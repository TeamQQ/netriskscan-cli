import type { Command } from "commander";
import ora from "ora";
import { NetRiskScanClient } from "../client/NetRiskScanClient.js";
import {
  ANONYMOUS_DAILY_LIMIT_CODE,
  NetRiskScanApiError,
  NetRiskScanNetworkError,
} from "../client/errors.js";
import type { IpRiskResponse, RiskFlagName } from "../client/types.js";
import { resolveOptionalApiKey, resolveBaseUrl } from "../utils/env.js";
import { isValidIp } from "../utils/ip.js";
import { ExitCode, exitCodeForApiErrorCode, type ExitCodeValue } from "../utils/exitCode.js";
import { renderCheckResult, renderVerboseMeta } from "../output/human.js";
import { printJson } from "../output/json.js";
import { printAnonymousLimitError, printApiError, printNetworkError } from "../output/errors.js";

const KNOWN_FLAGS: readonly RiskFlagName[] = [
  "proxy",
  "vpn",
  "tor",
  "datacenter",
  "scanner",
  "abuse",
];

interface CheckOptions {
  apiKey?: string;
  baseUrl?: string;
  json?: boolean;
  verbose?: boolean;
  debug?: boolean;
  timeout: string;
  maxRetries: string;
  failBelow?: string;
  failOn: string[];
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function registerCheckCommand(program: Command): void {
  program
    .command("check <ip>")
    .description("Check IP risk and network intelligence")
    .option(
      "--api-key <key>",
      "NetRiskScan API key (optional; uses the anonymous trial when omitted)",
    )
    .option("--base-url <url>", "Override the API base URL (advanced)")
    .option("--json", "Output machine-readable JSON")
    .option("--verbose", "Show rate limit, quota and request id")
    .option("--debug", "Show debug information on failure")
    .option("--timeout <ms>", "Request timeout in milliseconds", "10000")
    .option("--max-retries <n>", "Maximum automatic retries for 429/503", "3")
    .option("--fail-below <index>", "Exit non-zero if risk.index is below this threshold (CI use)")
    .option(
      "--fail-on <flag>",
      "Exit non-zero if the given flag is true (repeatable): proxy, vpn, tor, datacenter, scanner, abuse",
      collect,
      [] as string[],
    )
    .addHelpText(
      "after",
      `
Examples:
  $ netriskscan check 1.1.1.1
  $ netriskscan check 1.1.1.1 --json
  $ netriskscan check 1.2.3.4 --fail-below 60
  $ netriskscan check 1.2.3.4 --fail-on tor --fail-on proxy

Notes:
  An API key is optional. Without one, requests use the anonymous daily trial,
  metered by public IP; the response reports how many are left.
`,
    )
    .action(async (ip: string, options: CheckOptions) => {
      await runCheck(ip, options);
    });
}

async function runCheck(ip: string, options: CheckOptions): Promise<void> {
  const useJson = Boolean(options.json);

  for (const flag of options.failOn) {
    if (!KNOWN_FLAGS.includes(flag as RiskFlagName)) {
      process.stderr.write(
        `Error: unknown --fail-on flag "${flag}". Expected one of: ${KNOWN_FLAGS.join(", ")}\n`,
      );
      process.exitCode = ExitCode.InvalidArgument;
      return;
    }
  }

  if (!isValidIp(ip)) {
    process.stderr.write(`Error: "${ip}" is not a valid IPv4 or IPv6 address.\n`);
    process.exitCode = ExitCode.InvalidArgument;
    return;
  }

  // Undefined is a supported mode: the client then omits Authorization and the server serves the
  // request from the anonymous daily trial.
  const client = new NetRiskScanClient({
    apiKey: resolveOptionalApiKey(options.apiKey),
    baseUrl: resolveBaseUrl(options.baseUrl),
    timeout: Number(options.timeout),
    maxRetries: Number(options.maxRetries),
  });

  const spinner = useJson
    ? undefined
    : ora({
        text: `Checking ${ip}...`,
        stream: process.stderr,
        isEnabled: process.stderr.isTTY,
      }).start();

  try {
    const { data, meta } = await client.checkIp(ip);
    spinner?.stop();

    if (useJson) {
      printJson(data);
    } else {
      renderCheckResult(ip, data);
      if (options.verbose) {
        renderVerboseMeta(meta);
      }
    }

    process.exitCode = evaluateCiPolicy(data, options);
  } catch (err) {
    spinner?.stop();
    handleCheckError(err, options);
  }
}

function evaluateCiPolicy(data: IpRiskResponse, options: CheckOptions): ExitCodeValue {
  if (options.failOn.length > 0) {
    for (const flag of options.failOn) {
      if (data.flags[flag as RiskFlagName] === true) {
        return ExitCode.CiPolicyFailed;
      }
    }
  }

  if (options.failBelow !== undefined) {
    if (data.risk.index === null) {
      return ExitCode.AssessmentUnavailable;
    }
    if (data.risk.index < Number(options.failBelow)) {
      return ExitCode.CiPolicyFailed;
    }
  }

  return ExitCode.Success;
}

function handleCheckError(err: unknown, options: CheckOptions): void {
  if (err instanceof NetRiskScanApiError) {
    if (err.code === ANONYMOUS_DAILY_LIMIT_CODE) {
      printAnonymousLimitError(err);
    } else {
      printApiError(err, { debug: options.debug });
    }
    process.exitCode = exitCodeForApiErrorCode(err.code);
    return;
  }
  if (err instanceof NetRiskScanNetworkError) {
    printNetworkError(err, { debug: options.debug });
    process.exitCode = ExitCode.ApiError;
    return;
  }
  if (options.debug && err instanceof Error) {
    process.stderr.write(`${err.stack ?? err.message}\n`);
  } else {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  process.exitCode = ExitCode.GeneralError;
}
