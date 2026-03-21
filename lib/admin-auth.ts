import type { NextRequest } from "next/server";

/** ກວດ cookie admin_session ກົງກັບ ADMIN_TELEGRAM_ID */
export function isAdminRequest(request: NextRequest): boolean {
  const session = request.cookies.get("admin_session")?.value;
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  return Boolean(session && adminId && session === adminId);
}
