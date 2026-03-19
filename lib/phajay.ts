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

const PHAJAY_API_URL = process.env.PHAJAY_API_URL ?? "https://payment-gateway.phajay.co/v1/api";
const PHAJAY_SECRET_KEY = process.env.PHAJAY_SECRET_KEY ?? "";
const PHAJAY_WEBHOOK_SECRET = process.env.PHAJAY_WEBHOOK_SECRET ?? "";
const PHAJAY_MERCHANT_ID = process.env.PHAJAY_MERCHANT_ID ?? "";
const PHAJAY_MODE = process.env.PHAJAY_MODE ?? "";
const SUBSCRIPTION_PRICE_LAK = parseInt(process.env.SUBSCRIPTION_PRICE_LAK ?? "30000", 10);
const SUBSCRIPTION_DURATION_DAYS = parseInt(process.env.SUBSCRIPTION_DURATION_DAYS ?? "30", 10);
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

export function isPhajayTestMode(): boolean {
  return PHAJAY_MODE.toLowerCase() === "test" || PHAJAY_SECRET_KEY.toLowerCase().includes("test");
}

export function getSubscriptionAmountLak(): number {
  if (isPhajayTestMode()) {
    return 1;
  }
  return SUBSCRIPTION_PRICE_LAK;
}

export async function createPhajayPaymentLink(
  userId: string,
  amount: number
): Promise<{ payment_url: string; reference: string }> {
  if (!PHAJAY_SECRET_KEY) {
    throw new Error("PHAJAY_SECRET_KEY is not set");
  }
  if (!APP_URL) {
    throw new Error("APP_URL is not set");
  }

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

  const response = await fetch(`${PHAJAY_API_URL}/link/payment-link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PHAJAY_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Phajay create link failed:", response.status, errorBody);
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

export async function verifyPhajayWebhookSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  if (!PHAJAY_WEBHOOK_SECRET) {
    return true;
  }
  if (!signature) {
    return false;
  }
  const expected = await hmacSha256Hex(PHAJAY_WEBHOOK_SECRET, rawBody);
  return expected.toLowerCase() === signature.toLowerCase();
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
