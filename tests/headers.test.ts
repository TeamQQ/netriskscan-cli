import { describe, expect, it } from "vitest";
import {
  generateRequestId,
  isValidRequestId,
  parseQuota,
  parseRateLimit,
  redactApiKey,
  redactAuthorizationHeader,
} from "../src/client/headers.js";

describe("request id", () => {
  it("generates an id matching the required pattern", () => {
    expect(isValidRequestId(generateRequestId())).toBe(true);
  });

  it("validates format ^req_[A-Za-z0-9_-]{8,56}$", () => {
    expect(isValidRequestId("req_myjob_12345678")).toBe(true);
    expect(isValidRequestId("bad")).toBe(false);
    expect(isValidRequestId("req_short")).toBe(false);
    expect(isValidRequestId("nope_12345678")).toBe(false);
  });
});

describe("header parsing", () => {
  it("parses rate limit headers", () => {
    const headers = new Headers({
      "x-ratelimit-limit": "120",
      "x-ratelimit-remaining": "118",
      "x-ratelimit-reset": "1700000000",
    });
    expect(parseRateLimit(headers)).toEqual({ limit: 120, remaining: 118, reset: 1700000000 });
  });

  it("parses quota headers", () => {
    const headers = new Headers({
      "x-quota-limit": "50000",
      "x-quota-used": "12450",
      "x-quota-remaining": "37550",
    });
    expect(parseQuota(headers)).toEqual({ limit: 50000, used: 12450, remaining: 37550 });
  });

  it("returns undefined fields when headers are missing", () => {
    expect(parseQuota(new Headers())).toEqual({
      limit: undefined,
      used: undefined,
      remaining: undefined,
    });
  });
});

describe("API key redaction", () => {
  it("never includes the full key", () => {
    const redacted = redactApiKey("nrs_live_abcdefgh1234567890");
    expect(redacted).not.toContain("abcdefgh1234567890");
  });

  it("redacts an Authorization header but keeps the Bearer prefix", () => {
    const redacted = redactAuthorizationHeader("Bearer nrs_live_abcdefgh1234567890");
    expect(redacted.startsWith("Bearer nrs_live_")).toBe(true);
    expect(redacted).not.toContain("abcdefgh1234567890");
  });

  it("fully redacts a malformed header", () => {
    expect(redactAuthorizationHeader("not-a-bearer-token")).toBe("[REDACTED]");
  });
});
