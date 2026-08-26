import { randomBytes } from "node:crypto";
import type { QuotaInfo, RateLimitInfo } from "./types.js";

const REQUEST_ID_PATTERN = /^req_[A-Za-z0-9_-]{8,56}$/;

export function isValidRequestId(id: string): boolean {
  return REQUEST_ID_PATTERN.test(id);
}

export function generateRequestId(): string {
  return `req_${randomBytes(12).toString("hex")}`;
}

function parseIntHeader(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: parseIntHeader(headers.get("x-ratelimit-limit")),
    remaining: parseIntHeader(headers.get("x-ratelimit-remaining")),
    reset: parseIntHeader(headers.get("x-ratelimit-reset")),
  };
}

export function parseQuota(headers: Headers): QuotaInfo {
  return {
    limit: parseIntHeader(headers.get("x-quota-limit")),
    used: parseIntHeader(headers.get("x-quota-used")),
    remaining: parseIntHeader(headers.get("x-quota-remaining")),
  };
}

/** Never log or print a full API key. Keeps a short prefix/suffix for support purposes. */
export function redactApiKey(key: string): string {
  if (key.length <= 9) return "*".repeat(key.length);
  return `${key.slice(0, 9)}${"*".repeat(4)}${key.slice(-4)}`;
}

export function redactAuthorizationHeader(value: string): string {
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) return "[REDACTED]";
  return `Bearer ${redactApiKey(match[1])}`;
}
