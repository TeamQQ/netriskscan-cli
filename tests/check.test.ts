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
        { code: "NEW_FUTURE_NETWORK_SIGNAL", category: "future_category", severity: "future_level" },
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
});
