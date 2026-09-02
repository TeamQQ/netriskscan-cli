import { describe, expect, it } from "vitest";
import {
  formatGeoName,
  formatIndex,
  formatNullable,
  formatOrDash,
  formatProxyType,
  formatProxyTypeCompact,
  formatRiskReasonCode,
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

describe("formatGeoName", () => {
  it("name + code -> Name (CODE)", () => {
    expect(formatGeoName("United States", "US")).toBe("United States (US)");
    expect(formatGeoName("California", "CA")).toBe("California (CA)");
  });

  /** The server owns both halves independently; a missing one is simply not printed. */
  it("name only -> name", () => expect(formatGeoName("United States", null)).toBe("United States"));
  it("code only -> code", () => expect(formatGeoName(null, "US")).toBe("US"));

  /** undefined, not "N/A": the caller drops the row rather than claiming the server said nothing. */
  it("neither -> undefined", () => {
    expect(formatGeoName(null, null)).toBeUndefined();
    expect(formatGeoName(undefined, undefined)).toBeUndefined();
    expect(formatGeoName("", "")).toBeUndefined();
  });

  /** Server strings are display text: never re-cased, translated, or derived from the code. */
  it("passes server strings through byte-for-byte", () => {
    expect(formatGeoName("Köln", "NW")).toBe("Köln (NW)");
    expect(formatGeoName("new york", "NY")).toBe("new york (NY)");
  });
});

describe("formatRiskReasonCode", () => {
  it("maps the documented codes to their labels", () => {
    const cases: [string, string][] = [
      ["RESIDENTIAL_PROXY_DETECTED", "Residential Proxy Detected"],
      ["ISP_PROXY_DETECTED", "ISP Proxy Detected"],
      ["MOBILE_PROXY_DETECTED", "Mobile Proxy Detected"],
      ["DATACENTER_PROXY_DETECTED", "Datacenter Proxy Detected"],
      ["PROXY_DETECTED", "Proxy Detected"],
      ["VPN_DETECTED", "VPN Detected"],
      ["TOR_RELAY", "Tor Relay"],
      ["TOR_EXIT_NODE", "Tor Exit Node"],
      ["KNOWN_SCANNER", "Known Scanner"],
      ["ABUSE_ACTIVITY", "Abuse Activity"],
      ["BLACKLIST_MATCH", "Blacklist Match"],
      ["BOTNET_C2", "Botnet C2"],
      ["COMPROMISED_HOST", "Compromised Host"],
      ["VERIFIED_SEARCH_CRAWLER", "Verified Search Crawler"],
      ["PUBLIC_INFRASTRUCTURE", "Public Infrastructure"],
      ["RESIDENTIAL_NETWORK", "Residential Network"],
      ["CONFLICTING_EVIDENCE", "Conflicting Evidence"],
      ["INSUFFICIENT_EVIDENCE", "Insufficient Evidence"],
    ];
    for (const [code, label] of cases) {
      expect(formatRiskReasonCode(code)).toBe(label);
    }
  });

  /**
   * The reason vocabulary is additive server-side. A CLI already installed when a new code ships
   * must render it, not throw, drop it, or hide it behind "Unknown".
   */
  it("title-cases a code it has never seen instead of throwing", () => {
    expect(() => formatRiskReasonCode("NEW_FUTURE_REASON")).not.toThrow();
    expect(formatRiskReasonCode("NEW_FUTURE_REASON")).toBe("New Future Reason");
    expect(formatRiskReasonCode("NEW_FUTURE_NETWORK_SIGNAL")).toBe("New Future Network Signal");
    expect(formatRiskReasonCode("SOMETHING_NEW")).toBe("Something New");
  });

  it("survives degenerate values without throwing", () => {
    expect(formatRiskReasonCode("")).toBe("-");
    expect(formatRiskReasonCode(null)).toBe("-");
    expect(formatRiskReasonCode(undefined)).toBe("-");
    expect(formatRiskReasonCode("_")).toBe("_");
    expect(formatRiskReasonCode("SINGLE")).toBe("Single");
  });

  /** The label is terminal decoration only - it must never leak into --json/--jsonl. */
  it("never mutates the code it was given", () => {
    const code = "RESIDENTIAL_PROXY_DETECTED";
    formatRiskReasonCode(code);
    expect(code).toBe("RESIDENTIAL_PROXY_DETECTED");
  });
});
