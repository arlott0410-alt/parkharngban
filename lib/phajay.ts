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
/** Production: ລາຄາຕໍ່ 1 ເດືອນ (ກີບ) — ຄ່າເລີ່ມຕົ້ນກົງກັບ README / .env.example (50000) */
const SUBSCRIPTION_PRICE_LAK = parseInt(process.env.SUBSCRIPTION_PRICE_LAK ?? "50000", 10);
/**
 * Test/sandbox: ຍອດຕໍ່ເດືອນສຳລັບທັງ UI ແລະ maxAmount ສົ່ງ Phajay (ບໍ່ເກີນ limit ທົດລອງ)
 * @see SUBSCRIPTION_TEST_AMOUNT ໃນ .env.example
 */
const SUBSCRIPTION_TEST_AMOUNT = parseInt(process.env.SUBSCRIPTION_TEST_AMOUNT ?? "500", 10);
const SUBSCRIPTION_DURATION_DAYS = parseInt(process.env.SUBSCRIPTION_DURATION_DAYS ?? "30", 10);
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

/** ລາຄາຕໍ່ 1 ເດືອນຕາມໂໝດ — test ໃຊ້ SUBSCRIPTION_TEST_AMOUNT, production ໃຊ້ SUBSCRIPTION_PRICE_LAK */
function getMonthlyPriceLak(): number {
  return isPhajayTestMode() ? SUBSCRIPTION_TEST_AMOUNT : SUBSCRIPTION_PRICE_LAK;
}

export function getSubscriptionAmountLak(): number {
  return getMonthlyPriceLak();
}

/** ລາຄາຕໍ່ເດືອນ (ຈາກ env) — ສຳລັບສະແດງ */
export function getSubscriptionPriceLak(): number {
  return getMonthlyPriceLak();
}

export function getSubscriptionAmountLakForPlan(planId: SubscriptionPlanId): number {
  const def = SUBSCRIPTION_PLANS[planId];
  return getMonthlyPriceLak() * def.monthsCharged;
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

/**
 * Basic Auth ແບບ Phajay docs: `Buffer.from(key + ':').toString('base64')`
 * ໃຊ້ btoa ເພື່ອຮອງຮັບ Edge runtime (ບໍ່ມີ Node Buffer)
 */
function phajayBasicAuthHeader(secretKey: string): string {
  return `Basic ${btoa(`${secretKey}:`)}`;
}

export type PhajayBcelQrResult = {
  transactionId: string;
  link: string;
  qrCode: string;
  qr_image_url: string | null;
  qr_data: string | null;
  amount_lak: number;
};

function unwrapPhajayJson(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.data && typeof raw.data === "object" && raw.data !== null) {
    return raw.data as Record<string, unknown>;
  }
  return raw;
}

function normalizeBcelQrPayload(
  data: Record<string, unknown>,
  amount_lak: number
): PhajayBcelQrResult {
  const transactionId = String(
    data.transactionID ?? data.transactionId ?? data.transaction_id ?? ""
  );
  const link = String(
    data.link ?? data.payment_url ?? data.paymentUrl ?? data.url ?? ""
  );
  const qr_data = data.qr_data ?? data.qrData ?? null;
  /** Phajay ສົ່ງ qrCode ເປັນ URL ຮູບ QR (ເຊັນ qrserver.com) ຫຼື base64 — ສຳຄັນຕໍ່ການສະແດງໃນ <img> */
  let qrCode = String(data.qrCode ?? data.qr_code ?? "");
  if (!qrCode && qr_data) {
    qrCode = String(qr_data);
  }
  let qr_image_url = data.qr_image_url ?? data.qrImageUrl ?? data.image_url ?? null;
  if (!qr_image_url && qrCode && /^https?:\/\//i.test(qrCode.trim())) {
    qr_image_url = qrCode.trim();
  }
  return {
    transactionId,
    link,
    qrCode,
    qr_image_url: qr_image_url != null ? String(qr_image_url) : null,
    qr_data: qr_data != null ? String(qr_data) : null,
    amount_lak,
  };
}

function bcelResultIsUsable(r: PhajayBcelQrResult): boolean {
  return Boolean(
    r.transactionId && (r.link || r.qr_image_url || r.qrCode || r.qr_data)
  );
}

/**
 * Fallback: ເກົ່າເຄີຍໃຊ້ header `secretKey` + maxAmount/subscriptionDate/resubscriptionDays
 * ຖ້າ Basic + body ໃໝ່ບໍ່ຖືກຕ້ອງກັບເກດເວຍລຸ້ນເກົ່າ
 */
async function createPhajaySubscriptionQrLegacy(params: {
  planId: SubscriptionPlanId;
  amountLak: number;
}): Promise<PhajayBcelQrResult> {
  const secretKey = getPhajayApiSecretKey();
  const baseUrl = getPhajayApiBaseUrl();
  const subscriptionDate = toYYYYMMDD(new Date());
  const payload = {
    maxAmount: params.amountLak,
    subscriptionDate,
    resubscriptionDays: SUBSCRIPTION_DURATION_DAYS,
    description: buildSubscriptionQrDescription(params.planId),
  };

  phajayLog("info", "Phajay BCEL legacy request", {
    endpoint: `${baseUrl}/subscription/generate-bcel-qr`,
    planId: params.planId,
    maxAmount: params.amountLak,
  });

  const response = await fetch(`${baseUrl}/subscription/generate-bcel-qr`, {
    method: "POST",
    headers: {
      secretKey: secretKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  phajayLog("info", "Phajay BCEL legacy response", {
    status: response.status,
    bodyPreview: text.slice(0, 1200),
  });

  if (!response.ok) {
    throw new Error("ບໍ່ສາມາດສ້າງ QR ການຊຳລະໄດ້ ກະລຸນາລອງໃໝ່");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Phajay ຕອບບໍ່ແມ່ນ JSON");
  }
  const data = unwrapPhajayJson(parsed);
  const normalized = normalizeBcelQrPayload(data, params.amountLak);
  if (!bcelResultIsUsable(normalized)) {
    throw new Error("Phajay ຕອບກັບຂໍ້ມູນບໍ່ຄົບຖ້ວນ");
  }
  console.log("[phajay] BCEL legacy OK", {
    transactionId: normalized.transactionId,
    qrCodeIsUrl: /^https?:\/\//i.test(normalized.qrCode?.trim() ?? ""),
    hasLink: Boolean(normalized.link),
    amountLak: params.amountLak,
  });
  return normalized;
}

/**
 * POST /subscription/generate-bcel-qr
 *
 * ລຸ້ນໃໝ່ (ຕາມ Phajay): Authorization Basic, body { amount, duration_months, reference, callback_url }
 * ຖ້າບໍ່ສຳເລັດ ຫຼືຂາດ QR — ລອງ legacy secretKey (ຫຼາຍ merchant ຍັງໃຊ້ຢູ່)
 */
export async function createPhajaySubscriptionQr(params: {
  userId: string;
  planId?: SubscriptionPlanId;
}): Promise<PhajayBcelQrResult> {
  const secretKey = getPhajayApiSecretKey();
  if (!secretKey) {
    const mode = getPhajayMode();
    throw new Error(
      mode === "test"
        ? "ຕັ້ງ PHAJAY_SECRET_KEY_TEST ຫຼື PHAJAY_SECRET_KEY (test)"
        : "ຕັ້ງ PHAJAY_SECRET_KEY_PRODUCTION ຫຼື PHAJAY_SECRET_KEY"
    );
  }

  const appBase = APP_URL?.trim();
  if (!appBase) {
    throw new Error("APP_URL is not set — ຕ້ອງມີເພື່ອ callback_url");
  }

  const planId: SubscriptionPlanId = params.planId ?? "1m";
  const amountLak = getSubscriptionAmountLakForPlan(planId);
  const durationMonths = SUBSCRIPTION_PLANS[planId].monthsCovered;
  const reference = `${params.userId}_${Date.now()}`;
  const callbackUrl = `${appBase.replace(/\/$/, "")}/api/phajay/webhook`;
  const baseUrl = getPhajayApiBaseUrl();
  const endpoint = `${baseUrl}/subscription/generate-bcel-qr`;

  if (isPhajayTestMode()) {
    phajayLog("warn", "PHAJAY_MODE=test — ຍອດຈາກ SUBSCRIPTION_TEST_AMOUNT × ເດືອນທີ່ຈ່າຍ (default 500)", {
      amountLak,
      durationMonths,
      reference,
    });
  }

  const bodyNew = {
    amount: amountLak,
    duration_months: durationMonths,
    reference,
    callback_url: callbackUrl,
  };

  phajayLog("info", "Phajay BCEL request (Basic + amount/duration_months)", {
    endpoint,
    body: bodyNew,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: phajayBasicAuthHeader(secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyNew),
  });

  const text = await response.text();
  phajayLog("info", "Phajay BCEL primary response", {
    status: response.status,
    bodyPreview: text.slice(0, 1200),
  });

  if (response.ok) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const data = unwrapPhajayJson(parsed);
      const normalized = normalizeBcelQrPayload(data, amountLak);
      if (bcelResultIsUsable(normalized)) {
        console.log("[phajay] BCEL primary OK", {
          transactionId: normalized.transactionId,
          qrCodeIsUrl: /^https?:\/\//i.test(normalized.qrCode?.trim() ?? ""),
          hasLink: Boolean(normalized.link),
          amountLak,
        });
        return normalized;
      }
      phajayLog("warn", "primary BCEL response missing QR/link — trying legacy");
    } catch (e) {
      phajayLog("error", "primary BCEL JSON parse failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    phajayLog("warn", "primary BCEL not OK — trying legacy secretKey payload", {
      status: response.status,
    });
  }

  return createPhajaySubscriptionQrLegacy({ planId, amountLak });
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
  /** test: ຍອດຈາກ SUBSCRIPTION_TEST_AMOUNT (default 500) — production: SUBSCRIPTION_PRICE_LAK (default 50000) */
  const finalAmount = isPhajayTestMode() ? getSubscriptionPriceLak() : amount;

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
  return new Intl.NumberFormat("lo-LA").format(getMonthlyPriceLak()) + " ກີບ/ເດືອນ";
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
