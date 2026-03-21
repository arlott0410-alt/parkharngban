import { NextRequest } from "next/server";
import {
  verifyPhajayWebhookSignature,
  redactTransactionId,
  phajayLog,
} from "@/lib/phajay";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";

/** ບໍ່ cache — ຮັບ webhook ແບບ dynamic */
export const dynamic = "force-dynamic";

const ACK_OK = new Response("OK", { status: 200 });

/**
 * ກວດວ່າ payload ຈາກ Phajay ແມ່ນເຫດຊຳລະ subscription ສຳເລັດ
 * (ຊື່ status ອາດຕ່າງກັນລະຫວ່າງ test/prod — ກວດຫຼາຍແບບ)
 */
function isPhajaySubscriptionSuccessStatus(statusRaw: string | undefined): boolean {
  const s = (statusRaw ?? "").toUpperCase();
  if (!s) return false;
  if (s.includes("SUBSCRIPTION_SUCCESS")) return true;
  if (s.includes("SUBSCRIPTION_DEBIT_SUCCESS")) return true;
  if (s.includes("DEBIT_SUCCESS") && s.includes("SUBSCRIPTION")) return true;
  return false;
}

export async function GET() {
  return new Response(JSON.stringify({ service: "phajay-webhook", method: "POST only" }), {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rawBody = await request.text();

    if (!rawBody || rawBody.length > 512 * 1024) {
      phajayLog("warn", "webhook: body empty or too large", { requestId, length: rawBody?.length ?? 0 });
      return new Response("Bad Request", { status: 400 });
    }

    const signature =
      request.headers.get("x-phajay-signature") ??
      request.headers.get("X-Phajay-Signature") ??
      request.headers.get("x-signature");

    const verified = await verifyPhajayWebhookSignature(rawBody, signature);
    if (!verified.ok) {
      phajayLog("warn", "webhook: verification failed", {
        requestId,
        reason: verified.reason,
        status: verified.status,
      });
      return new Response(
        JSON.stringify({ error: verified.reason }),
        { status: verified.status, headers: { "Content-Type": "application/json" } }
      );
    }

    let payload: {
      message?: string;
      status?: string;
      transactionId?: string;
      transactionID?: string;
      paymentTransactionId?: string;
      authCode?: string;
      time?: string;
      [key: string]: unknown;
    };

    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      phajayLog("error", "webhook: invalid JSON", { requestId });
      return new Response("Invalid JSON", { status: 400 });
    }

    const status = payload.status;
    if (!isPhajaySubscriptionSuccessStatus(status)) {
      phajayLog("info", "webhook: ignored (not subscription success)", {
        requestId,
        status: status ?? "(empty)",
      });
      return ACK_OK;
    }

    const transactionId = payload.transactionId ?? payload.transactionID;
    if (!transactionId || typeof transactionId !== "string") {
      phajayLog("error", "webhook: missing transactionId", { requestId, payloadKeys: Object.keys(payload) });
      return ACK_OK;
    }

    const startedAt = (() => {
      if (!payload.time) return new Date();
      const normalized = String(payload.time).replace(" ", "T");
      const d = new Date(normalized);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    })();

    const supabase = createAdminClient();

    const { data: pendingSub, error: pendingError } = await supabase
      .from("subscriptions")
      .select("id, payment_details")
      .eq("payment_ref", transactionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      phajayLog("error", "webhook: supabase select failed", {
        requestId,
        error: pendingError.message,
        transactionId: redactTransactionId(transactionId),
      });
      return ACK_OK;
    }

    if (!pendingSub?.id) {
      phajayLog("warn", "webhook: no pending subscription for transaction", {
        requestId,
        transactionId: redactTransactionId(transactionId),
      });
      return ACK_OK;
    }

    const details = pendingSub.payment_details as { duration_days?: number } | null;
    const durationDays =
      typeof details?.duration_days === "number" && details.duration_days > 0
        ? details.duration_days
        : parseInt(process.env.SUBSCRIPTION_DURATION_DAYS ?? "30", 10);

    const expiryDate = new Date(startedAt);
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        started_at: startedAt.toISOString(),
        expiry_date: expiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingSub.id);

    if (updateError) {
      phajayLog("error", "webhook: subscription update failed", {
        requestId,
        error: updateError.message,
        subscriptionId: pendingSub.id,
      });
      return ACK_OK;
    }

    phajayLog("info", "webhook: subscription activated", {
      requestId,
      subscriptionId: pendingSub.id,
      transactionId: redactTransactionId(transactionId),
      durationDays,
    });

    return ACK_OK;
  } catch (error) {
    phajayLog("error", "webhook: unhandled error", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return ACK_OK;
  }
}
