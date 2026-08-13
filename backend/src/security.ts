import crypto from "node:crypto";

export const ACCESS_COOKIE = "romana_access_token";
export const REFRESH_COOKIE = "romana_refresh_token";
export const CSRF_COOKIE = "romana_csrf";

interface AttemptRecord {
  count: number;
  resetAt: number;
}

interface AttemptLimiterOptions {
  limit?: number;
  windowMs?: number;
  now?: () => number;
}

export function createAttemptLimiter({
  limit = 5,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
}: AttemptLimiterOptions = {}) {
  const attempts = new Map<string, AttemptRecord>();

  function current(key: string): AttemptRecord | null {
    const record = attempts.get(key);
    if (record && record.resetAt > now()) return record;
    attempts.delete(key);
    return null;
  }

  return {
    isLimited(key: string): boolean {
      return (current(key)?.count ?? 0) >= limit;
    },
    recordFailure(key: string): void {
      const record = current(key);
      if (record) record.count += 1;
      else attempts.set(key, { count: 1, resetAt: now() + windowMs });
    },
    clear(key: string): void {
      attempts.delete(key);
    },
  };
}

export function createCsrfToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function parseCookies(header = ""): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    const rawKey = separator === -1 ? trimmed : trimmed.slice(0, separator);
    const rawValue = separator === -1 ? "" : trimmed.slice(separator + 1);
    try {
      cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
    } catch {
      // Ignore malformed client cookies instead of failing the request.
    }
  }
  return cookies;
}

export function safeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
