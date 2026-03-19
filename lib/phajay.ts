import type {
  PhajayCreatePaymentRequest,
  PhajayCreatePaymentResponse,
  PhajayWebhookPayload,
} from "@/types";
import { generateOrderId } from "@/lib/utils";

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

// ======================================
// Phajay Payment Gateway Client
// ======================================

const PHAJAY_API_URL = process.env.PHAJAY_API_URL ?? "https://api.phajay.co";
const PHAJAY_SECRET_KEY = process.env.PHAJAY_SECRET_KEY ?? "";
const PHAJAY_MERCHANT_ID = process.env.PHAJAY_MERCHANT_ID ?? "";
const SUBSCRIPTION_PRICE_LAK = parseInt(process.env.SUBSCRIPTION_PRICE_LAK ?? "30000", 10);
const SUBSCRIPTION_DURATION_DAYS = parseInt(process.env.SUBSCRIPTION_DURATION_DAYS ?? "30", 10);

// ======================================
// Create Payment Link for Subscription
// ======================================

export async function createSubscriptionPayment(
  userId: number,
  userFirstName: string
): Promise<PhajayCreatePaymentResponse> {
  try {
    const orderId = generateOrderId(userId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    const payload: PhajayCreatePaymentRequest = {
      amount: SUBSCRIPTION_PRICE_LAK,
      order_id: orderId,
      description: `ປ້າຂ້າງບ້ານ — ຄ່າສະມາຊິກ ${SUBSCRIPTION_DURATION_DAYS} ວັນ`,
      customer_name: userFirstName,
      redirect_url: `${appUrl}/profile?payment=success`,
      webhook_url: `${appUrl}/api/phajay/webhook`,
    };

    const signature = await generatePhajaySignature(payload);

    const response = await fetch(`${PHAJAY_API_URL}/v1/payments/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-ID": PHAJAY_MERCHANT_ID,
        "X-Signature": signature,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Phajay API error:", errorText);
      return {
        success: false,
        error: `Payment gateway error: ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      payment_url?: string;
      transaction_id?: string;
      error?: string;
    };

    if (!data.payment_url) {
      return {
        success: false,
        error: data.error ?? "No payment URL returned",
      };
    }

    return {
      success: true,
      payment_url: data.payment_url,
      transaction_id: data.transaction_id,
    };
  } catch (error) {
    console.error("createSubscriptionPayment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ======================================
// Verify Phajay Webhook Signature
// ======================================

export async function verifyPhajayWebhook(payload: PhajayWebhookPayload): Promise<boolean> {
  if (!PHAJAY_SECRET_KEY) {
    console.warn("PHAJAY_SECRET_KEY not set — skipping webhook verification");
    return true;
  }

  const { signature, ...data } = payload;

  // Build canonical string (sorted keys)
  const keys = Object.keys(data).sort();
  const canonicalString = keys
    .map((k) => `${k}=${data[k as keyof typeof data] ?? ""}`)
    .join("&");

  const expected = await hmacSha256Hex(PHAJAY_SECRET_KEY, canonicalString);

  return expected === signature;
}

// ======================================
// Generate Request Signature
// ======================================

async function generatePhajaySignature(payload: PhajayCreatePaymentRequest): Promise<string> {
  const data = JSON.stringify(payload);
  return hmacSha256Hex(PHAJAY_SECRET_KEY, data);
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
