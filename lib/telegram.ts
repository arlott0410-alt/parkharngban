import type { TelegramInitData, TelegramUser } from "@/types";

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  const keyData = typeof key === "string" ? textEncoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    textEncoder.encode(data) as BufferSource
  );
  return new Uint8Array(signature);
}

// ======================================
// Validate Telegram WebApp initData (HMAC)
// ======================================

export async function validateTelegramInitData(initDataRaw: string): Promise<{
  valid: boolean;
  data?: TelegramInitData;
  error?: string;
}> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return { valid: false, error: "TELEGRAM_BOT_TOKEN not configured" };
    }

    const params = new URLSearchParams(initDataRaw);
    const hash = params.get("hash");
    if (!hash) {
      return { valid: false, error: "Missing hash" };
    }

    // Build data-check-string (all fields except hash, sorted alphabetically)
    params.delete("hash");
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

    // HMAC-SHA256: key = HMAC-SHA256("WebAppData", bot_token)
    const secretKey = await hmacSha256("WebAppData", botToken);
    const computedHash = toHex(await hmacSha256(secretKey, dataCheckString));

    if (computedHash !== hash) {
      return { valid: false, error: "Hash mismatch — possible tampering" };
    }

    // Check auth_date (reject if older than 24 hours)
    const authDate = parseInt(params.get("auth_date") ?? "0", 10);
    const age = Date.now() / 1000 - authDate;
    if (age > 86400) {
      return { valid: false, error: "initData expired (older than 24h)" };
    }

    // Parse user field
    const userJson = params.get("user");
    const user: TelegramUser | undefined = userJson
      ? JSON.parse(decodeURIComponent(userJson))
      : undefined;

    const data: TelegramInitData = {
      query_id: params.get("query_id") ?? undefined,
      user,
      auth_date: authDate,
      hash,
      start_param: params.get("start_param") ?? undefined,
    };

    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation error",
    };
  }
}

// ======================================
// Validate Telegram Bot Webhook Secret Token
// ======================================

export function validateWebhookSecret(secretHeader: string | null): boolean {
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret) return false;
  return secretHeader === expectedSecret;
}

// ======================================
// Send Telegram Message
// ======================================

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    reply_markup?: object;
    disable_notification?: boolean;
  }
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...options,
    }),
  });

  const result = (await response.json()) as { ok: boolean };
  return result.ok;
}

// ======================================
// Download voice file from Telegram
// ======================================

export async function downloadVoiceFile(fileId: string): Promise<Uint8Array | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  // Get file path
  const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const fileInfoRes = await fetch(fileInfoUrl);
  const fileInfo = (await fileInfoRes.json()) as {
    ok: boolean;
    result?: { file_path: string };
  };

  if (!fileInfo.ok || !fileInfo.result?.file_path) return null;

  // Download file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) return null;

  const arrayBuffer = await fileRes.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ======================================
// Bot reply templates (Lao "ป้า" style)
// ======================================

export function buildSuccessReply(
  type: "income" | "expense",
  amount: number,
  description: string,
  balance: { income: number; expense: number }
): string {
  const emoji = type === "income" ? "💚" : "🔴";
  const typeLabel = type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ";
  const amountStr = new Intl.NumberFormat("lo-LA").format(amount);
  const net = balance.income - balance.expense;
  const netStr = new Intl.NumberFormat("lo-LA").format(Math.abs(net));

  return `${emoji} ປ້າບັນທຶກໃຫ້ແລ້ວ!\n\n📝 ${typeLabel}: ${amountStr} ກີບ\n💬 ${description}\n\n📊 ຍອດລວມເດືອນນີ້:\n💚 ຮັບ: ${new Intl.NumberFormat("lo-LA").format(balance.income)} ກີບ\n🔴 ຈ່າຍ: ${new Intl.NumberFormat("lo-LA").format(balance.expense)} ກີບ\n${net >= 0 ? "✅" : "⚠️"} ຄົງເຫຼືອ: ${net >= 0 ? "+" : "-"}${netStr} ກີບ`;
}

export function buildErrorReply(reason: "parse_failed" | "expired" | "not_registered"): string {
  const messages = {
    parse_failed:
      "🤔 ປ້າບໍ່ເຂົ້າໃຈ...\n\nກະລຸນາສົ່ງຂໍ້ຄວາມໃໝ່ ເຊັ່ນ:\n• ຈ່າຍ 50,000 ຊື້ອາຫານ\n• ຮັບເງິນເດືອນ 1,500,000\n• ได้เงิน 200,000 จากงาน",
    expired:
      "⏰ ການສະມາຊິກໝົດອາຍຸແລ້ວ\n\nກະລຸນາຕໍ່ອາຍຸ 50,000 ກີບ/ເດືອນ\nກົດ /renew ເພື່ອຕໍ່ອາຍຸ 🙏",
    not_registered:
      "👋 ສະບາຍດີ! ປ້າຊ່ວຍຈົດລາຍຮັບ-ລາຍຈ່າຍໃຫ້ທ່ານ\n\nກ່ອນໃຊ້ງານ ກະລຸນາເປີດ Mini App ກ່ອນ 👇",
  };
  return messages[reason];
}

export const DEFAULT_WELCOME_TEMPLATE =
  "🌺 ສະບາຍດີ {{firstName}}!\n\nປ້າຂ້າງບ້ານຢູ່ນີ້ ✨\nຊ່ວຍຈົດລາຍຮັບ-ລາຍຈ່າຍດ້ວຍ AI ພາສາລາວ\n\n💬 ສົ່ງຂໍ້ຄວາມໄດ້ເລີຍ ເຊັ່ນ:\n• \"ຈ່າຍ 50,000 ຊື້ອາຫານ\"\n• \"ຮັບເງິນເດືອນ 1.5ລ້ານ\"\n\n💰 ຄ່າບໍລິການ: 50,000 ກີບ/ເດືອນ\n\nກົດ /subscribe ເພື່ອເລີ່ມໃຊ້ງານ 🙏";

export function buildWelcomeMessage(
  firstName: string,
  template: string = DEFAULT_WELCOME_TEMPLATE
): string {
  return template.replaceAll("{{firstName}}", firstName);
}
