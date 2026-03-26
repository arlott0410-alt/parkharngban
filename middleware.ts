import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName, validateAdminSessionToken } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ======================================
  // Protect /admin routes
  // ======================================
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminSession = request.cookies.get(getAdminSessionCookieName())?.value;
    const allowed = await validateAdminSessionToken(adminSession);
    if (!allowed) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
  ],
};
