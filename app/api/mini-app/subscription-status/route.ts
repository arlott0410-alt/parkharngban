import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";

/**
 * GET — ກວດສະຖານະ subscription ຫຼັງຊຳລະ (ປຸ່ມ "ກວດສອບສະຖານະ" ໃນ Mini App)
 * ບໍ່ເອີ້ນ Phajay — ອ່ານຈາກ Supabase ຢ່າງດຽວ.
 */
export async function GET(request: NextRequest) {
  const ts = new Date().toISOString();
  const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
  const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

  if (!valid || !initData?.user) {
    console.warn(`[subscription-status] ${ts} Unauthorized`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = initData.user.id;
  const supabase = createAdminClient();

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("id, status, started_at, expiry_date, payment_ref, amount_lak, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[subscription-status] ${ts} supabase error`, error.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  console.log(`[subscription-status] ${ts} user=${userId} status=${sub?.status ?? "none"}`);

  return NextResponse.json({
    ok: true,
    subscription: sub ?? null,
  });
}
