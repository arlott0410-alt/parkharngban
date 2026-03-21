/**
 * Phajay — ຊຳລະເງິນກີບ (LAK) ຜ່ານເກດເວຍ; ອາຍຸສະມາຊິກໃນແອັບກຳນົດຝັ່ງເຮົາ (webhook + Supabase).
 *
 * - ໂໝດ Test/Production: `PHAJAY_MODE` + keys ໃນ `lib/phajay-env.ts`
 * @see docs/PHAJAY.md
 */
import {
  type SubscriptionPlanId,
  SUBSCRIPTION_PLANS,
  getDurationDaysForPlan,
} from "@/lib/subscription-plans";
import {
  getPhajayApiBaseUrl,
  getPhajayApiSecretKey,
  getPhajayMode,
  getPhajayWebhookSecret,
  isPhajayProductionMode,
  isPhajayTestMode,
  phajayLog,
} from "@/lib/phajay-env";

export {
  getPhajayMode,
  isPhajayProductionMode,
  isPhajayTestMode,
  phajayLog,
  redactTransactionId,
} from "@/lib/phajay-env";
export type { PhajayRuntimeMode } from "@/lib/phajay-env";

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(key) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    textEncoder.encode(data) as BufferSource
  );
  return toHex(new Uint8Array(signature));
}

const PHAJAY_MERCHANT_ID = process.env.PHAJAY_MERCHANT_ID ?? "";
const SUBSCRIPTION_PRICE_LAK = parseInt(process.env.SUBSCRIPTION_PRICE_LAK ?? "30000", 10);
const SUBSCRIPTION_DURATION_DAYS = parseInt(process.env.SUBSCRIPTION_DURATION_DAYS ?? "30", 10);
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

export function getSubscriptionAmountLak(): number {
  if (isPhajayTestMode()) {
    return 1;
  }
  return SUBSCRIPTION_PRICE_LAK;
}

/** ລາຄາຕໍ່ເດືອນ (ຈາກ env) — ສຳລັບສະແດງ */
export function getSubscriptionPriceLak(): number {
  return SUBSCRIPTION_PRICE_LAK;
}

export function getSubscriptionAmountLakForPlan(planId: SubscriptionPlanId): number {
  const def = SUBSCRIPTION_PLANS[planId];
  if (isPhajayTestMode()) {
    return 1;
  }
  return SUBSCRIPTION_PRICE_LAK * def.monthsCharged;
}

export type SubscriptionPlanDisplay = {
  id: SubscriptionPlanId;
  label: string;
  promo?: string;
  amount_lak: number;
  duration_days: number;
  months_covered: number;
  months_charged: number;
};

export function getSubscriptionPlansForDisplay(): SubscriptionPlanDisplay[] {
  const ids: SubscriptionPlanId[] = ["1m", "6m", "12m"];
  return ids.map((id) => {
    const def = SUBSCRIPTION_PLANS[id];
    return {
      id,
      label: def.labelLo,
      promo: def.promoLo,
      amount_lak: getSubscriptionAmountLakForPlan(id),
      duration_days: getDurationDaysForPlan(id),
      months_covered: def.monthsCovered,
      months_charged: def.monthsCharged,
    };
  });
}

/**
 * ຂໍ້ຄວາມໃບບິນ/QR — ບອກຊຸດສິນຄ້າເທົ່ານັ້ນ
 * ອາຍຸການໃຊ້ງານຈິງຢູ່ຝັ່ງເຮົາ (payment_details + webhook) ບໍ່ແມ່ນ Phajay
 */
function buildSubscriptionQrDescription(planId: SubscriptionPlanId): string {
  const def = SUBSCRIPTION_PLANS[planId];
  if (planId === "1m") {
    return "ປ້າຂ້າງບ້ານ — ສະມາຊິກ 1 ເດືອນ";
  }
  const promo = def.promoLo ? ` (${def.promoLo})` : "";
  return `ປ້າຂ້າງບ້ານ — ສະມາຊິກ ${def.labelLo}${promo}`;
}

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function createPhajaySubscriptionQr(params: {
  userId: string;
  planId?: SubscriptionPlanId;
}): Promise<{ qrCode: string; link: string; transactionId: string }> {
  const secretKey = getPhajayApiSecretKey();
  if (!secretKey) {
    const mode = getPhajayMode();
    throw new Error(
      mode === "test"
        ? "ຕັ້ງ PHAJAY_SECRET_KEY_TEST ຫຼື PHAJAY_SECRET_KEY (test)"
        : "ຕັ້ງ PHAJAY_SECRET_KEY_PRODUCTION ຫຼື PHAJAY_SECRET_KEY"
    );
  }

  const planId: SubscriptionPlanId = params.planId ?? "1m";
  const finalAmount = getSubscriptionAmountLakForPlan(planId);
  const baseUrl = getPhajayApiBaseUrl();

  const subscriptionDate = toYYYYMMDD(new Date()); // make debit happen immediately (and avoid setup webhook "no response" note)

  // Phajay = ຊຳລະເງິນເທົ່ານັ້ນ — ຄ່ານີ້ແມ່ນພາລາມິເຕີຂອງເກດເວຍ (ຮອບຕໍ່ໄປຕາມສັນຍາ BCEL) ບໍ່ແມ່ນອາຍຸໃຊ້ງານໃນແອັບ
  const payload = {
    maxAmount: finalAmount,
    subscriptionDate,
    resubscriptionDays: SUBSCRIPTION_DURATION_DAYS,
    description: buildSubscriptionQrDescription(planId),
  };

  phajayLog("info", "generate-bcel-qr request", {
    endpoint: `${baseUrl}/subscription/generate-bcel-qr`,
    planId,
    maxAmount: finalAmount,
  });

  const response = await fetch(`${baseUrl}/subscription/generate-bcel-qr`, {
    method: "POST",
    headers: {
      secretKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    phajayLog("error", "generate-bcel-qr failed", {
      status: response.status,
      body: errorBody.slice(0, 500),
    });
    throw new Error("ບໍ່ສາມາດສ້າງ QR ການຊຳລະໄດ້ ກະລຸນາລອງໃໝ່");
  }

  const data = (await response.json()) as {
    qrCode?: string;
    link?: string;
    transactionID?: string;
    transactionId?: string;
    transactionIDString?: string;
    message?: string;
  };

  const qrCode = data.qrCode ?? "";
  const link = data.link ?? "";
  const transactionId = data.transactionID ?? data.transactionId ?? "";

  if (!qrCode || !link || !transactionId) {
    console.error("Phajay generate QR response missing fields:", data);
    throw new Error("Phajay ຕອບກັບຂໍ້ມູນບໍ່ຄົບຖ້ວນ");
  }

  return { qrCode, link, transactionId };
}

export async function createPhajayPaymentLink(
  userId: string,
  amount: number
): Promise<{ payment_url: string; reference: string }> {
  const secretKey = getPhajayApiSecretKey();
  if (!secretKey) {
    throw new Error("Phajay API secret not configured (see PHAJAY_SECRET_KEY_TEST / PHAJAY_SECRET_KEY)");
  }
  if (!APP_URL) {
    throw new Error("APP_URL is not set");
  }

  const baseUrl = getPhajayApiBaseUrl();
  const reference = `sub_${userId}_${Date.now()}`;
  const successUrl = `${APP_URL}/payment/success?ref=${encodeURIComponent(reference)}`;
  const cancelUrl = `${APP_URL}/payment/cancel`;
  const webhookUrl = `${APP_URL}/api/phajay/webhook`;
  const finalAmount = isPhajayTestMode() ? 1 : amount;

  const payload: Record<string, unknown> = {
    amount: finalAmount,
    currency: "LAK",
    description: "ສະມັກບ້ານປາກຫັງ 30 ວັນ",
    reference,
    success_url: successUrl,
    cancel_url: cancelUrl,
    webhook_url: webhookUrl,
  };

  if (PHAJAY_MERCHANT_ID) {
    payload.merchant_id = PHAJAY_MERCHANT_ID;
  }

  const response = await fetch(`${baseUrl}/link/payment-link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    phajayLog("error", "payment-link failed", { status: response.status, body: errorBody.slice(0, 500) });
    throw new Error("ບໍ່ສາມາດເຊື່ອມຕໍ່ Phajay ໄດ້ ກະລຸນາລອງໃໝ່");
  }

  const data = (await response.json()) as {
    payment_url?: string;
    link?: string;
  };

  const paymentUrl = data.payment_url ?? data.link;
  if (!paymentUrl) {
    console.error("Phajay response missing payment URL:", data);
    throw new Error("ບໍ່ສາມາດສ້າງລິ້ງຊຳລະເງິນໄດ້");
  }

  return {
    payment_url: paymentUrl,
    reference,
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

export type PhajayWebhookVerifyResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: string };

/**
 * ກວດ HMAC ຂອງ raw body ກັບ x-phajay-signature (hex SHA-256).
 * - Production: ຕ້ອງມີ PHAJAY_WEBHOOK_SECRET*
 * - Test: ຕັ້ງ secret ຫຼື PHAJAY_ALLOW_UNSIGNED_WEBHOOKS=true (ທົດສອບເທົ່ານັ້ນ)
 */
export async function verifyPhajayWebhookSignature(
  rawBody: string,
  signature: string | null
): Promise<PhajayWebhookVerifyResult> {
  const secret = getPhajayWebhookSecret();
  const allowUnsigned =
    getPhajayMode() === "test" &&
    process.env.PHAJAY_ALLOW_UNSIGNED_WEBHOOKS === "true";

  if (!secret) {
    if (isPhajayProductionMode()) {
      phajayLog("error", "webhook: missing webhook secret in production");
      return { ok: false, status: 503, reason: "webhook_secret_not_configured" };
    }
    if (allowUnsigned) {
      phajayLog("warn", "webhook: accepting unsigned (PHAJAY_ALLOW_UNSIGNED_WEBHOOKS=true, test only)");
      return { ok: true };
    }
    phajayLog("error", "webhook: set PHAJAY_WEBHOOK_SECRET_TEST or PHAJAY_ALLOW_UNSIGNED_WEBHOOKS=true");
    return { ok: false, status: 503, reason: "webhook_secret_not_configured" };
  }

  if (!signature || !signature.trim()) {
    phajayLog("warn", "webhook: missing x-phajay-signature header");
    return { ok: false, status: 401, reason: "missing_signature" };
  }

  const expected = await hmacSha256Hex(secret, rawBody);
  if (!timingSafeEqualHex(expected, signature.trim())) {
    phajayLog("warn", "webhook: signature mismatch");
    return { ok: false, status: 401, reason: "invalid_signature" };
  }

  return { ok: true };
}

export function isSuccessfulPhajayStatus(status: string | undefined): boolean {
  if (!status) return false;
  const value = status.toLowerCase();
  return value === "success" || value === "completed";
}

// ======================================
// Calculate new expiry date
// ======================================

export function calculateNewExpiry(currentExpiry?: string | null): Date {
  const base =
    currentExpiry && new Date(currentExpiry) > new Date()
      ? new Date(currentExpiry) // Extend from current expiry if still active
      : new Date(); // Start from today if expired

  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + SUBSCRIPTION_DURATION_DAYS);
  return newExpiry;
}

// ======================================
// Get subscription price display
// ======================================

export function getSubscriptionPriceDisplay(): string {
  return new Intl.NumberFormat("lo-LA").format(SUBSCRIPTION_PRICE_LAK) + " ກີບ/ເດືອນ";
}

// ======================================
// URLs ສຳລັບລົງທະບຽນໃນແຜງ Phajay (webhook)
// ======================================

function getAppBaseUrl(): string {
  return (APP_URL || "").replace(/\/$/, "");
}

/** URL ທີ່ຕ້ອງໃຫ້ Phajay ສົ່ງເຫດຊຳລະ subscription ສຳເລັດ — ຖ້າບໍ່ມີ APP_URL ຈະໄດ້ null */
export function getPhajayWebhookUrl(): string | null {
  const base = getAppBaseUrl();
  return base ? `${base}/api/phajay/webhook` : null;
}

/** URL ສຳລັບເຫດ SUBSCRIPTION_CONNECTED (ຖ້າ Phajay ແຍກ endpoint) */
export function getPhajaySubscriptionSetupWebhookUrl(): string | null {
  const base = getAppBaseUrl();
  return base ? `${base}/api/phajay/subscription-setup` : null;
}
