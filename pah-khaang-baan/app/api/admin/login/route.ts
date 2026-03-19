import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const telegramId = formData.get("telegram_id")?.toString().trim();
  const redirectTo = formData.get("redirect")?.toString() ?? "/admin";

  const adminId = process.env.ADMIN_TELEGRAM_ID;

  if (!telegramId || telegramId !== adminId) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("error", "invalid");
    loginUrl.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  // Set secure cookie
  response.cookies.set("admin_session", adminId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
