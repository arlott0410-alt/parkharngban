import { NextRequest } from "next/server";
import { isSuccessfulPhajayStatus, verifyPhajayWebhookSignature } from "@/lib/phajay";
import { createAdminClient } from "@/lib/supabase";
import type { PhajayWebhookPayload } from "@/types";

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

    const payload = JSON.parse(rawBody) as PhajayWebhookPayload;
    if (!isSuccessfulPhajayStatus(payload.status)) {
      return acknowledge;
    }

    const reference = payload.reference;
    if (!reference) {
      console.error("Phajay webhook: missing reference", payload);
      return acknowledge;
    }

    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + 30);

    const supabase = createAdminClient();

    const { data: pendingSub, error: pendingError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("payment_ref", reference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      console.error("Phajay webhook: failed to find pending subscription", pendingError);
      return acknowledge;
    }

    if (!pendingSub?.id) {
      console.warn("Phajay webhook: pending subscription not found", { reference });
      return acknowledge;
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        started_at: now.toISOString(),
        expiry_date: expiryDate.toISOString(),
        payment_details: payload,
        updated_at: now.toISOString(),
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
