import type { NextRequest } from "next/server";

type AdminSessionPayload = {
  uid: string;
  iat: number;
  exp: number;
};

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function encodeBase64Url(input: string): string {
  if (typeof btoa === "function") {
    return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url(input: string): string {
  if (typeof atob === "function") {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return atob(normalized + padding);
  }
  return Buffer.from(input, "base64url").toString("utf8");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getSigningSecret(): string | null {
  const secret =
    process.env.ADMIN_SESSION_SECRET ??
    process.env.WEBHOOK_SECRET ??
    null;
  if (!secret || secret.length < 32) return null;
  return secret;
}

async function hmacSha256Hex(secret: string, input: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return Array.from(new Uint8Array(sig))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getAdminSessionCookieName(): string {
  return ADMIN_SESSION_COOKIE;
}

export async function createAdminSessionToken(adminTelegramId: string): Promise<string | null> {
  const secret = getSigningSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    uid: adminTelegramId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadRaw = JSON.stringify(payload);
  const payloadB64 = encodeBase64Url(payloadRaw);
  const signature = await hmacSha256Hex(secret, payloadB64);
  return `${payloadB64}.${signature}`;
}

export async function validateAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  const secret = getSigningSecret();
  if (!adminId || !secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return false;

  const expectedSig = await hmacSha256Hex(secret, payloadB64);
  if (!safeEqual(expectedSig, providedSig)) return false;

  try {
    const parsed = JSON.parse(decodeBase64Url(payloadB64)) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed?.uid || parsed.uid !== adminId) return false;
    if (!Number.isFinite(parsed.exp) || parsed.exp <= now) return false;
    return true;
  } catch {
    return false;
  }
}

/** Verify signed admin session cookie */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return validateAdminSessionToken(session);
}
