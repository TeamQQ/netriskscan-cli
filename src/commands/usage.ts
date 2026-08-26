import type { Command } from "commander";
import ora from "ora";
import { NetRiskScanClient } from "../client/NetRiskScanClient.js";
import { NetRiskScanApiError, NetRiskScanConfigError, NetRiskScanNetworkError } from "../client/errors.js";
import { resolveApiKey, resolveBaseUrl } from "../utils/env.js";
import { ExitCode, exitCodeForApiErrorCode } from "../utils/exitCode.js";
import { renderUsageResult, renderVerboseMeta } from "../output/human.js";
import { printJson } from "../output/json.js";
import { printApiError, printConfigError, printNetworkError } from "../output/errors.js";

interface UsageOptions {
  apiKey?: string;
  baseUrl?: string;
  json?: boolean;
  verbose?: boolean;
  debug?: boolean;
  timeout: string;
  maxRetries: string;
}

export function registerUsageCommand(program: Command): void {
  program
    .command("usage")
    .description("Show API usage and quota for the current billing period")
    .option("--api-key <key>", "NetRiskScan API key (overrides NETRISKSCAN_API_KEY)")
    .option("--base-url <url>", "Override the API base URL (advanced)")
    .option("--json", "Output machine-readable JSON")
    .option("--verbose", "Show rate limit and request id")
    .option("--debug", "Show debug information on failure")
    .option("--timeout <ms>", "Request timeout in milliseconds", "10000")
    .option("--max-retries <n>", "Maximum automatic retries for 429/503", "3")
    .action(async (options: UsageOptions) => {
      await runUsage(options);
    });
}

async function runUsage(options: UsageOptions): Promise<void> {
  const useJson = Boolean(options.json);

  let apiKey: string;
  try {
    apiKey = resolveApiKey(options.apiKey);
  } catch (err) {
    if (err instanceof NetRiskScanConfigError) {
      printConfigError(err);
      process.exitCode = ExitCode.AuthError;
      return;
    }
    throw err;
  }

  const client = new NetRiskScanClient({
    apiKey,
    baseUrl: resolveBaseUrl(options.baseUrl),
    timeout: Number(options.timeout),
    maxRetries: Number(options.maxRetries),
  });

  const spinner = useJson
    ? undefined
    : ora({ text: "Fetching usage...", stream: process.stderr, isEnabled: process.stderr.isTTY }).start();

  try {
    const { data, meta } = await client.getUsage();
    spinner?.stop();

    if (useJson) {
      printJson(data);
    } else {
      renderUsageResult(data);
      if (options.verbose) {
        renderVerboseMeta(meta);
      }
    }
  } catch (err) {
    spinner?.stop();
    if (err instanceof NetRiskScanApiError) {
      printApiError(err, { debug: options.debug });
      process.exitCode = exitCodeForApiErrorCode(err.code);
      return;
    }
    if (err instanceof NetRiskScanNetworkError) {
      printNetworkError(err, { debug: options.debug });
      process.exitCode = ExitCode.ApiError;
      return;
    }
    throw err;
  }
}
