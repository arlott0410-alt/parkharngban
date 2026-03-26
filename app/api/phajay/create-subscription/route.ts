import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { validateTelegramInitData } from "@/lib/telegram";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
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
  const logTs = () => new Date().toISOString();
  try {
    const initDataRaw = request.headers.get("x-telegram-init-data") ?? "";
    const { valid, data: initData } = await validateTelegramInitData(initDataRaw);
    if (!valid || !initData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getRequestIp(request);
    const limiter = checkRateLimit(`create-subscription:${initData.user.id}:${ip}`, 8, 60 * 1000);
    if (!limiter.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json()) as { user_id?: string; plan?: string };
    const userId = String(initData.user.id);
    const planId = parseSubscriptionPlanId(body.plan);

    if ((body.user_id ?? "").toString().trim() && (body.user_id ?? "").toString().trim() !== userId) {
      return NextResponse.json({ error: "Forbidden user mismatch" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const numericUserId = Number.parseInt(userId, 10);

    if (Number.isNaN(numericUserId)) {
      return NextResponse.json({ error: "user id ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }

    console.log(`[create-subscription] ${logTs()} request`, { userId: numericUserId, plan: planId });

    const nowIso = new Date().toISOString();

    /** ກວດແຕ່ “ຊຳລະແລ້ວຍັງໃຊ້ງານ” — ຫຼັງ admin revoke ເປັນ expired ຈຶ່ງບໍ່ຕິດ 409; ລູກຄ້າສ້າງ QR ຊຳລະໃໝ່ໄດ້ */
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

    const { data: pendingRow, error: pendingFetchError } = await supabase
      .from("subscriptions")
      .select("status, payment_ref, payment_details, updated_at")
      .eq("user_id", numericUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingFetchError) {
      console.error("create-subscription pending row fetch error:", pendingFetchError);
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

      console.log("[create-subscription] returning cached BCEL QR (cooldown)", {
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

    /** ບັນທຶກ subscriptions: status=pending, payment_ref=transactionId, amount_lak — ລໍຖ້າ webhook ຫຼັງຊຳລະ */
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
      console.error("create-subscription save pending error (still returning QR):", saveError);
    }

    console.log("[create-subscription] Phajay OK, returning to client", {
      transactionId: phajayResult.transactionId,
      hasQrCodeUrl: Boolean(qrCodeUrl),
      hasDeepLink: Boolean(phajayResult.link),
      amount,
      pendingSaveFailed: payload.pendingSaveFailed,
    });

    return NextResponse.json(payload);
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
