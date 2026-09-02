import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCheckResult } from "../src/output/human.js";
import type { IpLocation, IpRiskResponse, RiskReason } from "../src/client/types.js";

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

function response(
  network: Partial<IpRiskResponse["network"]> = {},
  usage?: IpRiskResponse["usage"],
  flags: Partial<IpRiskResponse["flags"]> = {},
): IpRiskResponse {
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
    flags: {
      proxy: false,
      vpn: false,
      tor: false,
      datacenter: null,
      scanner: false,
      abuse: false,
      ...flags,
    },
    ...(usage === undefined ? {} : { usage }),
  };
}

function anonymous(usage: Partial<NonNullable<IpRiskResponse["usage"]>> = {}): IpRiskResponse {
  return response(
    {},
    {
      mode: "anonymous",
      dailyLimit: 30,
      used: 7,
      remaining: 23,
      resetAt: "2026-08-29T00:00:00Z",
      ...usage,
    },
  );
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

describe("Proxy Type row", () => {
  it("shows the human-readable label directly after Proxy, when the address is a proxy", () => {
    const out = render(response({}, undefined, { proxy: true, proxyType: "residential_proxy" }));

    expect(out).toContain("Proxy             Yes");
    expect(out).toContain("Proxy Type        Residential Proxy");
    expect(out.indexOf("Proxy ")).toBeLessThan(out.indexOf("Proxy Type"));
  });

  it("renders each documented proxy subtype", () => {
    const cases: [IpRiskResponse["flags"]["proxyType"], string][] = [
      ["residential_proxy", "Residential Proxy"],
      ["isp_proxy", "ISP Proxy"],
      ["mobile_proxy", "Mobile Proxy"],
      ["datacenter_proxy", "Datacenter Proxy"],
      ["unknown_proxy", "Unknown Proxy"],
    ];
    for (const [proxyType, label] of cases) {
      const out = render(response({}, undefined, { proxy: true, proxyType }));
      expect(out).toContain(`Proxy Type        ${label}`);
    }
  });

  /** Proxy Type is a classification detail, not a signal - "not a proxy" must read as "-", not
   * "Unknown" the way an unchecked Signals row would. */
  it("shows - (not Unknown) when the address is not a proxy", () => {
    const out = render(response({}, undefined, { proxy: false, proxyType: null }));

    expect(out).toContain("Proxy             No");
    expect(out).toContain("Proxy Type        -");
  });

  /** Older servers predate this field entirely; reading it must not throw or print "undefined". */
  it("tolerates a response from a server that predates proxyType", () => {
    const legacy = response({}, undefined, { proxy: true });
    delete (legacy.flags as Record<string, unknown>).proxyType;

    const out = render(legacy);

    expect(out).not.toContain("undefined");
    expect(out).toContain("Proxy Type        -");
  });
});

describe("Identity section", () => {
  it("shows a verified crawler's canonical name", () => {
    const out = render(
      response({}, undefined, { searchCrawler: true, searchCrawlerName: "Googlebot" }),
    );

    expect(out).toContain("Identity");
    expect(out).toContain("Search Crawler    Yes");
    expect(out).toContain("Crawler           Googlebot");
  });

  it("passes an unusual canonical name through unchanged", () => {
    const out = render(
      response({}, undefined, { searchCrawler: true, searchCrawlerName: "OAI-SearchBot" }),
    );

    expect(out).toContain("Crawler           OAI-SearchBot");
  });

  it("shows No / - for an ordinary, non-crawler address", () => {
    const out = render(
      response({}, undefined, { searchCrawler: false, searchCrawlerName: null }),
    );

    expect(out).toContain("Search Crawler    No");
    expect(out).toContain("Crawler           -");
  });

  it("shows Unknown / - when the server could not determine crawler status", () => {
    const out = render(
      response({}, undefined, { searchCrawler: null, searchCrawlerName: null }),
    );

    expect(out).toContain("Search Crawler    Unknown");
    expect(out).toContain("Crawler           -");
  });

  it("is placed between Signals and Request ID", () => {
    const out = render(response({}, undefined, { searchCrawler: true, searchCrawlerName: "Googlebot" }));

    expect(out.indexOf("Signals")).toBeLessThan(out.indexOf("Identity"));
    expect(out.indexOf("Identity")).toBeLessThan(out.indexOf("Request ID"));
  });

  /** Older servers predate these fields entirely; reading them must not throw or print "undefined",
   * and the CLI must still show the section with its Unknown/- placeholders. */
  it("tolerates a response from a server that predates searchCrawler and searchCrawlerName", () => {
    const legacy = response();
    delete (legacy.flags as Record<string, unknown>).searchCrawler;
    delete (legacy.flags as Record<string, unknown>).searchCrawlerName;

    const out = render(legacy);

    expect(out).not.toContain("undefined");
    expect(out).toContain("Identity");
    expect(out).toContain("Search Crawler    Unknown");
    expect(out).toContain("Crawler           -");
  });

  /** A verified crawler is identity, not risk - it must never be implied dangerous even when other
   * signals (e.g. datacenter hosting) are true for the same address. */
  it("does not alter unrelated Signals rows for a verified crawler", () => {
    const out = render(
      response(
        {},
        undefined,
        { searchCrawler: true, searchCrawlerName: "Googlebot", datacenter: true },
      ),
    );

    expect(out).toContain("Datacenter        Yes");
    expect(out).toContain("Search Crawler    Yes");
  });
});

describe("anonymous trial usage", () => {
  it("shows the server-reported allowance as Available", () => {
    const out = render(anonymous());

    expect(out).toContain("Usage");
    expect(out).toContain("Available         23");
    expect(out).toContain("Daily Limit       30");
  });

  /**
   * The 30th query of the day still succeeds, and zero is a real answer. A truthiness check would
   * drop the row on precisely the run where the user most needs to see it.
   */
  it("prints Available 0 rather than omitting the row", () => {
    const out = render(anonymous({ used: 30, remaining: 0 }));

    expect(out).toContain("Available         0");
    expect(out).toContain("Daily Limit       30");
  });

  /** Never `dailyLimit - used`: the server is the only authority on what is left. */
  it("prints remaining verbatim even when it disagrees with dailyLimit minus used", () => {
    const out = render(anonymous({ dailyLimit: 30, used: 7, remaining: 19 }));

    expect(out).toContain("Available         19");
    expect(out).not.toContain("Available         23");
  });

  /** The allowance resets on the UTC day, so a localized time would misdescribe the reset. */
  it("renders the reset instant in UTC, not local time", () => {
    const out = render(anonymous());

    expect(out).toContain("Reset             2026-08-29 00:00 UTC");
  });

  it("omits the Reset row for a missing or unparseable resetAt", () => {
    expect(render(anonymous({ resetAt: undefined }))).not.toContain("Reset");

    const broken = render(anonymous({ resetAt: "not-a-date" }));
    expect(broken).not.toContain("Reset");
    expect(broken).not.toContain("Invalid Date");
    expect(broken).toContain("Available         23");
  });

  it("places Usage between Signals and Request ID", () => {
    const out = render(anonymous());

    expect(out.indexOf("Signals")).toBeLessThan(out.indexOf("Usage"));
    expect(out.indexOf("Usage")).toBeLessThan(out.indexOf("Request ID"));
  });

  /** An API-key caller's allowance is a billing quota, a different thing, shown under --verbose. */
  it("does not show the anonymous block for a keyed request", () => {
    const out = render(response({}, { mode: "api_key", remaining: 4900 }));

    expect(out).not.toContain("Usage");
    expect(out).not.toContain("Available");
  });

  /** Older servers send no usage object at all; that must render exactly as it always did. */
  it("renders a legacy response with no usage field unchanged", () => {
    const out = render(response());

    expect(out).not.toContain("Usage");
    expect(out).not.toContain("Available");
    expect(out).not.toContain("undefined");
    expect(out).toContain("Request ID        req_test12345678");
  });
});

/** A response carrying server-sent geolocation. Every field is independently nullable. */
function located(location: Partial<IpLocation> = {}): IpRiskResponse {
  return {
    ...response(),
    location: {
      countryCode: "US",
      country: "United States",
      regionCode: "CA",
      region: "California",
      city: "Los Angeles",
      timeZone: "America/Los_Angeles",
      ...location,
    },
  };
}

/** A response carrying server-sent reasons. `undefined` models a server that predates the field. */
function explained(reasons: RiskReason[] | undefined): IpRiskResponse {
  const base = response();
  return reasons === undefined ? base : { ...base, risk: { ...base.risk, reasons } };
}

describe("Location section", () => {
  it("shows the full geolocation the server sent", () => {
    const out = render(located());

    expect(out).toContain("Location");
    expect(out).toContain("Country           United States (US)");
    expect(out).toContain("Region            California (CA)");
    expect(out).toContain("City              Los Angeles");
    expect(out).toContain("Time Zone         America/Los_Angeles");
  });

  it("is placed between Network and Signals", () => {
    const out = render(located());

    expect(out.indexOf("Network")).toBeLessThan(out.indexOf("Location"));
    expect(out.indexOf("Location")).toBeLessThan(out.indexOf("Signals"));
  });

  /**
   * Geo resolution is independently partial - a country with no city is an ordinary result, not an
   * error. Printing five "N/A" rows would dress absence up as data.
   */
  it("prints only the fields the server actually resolved", () => {
    const out = render(
      located({ regionCode: null, region: null, city: null, timeZone: "Europe/Berlin" }),
    );

    expect(out).toContain("Location");
    expect(out).toContain("Time Zone         Europe/Berlin");
    expect(out).not.toContain("Region");
    expect(out).not.toContain("City");
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("null");
    expect(out).not.toContain("Invalid Date");
  });

  it("renders a country-only result as one row", () => {
    const out = render({
      ...response(),
      location: {
        countryCode: "DE",
        country: "Germany",
        regionCode: null,
        region: null,
        city: null,
        timeZone: null,
      },
    });

    expect(out).toContain("Country           Germany (DE)");
    expect(out).not.toContain("Time Zone");
  });

  it("falls back to whichever half of a name/code pair the server sent", () => {
    const nameOnly = render(located({ countryCode: null, regionCode: null }));
    expect(nameOnly).toContain("Country           United States");
    expect(nameOnly).toContain("Region            California");

    const codeOnly = render(located({ country: null, region: null }));
    expect(codeOnly).toContain("Country           US");
    expect(codeOnly).toContain("Region            CA");
  });

  /** An older server omits the key entirely; a newer one can send null for an unlocatable address. */
  it("shows no Location section at all when the server sent none", () => {
    for (const data of [response(), { ...response(), location: null }]) {
      const out = render(data);
      expect(out).not.toContain("Location");
      expect(out).not.toContain("Country");
      expect(out).not.toContain("Time Zone");
      expect(out).not.toContain("undefined");
      expect(out).toContain("Network");
      expect(out).toContain("Signals");
    }
  });

  /** A present-but-entirely-empty object is still nothing to say - no heading over blank rows. */
  it("shows no Location section when every field came back null", () => {
    const out = render(
      located({
        countryCode: null,
        country: null,
        regionCode: null,
        region: null,
        city: null,
        timeZone: null,
      }),
    );

    expect(out).not.toContain("Location");
  });
});

describe("Risk Reasons section", () => {
  it("renders a single reason with its severity", () => {
    const out = render(
      explained([{ code: "RESIDENTIAL_PROXY_DETECTED", category: "anonymity", severity: "high" }]),
    );

    expect(out).toContain("Risk Reasons");
    expect(out).toContain("Residential Proxy Detected    high");
  });

  it("renders every reason the server sent, in the server's order", () => {
    const out = render(
      explained([
        { code: "VERIFIED_SEARCH_CRAWLER", category: "identity", severity: "info" },
        { code: "PUBLIC_INFRASTRUCTURE", category: "network", severity: "info" },
      ]),
    );

    expect(out).toContain("Verified Search Crawler");
    expect(out).toContain("Public Infrastructure");
    expect(out.indexOf("Verified Search Crawler")).toBeLessThan(out.indexOf("Public Infrastructure"));
  });

  it("is placed under the risk summary it explains, above Network", () => {
    const out = render(
      explained([{ code: "VPN_DETECTED", category: "anonymity", severity: "medium" }]),
    );

    expect(out.indexOf("Assessment")).toBeLessThan(out.indexOf("Risk Reasons"));
    expect(out.indexOf("Risk Reasons")).toBeLessThan(out.indexOf("Network"));
  });

  /** The ordinary case: an unremarkable address must not gain an empty heading. */
  it("shows no section for an empty list or a server that predates the field", () => {
    for (const data of [explained([]), explained(undefined)]) {
      const out = render(data);
      expect(out).not.toContain("Risk Reasons");
      expect(out).not.toContain("undefined");
      expect(out).toContain("Network");
    }
  });

  /**
   * The server's vocabulary is additive. An unrecognised code is rendered, never dropped, and never
   * relabelled "Unknown" - and an unrecognised severity must not reach the colour switch as a hole.
   */
  it("renders an unknown code and an unknown severity without throwing", () => {
    const out = render(
      explained([
        { code: "NEW_FUTURE_NETWORK_SIGNAL", category: "network", severity: "info" },
        { code: "SOMETHING_NEW", category: "future_category", severity: "future_level" },
      ]),
    );

    expect(out).toContain("New Future Network Signal");
    expect(out).toContain("Something New");
    expect(out).toContain("future_level");
    expect(out).not.toContain("Unknown Reason");
  });

  /**
   * Reasons are server-owned facts. `flags.tor === true` says the address is Tor, not that it is an
   * *exit* node - only the server can say which, and the CLI must not upgrade one to the other.
   */
  it("shows TOR_RELAY as Tor Relay and never as an exit node", () => {
    const out = render({
      ...explained([{ code: "TOR_RELAY", category: "anonymity", severity: "medium" }]),
      flags: { ...response().flags, tor: true },
    });

    expect(out).toContain("Tor               Yes");
    expect(out).toContain("Tor Relay");
    expect(out).not.toContain("Tor Exit Node");
  });

  it("shows TOR_EXIT_NODE only when the server actually said so", () => {
    const out = render({
      ...explained([{ code: "TOR_EXIT_NODE", category: "anonymity", severity: "high" }]),
      flags: { ...response().flags, tor: true },
    });

    expect(out).toContain("Tor Exit Node");
  });

  /**
   * A residential address whose server-sent reason is RESIDENTIAL_NETWORK renders that reason - but
   * the CLI never invents it from `network.type === "residential"`, which is why the reasons-free
   * counterpart above shows no section at all.
   */
  it("renders an explanatory, non-threatening reason as an ordinary row", () => {
    const out = render({
      ...explained([{ code: "RESIDENTIAL_NETWORK", category: "network", severity: "info" }]),
      network: { ...response().network, type: "residential" },
      flags: { ...response().flags, proxy: false, proxyType: null },
    });

    expect(out).toContain("Residential Network");
    expect(out).toContain("info");
    expect(out).toContain("Proxy             No");
    expect(out).toContain("Proxy Type        -");
  });

  /** The human label is terminal decoration; it must never replace the machine code elsewhere. */
  it("does not print the raw screaming-snake code for a documented reason", () => {
    const out = render(
      explained([{ code: "RESIDENTIAL_PROXY_DETECTED", category: "anonymity", severity: "high" }]),
    );

    expect(out).not.toContain("RESIDENTIAL_PROXY_DETECTED");
  });
});

/**
 * The full P0 shape, and the consistency case fixed in the previous release: a verified crawler
 * whose network profile, identity rows and reasons must all agree.
 */
describe("verified crawler with location and reasons", () => {
  function crawler(): IpRiskResponse {
    return {
      requestId: "req_crawler12345",
      risk: {
        index: 95,
        band: "excellent",
        assessmentGrade: "complete",
        reasons: [
          { code: "VERIFIED_SEARCH_CRAWLER", category: "identity", severity: "info" },
          { code: "PUBLIC_INFRASTRUCTURE", category: "network", severity: "info" },
        ],
      },
      network: {
        type: "public_infrastructure",
        profile: "search_crawler",
        service: "Googlebot",
        connectionType: "direct",
        asn: "AS15169",
        organization: "Google LLC",
      },
      location: {
        countryCode: "US",
        country: "United States",
        regionCode: "CA",
        region: "California",
        city: "Mountain View",
        timeZone: "America/Los_Angeles",
      },
      flags: {
        proxy: false,
        proxyType: null,
        vpn: false,
        tor: false,
        datacenter: false,
        scanner: null,
        abuse: false,
        searchCrawler: true,
        searchCrawlerName: "Googlebot",
      },
    };
  }

  it("shows profile, service, reasons and identity consistently", () => {
    const out = render(crawler());

    expect(out).toContain("Profile           search_crawler");
    expect(out).toContain("Service           Googlebot");
    expect(out).toContain("Verified Search Crawler");
    expect(out).toContain("Public Infrastructure");
    expect(out).toContain("Search Crawler    Yes");
    expect(out).toContain("Crawler           Googlebot");
    expect(out).toContain("City              Mountain View");
  });

  /** Identity is not risk: info-severity reasons must not turn unrelated signals into warnings. */
  it("leaves the tri-state signals untouched", () => {
    const out = render(crawler());

    expect(out).toContain("Proxy             No");
    expect(out).toContain("Proxy Type        -");
    expect(out).toContain("Scanner           Unknown");
    expect(out).toContain("Index             95");
    expect(out).toContain("Band              excellent");
  });
});
