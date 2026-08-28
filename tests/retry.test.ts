import { describe, expect, it } from "vitest";
import { computeBackoffMs, isRetryableFailure, isRetryableStatus } from "../src/client/retry.js";

describe("isRetryableStatus", () => {
  it("retries only 429 and 503", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("never retries 400/401/403/404", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(isRetryableStatus(status)).toBe(false);
    }
  });
});

describe("isRetryableFailure", () => {
  /** Not every 429 is transient: one is a per-minute window, the other a spent daily allowance. */
  it("retries a per-minute 429 but never the anonymous daily limit", () => {
    expect(isRetryableFailure(429, "rate_limit_exceeded")).toBe(true);
    expect(isRetryableFailure(429, "anonymous_daily_limit_reached")).toBe(false);
  });

  it("keeps 503 retryable and 4xx non-retryable", () => {
    expect(isRetryableFailure(503, "temporarily_unavailable")).toBe(true);
    expect(isRetryableFailure(401, "invalid_api_key")).toBe(false);
  });

  it("falls back to status alone when the server sent no error code", () => {
    expect(isRetryableFailure(429)).toBe(true);
    expect(isRetryableFailure(400)).toBe(false);
  });
});

describe("computeBackoffMs", () => {
  it("honors Retry-After when provided", () => {
    expect(computeBackoffMs(1, 2)).toBe(2000);
    expect(computeBackoffMs(3, 0)).toBe(0);
  });

  it("falls back to exponential backoff with jitter when Retry-After is absent", () => {
    const first = computeBackoffMs(1);
    expect(first).toBeGreaterThanOrEqual(1000);
    expect(first).toBeLessThan(1250);

    const second = computeBackoffMs(2);
    expect(second).toBeGreaterThanOrEqual(2000);
    expect(second).toBeLessThan(2250);
  });
});
