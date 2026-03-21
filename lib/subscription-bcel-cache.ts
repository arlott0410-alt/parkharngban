import type { PhajayBcelQrResult } from "@/lib/phajay";
import type { SubscriptionPlanId } from "@/lib/subscription-plans";

/**
 * ລະຫວ່າງການສ້າງ QR ຊຸດໃໝ່ (ວິນາທີ) — ກົດຊ້ຳຈະຄືນ QR ເກົ່າຈາກ DB ແທນການເອີ້ນ Phajay ຊ້ຳ
 * @see SUBSCRIPTION_QR_COOLDOWN_SECONDS
 */
export function getSubscriptionQrCooldownSeconds(): number {
  const raw = process.env.SUBSCRIPTION_QR_COOLDOWN_SECONDS;
  const n = raw != null && raw !== "" ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 120;
}

/** ບັນທຶກໃນ payment_details.bcel ຫຼັງສ້າງ QR ສຳເລັດ */
export type StoredBcelPayload = {
  qrCodeUrl: string;
  deepLink: string | null;
  transactionId: string;
  amountLak: number;
  generatedAt: string;
};

type PaymentDetailsShape = {
  plan?: string;
  bcel?: StoredBcelPayload;
};

export function isWithinCooldown(updatedAtIso: string, cooldownSec: number): boolean {
  if (cooldownSec <= 0) return false;
  const t = new Date(updatedAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < cooldownSec * 1000;
}

/**
 * ຄືນ QR ທີ່ບັນທຶກແລ້ວ ຖ້າແຜນກົງກັນ ແລະຍັງຢູ່ໃນ cooldown — ຫຼຸດ spam / ຫຼາຍບິນ Phajay
 */
export function tryGetCachedBcelForPlan(
  rowStatus: string | null | undefined,
  paymentDetails: unknown,
  planId: SubscriptionPlanId,
  rowUpdatedAt: string | null | undefined
): StoredBcelPayload | null {
  /** ລໍຖ້າຊຳລະ: pending (ໃໝ່) ຫຼື inactive (ຂໍ້ມູນເກົ່າ) */
  if (rowStatus !== "inactive" && rowStatus !== "pending") return null;
  if (!rowUpdatedAt) return null;
  const cooldown = getSubscriptionQrCooldownSeconds();
  if (!isWithinCooldown(rowUpdatedAt, cooldown)) return null;

  const d = paymentDetails as PaymentDetailsShape | null;
  if (!d || d.plan !== planId) return null;
  const b = d.bcel;
  if (!b?.qrCodeUrl?.trim() || !b.transactionId?.trim()) return null;
  return {
    qrCodeUrl: b.qrCodeUrl.trim(),
    deepLink: b.deepLink ?? null,
    transactionId: b.transactionId.trim(),
    amountLak: typeof b.amountLak === "number" ? b.amountLak : 0,
    generatedAt: b.generatedAt || rowUpdatedAt,
  };
}

export function computeQrCodeUrlFromPhajayResult(res: PhajayBcelQrResult): string {
  return (
    res.qr_image_url?.trim() ||
    (res.qrCode?.trim().startsWith("http") ? res.qrCode.trim() : "") ||
    res.qrCode ||
    ""
  );
}

export function buildStoredBcelPayload(
  res: PhajayBcelQrResult,
  amountLak: number,
  nowIso: string
): StoredBcelPayload {
  return {
    qrCodeUrl: computeQrCodeUrlFromPhajayResult(res),
    deepLink: res.link?.trim() ? res.link : null,
    transactionId: res.transactionId,
    amountLak,
    generatedAt: nowIso,
  };
}

/** ຮູບແບບ JSON ສົ່ງໃຫ້ Mini App (ສ້າງໃໝ່ ຫຼື ຄືນຈາກ cache) */
export function buildSubscriptionQrApiPayload(opts: {
  qrCodeUrl: string;
  deepLink: string | null | undefined;
  transactionId: string;
  amount: number;
  qr_image_url?: string | null;
  qr_data?: string | null;
  qrCode?: string | null;
  link?: string | null;
  pendingSaveFailed: boolean;
  qrFromCache?: boolean;
}) {
  const {
    qrCodeUrl,
    deepLink,
    transactionId,
    amount,
    qr_image_url,
    qr_data,
    qrCode,
    link,
    pendingSaveFailed,
    qrFromCache,
  } = opts;

  return {
    success: true as const,
    qrCodeUrl,
    deepLink: deepLink ?? link ?? null,
    transactionId,
    amount,
    qr_image_url: qr_image_url ?? null,
    qr_data: qr_data ?? null,
    transaction_id: transactionId,
    link: link ?? deepLink ?? null,
    qrCode: qrCode ?? null,
    amount_lak: amount,
    pendingSaveFailed,
    qrFromCache: Boolean(qrFromCache),
  };
}
