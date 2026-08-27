import { afterEach, describe, expect, it, vi } from "vitest";
import { printConfigError } from "../src/output/errors.js";
import { NetRiskScanConfigError } from "../src/client/errors.js";

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
      printConfigError(new NetRiskScanConfigError("NetRiskScan API key is required.\n\nSet NETRISKSCAN_API_KEY or use --api-key.")),
    );

    expect(out).toContain("Get a free API key");
    expect(out).toContain("https://netriskscan.com");
  });

  it("does not append the API key CTA for an unrelated config error", () => {
    const out = captureStderr(() => printConfigError(new NetRiskScanConfigError("Invalid --base-url value.")));

    expect(out).not.toContain("Get a free API key");
  });
});
