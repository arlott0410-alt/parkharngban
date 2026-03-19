import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ======================================
  // Protect /admin routes
  // ======================================
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

    const adminSession = request.cookies.get("admin_session")?.value;

    if (!adminSession || adminSession !== adminTelegramId) {
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
