import { describe, expect, it } from "vitest";
import { ExitCode, exitCodeForApiErrorCode } from "../src/utils/exitCode.js";

describe("exitCodeForApiErrorCode", () => {
  it("maps key/scope errors to AuthError", () => {
    expect(exitCodeForApiErrorCode("invalid_api_key")).toBe(ExitCode.AuthError);
    expect(exitCodeForApiErrorCode("api_key_disabled")).toBe(ExitCode.AuthError);
    expect(exitCodeForApiErrorCode("scope_not_allowed")).toBe(ExitCode.AuthError);
  });

  it("maps rate limit / quota errors to RateLimitOrQuota", () => {
    expect(exitCodeForApiErrorCode("rate_limit_exceeded")).toBe(ExitCode.RateLimitOrQuota);
    expect(exitCodeForApiErrorCode("quota_exceeded")).toBe(ExitCode.RateLimitOrQuota);
  });

  it("maps everything else to ApiError", () => {
    expect(exitCodeForApiErrorCode("invalid_ip")).toBe(ExitCode.ApiError);
    expect(exitCodeForApiErrorCode("not_found")).toBe(ExitCode.ApiError);
    expect(exitCodeForApiErrorCode("temporarily_unavailable")).toBe(ExitCode.ApiError);
    expect(exitCodeForApiErrorCode("some_future_code")).toBe(ExitCode.ApiError);
  });
});
