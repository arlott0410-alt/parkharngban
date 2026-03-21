/**
 * ຄິດໄລ່ວັນໝົດອາຍຸສະມາຊິກຈາກແຜນ (ເດືອນ) — ຕາມທີ່ຜູ້ໃຊ້ຂໍ: setMonth ຈາກ started_at ຫຼືຕໍ່ຈາກວັນໝົດເກົ່າ (recurring debit).
 */
import { parseSubscriptionPlanId, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from "@/lib/subscription-plans";

export type PaymentDetailsLike = {
  plan?: string;
  months_covered?: number;
  duration_days?: number;
} | null;

/** ຈຳນວນເດືອນທີ່ໄດ້ຮັບສິດ (ຈາກ payment_details ຫຼືແຜນ) */
export function getMonthsCoveredFromPaymentDetails(details: PaymentDetailsLike): number {
  if (details && typeof details.months_covered === "number" && details.months_covered > 0) {
    return details.months_covered;
  }
  const planRaw = details?.plan;
  if (typeof planRaw === "string") {
    const id = parseSubscriptionPlanId(planRaw) as SubscriptionPlanId;
    return SUBSCRIPTION_PLANS[id].monthsCovered;
  }
  /** ສຳຮອງ: duration_days / 30 */
  if (details && typeof details.duration_days === "number" && details.duration_days > 0) {
    return Math.max(1, Math.round(details.duration_days / 30));
  }
  return 1;
}

/** ເພີ່ມເດືອນແບບປົກກະຕິ (ຈັດວັນປົກກະຕິເມື່ອ overflow) */
export function addCalendarMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export type ComputeExpiryArgs = {
  startedAt: Date;
  paymentDetails: PaymentDetailsLike;
  /** ສຳລັບ recurring: ຖ້າຍັງ active ແລະມີວັນໝົດໃນອະນາຄົດ — ຕໍ່ຈາກວັນໝົດເກົ່າ */
  existingStatus?: string | null;
  existingExpiryIso?: string | null;
  /** true ເມື່ອເປັນເຫດ debit ຮອບຖັດໄປ (ມີ subscription id ກົງກັນ) */
  isRecurringDebit: boolean;
};

/**
 * ຄິດ expiry: ຄັ້ງທຳອິດ = started_at + plan months;
 * recurring = expiryເກົ່າ (ຖ້າຍັງບໍ່ໝົດ) + plan months.
 */
export function computeSubscriptionExpiryIso(args: ComputeExpiryArgs): string {
  const months = getMonthsCoveredFromPaymentDetails(args.paymentDetails);
  const now = new Date();

  if (args.isRecurringDebit && args.existingStatus === "active" && args.existingExpiryIso) {
    const cur = new Date(args.existingExpiryIso);
    if (!Number.isNaN(cur.getTime()) && cur > now) {
      return addCalendarMonths(cur, months).toISOString();
    }
  }

  return addCalendarMonths(args.startedAt, months).toISOString();
}
