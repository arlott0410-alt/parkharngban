import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ======================================
// Currency Formatting — Lao Kip (LAK)
// ======================================

/**
 * ສະແດງເງິນກີບເປັນຕົວເລກເຕັມ (ປັດເປັນຈຳນວນເຕັມ) — ບໍ່ໃຊ້ໂໝດຍໍ 50K/5K ເພື່ອບໍ່ສັບສົນ
 * @param _legacyCompact ignored — ຄົງ signature ເກົ່າ (formatLAK(x, true)) ໃຫ້ບໍ່ເບີກ
 */
export function formatLAK(amount: number, _legacyCompact?: boolean): string {
  const n = Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : 0;
  return new Intl.NumberFormat("lo-LA", {
    style: "currency",
    currency: "LAK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("lo-LA").format(num);
}

// ======================================
// Date Utilities
// ======================================

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("lo-LA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("lo-LA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getMonthYear(month: number, year: number): string {
  const months = [
    "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ",
    "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ",
    "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
  ];
  return `${months[month - 1]} ${year + 543}`; // Buddhist Era
}

export function isSubscriptionActive(expiry_date?: string | null): boolean {
  if (!expiry_date) return false;
  return new Date(expiry_date) > new Date();
}

export function daysUntilExpiry(expiry_date?: string | null): number {
  if (!expiry_date) return 0;
  const diff = new Date(expiry_date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ======================================
// Free Trial Helpers — new users only
// ======================================
const DEFAULT_TRIAL_DURATION_DAYS = parseInt(process.env.TRIAL_DURATION_DAYS ?? "7", 10);

export function trialExpiryDate(created_at?: string | null): Date | null {
  if (!created_at) return null;
  const base = new Date(created_at);
  if (Number.isNaN(base.getTime())) return null;

  const expiry = new Date(base);
  expiry.setDate(expiry.getDate() + DEFAULT_TRIAL_DURATION_DAYS);
  return expiry;
}

export function isTrialActive(created_at?: string | null): boolean {
  const expiry = trialExpiryDate(created_at);
  if (!expiry) return false;
  return expiry > new Date();
}

export function daysUntilTrialExpiry(created_at?: string | null): number {
  const expiry = trialExpiryDate(created_at);
  if (!expiry) return 0;
  const diff = expiry.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ======================================
// Percentage
// ======================================

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// ======================================
// CSV Export
// ======================================

export function transactionsToCSV(
  transactions: Array<{
    transaction_date: string;
    type: string;
    amount: number;
    description?: string;
    category?: { name: string };
    note?: string;
  }>
): string {
  const headers = ["ວັນທີ", "ປະເພດ", "ຈຳນວນ (ກີບ)", "ໝວດໝູ່", "ລາຍລະອຽດ", "ໝາຍເຫດ"];
  const rows = transactions.map((t) => [
    t.transaction_date,
    t.type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ",
    t.amount.toString(),
    t.category?.name ?? "",
    t.description ?? "",
    t.note ?? "",
  ]);
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

// ======================================
// Telegram Helpers
// ======================================

export function getTelegramAvatarUrl(userId: number): string {
  // Placeholder — real avatar requires Telegram Bot API call
  return `https://t.me/i/userpic/320/${userId}`;
}

// ======================================
// Random / Security Helpers
// ======================================

export function generateOrderId(userId: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PKB-${userId}-${timestamp}-${random}`;
}

// ======================================
// Lao Text Helpers
// ======================================

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "ສະບາຍດີຕອນເຊົ້າ";
  if (hour < 17) return "ສະບາຍດີຕອນທ່ຽງ";
  return "ສະບາຍດີຕອນແລງ";
}

export function getTransactionTypeLabel(type: string): string {
  return type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ";
}
