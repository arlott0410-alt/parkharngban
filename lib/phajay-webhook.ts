/**
 * ກວດວິເຄາະ payload webhook ຈາກ Phajay — ຮູບແບບ test/prod ອາດຕ່າງກັນ (status vs message, nested data).
 * @see app/api/phajay/webhook/route.ts
 */

function isLooseSuccessWord(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === "success" || v === "completed";
}

/** ກວດວ່າ string ສະເພາະຊ່ອງ status ຈາກ Phajay (ເກົ່າ) */
export function isPhajaySubscriptionSuccessStatus(statusRaw: string | undefined): boolean {
  const s = (statusRaw ?? "").toUpperCase();
  if (!s) return false;
  if (s.includes("SUBSCRIPTION_SUCCESS")) return true;
  if (s.includes("SUBSCRIPTION_DEBIT_SUCCESS")) return true;
  if (s.includes("DEBIT_SUCCESS") && s.includes("SUBSCRIPTION")) return true;
  return false;
}

function getNestedData(payload: Record<string, unknown>): Record<string, unknown> | null {
  const d = payload.data;
  if (d && typeof d === "object" && d !== null && !Array.isArray(d)) {
    return d as Record<string, unknown>;
  }
  return null;
}

/**
 * ຊຳລະ subscription ສຳເລັດຫຼືບໍ່ — ກວດຫຼາຍຊ່ອງ ແລະຄຳວ່າ SUCCESSFULLY ທີ່ portal ອາດໃຊ້ໃນຂໍ້ຄວາມ
 */
export function isPhajaySubscriptionPaymentSuccess(payload: Record<string, unknown>): boolean {
  const nested = getNestedData(payload);
  const candidates: string[] = [];

  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) candidates.push(v.trim());
  };

  push(payload.status);
  push(payload.message);
  push(payload.state);
  if (nested) {
    push(nested.status);
    push(nested.message);
    push(nested.state);
  }

  for (const s of candidates) {
    if (isPhajaySubscriptionSuccessStatus(s)) return true;
    if (isLooseSuccessWord(s)) return true;
    const u = s.toUpperCase();
    if (u.includes("SUCCESSFULLY")) return true;
  }

  return false;
}

const TX_KEYS = [
  "transactionId",
  "transactionID",
  "transaction_id",
  "paymentTransactionId",
  "payment_transaction_id",
  "merchantTransactionId",
  "paymentId",
] as const;

/**
 * ລາຍການ transaction id ທີ່ອາດກົງກັບ payment_ref / bcel.transactionId
 */
export function collectPhajayTransactionIdCandidates(payload: Record<string, unknown>): string[] {
  const nested = getNestedData(payload);
  const out: string[] = [];

  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim().length > 0) out.push(v.trim());
  };

  for (const k of TX_KEYS) {
    push(payload[k]);
    if (nested) push(nested[k]);
  }

  return [...new Set(out)];
}
