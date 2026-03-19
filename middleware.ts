import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ======================================
  // Protect /admin routes
  // ======================================
  if (pathname.startsWith("/admin")) {
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

    // Check admin session cookie
    const adminSession = request.cookies.get("admin_session")?.value;

    if (!adminSession || adminSession !== adminTelegramId) {
      // Redirect to admin login page
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
