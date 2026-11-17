import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerCheckCommand } from "../src/commands/check.js";
import { ExitCode } from "../src/utils/exitCode.js";
import { mockResponse } from "./helpers.js";

const originalKey = process.env.NETRISKSCAN_API_KEY;

/** The full P0 shape: geolocation plus server-generated reasons, one of them a future code. */
function p0Body(): Record<string, unknown> {
  return {
    requestId: "req_newserver",
    risk: {
      index: 42,
      band: "poor",
      assessmentGrade: "complete",
      reasons: [
        { code: "RESIDENTIAL_PROXY_DETECTED", category: "anonymity", severity: "high" },
        {
          code: "NEW_FUTURE_NETWORK_SIGNAL",
          category: "future_category",
          severity: "future_level",
        },
      ],
    },
    network: {
      type: "residential",
      connectionType: "proxied",
      asn: "AS123",
      organization: "Example ISP",
    },
    location: {
      countryCode: "US",
      country: "United States",
      regionCode: "CA",
      region: "California",
      city: "Los Angeles",
      timeZone: "America/Los_Angeles",
    },
    flags: {
      proxy: true,
      proxyType: "residential_proxy",
      vpn: false,
      tor: false,
      datacenter: false,
      scanner: null,
      abuse: false,
    },
  };
}

/** A server that predates both P0 fields. */
function legacyBody(): Record<string, unknown> {
  return {
    requestId: "req_oldserver",
    risk: { index: 95, band: "excellent", assessmentGrade: "complete" },
    network: { type: "residential", connectionType: "direct", asn: "AS123", organization: "ISP" },
    flags: {
      proxy: false,
      vpn: false,
      tor: false,
      datacenter: false,
      scanner: false,
      abuse: false,
    },
  };
}

/** The Schema 1.6.0 shape: network domain/range plus the five extended geolocation fields. */
function schema160Body(): Record<string, unknown> {
  return {
    requestId: "req_schema160",
    risk: { index: 96, band: "excellent", assessmentGrade: "complete" },
    network: {
      type: "public_infrastructure",
      connectionType: "direct",
      asn: "AS15169",
      organization: "Google LLC",
      domain: "google.com",
      range: "142.250.190.64/26",
    },
    location: {
      countryCode: "US",
      country: "United States",
      regionCode: "IL",
      region: "Illinois",
      city: "Chicago",
      timeZone: "America/Chicago",
      continentCode: "NA",
      continent: "North America",
      postalCode: "60666",
      latitude: 41.8781,
      longitude: -87.6298,
    },
    flags: {
      proxy: false,
      proxyType: null,
      vpn: false,
      tor: false,
      datacenter: true,
      scanner: null,
      abuse: false,
      searchCrawler: false,
      searchCrawlerName: null,
    },
  };
}

/** Runs the real command wiring and returns stdout, colour codes stripped. */
async function runCheck(args: string[]): Promise<string> {
  let out = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const program = new Command();
  program.exitOverride();
  registerCheckCommand(program);
  await program.parseAsync(args, { from: "user" });
  // eslint-disable-next-line no-control-regex
  return out.replace(/\[[0-9;]*m/g, "");
}

describe("check --json", () => {
  beforeEach(() => {
    delete process.env.NETRISKSCAN_API_KEY;
    process.exitCode = undefined;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.exitCode = undefined;
    if (originalKey === undefined) delete process.env.NETRISKSCAN_API_KEY;
    else process.env.NETRISKSCAN_API_KEY = originalKey;
  });

  /**
   * `--json` is passthrough, not a second DTO: whatever the server sent is what comes out, so a
   * field the server adds appears without the CLI being taught about it.
   */
  it("prints the server response verbatim, including location and risk.reasons", async () => {
    const body = p0Body();
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, body));

    const out = await runCheck(["check", "203.0.113.10", "--json"]);

    expect(JSON.parse(out)).toEqual(body);
  });

  /**
   * Human formatting and machine output are strictly separated: the terminal shows
   * "Residential Proxy Detected", `--json` must still carry `RESIDENTIAL_PROXY_DETECTED`.
   */
  it("keeps reason code, category and severity in their raw machine form", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));

    const out = await runCheck(["check", "203.0.113.10", "--json"]);
    const parsed = JSON.parse(out) as {
      risk: { reasons: { code: string; category: string; severity: string }[] };
    };

    expect(parsed.risk.reasons[0]).toEqual({
      code: "RESIDENTIAL_PROXY_DETECTED",
      category: "anonymity",
      severity: "high",
    });
    expect(parsed.risk.reasons[1].category).toBe("future_category");
    expect(parsed.risk.reasons[1].severity).toBe("future_level");
    expect(out).not.toContain("Residential Proxy Detected");
    expect(out).not.toContain("NetRiskScan\n");
  });

  it("preserves an old server's response shape exactly, adding no keys", async () => {
    const body = legacyBody();
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, body));

    const out = await runCheck(["check", "8.8.8.8", "--json"]);
    const parsed = JSON.parse(out) as Record<string, unknown>;

    expect(parsed).toEqual(body);
    expect(Object.keys(parsed)).not.toContain("location");
    expect(parsed.risk).not.toHaveProperty("reasons");
  });

  /** Schema 1.6.0 is passthrough too: all seven fields leave exactly as the server sent them. */
  it("prints all seven schema 1.6.0 fields verbatim, with no terminal decoration", async () => {
    const body = schema160Body();
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, body));

    const out = await runCheck(["check", "142.250.190.78", "--json"]);
    const parsed = JSON.parse(out) as {
      network: { domain: string; range: string };
      location: { postalCode: string; latitude: number; longitude: number };
    };

    expect(parsed).toEqual(body);
    expect(parsed.network.domain).toBe("google.com");
    expect(parsed.network.range).toBe("142.250.190.64/26");
    expect(parsed.location.postalCode).toBe("60666");
    expect(parsed.location.latitude).toBe(41.8781);
    expect(parsed.location.longitude).toBe(-87.6298);
    expect(out).not.toContain("NetRiskScan\n");
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/\u001b\[/);
  });

  it("preserves null for every new field instead of coercing it", async () => {
    const body = schema160Body();
    (body.network as Record<string, unknown>).domain = null;
    (body.network as Record<string, unknown>).range = null;
    Object.assign(body.location as Record<string, unknown>, {
      continentCode: null,
      continent: null,
      postalCode: null,
      latitude: null,
      longitude: null,
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, body));

    const out = await runCheck(["check", "8.8.8.8", "--json"]);
    const parsed = JSON.parse(out) as {
      network: Record<string, unknown>;
      location: Record<string, unknown>;
    };

    expect(parsed).toEqual(body);
    expect(parsed.network.domain).toBeNull();
    expect(parsed.network.range).toBeNull();
    expect(parsed.location.latitude).toBeNull();
    expect(parsed.location.longitude).toBeNull();
    expect(parsed.location.postalCode).toBeNull();
    expect(out).toContain('"latitude": null');
    expect(out).not.toContain('"latitude": 0');
  });

  it("adds none of the seven keys for a server that predates them", async () => {
    const body = {
      ...legacyBody(),
      location: {
        countryCode: "US",
        country: "United States",
        regionCode: "CA",
        region: "California",
        city: "Los Angeles",
        timeZone: "America/Los_Angeles",
      },
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, body));

    const out = await runCheck(["check", "8.8.8.8", "--json"]);
    const parsed = JSON.parse(out) as {
      network: Record<string, unknown>;
      location: Record<string, unknown>;
    };

    expect(parsed).toEqual(body);
    expect(parsed.network).not.toHaveProperty("domain");
    expect(parsed.network).not.toHaveProperty("range");
    for (const key of ["continentCode", "continent", "postalCode", "latitude", "longitude"]) {
      expect(parsed.location).not.toHaveProperty(key);
    }
  });

  it("keeps a zero coordinate pair as numbers and the postal code as a string", async () => {
    const body = schema160Body();
    Object.assign(body.location as Record<string, unknown>, {
      postalCode: "01234",
      latitude: 0,
      longitude: 0,
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, body));

    const out = await runCheck(["check", "1.2.3.4", "--json"]);
    const parsed = JSON.parse(out) as {
      location: { postalCode: unknown; latitude: unknown; longitude: unknown };
    };

    expect(parsed.location.latitude).toBe(0);
    expect(parsed.location.longitude).toBe(0);
    expect(typeof parsed.location.postalCode).toBe("string");
    expect(parsed.location.postalCode).toBe("01234");
  });
});

describe("check human output over a P0 response", () => {
  beforeEach(() => {
    delete process.env.NETRISKSCAN_API_KEY;
    process.exitCode = undefined;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.exitCode = undefined;
    if (originalKey === undefined) delete process.env.NETRISKSCAN_API_KEY;
    else process.env.NETRISKSCAN_API_KEY = originalKey;
  });

  it("renders Risk Reasons and Location end to end", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));

    const out = await runCheck(["check", "203.0.113.10"]);

    expect(out).toContain("Risk Reasons");
    expect(out).toContain("Residential Proxy Detected");
    expect(out).toContain("New Future Network Signal");
    expect(out).toContain("Location");
    expect(out).toContain("Country           United States (US)");
    expect(out).toContain("City              Los Angeles");
    expect(out).toContain("Scanner           Unknown");
  });

  it("shows neither section for a server that sends neither field", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, legacyBody()));

    const out = await runCheck(["check", "8.8.8.8"]);

    expect(out).not.toContain("Risk Reasons");
    expect(out).not.toContain("Location");
    expect(out).not.toContain("undefined");
    expect(out).toContain("Index             95");
    expect(process.exitCode).toBe(ExitCode.Success);
  });
});

/**
 * P0 is display-only. Reasons explain the server's verdict; they are never a second input to the
 * exit code, and the flag vocabulary `--fail-on` accepts is unchanged.
 */
describe("CI policy is unaffected by reasons and location", () => {
  beforeEach(() => {
    delete process.env.NETRISKSCAN_API_KEY;
    process.exitCode = undefined;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.exitCode = undefined;
    if (originalKey === undefined) delete process.env.NETRISKSCAN_API_KEY;
    else process.env.NETRISKSCAN_API_KEY = originalKey;
  });

  it("exits 0 for a high-severity reason when no policy flag was passed", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));

    await runCheck(["check", "203.0.113.10"]);

    expect(process.exitCode).toBe(ExitCode.Success);
  });

  /** Still purely `risk.index` versus the threshold - the reason list plays no part. */
  it("gates on risk.index alone for --fail-below", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));
    await runCheck(["check", "203.0.113.10", "--fail-below", "60"]);
    expect(process.exitCode).toBe(ExitCode.CiPolicyFailed);

    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));
    await runCheck(["check", "203.0.113.10", "--fail-below", "40"]);
    expect(process.exitCode).toBe(ExitCode.Success);
  });

  it("still trips --fail-on only on the documented flags", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));
    await runCheck(["check", "203.0.113.10", "--fail-on", "proxy"]);
    expect(process.exitCode).toBe(ExitCode.CiPolicyFailed);

    vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));
    await runCheck(["check", "203.0.113.10", "--fail-on", "vpn"]);
    expect(process.exitCode).toBe(ExitCode.Success);
  });

  /** Reasons, geography and crawler identity are not risk flags and must not become gate inputs. */
  it("rejects a --fail-on value P0 might tempt someone to add", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(mockResponse(200, p0Body()));

    for (const flag of ["reason", "country", "searchCrawler"]) {
      process.exitCode = undefined;
      await runCheck(["check", "203.0.113.10", "--fail-on", flag]);
      expect(process.exitCode).toBe(ExitCode.InvalidArgument);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** Schema 1.6.0 is display-only: the gate still reads risk.index and nothing else. */
  it("gates on risk.index alone even with the schema 1.6.0 fields present", async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(200, schema160Body()));
    await runCheck(["check", "142.250.190.78", "--fail-below", "97"]);
    expect(process.exitCode).toBe(ExitCode.CiPolicyFailed);

    vi.mocked(fetch).mockResolvedValue(mockResponse(200, schema160Body()));
    await runCheck(["check", "142.250.190.78", "--fail-below", "90"]);
    expect(process.exitCode).toBe(ExitCode.Success);
  });

  /** The new fields are not risk flags either - the --fail-on vocabulary is unchanged. */
  it("rejects the schema 1.6.0 fields as --fail-on values", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(mockResponse(200, schema160Body()));

    for (const flag of ["domain", "range", "latitude", "continent"]) {
      process.exitCode = undefined;
      await runCheck(["check", "142.250.190.78", "--fail-on", flag]);
      expect(process.exitCode).toBe(ExitCode.InvalidArgument);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
