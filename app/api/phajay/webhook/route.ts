import { NextRequest } from "next/server";
import { verifyPhajayWebhookSignature } from "@/lib/phajay";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const acknowledge = new Response("OK", { status: 200 });

  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-phajay-signature") ?? request.headers.get("x-signature");
    const signatureOk = await verifyPhajayWebhookSignature(rawBody, signature);

    if (!signatureOk) {
      console.warn("Phajay webhook: invalid signature");
      return acknowledge;
    }

    const payload = JSON.parse(rawBody) as {
      message?: string;
      status?: string;
      transactionId?: string;
      transactionID?: string;
      paymentTransactionId?: string;
      authCode?: string;
      time?: string;
      [key: string]: unknown;
    };

    const status = (payload.status ?? "").toUpperCase();
    const isSuccess = status.includes("SUBSCRIPTION_SUCCESS");
    if (!isSuccess) {
      return acknowledge;
    }

    const transactionId = payload.transactionId ?? payload.transactionID;
    if (!transactionId) {
      console.error("Phajay webhook: missing transactionId", payload);
      return acknowledge;
    }

    const startedAt = (() => {
      if (!payload.time) return new Date();
      // Example format: "2025-02-12 14:54:45"
      const normalized = String(payload.time).replace(" ", "T");
      const d = new Date(normalized);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    })();

    const expiryDate = new Date(startedAt);
    const durationDays = parseInt(process.env.SUBSCRIPTION_DURATION_DAYS ?? "30", 10);
    expiryDate.setDate(expiryDate.getDate() + durationDays);

    const supabase = createAdminClient();

    const { data: pendingSub, error: pendingError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("payment_ref", transactionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      console.error("Phajay webhook: failed to find pending subscription", pendingError);
      return acknowledge;
    }

    if (!pendingSub?.id) {
      console.warn("Phajay webhook: pending subscription not found", { transactionId });
      return acknowledge;
    }

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
      console.error("Phajay webhook: update subscription failed", updateError);
      return acknowledge;
    }

    return acknowledge;
  } catch (error) {
    console.error("Phajay webhook error:", error);
    return acknowledge;
  }
}
