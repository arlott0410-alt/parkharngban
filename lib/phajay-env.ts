/**
 * Phajay environment resolution — Test vs Production (ຫຼັງ KYC).
 *
 * - PHAJAY_MODE=test | production  (required ສຳລັບການເລືອກ key ທີ່ຊັດເຈນ)
 * - API keys: PHAJAY_SECRET_KEY_TEST / PHAJAY_SECRET_KEY_PRODUCTION
 *   ຫຼື PHAJAY_SECRET_KEY ສຳລັບທັງສອງໂໝດ (backward compatible)
 * - Webhook HMAC: PHAJAY_WEBHOOK_SECRET_TEST / PHAJAY_WEBHOOK_SECRET_PRODUCTION ຫຼື PHAJAY_WEBHOOK_SECRET
 *
 * @see docs/PHAJAY.md
 */

export type PhajayRuntimeMode = "test" | "production";

const LOG_PREFIX = "[phajay]";

function normalizeMode(raw: string | undefined): PhajayRuntimeMode {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "production" || v === "prod") return "production";
  /** default: test — ປອດໄພກວ່າສຳລັບ dev / ກ່ອນ KYC */
  return "test";
}

/** ໂໝດປັດຈຸບັນ (ຈາກ PHAJAY_MODEເທົ່ານັ້ນ — ບໍ່ເດົາເອງຈາກຮູບແບບ key) */
export function getPhajayMode(): PhajayRuntimeMode {
  return normalizeMode(process.env.PHAJAY_MODE);
}

export function isPhajayTestMode(): boolean {
  return getPhajayMode() === "test";
}

export function isPhajayProductionMode(): boolean {
  return getPhajayMode() === "production";
}

/**
 * Secret ສຳລັບ API (header secretKey / Bearer) ຕາມໂໝດ.
 * ລຳດັບ: MODE-specific → PHAJAY_SECRET_KEY
 */
export function getPhajayApiSecretKey(): string {
  const mode = getPhajayMode();
  const specific =
    mode === "test"
      ? process.env.PHAJAY_SECRET_KEY_TEST ?? ""
      : process.env.PHAJAY_SECRET_KEY_PRODUCTION ?? "";
  const fallback = process.env.PHAJAY_SECRET_KEY ?? "";
  const key = specific.trim() || fallback.trim();
  return key;
}

/**
 * ຄວາມລັບສຳລັບກວດ HMAC webhook (x-phajay-signature) ຕາມໂໝດ.
 */
export function getPhajayWebhookSecret(): string {
  const mode = getPhajayMode();
  const specific =
    mode === "test"
      ? process.env.PHAJAY_WEBHOOK_SECRET_TEST ?? ""
      : process.env.PHAJAY_WEBHOOK_SECRET_PRODUCTION ?? "";
  const fallback = process.env.PHAJAY_WEBHOOK_SECRET ?? "";
  return (specific.trim() || fallback.trim());
}

/** Base URL ສຳລັບ REST API — ສາມາດແຍກ test/prod ຖ້າ Phajay ໃຫ້ endpoint ຄນລະຕົວ */
export function getPhajayApiBaseUrl(): string {
  const mode = getPhajayMode();
  const specific =
    mode === "test"
      ? process.env.PHAJAY_API_URL_TEST?.trim()
      : process.env.PHAJAY_API_URL_PRODUCTION?.trim();
  const fallback =
    process.env.PHAJAY_API_URL?.trim() ||
    "https://payment-gateway.phajay.co/v1/api";
  return specific || fallback;
}

/** ສຳລັບ logs — ບໍ່ເຜີຍຄວາມລັບ */
export function getPhajayLogContext(): {
  mode: PhajayRuntimeMode;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
} {
  return {
    mode: getPhajayMode(),
    hasApiKey: getPhajayApiSecretKey().length > 0,
    hasWebhookSecret: getPhajayWebhookSecret().length > 0,
  };
}

export function phajayLog(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
  const ctx = getPhajayLogContext();
  const payload = {
    ...meta,
    mode: ctx.mode,
  };
  const line = `${LOG_PREFIX} ${message}`;
  if (level === "info") console.info(line, payload);
  else if (level === "warn") console.warn(line, payload);
  else console.error(line, payload);
}

/** ຕັດ transaction id ສຳລັບ log — ຫຼຸດຄວາມຍາວ */
export function redactTransactionId(id: string | undefined): string {
  if (!id) return "(empty)";
  if (id.length <= 12) return `${id.slice(0, 4)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
