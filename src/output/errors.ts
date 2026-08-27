import chalk from "chalk";
import type { NetRiskScanApiError, NetRiskScanConfigError, NetRiskScanNetworkError } from "../client/errors.js";

export function printConfigError(err: NetRiskScanConfigError): void {
  process.stderr.write(`Error: ${err.message}\n`);
  if (err.message.includes("API key")) {
    process.stderr.write("\nGet a free API key (no credit card required): https://www.netriskscan.com\n");
  }
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

export function printNetworkError(err: NetRiskScanNetworkError, options: { debug?: boolean } = {}): void {
  process.stderr.write(`\n${chalk.red("NetRiskScan request failed")}\n\n${err.message}\n\n`);
  if (options.debug && err.stack) {
    process.stderr.write(`${err.stack}\n`);
  }
}
