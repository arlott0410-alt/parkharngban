import { NextRequest } from "next/server";
import {
  verifyPhajayWebhookSignature,
  redactTransactionId,
  phajayLog,
} from "@/lib/phajay";
import {
  collectPhajayTransactionIdCandidates,
  isPhajaySubscriptionPaymentSuccess,
} from "@/lib/phajay-webhook";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";

/** ບໍ່ cache — ຮັບ webhook ແບບ dynamic */
export const dynamic = "force-dynamic";

const ACK_OK = new Response("OK", { status: 200 });

export async function GET() {
  return new Response(JSON.stringify({ service: "phajay-webhook", method: "POST only" }), {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}

/**
 * ຫາແຖວ subscription ລໍຖ້າຊຳລະ ທີ່ກົງກັບ transaction id ຈາກ webhook
 */
async function findPendingSubscriptionByTransactionCandidates(
  supabase: ReturnType<typeof createAdminClient>,
  candidates: string[],
  requestId: string
): Promise<{ id: string; payment_details: unknown } | null> {
  if (candidates.length === 0) return null;

  const { data: byRef, error: refErr } = await supabase
    .from("subscriptions")
    .select("id, payment_details")
    .in("payment_ref", candidates)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (refErr) {
    phajayLog("error", "webhook: supabase select by payment_ref failed", {
      requestId,
      error: refErr.message,
    });
    return null;
  }

  if (byRef?.id) return byRef;

  /** ຖ້າ Phajay ສົ່ງ id ຄົນລະກັບ payment_ref ແຕ່ກົງກັບ bcel.transactionId ໃນ JSON */
  for (const tid of candidates) {
    const { data: byJson, error: jsonErr } = await supabase
      .from("subscriptions")
      .select("id, payment_details")
      .filter("payment_details->bcel->>transactionId", "eq", tid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jsonErr) {
      phajayLog("warn", "webhook: json path lookup failed", {
        requestId,
        error: jsonErr.message,
        transactionId: redactTransactionId(tid),
      });
      continue;
    }
    if (byJson?.id) return byJson;
  }

  return null;
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

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      phajayLog("error", "webhook: invalid JSON", { requestId });
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!isPhajaySubscriptionPaymentSuccess(payload)) {
      phajayLog("info", "webhook: ignored (not subscription payment success)", {
        requestId,
        status: typeof payload.status === "string" ? payload.status : "(none)",
        message: typeof payload.message === "string" ? payload.message.slice(0, 120) : "(none)",
        keys: Object.keys(payload),
      });
      return ACK_OK;
    }

    const candidates = collectPhajayTransactionIdCandidates(payload);
    if (candidates.length === 0) {
      phajayLog("error", "webhook: no transaction id in payload", {
        requestId,
        payloadKeys: Object.keys(payload),
      });
      return ACK_OK;
    }

    const transactionId = candidates[0];

    const timeRaw =
      typeof payload.time === "string"
        ? payload.time
        : payload.data &&
            typeof payload.data === "object" &&
            payload.data !== null &&
            typeof (payload.data as Record<string, unknown>).time === "string"
          ? String((payload.data as Record<string, unknown>).time)
          : undefined;

    const startedAt = (() => {
      if (!timeRaw) return new Date();
      const normalized = String(timeRaw).replace(" ", "T");
      const d = new Date(normalized);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    })();

    const supabase = createAdminClient();

    const pendingSub = await findPendingSubscriptionByTransactionCandidates(
      supabase,
      candidates,
      requestId
    );

    if (!pendingSub?.id) {
      phajayLog("warn", "webhook: no pending subscription for transaction candidates", {
        requestId,
        candidates: candidates.map((c) => redactTransactionId(c)),
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
