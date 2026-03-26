import type { NextRequest } from "next/server";

type WindowCounter = {
  count: number;
  resetAt: number;
};

const GLOBAL_KEY = "__pkb_rate_limit_store__";

function getStore(): Map<string, WindowCounter> {
  const globalObj = globalThis as unknown as Record<string, unknown>;
  if (!globalObj[GLOBAL_KEY]) {
    globalObj[GLOBAL_KEY] = new Map<string, WindowCounter>();
  }
  return globalObj[GLOBAL_KEY] as Map<string, WindowCounter>;
}

function nowMs(): number {
  return Date.now();
}

export function getRequestIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const store = getStore();
  const ts = nowMs();
  const current = store.get(key);

  if (!current || current.resetAt <= ts) {
    const resetAt = ts + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
