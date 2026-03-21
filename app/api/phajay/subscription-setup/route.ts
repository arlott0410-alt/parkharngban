import { NextRequest } from "next/server";
import { verifyPhajayWebhookSignature, phajayLog, redactTransactionId } from "@/lib/phajay";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ACK_OK = new Response("OK", { status: 200 });

export async function GET() {
  return new Response(JSON.stringify({ service: "phajay-subscription-setup", method: "POST only" }), {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return new Response("Bad Request", { status: 400 });
    }

    const signature =
      request.headers.get("x-phajay-signature") ??
      request.headers.get("X-Phajay-Signature") ??
      request.headers.get("x-signature");

    const verified = await verifyPhajayWebhookSignature(rawBody, signature);
    if (!verified.ok) {
      phajayLog("warn", "subscription-setup: verification failed", {
        requestId,
        reason: verified.reason,
      });
      return new Response(JSON.stringify({ error: verified.reason }), {
        status: verified.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: {
      status?: string;
      transactionId?: string;
      transactionID?: string;
      [key: string]: unknown;
    };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const status = (payload.status ?? "").toUpperCase();
    const transactionId = payload.transactionId ?? payload.transactionID;
    if (!transactionId) {
      phajayLog("warn", "subscription-setup: missing transactionId", { requestId });
      return ACK_OK;
    }

    if (status.includes("SUBSCRIPTION_CONNECTED")) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("subscriptions")
        .update({ updated_at: new Date().toISOString() })
        .eq("payment_ref", transactionId);

      if (error) {
        phajayLog("error", "subscription-setup: db update failed", {
          requestId,
          error: error.message,
          transactionId: redactTransactionId(String(transactionId)),
        });
      } else {
        phajayLog("info", "subscription-setup: SUBSCRIPTION_CONNECTED", {
          requestId,
          transactionId: redactTransactionId(String(transactionId)),
        });
      }
    }

    return ACK_OK;
  } catch (error) {
    phajayLog("error", "subscription-setup: unhandled", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return ACK_OK;
  }
}
