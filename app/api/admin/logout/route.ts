import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName } from "@/lib/admin-auth";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.delete(getAdminSessionCookieName());
  return response;
}
