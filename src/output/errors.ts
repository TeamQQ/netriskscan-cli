import chalk from "chalk";
import type {
  NetRiskScanApiError,
  NetRiskScanConfigError,
  NetRiskScanNetworkError,
} from "../client/errors.js";
import { formatNumber, formatUtcTimestamp, row } from "./format.js";

/** Used only when the server did not send its own `signupUrl`. */
const SIGNUP_URL = "https://www.netriskscan.com/developers";

export function printConfigError(err: NetRiskScanConfigError): void {
  process.stderr.write(`Error: ${err.message}\n`);
  if (err.message.includes("API key")) {
    process.stderr.write(
      "\nGet a free API key (no credit card required): https://www.netriskscan.com\n",
    );
  }
}

/**
 * The anonymous trial running out is an ordinary end-of-trial moment, not a protocol fault, so it
 * gets its own renderer instead of the `Code / Status / Message` dump. It tells the reader what
 * they have, when it comes back, and where to get more.
 */
export function printAnonymousLimitError(err: NetRiskScanApiError): void {
  const usage = err.anonymousUsage;
  const lines = [
    "",
    chalk.bold("NetRiskScan"),
    "",
    chalk.yellow("Anonymous daily trial limit reached."),
    "",
  ];

  const usageLines: string[] = [
    // The request that returned this error was refused, so nothing is left regardless of what the
    // body reports; `remaining` is only trusted when the server actually sent it.
    row("Available", formatNumber(typeof usage?.remaining === "number" ? usage.remaining : 0)),
  ];
  if (typeof usage?.dailyLimit === "number") {
    usageLines.push(row("Daily Limit", formatNumber(usage.dailyLimit)));
  }
  const reset = formatUtcTimestamp(usage?.resetAt);
  if (reset !== undefined) {
    usageLines.push(row("Reset", reset));
  }

  lines.push(chalk.bold("Usage"), ...usageLines, "");
  lines.push(chalk.bold("Get more queries"), usage?.signupUrl || SIGNUP_URL, "");

  process.stderr.write(`${lines.join("\n")}\n`);
}

const LABEL_WIDTH = 11;

export function printApiError(err: NetRiskScanApiError, options: { debug?: boolean } = {}): void {
  const lines = [
    "",
    chalk.red("NetRiskScan API error"),
    "",
    `${"Code".padEnd(LABEL_WIDTH)}${err.code}`,
    `${"Status".padEnd(LABEL_WIDTH)}${err.status}`,
    `${"Message".padEnd(LABEL_WIDTH)}${err.message}`,
  ];
  if (err.requestId) {
    lines.push(`${"Request ID".padEnd(LABEL_WIDTH)}${err.requestId}`);
  }
  if (err.retryAfter !== undefined) {
    lines.push(`${"Retry after".padEnd(LABEL_WIDTH)}${err.retryAfter}s`);
  }
  lines.push("");
  process.stderr.write(`${lines.join("\n")}\n`);

  if (options.debug && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
}

export function printNetworkError(
  err: NetRiskScanNetworkError,
  options: { debug?: boolean } = {},
): void {
  process.stderr.write(`\n${chalk.red("NetRiskScan request failed")}\n\n${err.message}\n\n`);
  if (options.debug && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
}
