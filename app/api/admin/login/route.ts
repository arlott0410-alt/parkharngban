import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionToken, getAdminSessionCookieName } from "@/lib/admin-auth";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

export const runtime = "edge";

function sanitizeRedirectTarget(value: string | undefined): string {
  if (!value) return "/admin";
  if (!value.startsWith("/")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (!value.startsWith("/admin")) return "/admin";
  return value;
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rl = checkRateLimit(`admin-login:${ip}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts" },
      { status: 429, headers: { "Retry-After": Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString() } }
    );
  }

  const formData = await request.formData();
  const telegramId = formData.get("telegram_id")?.toString().trim();
  const redirectTo = sanitizeRedirectTarget(formData.get("redirect")?.toString());

  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) {
    return NextResponse.json({ error: "Admin auth not configured" }, { status: 503 });
  }

  if (!telegramId || telegramId !== adminId) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("error", "invalid");
    loginUrl.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  const sessionToken = await createAdminSessionToken(adminId);
  if (!sessionToken) {
    return NextResponse.json({ error: "Admin session secret not configured" }, { status: 503 });
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  // Set secure cookie
  response.cookies.set(getAdminSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return response;
}
