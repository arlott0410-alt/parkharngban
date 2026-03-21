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
import {
  buildStoredBcelPayload,
  buildSubscriptionQrApiPayload,
  computeQrCodeUrlFromPhajayResult,
  tryGetCachedBcelForPlan,
} from "@/lib/subscription-bcel-cache";

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

    const { data: pendingRow, error: pendingFetchError } = await supabase
      .from("subscriptions")
      .select("status, payment_ref, payment_details, updated_at")
      .eq("user_id", numericUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingFetchError) {
      console.error("renew-subscription pending row fetch error:", pendingFetchError);
      return NextResponse.json({ error: "ລະບົບກວດສອບ subscription ຂັດຂ້ອງ" }, { status: 500 });
    }

    const cached = tryGetCachedBcelForPlan(
      pendingRow?.status,
      pendingRow?.payment_details,
      planId,
      pendingRow?.updated_at ?? null
    );

    if (cached) {
      const payload = buildSubscriptionQrApiPayload({
        qrCodeUrl: cached.qrCodeUrl,
        deepLink: cached.deepLink,
        transactionId: cached.transactionId,
        amount: cached.amountLak || amount,
        qr_image_url: null,
        qr_data: null,
        qrCode: null,
        link: cached.deepLink,
        pendingSaveFailed: false,
        qrFromCache: true,
      });

      console.log("[renew-subscription] returning cached BCEL QR (cooldown)", {
        userId: numericUserId,
        planId,
        transactionId: cached.transactionId,
      });

      return NextResponse.json(payload);
    }

    const phajayResult = await createPhajaySubscriptionQr({
      userId,
      planId,
    });

    const storedBcel = buildStoredBcelPayload(phajayResult, amount, nowIso);

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
        bcel: storedBcel,
      },
    });

    const qrCodeUrl = computeQrCodeUrlFromPhajayResult(phajayResult);

    const payload = buildSubscriptionQrApiPayload({
      qrCodeUrl,
      deepLink: phajayResult.link,
      transactionId: phajayResult.transactionId,
      amount,
      qr_image_url: phajayResult.qr_image_url,
      qr_data: phajayResult.qr_data,
      qrCode: phajayResult.qrCode,
      link: phajayResult.link,
      pendingSaveFailed: Boolean(saveError),
      qrFromCache: false,
    });

    if (saveError) {
      console.error("renew-subscription save pending error (still returning QR):", saveError);
    }

    console.log("[renew-subscription] Phajay OK", {
      transactionId: phajayResult.transactionId,
      hasQrCodeUrl: Boolean(qrCodeUrl),
      amount,
      pendingSaveFailed: payload.pendingSaveFailed,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("renew-subscription error:", error);
    return NextResponse.json(
      { error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່" },
      { status: 500 }
    );
  }
}
