import { NextRequest, NextResponse } from "next/server";
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
    const body = (await request.json()) as { user_id?: string; plan?: string };
    const userId = (body.user_id ?? "").trim();
    const planId = parseSubscriptionPlanId(body.plan);

    if (!userId) {
      return NextResponse.json({ error: "ບໍ່ພົບ user id" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const numericUserId = Number.parseInt(userId, 10);

    if (Number.isNaN(numericUserId)) {
      return NextResponse.json({ error: "user id ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const { data: activeSubscription, error: activeCheckError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", numericUserId)
      .eq("status", "active")
      .gt("expiry_date", nowIso)
      .maybeSingle();

    if (activeCheckError) {
      console.error("create-subscription active check error:", activeCheckError);
      return NextResponse.json({ error: "ລະບົບກວດສອບ subscription ຂັດຂ້ອງ" }, { status: 500 });
    }

    if (activeSubscription) {
      return NextResponse.json({ error: "ມີ subscription ແອກທິບຢູ່ແລ້ວ" }, { status: 409 });
    }

    const amount = getSubscriptionAmountLakForPlan(planId);
    const planMeta = SUBSCRIPTION_PLANS[planId];
    const { qrCode, link, transactionId } = await createPhajaySubscriptionQr({
      userId,
      planId,
    });

    const { error: saveError } = await upsertPendingPhajayPayment(supabase, {
      userId: numericUserId,
      amountLak: amount,
      paymentRef: transactionId,
      nowIso,
      paymentDetails: {
        plan: planId,
        duration_days: getDurationDaysForPlan(planId),
        months_charged: planMeta.monthsCharged,
        months_covered: planMeta.monthsCovered,
      },
    });

    if (saveError) {
      console.error("create-subscription save pending error:", saveError);
      return NextResponse.json({ error: "ບໍ່ສາມາດບັນທຶກການຊຳລະໄດ້" }, { status: 500 });
    }

    return NextResponse.json({
      qrCode,
      link,
      transactionId,
    });
  } catch (error) {
    console.error("create-subscription error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່",
      },
      { status: 500 }
    );
  }
}
