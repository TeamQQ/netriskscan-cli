import type { Command } from "commander";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { NetRiskScanClient } from "../client/NetRiskScanClient.js";
import { NetRiskScanApiError, NetRiskScanNetworkError } from "../client/errors.js";
import type { AnonymousLimitInfo } from "../client/errors.js";
import type { IpRiskResponse } from "../client/types.js";
import { resolveOptionalApiKey, resolveBaseUrl } from "../utils/env.js";
import { isValidIp } from "../utils/ip.js";
import { runPool } from "../utils/pool.js";
import { ExitCode, exitCodeForApiErrorCode, type ExitCodeValue } from "../utils/exitCode.js";
import { printJsonLine } from "../output/jsonl.js";
import { renderBatchTable } from "../output/table.js";

/**
 * Client-side batch only: sends individual `GET /v1/ip-risk/{ip}` requests with controlled
 * concurrency. There is currently no server-side batch endpoint - do not call one.
 */
const MAX_CONCURRENCY = 20;
const DEFAULT_CONCURRENCY = 5;

export interface BatchItemError {
  code: string;
  message: string;
  requestId?: string;
  /** Present on `anonymous_daily_limit_reached`, so the summary can report the real allowance. */
  anonymousUsage?: AnonymousLimitInfo;
}

export type BatchItemResult =
  | { ip: string; ok: true; result: IpRiskResponse }
  | { ip: string; ok: false; error: BatchItemError };

interface BatchOptions {
  apiKey?: string;
  baseUrl?: string;
  concurrency: string;
  jsonl?: boolean;
  timeout: string;
  maxRetries: string;
}

export function registerBatchCommand(program: Command): void {
  program
    .command("batch <file>")
    .description("Check multiple IP addresses (client-side batch over GET /v1/ip-risk/{ip})")
    .option(
      "--api-key <key>",
      "NetRiskScan API key (optional; uses the anonymous trial when omitted)",
    )
    .option("--base-url <url>", "Override the API base URL (advanced)")
    .option(
      "--concurrency <n>",
      `Number of concurrent requests (default: ${DEFAULT_CONCURRENCY}, max: ${MAX_CONCURRENCY})`,
      String(DEFAULT_CONCURRENCY),
    )
    .option("--jsonl", "Output newline-delimited JSON (one object per IP)")
    .option("--timeout <ms>", "Request timeout in milliseconds", "10000")
    .option("--max-retries <n>", "Maximum automatic retries for 429/503", "3")
    .addHelpText(
      "after",
      `
Notes:
  This is a client-side batch: it sends individual GET /v1/ip-risk/{ip}
  requests with controlled concurrency. NetRiskScan does not currently
  offer a server-side batch endpoint. Make sure the selected concurrency
  complies with the limits shown in your NetRiskScan Developer Dashboard.

  An API key is optional. Without an API key, requests use the anonymous daily
  trial, metered by public IP. How many remain is decided by the server, not by
  this CLI, and is reported in the summary after the table.

Input format:
  One IP per line. Blank lines and lines starting with # are ignored.

Examples:
  $ netriskscan batch ips.txt
  $ cat ips.txt | netriskscan batch -
  $ netriskscan batch ips.txt --concurrency 10 --jsonl > results.jsonl
`,
    )
    .action(async (file: string, options: BatchOptions) => {
      await runBatch(file, options);
    });
}

async function readIps(file: string): Promise<string[]> {
  const stream = file === "-" ? process.stdin : createReadStream(file, "utf8");
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const ips: string[] = [];
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    ips.push(line);
  }
  return ips;
}

function parseConcurrency(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CONCURRENCY;
  if (n > MAX_CONCURRENCY) {
    process.stderr.write(
      `Warning: --concurrency ${n} exceeds the safety cap of ${MAX_CONCURRENCY}; using ${MAX_CONCURRENCY}.\n` +
        "Check your NetRiskScan Developer Dashboard for your plan's concurrency limit.\n",
    );
    return MAX_CONCURRENCY;
  }
  return Math.floor(n);
}

function toBatchError(err: unknown): BatchItemError {
  if (err instanceof NetRiskScanApiError) {
    return {
      code: err.code,
      message: err.message,
      requestId: err.requestId,
      anonymousUsage: err.anonymousUsage,
    };
  }
  if (err instanceof NetRiskScanNetworkError) {
    return { code: "network_error", message: err.message, requestId: err.requestId };
  }
  return { code: "unknown_error", message: err instanceof Error ? err.message : String(err) };
}

async function runBatch(file: string, options: BatchOptions): Promise<void> {
  const ips = await readIps(file);
  if (ips.length === 0) {
    process.stderr.write("Error: no IP addresses found in input.\n");
    process.exitCode = ExitCode.InvalidArgument;
    return;
  }

  // No key means the anonymous trial. The CLI deliberately does not pre-check the input length
  // against a daily allowance: it cannot know how much of today's allowance was already spent,
  // and only the server can.
  const client = new NetRiskScanClient({
    apiKey: resolveOptionalApiKey(options.apiKey),
    baseUrl: resolveBaseUrl(options.baseUrl),
    timeout: Number(options.timeout),
    maxRetries: Number(options.maxRetries),
  });

  const concurrency = parseConcurrency(options.concurrency);

  const results = await runPool(ips, concurrency, async (ip): Promise<BatchItemResult> => {
    if (!isValidIp(ip)) {
      return {
        ip,
        ok: false,
        error: { code: "invalid_ip", message: `"${ip}" is not a valid IPv4 or IPv6 address.` },
      };
    }
    try {
      const { data } = await client.checkIp(ip);
      return { ip, ok: true, result: data };
    } catch (err) {
      return { ip, ok: false, error: toBatchError(err) };
    }
  });

  if (options.jsonl) {
    for (const item of results) {
      printJsonLine(item);
    }
  } else {
    renderBatchTable(results);
  }

  process.exitCode = computeBatchExitCode(results);
}

function computeBatchExitCode(results: readonly BatchItemResult[]): ExitCodeValue {
  const failures = results.filter((r): r is Extract<BatchItemResult, { ok: false }> => !r.ok);
  if (failures.length === 0) return ExitCode.Success;

  const codes = failures.map((f) => exitCodeForApiErrorCode(f.error.code));
  if (codes.includes(ExitCode.AuthError)) return ExitCode.AuthError;
  if (codes.includes(ExitCode.RateLimitOrQuota)) return ExitCode.RateLimitOrQuota;
  return ExitCode.ApiError;
}
