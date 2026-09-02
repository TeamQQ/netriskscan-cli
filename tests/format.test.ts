import { describe, expect, it } from "vitest";
import {
  formatIndex,
  formatNullable,
  formatOrDash,
  formatProxyType,
  formatProxyTypeCompact,
  formatTriState,
} from "../src/output/format.js";

describe("formatTriState", () => {
  it("true -> Yes", () => expect(formatTriState(true)).toBe("Yes"));
  it("false -> No", () => expect(formatTriState(false)).toBe("No"));
  it("null -> Unknown (never collapses to No)", () => expect(formatTriState(null)).toBe("Unknown"));
  it("undefined -> Unknown", () => expect(formatTriState(undefined)).toBe("Unknown"));
});

describe("formatIndex", () => {
  it("keeps 0 as a real value, not falsy", () => expect(formatIndex(0)).toBe("0"));
  it("keeps 92", () => expect(formatIndex(92)).toBe("92"));
  it("keeps 100", () => expect(formatIndex(100)).toBe("100"));
  it("null -> N/A", () => expect(formatIndex(null)).toBe("N/A"));
});

describe("formatNullable", () => {
  it("passes through a real string", () =>
    expect(formatNullable("residential")).toBe("residential"));
  it("null -> N/A", () => expect(formatNullable(null)).toBe("N/A"));
  it("undefined -> N/A", () => expect(formatNullable(undefined)).toBe("N/A"));
});

describe("formatProxyType", () => {
  it("residential_proxy -> Residential Proxy", () =>
    expect(formatProxyType("residential_proxy")).toBe("Residential Proxy"));
  it("isp_proxy -> ISP Proxy", () => expect(formatProxyType("isp_proxy")).toBe("ISP Proxy"));
  it("mobile_proxy -> Mobile Proxy", () =>
    expect(formatProxyType("mobile_proxy")).toBe("Mobile Proxy"));
  it("datacenter_proxy -> Datacenter Proxy", () =>
    expect(formatProxyType("datacenter_proxy")).toBe("Datacenter Proxy"));
  it("unknown_proxy -> Unknown Proxy", () =>
    expect(formatProxyType("unknown_proxy")).toBe("Unknown Proxy"));
  it("null -> -", () => expect(formatProxyType(null)).toBe("-"));
  it("undefined -> - (absent on a server that predates the field)", () =>
    expect(formatProxyType(undefined)).toBe("-"));

  /** A future proxy subtype must render, not throw or silently disappear. */
  it("renders an unrecognised raw value verbatim rather than throwing", () => {
    expect(formatProxyType("satellite_proxy")).toBe("satellite_proxy");
  });
});

describe("formatProxyTypeCompact", () => {
  it("abbreviates each known value for the batch table", () => {
    expect(formatProxyTypeCompact("residential_proxy")).toBe("Residential");
    expect(formatProxyTypeCompact("isp_proxy")).toBe("ISP");
    expect(formatProxyTypeCompact("mobile_proxy")).toBe("Mobile");
    expect(formatProxyTypeCompact("datacenter_proxy")).toBe("Datacenter");
    expect(formatProxyTypeCompact("unknown_proxy")).toBe("Unknown");
  });
  it("null -> -", () => expect(formatProxyTypeCompact(null)).toBe("-"));
  it("renders an unrecognised raw value verbatim", () =>
    expect(formatProxyTypeCompact("satellite_proxy")).toBe("satellite_proxy"));
});

describe("formatOrDash", () => {
  /** The server's canonical crawler name is display text, not raw machine data - it must pass
   * through byte-for-byte, never lower-cased, title-cased, or otherwise reformatted. */
  it("passes a server-owned name through unchanged", () => {
    expect(formatOrDash("Googlebot")).toBe("Googlebot");
    expect(formatOrDash("OAI-SearchBot")).toBe("OAI-SearchBot");
  });
  it("null -> -", () => expect(formatOrDash(null)).toBe("-"));
  it("undefined -> -", () => expect(formatOrDash(undefined)).toBe("-"));
  it("empty string -> -", () => expect(formatOrDash("")).toBe("-"));
});
