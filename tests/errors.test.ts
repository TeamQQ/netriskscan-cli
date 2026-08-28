import { afterEach, describe, expect, it, vi } from "vitest";
import { printAnonymousLimitError, printConfigError } from "../src/output/errors.js";
import { NetRiskScanApiError, NetRiskScanConfigError } from "../src/client/errors.js";
import { ExitCode, exitCodeForApiErrorCode } from "../src/utils/exitCode.js";

function captureStderr(fn: () => void): string {
  let out = "";
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  fn();
  spy.mockRestore();
  return out;
}

afterEach(() => vi.restoreAllMocks());

describe("printConfigError", () => {
  it("points to a free API key for a missing-key error", () => {
    const out = captureStderr(() =>
      printConfigError(
        new NetRiskScanConfigError(
          "An API key is required for the usage command.\n\nSet NETRISKSCAN_API_KEY or use --api-key.",
        ),
      ),
    );

    expect(out).toContain("Get a free API key");
    expect(out).toContain("https://www.netriskscan.com");
  });

  it("does not append the API key CTA for an unrelated config error", () => {
    const out = captureStderr(() =>
      printConfigError(new NetRiskScanConfigError("Invalid --base-url value.")),
    );

    expect(out).not.toContain("Get a free API key");
  });
});

function limitError(anonymousUsage?: NetRiskScanApiError["anonymousUsage"]): NetRiskScanApiError {
  return new NetRiskScanApiError("Anonymous daily limit reached.", {
    status: 429,
    code: "anonymous_daily_limit_reached",
    anonymousUsage,
  });
}

function strip(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, "");
}

describe("printAnonymousLimitError", () => {
  /**
   * Running out of a free trial is an end-of-trial moment, not a protocol fault, so it must not
   * come out as the technical Code / Status / Message dump.
   */
  it("renders a plain-language block with the allowance and a signup link", () => {
    const out = strip(
      captureStderr(() =>
        printAnonymousLimitError(
          limitError({
            dailyLimit: 30,
            used: 30,
            remaining: 0,
            resetAt: "2026-08-29T00:00:00Z",
            signupUrl: "https://www.netriskscan.com/developers",
          }),
        ),
      ),
    );

    expect(out).toContain("Anonymous daily trial limit reached");
    expect(out).toContain("Available         0");
    expect(out).toContain("Daily Limit       30");
    expect(out).toContain("Reset             2026-08-29 00:00 UTC");
    expect(out).toContain("Get more queries");
    expect(out).toContain("https://www.netriskscan.com/developers");
    expect(out).not.toContain("NetRiskScan API error");
    expect(out).not.toContain("Status     429");
  });

  it("prefers the server's signup URL over the built-in fallback", () => {
    const out = captureStderr(() =>
      printAnonymousLimitError(limitError({ signupUrl: "https://example.test/upgrade" })),
    );

    expect(out).toContain("https://example.test/upgrade");
  });

  /** An older server may send nothing but code and message; the renderer still has to work. */
  it("falls back to Available 0 and the default signup URL when the body carried no allowance", () => {
    const out = strip(captureStderr(() => printAnonymousLimitError(limitError())));

    expect(out).toContain("Available         0");
    expect(out).toContain("https://www.netriskscan.com/developers");
    expect(out).not.toContain("Daily Limit");
    expect(out).not.toContain("Reset");
    expect(out).not.toContain("undefined");
  });

  /** Scripts gate on the exit code, so the trial ending must land on the existing allowance code. */
  it("is reported through exit code 5, not a new code", () => {
    expect(exitCodeForApiErrorCode("anonymous_daily_limit_reached")).toBe(
      ExitCode.RateLimitOrQuota,
    );
    expect(exitCodeForApiErrorCode("anonymous_daily_limit_reached")).toBe(5);
  });
});
