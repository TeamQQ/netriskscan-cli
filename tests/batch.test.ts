import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerBatchCommand } from "../src/commands/batch.js";
import { ExitCode } from "../src/utils/exitCode.js";
import { mockResponse } from "./helpers.js";

const dir = mkdtempSync(join(tmpdir(), "netriskscan-batch-"));
const originalKey = process.env.NETRISKSCAN_API_KEY;

function ipsFile(...ips: string[]): string {
  const file = join(dir, `ips-${ips.length}-${ips[0]}.txt`);
  writeFileSync(file, `${ips.join("\n")}\n`, "utf8");
  return file;
}

function anonymousBody(remaining: number): Record<string, unknown> {
  return {
    requestId: "req_abc12345678",
    risk: { index: 96, band: "excellent", assessmentGrade: "complete" },
    network: {
      type: "public_infrastructure",
      connectionType: "direct",
      asn: "AS15169",
      organization: "Google LLC",
    },
    flags: { proxy: false, vpn: false, tor: false, datacenter: true, scanner: null, abuse: false },
    usage: {
      mode: "anonymous",
      dailyLimit: 30,
      used: 30 - remaining,
      remaining,
      resetAt: "2026-08-29T00:00:00Z",
    },
  };
}

const limitBody = {
  error: {
    code: "anonymous_daily_limit_reached",
    message: "Anonymous daily limit reached.",
    dailyLimit: 30,
    used: 30,
    remaining: 0,
    resetAt: "2026-08-29T00:00:00Z",
    signupUrl: "https://www.netriskscan.com/developers",
  },
};

/** Runs the real command wiring and returns whatever it wrote to stdout, colour codes stripped. */
async function runBatch(args: string[]): Promise<string> {
  let out = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  const program = new Command();
  program.exitOverride();
  registerBatchCommand(program);
  await program.parseAsync(args, { from: "user" });
  // eslint-disable-next-line no-control-regex
  return out.replace(/\[[0-9;]*m/g, "");
}

describe("batch without an API key", () => {
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

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** Previously this failed before opening a socket; the anonymous trial has to reach the API. */
  it("still sends requests, with no Authorization header", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(mockResponse(200, anonymousBody(23)));

    const out = await runBatch(["batch", ipsFile("8.8.8.8")]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBeUndefined();
    expect(out).toContain("1 succeeded, 0 failed");
    expect(process.exitCode).toBe(ExitCode.Success);
  });

  /**
   * Responses come back out of the order the server charged them, so the lowest remaining seen is
   * the closest thing to the caller's real position - the last or highest would overstate it.
   */
  it("reports the lowest remaining seen across the batch", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, anonymousBody(22)))
      .mockResolvedValueOnce(mockResponse(200, anonymousBody(19)))
      .mockResolvedValueOnce(mockResponse(200, anonymousBody(21)))
      .mockResolvedValueOnce(mockResponse(200, anonymousBody(20)));

    const out = await runBatch([
      "batch",
      ipsFile("1.1.1.1", "8.8.8.8", "9.9.9.9", "1.0.0.1"),
      "--concurrency",
      "1",
    ]);

    expect(out).toContain("Anonymous trial");
    expect(out).toContain("Available         19");
    expect(out).toContain("Daily Limit       30");
  });

  it("reports Available 0 once any request was refused for exhausting the trial", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(200, anonymousBody(1)))
      .mockResolvedValue(mockResponse(429, limitBody));

    const out = await runBatch(["batch", ipsFile("1.1.1.1", "8.8.8.8"), "--concurrency", "1"]);

    expect(out).toContain("Available         0");
    expect(process.exitCode).toBe(ExitCode.RateLimitOrQuota);
  });

  /** One request per IP: a spent daily allowance must not be retried three more times. */
  it("does not retry the anonymous daily limit", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(mockResponse(429, limitBody));

    await runBatch(["batch", ipsFile("1.1.1.1"), "--max-retries", "3"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** The CLI cannot know how much of today's allowance is already spent - only the server can. */
  it("does not impose a local cap on how many IPs may be submitted", async () => {
    // A fresh Response per call: a body can only be read once.
    const fetchMock = vi
      .mocked(fetch)
      .mockImplementation(() => Promise.resolve(mockResponse(200, anonymousBody(5))));
    const many = Array.from({ length: 40 }, (_, i) => `10.0.0.${i + 1}`);

    const out = await runBatch(["batch", ipsFile(...many), "--concurrency", "20"]);

    expect(fetchMock).toHaveBeenCalledTimes(40);
    expect(out).toContain("40 succeeded, 0 failed");
  });

  it("prints no anonymous summary when the server reported no anonymous usage", async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(200, {
        requestId: "req_abc12345678",
        risk: { index: 96, band: "excellent", assessmentGrade: "complete" },
        network: { type: "residential", connectionType: "isp", asn: "AS1", organization: "ISP" },
        flags: {
          proxy: false,
          vpn: false,
          tor: false,
          datacenter: false,
          scanner: false,
          abuse: false,
        },
      }),
    );

    const out = await runBatch(["batch", ipsFile("2.2.2.2")]);

    expect(out).not.toContain("Anonymous trial");
    expect(out).toContain("1 succeeded, 0 failed");
  });
});
