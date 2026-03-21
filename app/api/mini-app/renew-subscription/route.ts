import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase";
import {
  createPhajaySubscriptionQr,
  getSubscriptionAmountLakForPlan,
} from "@/lib/phajay";
import {
  parseSubscriptionPlanId,
  SUBSCRIPTION_PLANS,
  getDurationDaysForPlan,
} from "@/lib/subscription-plans";
import { upsertPendingPhajayPayment } from "@/lib/subscription-pending";

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

    let planId = parseSubscriptionPlanId("1m");
    try {
      const body = (await request.json()) as { plan?: string };
      if (body?.plan) {
        planId = parseSubscriptionPlanId(body.plan);
      }
    } catch {
      // no body
    }

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

    const amount = getSubscriptionAmountLakForPlan(planId);
    const planMeta = SUBSCRIPTION_PLANS[planId];
    const phajayResult = await createPhajaySubscriptionQr({
      userId,
      planId,
    });

    const { error: saveError } = await upsertPendingPhajayPayment(supabase, {
      userId: numericUserId,
      amountLak: amount,
      paymentRef: phajayResult.transactionId,
      nowIso,
      paymentDetails: {
        plan: planId,
        duration_days: getDurationDaysForPlan(planId),
        months_charged: planMeta.monthsCharged,
        months_covered: planMeta.monthsCovered,
      },
    });

    if (saveError) {
      console.error("renew-subscription save pending error:", saveError);
      return NextResponse.json({ error: "ບໍ່ສາມາດບັນທຶກການຊຳລະໄດ້" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      qr_image_url: phajayResult.qr_image_url,
      qr_data: phajayResult.qr_data,
      transaction_id: phajayResult.transactionId,
      link: phajayResult.link,
      qrCode: phajayResult.qrCode,
      amount_lak: amount,
      transactionId: phajayResult.transactionId,
    });
  } catch (error) {
    console.error("renew-subscription error:", error);
    return NextResponse.json(
      { error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່" },
      { status: 500 }
    );
  }
}
