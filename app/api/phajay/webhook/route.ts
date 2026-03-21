import { NextRequest } from "next/server";
import {
  verifyPhajayWebhookSignature,
  redactTransactionId,
  phajayLog,
} from "@/lib/phajay";
import {
  collectPhajaySubscriptionIdCandidates,
  collectPhajayTransactionIdCandidates,
  getNestedData,
  isPhajaySubscriptionPaymentSuccess,
} from "@/lib/phajay-webhook";
import { computeSubscriptionExpiryIso, type PaymentDetailsLike } from "@/lib/subscription-expiry";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";

/** ບໍ່ cache — ຮັບ webhook ແບບ dynamic */
export const dynamic = "force-dynamic";

const ACK_OK = new Response("OK", { status: 200 });

/** ສົ່ງ 200 ສະເຫມີເພື່ອໃຫ້ Phajay ບໍ່ retry ວນຊ້ຳ (ຍົກເວັ້ນເກດທີ່ບໍ່ຮັບເປັນ webhook ຈຣິງ) */
function ok200(): Response {
  return ACK_OK;
}

function ts(): string {
  return new Date().toISOString();
}

type SubRow = {
  id: string;
  status: string;
  payment_details: unknown;
  expiry_date: string | null;
  started_at: string | null;
};

/**
 * ຫາແຖວຕາມ payment_ref / bcel.transactionId — ສຳລັບການຊຳລະຄັ້ງທຳອິດ (pending / inactive / pending_active)
 */
async function findAwaitingSubscriptionByTxCandidates(
  supabase: ReturnType<typeof createAdminClient>,
  candidates: string[],
  requestId: string
): Promise<SubRow | null> {
  if (candidates.length === 0) return null;

  const awaitingStatuses = ["pending", "inactive", "pending_active"];

  const { data: byRef, error: refErr } = await supabase
    .from("subscriptions")
    .select("id, status, payment_details, expiry_date, started_at")
    .in("payment_ref", candidates)
    .in("status", awaitingStatuses)
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

  if (byRef?.id) return byRef as SubRow;

  for (const tid of candidates) {
    const { data: byJson, error: jsonErr } = await supabase
      .from("subscriptions")
      .select("id, status, payment_details, expiry_date, started_at")
      .in("status", awaitingStatuses)
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
    if (byJson?.id) return byJson as SubRow;
  }

  return null;
}

/**
 * ຫາແຖວ active ຕາມ Phajay subscription id (ເກັບໄວ້ໃນ payment_details.phaJay.subscriptionId) — recurring debit
 */
async function findActiveByPhajaySubscriptionId(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  requestId: string
): Promise<SubRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status, payment_details, expiry_date, started_at")
    .eq("status", "active")
    .filter("payment_details->phaJay->>subscriptionId", "eq", subscriptionId)
    .maybeSingle();

  if (error) {
    phajayLog("warn", "webhook: lookup by phaJay.subscriptionId failed", {
      requestId,
      error: error.message,
      subscriptionId: redactTransactionId(subscriptionId),
    });
    return null;
  }
  return data?.id ? (data as SubRow) : null;
}

function parseTimeFromPayload(payload: Record<string, unknown>): Date {
  const nested = getNestedData(payload);
  const timeRaw =
    typeof payload.time === "string"
      ? payload.time
      : nested && typeof nested.time === "string"
        ? nested.time
        : undefined;

  if (!timeRaw) return new Date();
  const normalized = String(timeRaw).replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mergePaymentDetailsPhaJay(
  prev: unknown,
  subscriptionId: string | undefined
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && prev !== null && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  const prevPha = base.phaJay;
  const phaObj =
    prevPha && typeof prevPha === "object" && prevPha !== null && !Array.isArray(prevPha)
      ? { ...(prevPha as Record<string, unknown>) }
      : {};
  if (subscriptionId) {
    phaObj.subscriptionId = subscriptionId;
  }
  base.phaJay = phaObj;
  return base;
}

export async function GET() {
  return new Response(JSON.stringify({ service: "phajay-webhook", method: "POST only" }), {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const t0 = ts();

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
      console.error(`[phajay-webhook] ${t0} VERIFY FAILED`, {
        requestId,
        reason: verified.reason,
        status: verified.status,
      });
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
    } catch (e) {
      console.error(`[phajay-webhook] ${t0} invalid JSON`, requestId, e);
      return new Response("Invalid JSON", { status: 400 });
    }

    /** ຕາມທີ່ຜູ້ໃຊ້ຂໍ: log payload ເຕັມຫຼັງ parse (ຫຼັງ verify HMAC ຜ່ານແລ້ວ) */
    console.log(`[phajay-webhook] ${t0} Webhook received from PhaJay:`, JSON.stringify(payload, null, 2));

    if (!isPhajaySubscriptionPaymentSuccess(payload)) {
      phajayLog("info", "webhook: ignored (not payment success shape)", {
        requestId,
        status: typeof payload.status === "string" ? payload.status : "(none)",
        message: typeof payload.message === "string" ? payload.message.slice(0, 160) : "(none)",
        keys: Object.keys(payload),
      });
      return ok200();
    }

    const txCandidates = collectPhajayTransactionIdCandidates(payload);
    const subIdCandidates = collectPhajaySubscriptionIdCandidates(payload);

    if (txCandidates.length === 0 && subIdCandidates.length === 0) {
      phajayLog("error", "webhook: no transaction/subscription id in payload", {
        requestId,
        payloadKeys: Object.keys(payload),
      });
      return ok200();
    }

    const startedAt = parseTimeFromPayload(payload);
    const supabase = createAdminClient();

    /**
     * ຂັ້ນຕອນ 1: debit ຮອບຖັດໄປ — ຖ້າ payload ມີ subscription id ກົງກັບ payment_details.phaJay.subscriptionId
     * ແລະແຖວນັ້ນ active ຢູ່ → ຕໍ່ອາຍຸ (ບໍ່ພຶ່ງຄຳວ່າ DEBIT ໃນ message ເພາະ Phajay ອາດສົ່ງແບບຕ່າງກັນ)
     */
    if (subIdCandidates.length > 0) {
      for (const sid of subIdCandidates) {
        const activeRow = await findActiveByPhajaySubscriptionId(supabase, sid, requestId);
        if (!activeRow?.id) continue;

        const details = activeRow.payment_details as PaymentDetailsLike;
        const expiryIso = computeSubscriptionExpiryIso({
          startedAt,
          paymentDetails: details,
          existingStatus: "active",
          existingExpiryIso: activeRow.expiry_date,
          isRecurringDebit: true,
        });

        const mergedDetails = mergePaymentDetailsPhaJay(activeRow.payment_details, sid);

        const { error: upErr } = await supabase
          .from("subscriptions")
          .update({
            expiry_date: expiryIso,
            payment_details: mergedDetails,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeRow.id);

        if (upErr) {
          phajayLog("error", "webhook: recurring extend failed", {
            requestId,
            error: upErr.message,
            subscriptionId: activeRow.id,
          });
        } else {
          phajayLog("info", "webhook: recurring subscription extended", {
            requestId,
            subscriptionId: activeRow.id,
            phaJaySid: redactTransactionId(sid),
          });
          console.log(`[phajay-webhook] ${ts()} recurring extended row=${activeRow.id}`);
        }
        return ok200();
      }
    }

    /** ຂັ້ນຕອນ 2: ຊຳລະຄັ້ງທຳອິດ — ກົດຕໍ່ລໍຖ້າ (pending / inactive / pending_active) */
    const awaiting = await findAwaitingSubscriptionByTxCandidates(supabase, txCandidates, requestId);

    if (!awaiting?.id) {
      phajayLog("warn", "webhook: no awaiting subscription row for candidates", {
        requestId,
        candidates: txCandidates.map((c) => redactTransactionId(c)),
      });
      console.warn(`[phajay-webhook] ${ts()} no row for tx candidates`, txCandidates.map(redactTransactionId));
      return ok200();
    }

    const details = awaiting.payment_details as PaymentDetailsLike;
    const primarySubId = subIdCandidates[0];
    const mergedDetails = mergePaymentDetailsPhaJay(awaiting.payment_details, primarySubId);

    const expiryIso = computeSubscriptionExpiryIso({
      startedAt,
      paymentDetails: details,
      existingStatus: awaiting.status,
      existingExpiryIso: awaiting.expiry_date,
      isRecurringDebit: false,
    });

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        started_at: startedAt.toISOString(),
        expiry_date: expiryIso,
        payment_details: mergedDetails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", awaiting.id);

    if (updateError) {
      console.error(`[phajay-webhook] ${ts()} DB update failed`, updateError.message, awaiting.id);
      phajayLog("error", "webhook: subscription update failed", {
        requestId,
        error: updateError.message,
        subscriptionId: awaiting.id,
      });
      return ok200();
    }

    const tid = txCandidates[0] ?? subIdCandidates[0] ?? "";
    phajayLog("info", "webhook: subscription activated", {
      requestId,
      subscriptionId: awaiting.id,
      transactionId: redactTransactionId(tid),
    });
    console.log(`[phajay-webhook] ${ts()} ACTIVATED subscription row=${awaiting.id}`);

    return ok200();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[phajay-webhook] ${ts()} UNHANDLED`, requestId, msg, error);
    phajayLog("error", "webhook: unhandled error", {
      requestId,
      message: msg,
    });
    return ok200();
  }
}
