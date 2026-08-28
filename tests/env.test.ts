import { afterEach, describe, expect, it } from "vitest";
import { resolveOptionalApiKey, resolveRequiredApiKey } from "../src/utils/env.js";
import { NetRiskScanConfigError } from "../src/client/errors.js";

const original = process.env.NETRISKSCAN_API_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.NETRISKSCAN_API_KEY;
  else process.env.NETRISKSCAN_API_KEY = original;
});

/** check / batch: a missing key is a supported mode (the anonymous trial), never an error. */
describe("resolveOptionalApiKey", () => {
  it("prefers --api-key over the environment variable", () => {
    process.env.NETRISKSCAN_API_KEY = "env_key";
    expect(resolveOptionalApiKey("cli_key")).toBe("cli_key");
  });

  it("falls back to NETRISKSCAN_API_KEY", () => {
    process.env.NETRISKSCAN_API_KEY = "env_key";
    expect(resolveOptionalApiKey(undefined)).toBe("env_key");
  });

  it("returns undefined instead of throwing when neither is set", () => {
    delete process.env.NETRISKSCAN_API_KEY;
    expect(resolveOptionalApiKey(undefined)).toBeUndefined();
  });

  it("treats an empty environment variable as absent rather than as an empty key", () => {
    process.env.NETRISKSCAN_API_KEY = "";
    expect(resolveOptionalApiKey(undefined)).toBeUndefined();
  });
});

/** usage: account data has no anonymous form, so the key stays mandatory here. */
describe("resolveRequiredApiKey", () => {
  it("prefers --api-key over the environment variable", () => {
    process.env.NETRISKSCAN_API_KEY = "env_key";
    expect(resolveRequiredApiKey("cli_key")).toBe("cli_key");
  });

  it("falls back to NETRISKSCAN_API_KEY", () => {
    process.env.NETRISKSCAN_API_KEY = "env_key";
    expect(resolveRequiredApiKey(undefined)).toBe("env_key");
  });

  it("throws NetRiskScanConfigError when neither is set", () => {
    delete process.env.NETRISKSCAN_API_KEY;
    expect(() => resolveRequiredApiKey(undefined)).toThrow(NetRiskScanConfigError);
  });

  /** The message must not imply the whole CLI needs an account - check and batch do not. */
  it("names the usage command rather than the CLI as a whole", () => {
    delete process.env.NETRISKSCAN_API_KEY;
    expect(() => resolveRequiredApiKey(undefined)).toThrow(/usage command/);
  });
});
