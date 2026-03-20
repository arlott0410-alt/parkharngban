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
    if (!signatureOk) return acknowledge;

    const payload = JSON.parse(rawBody) as {
      status?: string;
      transactionId?: string;
      transactionID?: string;
      authCode?: string;
      time?: string;
      [key: string]: unknown;
    };

    const status = (payload.status ?? "").toUpperCase();
    const transactionId = payload.transactionId ?? payload.transactionID;
    if (!transactionId) return acknowledge;

    // Subscription setup webhook: we mainly acknowledge & optionally refresh updated_at.
    if (status.includes("SUBSCRIPTION_CONNECTED")) {
      const supabase = createAdminClient();
      await supabase
        .from("subscriptions")
        .update({ updated_at: new Date().toISOString() })
        .eq("payment_ref", transactionId);
    }

    return acknowledge;
  } catch (error) {
    console.error("Phajay subscription-setup webhook error:", error);
    return acknowledge;
  }
}

