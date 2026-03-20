import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import { createPhajaySubscriptionQr, getSubscriptionAmountLak } from "@/lib/phajay";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
    const { valid, data: initData } = await validateTelegramInitData(initDataRaw);

    if (!valid || !initData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(initData.user.id);
    const numericUserId = Number.parseInt(userId, 10);
    const nowIso = new Date().toISOString();
    const supabase = createAdminClient();

    const { data: activeSubscription, error: activeCheckError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", numericUserId)
      .eq("status", "active")
      .gt("expiry_date", nowIso)
      .maybeSingle();

    if (activeCheckError) {
      console.error("renew-subscription active check error:", activeCheckError);
      return NextResponse.json({ error: "ລະບົບກວດສອບ subscription ຂັດຂ້ອງ" }, { status: 500 });
    }

    if (activeSubscription) {
      return NextResponse.json({ error: "ມີ subscription ແອກທິບຢູ່ແລ້ວ" }, { status: 409 });
    }

    const amount = getSubscriptionAmountLak();
    const { qrCode, link, transactionId } = await createPhajaySubscriptionQr({
      userId,
      amountLak: amount,
    });

    const { error: insertError } = await supabase.from("subscriptions").insert({
      user_id: numericUserId,
      amount_lak: amount,
      payment_ref: transactionId,
      status: "inactive",
      created_at: nowIso,
    });

    if (insertError) {
      console.error("renew-subscription insert error:", insertError);
      return NextResponse.json({ error: "ບໍ່ສາມາດບັນທຶກການຊຳລະໄດ້" }, { status: 500 });
    }

    return NextResponse.json({ qrCode, link, transactionId });
  } catch (error) {
    console.error("renew-subscription error:", error);
    return NextResponse.json(
      { error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່" },
      { status: 500 }
    );
  }
}
