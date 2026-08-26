import { afterEach, describe, expect, it } from "vitest";
import { resolveApiKey } from "../src/utils/env.js";
import { NetRiskScanConfigError } from "../src/client/errors.js";

describe("resolveApiKey", () => {
  const original = process.env.NETRISKSCAN_API_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.NETRISKSCAN_API_KEY;
    else process.env.NETRISKSCAN_API_KEY = original;
  });

  it("prefers --api-key over the environment variable", () => {
    process.env.NETRISKSCAN_API_KEY = "env_key";
    expect(resolveApiKey("cli_key")).toBe("cli_key");
  });

  it("falls back to NETRISKSCAN_API_KEY", () => {
    process.env.NETRISKSCAN_API_KEY = "env_key";
    expect(resolveApiKey(undefined)).toBe("env_key");
  });

  it("throws NetRiskScanConfigError when neither is set", () => {
    delete process.env.NETRISKSCAN_API_KEY;
    expect(() => resolveApiKey(undefined)).toThrow(NetRiskScanConfigError);
  });
});
