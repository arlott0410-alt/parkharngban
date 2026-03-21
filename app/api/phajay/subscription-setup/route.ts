import { NextRequest } from "next/server";
import { verifyPhajayWebhookSignature, phajayLog, redactTransactionId } from "@/lib/phajay";
import { computeSubscriptionExpiryIso, type PaymentDetailsLike } from "@/lib/subscription-expiry";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ACK_OK = new Response("OK", { status: 200 });

function ts(): string {
  return new Date().toISOString();
}

export async function GET() {
  return new Response(JSON.stringify({ service: "phajay-subscription-setup", method: "POST only" }), {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  });
}

/**
 * ກວດວ່າມີການຢືນຢັນຈາກ Phajay (authCode / confirmation) — ເປີດສິດກ່ອນ webhook ຫຼັກຖ້າມີຂໍ້ມູນພຽງພໍ
 */
function hasConfirmationSignals(payload: Record<string, unknown>): boolean {
  if (typeof payload.authCode === "string" && payload.authCode.trim().length > 0) return true;
  if (typeof payload.confirmation === "string" && payload.confirmation.trim().length > 0) return true;
  if (typeof payload.confirmationCode === "string" && payload.confirmationCode.trim().length > 0) return true;
  if (payload.confirmed === true) return true;
  const st = String(payload.status ?? "").toUpperCase();
  if (st.includes("CONFIRM") || st.includes("CONNECTED")) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const t0 = ts();

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
      console.error(`[phajay-subscription-setup] ${t0} VERIFY FAILED`, { requestId, reason: verified.reason });
      return new Response(JSON.stringify({ error: verified.reason }), {
        status: verified.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (e) {
      console.error(`[phajay-subscription-setup] ${t0} invalid JSON`, requestId, e);
      return new Response("Invalid JSON", { status: 400 });
    }

    console.log(`[phajay-subscription-setup] ${t0} payload:`, JSON.stringify(payload, null, 2));

    const statusRaw = (payload.status ?? "").toString().toUpperCase();
    const transactionId = String(
      payload.transactionId ?? payload.transactionID ?? payload.transaction_id ?? ""
    ).trim();

    /** SUBSCRIPTION_CONNECTED — ອັບເດດເວລາຢືນຢັນການເຊື່ອມຕໍ່ */
    if (statusRaw.includes("SUBSCRIPTION_CONNECTED") && transactionId) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("subscriptions")
        .update({ updated_at: new Date().toISOString() })
        .eq("payment_ref", transactionId);

      if (error) {
        phajayLog("error", "subscription-setup: db update failed", {
          requestId,
          error: error.message,
          transactionId: redactTransactionId(transactionId),
        });
      } else {
        phajayLog("info", "subscription-setup: SUBSCRIPTION_CONNECTED", {
          requestId,
          transactionId: redactTransactionId(transactionId),
        });
      }
      return ACK_OK;
    }

    /**
     * ຖ້າມີ authCode / confirmation — ອັບເດດແຖວຕາມ transaction id ເປັນ pending_active ຫຼື active
     * (ຖ້າມີ duration ໃນ payment_details ຈະຄິດ expiry; ບໍ່ດັ່ງນັ້ນຈະເປັນ pending_active ໃຫ້ webhook ຫຼັກຊ້ອຍ)
     */
    if (transactionId && hasConfirmationSignals(payload)) {
      const supabase = createAdminClient();
      const { data: row, error: selErr } = await supabase
        .from("subscriptions")
        .select("id, status, payment_details, expiry_date, started_at")
        .eq("payment_ref", transactionId)
        .maybeSingle();

      if (selErr) {
        console.error(`[phajay-subscription-setup] ${ts()} select failed`, selErr.message);
        return ACK_OK;
      }

      if (row?.id) {
        const details = row.payment_details as PaymentDetailsLike;
        const startedAt = new Date();
        const canActivate =
          details &&
          (typeof details.duration_days === "number" ||
            typeof details.months_covered === "number" ||
            (typeof details.plan === "string" && details.plan.length > 0));

        if (canActivate) {
          const expiryIso = computeSubscriptionExpiryIso({
            startedAt,
            paymentDetails: details,
            existingStatus: row.status,
            existingExpiryIso: row.expiry_date,
            isRecurringDebit: false,
          });

          const prevDetails =
            typeof row.payment_details === "object" && row.payment_details !== null
              ? (row.payment_details as Record<string, unknown>)
              : {};

          const { error: upErr } = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              started_at: startedAt.toISOString(),
              expiry_date: expiryIso,
              updated_at: new Date().toISOString(),
              payment_details: {
                ...prevDetails,
                subscription_setup_confirmed_at: new Date().toISOString(),
              },
            })
            .eq("id", row.id);

          if (upErr) {
            console.error(`[phajay-subscription-setup] ${ts()} activate failed`, upErr.message);
          } else {
            console.log(`[phajay-subscription-setup] ${ts()} activated id=${row.id} via confirmation`);
          }
        } else {
          const { error: upErr } = await supabase
            .from("subscriptions")
            .update({
              status: "pending_active",
              updated_at: new Date().toISOString(),
              payment_details: {
                ...(typeof row.payment_details === "object" && row.payment_details !== null
                  ? (row.payment_details as Record<string, unknown>)
                  : {}),
                subscription_setup_confirmed_at: new Date().toISOString(),
              },
            })
            .eq("id", row.id);

          if (upErr) {
            console.error(`[phajay-subscription-setup] ${ts()} pending_active failed`, upErr.message);
          } else {
            console.log(`[phajay-subscription-setup] ${ts()} pending_active id=${row.id}`);
          }
        }
      }
      return ACK_OK;
    }

    if (!transactionId) {
      phajayLog("warn", "subscription-setup: missing transactionId", { requestId });
    }

    return ACK_OK;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[phajay-subscription-setup] ${ts()} unhandled`, requestId, msg);
    phajayLog("error", "subscription-setup: unhandled", { requestId, message: msg });
    return ACK_OK;
  }
}
