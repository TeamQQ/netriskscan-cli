import { ANONYMOUS_DAILY_LIMIT_CODE } from "./errors.js";

/** Only 429 and 503 are automatically retried; 400/401/403/404 never are. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503;
}

/**
 * Status *and* error code decide retryability, because not every 429 is transient.
 *
 * `rate_limit_exceeded` is a short per-minute window and retrying is the right behaviour.
 * `anonymous_daily_limit_reached` is a spent daily allowance that cannot come back before the
 * UTC reset, so retrying it only burns three more round-trips before failing identically.
 */
export function isRetryableFailure(status: number, code?: string): boolean {
  if (code === ANONYMOUS_DAILY_LIMIT_CODE) return false;
  return isRetryableStatus(status);
}

const BASE_DELAY_MS = 1000;
const MAX_JITTER_MS = 250;

/** Honors Retry-After when present; otherwise exponential backoff (1s, 2s, 4s, ...) with jitter. */
export function computeBackoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0
  ) {
    return retryAfterSeconds * 1000;
  }
  const base = BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.random() * MAX_JITTER_MS;
  return base + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
