/**
 * ແຜນສະມາຊິກ: 1 ເດືອນ / 6 ເດືອນ (ຈ່າຍ 5) / 12 ເດືອນ (ຈ່າຍ 10)
 * ຈຳນວນວັນ = 30 ວັນ × ຈຳນວນເດືອນທີ່ໄດ້ໃຊ້ງານ
 */

export const SUBSCRIPTION_PLAN_IDS = ["1m", "6m", "12m"] as const;
export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLAN_IDS)[number];

export type SubscriptionPlanDefinition = {
  monthsCovered: number;
  monthsCharged: number;
  labelLo: string;
  /** ຂໍ້ຄວາມໂປຣໂມ (ສະແດງໃນ UI) */
  promoLo?: string;
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlanDefinition> = {
  "1m": {
    monthsCovered: 1,
    monthsCharged: 1,
    labelLo: "1 ເດືອນ",
  },
  "6m": {
    monthsCovered: 6,
    monthsCharged: 5,
    labelLo: "6 ເດືອນ",
    promoLo: "ຈ່າຍ 5 ເດືອນ",
  },
  "12m": {
    monthsCovered: 12,
    monthsCharged: 10,
    labelLo: "12 ເດືອນ",
    promoLo: "ຈ່າຍ 10 ເດືອນ",
  },
};

/** ວັນຕໍ່ 1 ເດືອນ (ກົງກັບເກົ່າ SUBSCRIPTION_DURATION_DAYS = 30) */
export const SUBSCRIPTION_DAYS_PER_MONTH = 30;

export function isSubscriptionPlanId(value: string): value is SubscriptionPlanId {
  return (SUBSCRIPTION_PLAN_IDS as readonly string[]).includes(value);
}

export function parseSubscriptionPlanId(value: unknown): SubscriptionPlanId {
  if (typeof value === "string" && isSubscriptionPlanId(value)) {
    return value;
  }
  return "1m";
}

export function getDurationDaysForPlan(planId: SubscriptionPlanId): number {
  const def = SUBSCRIPTION_PLANS[planId];
  return def.monthsCovered * SUBSCRIPTION_DAYS_PER_MONTH;
}
