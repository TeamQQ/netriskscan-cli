import { describe, expect, it } from "vitest";
import { computeBackoffMs, isRetryableStatus } from "../src/client/retry.js";

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
