import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCheckResult } from "../src/output/human.js";
import type { IpRiskResponse } from "../src/client/types.js";

/** Captures what renderCheckResult wrote, with colour codes stripped so assertions read plainly. */
function render(data: IpRiskResponse): string {
  let out = "";
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  renderCheckResult("1.2.3.4", data);
  spy.mockRestore();
  // eslint-disable-next-line no-control-regex
  return out.replace(/\[[0-9;]*m/g, "");
}

function response(network: Partial<IpRiskResponse["network"]> = {}): IpRiskResponse {
  return {
    requestId: "req_test12345678",
    risk: { index: 78, band: "good", assessmentGrade: "complete" },
    network: {
      type: "public_infrastructure",
      connectionType: "direct",
      asn: "AS714",
      organization: "Apple Inc.",
      ...network,
    },
    flags: { proxy: false, vpn: false, tor: false, datacenter: null, scanner: false, abuse: false },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("service identity rows", () => {
  it("shows Profile and Service when the server matched a known service", () => {
    const out = render(response({ profile: "search_crawler", service: "Applebot" }));

    expect(out).toContain("Profile           search_crawler");
    expect(out).toContain("Service           Applebot");
  });

  it("places them between Type and Connection", () => {
    const out = render(response({ profile: "search_crawler", service: "Applebot" }));
    const order = ["Type", "Profile", "Service", "Connection", "ASN", "Organization"];

    const positions = order.map((label) => out.indexOf(`\n${label.padEnd(18)}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  /**
   * The counter-case. An ordinary Apple address is Apple, not Applebot — the server omits both keys, and
   * the CLI must print neither a row nor a placeholder. If a "Profile" row ever appears here, something
   * upstream has started inferring a crawler from an ASN or an operator name.
   */
  it("omits both rows entirely when the address matched no known service", () => {
    const out = render(response());

    expect(out).not.toContain("Profile");
    expect(out).not.toContain("Service");
    expect(out).toContain("Organization      Apple Inc.");
  });

  it("omits a row whose value is null or empty rather than printing N/A", () => {
    const out = render(response({ profile: null, service: "" }));

    expect(out).not.toContain("Profile");
    expect(out).not.toContain("Service");
  });

  /** Older servers predate these fields, so the keys are simply absent. Reading them must not throw or
   * print "undefined". */
  it("tolerates a response from a server that predates the fields", () => {
    const legacy = response();
    delete (legacy.network as Record<string, unknown>).profile;
    delete (legacy.network as Record<string, unknown>).service;

    const out = render(legacy);

    expect(out).not.toContain("undefined");
    expect(out).toContain("Type              public_infrastructure");
  });

  /** The profile vocabulary grows as official sources are onboarded; an unrecognised value renders as
   * itself rather than being dropped or mapped to something wrong. */
  it("renders a profile value it does not recognise", () => {
    const out = render(response({ profile: "some_future_profile", service: "Future Service" }));

    expect(out).toContain("Profile           some_future_profile");
    expect(out).toContain("Service           Future Service");
  });
});

describe("Explore footer", () => {
  /** The check command's human-readable output ends with a project navigation footer. This must stay
   * confined to renderCheckResult - printJson/printJsonLine (used by --json/--jsonl) are separate
   * functions that never call this one, so machine-readable modes can't pick it up by accident. */
  it("prints Web and GitHub links after Request ID", () => {
    const out = render(response());

    expect(out).toContain("Explore");
    expect(out).toContain("Web               https://www.netriskscan.com");
    expect(out).toContain("GitHub            https://github.com/TeamQQ/netriskscan-cli");
    expect(out.indexOf("Request ID")).toBeLessThan(out.indexOf("Explore"));
  });
});

describe("signals stay tri-state", () => {
  /** A crawler identity says nothing about datacenter hosting. When no source checked, the row must read
   * Unknown — collapsing it to "No" would report an unchecked signal as a confirmed absence. */
  it("renders an unchecked signal as Unknown, not No", () => {
    const out = render(response({ profile: "search_crawler", service: "Applebot" }));

    expect(out).toContain("Datacenter        Unknown");
    expect(out).toContain("Proxy             No");
  });
});
