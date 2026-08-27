import chalk from "chalk";
import type { IpRiskResponse, ResponseMeta, RiskBand, UsageResponse } from "../client/types.js";
import { formatDate, formatIndex, formatNullable, formatNumber, formatTriState } from "./format.js";

const LABEL_WIDTH = 18;

function row(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH)}${value}`;
}

function bandColor(band: RiskBand | null): (text: string) => string {
  switch (band) {
    case "excellent":
    case "good":
      return chalk.green;
    case "fair":
      return chalk.yellow;
    case "poor":
    case "high_risk":
      return chalk.red;
    default:
      return chalk.gray;
  }
}

export function renderCheckResult(ip: string, data: IpRiskResponse): void {
  const lines: string[] = [];
  lines.push(chalk.bold("NetRiskScan"));
  lines.push("");
  lines.push(row("IP", ip));
  lines.push(row("Index", formatIndex(data.risk.index)));
  lines.push(row("Band", data.risk.band ? bandColor(data.risk.band)(data.risk.band) : chalk.gray("N/A")));
  lines.push(row("Assessment", data.risk.assessmentGrade));
  lines.push("");

  if (data.risk.assessmentGrade === "insufficient" && data.risk.index === null) {
    lines.push(chalk.yellow("This address could not be reliably assessed."));
    lines.push("");
  }

  lines.push(chalk.bold("Network"));
  lines.push(row("Type", formatNullable(data.network.type)));
  // Omitted entirely when absent, unlike the fields around them, which render "N/A". Those describe every
  // address, so a missing one is worth showing as missing; these two exist only for the minority of
  // addresses NetRiskScan holds a first-party record for, and printing "Profile  N/A" on every residential
  // lookup would be noise rather than information.
  if (data.network.profile) {
    lines.push(row("Profile", data.network.profile));
  }
  if (data.network.service) {
    lines.push(row("Service", data.network.service));
  }
  lines.push(row("Connection", formatNullable(data.network.connectionType)));
  lines.push(row("ASN", formatNullable(data.network.asn)));
  lines.push(row("Organization", formatNullable(data.network.organization)));
  lines.push("");

  lines.push(chalk.bold("Signals"));
  lines.push(row("Proxy", formatTriState(data.flags.proxy)));
  lines.push(row("VPN", formatTriState(data.flags.vpn)));
  lines.push(row("Tor", formatTriState(data.flags.tor)));
  lines.push(row("Datacenter", formatTriState(data.flags.datacenter)));
  lines.push(row("Scanner", formatTriState(data.flags.scanner)));
  lines.push(row("Abuse", formatTriState(data.flags.abuse)));
  lines.push("");

  lines.push(row("Request ID", data.requestId));

  process.stdout.write(`${lines.join("\n")}\n`);
}

export function renderVerboseMeta(meta: ResponseMeta): void {
  const lines: string[] = [""];
  if (meta.rateLimit.remaining !== undefined && meta.rateLimit.limit !== undefined) {
    lines.push(
      row("Rate limit", `${formatNumber(meta.rateLimit.remaining)} / ${formatNumber(meta.rateLimit.limit)} remaining`),
    );
  }
  if (meta.quota.remaining !== undefined && meta.quota.limit !== undefined) {
    lines.push(row("Quota", `${formatNumber(meta.quota.remaining)} / ${formatNumber(meta.quota.limit)} remaining`));
  }
  lines.push(row("Request ID", meta.requestId));
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function renderUsageResult(data: UsageResponse): void {
  const lines: string[] = [];
  lines.push(chalk.bold("NetRiskScan Usage"));
  lines.push("");
  lines.push(row("Plan", data.plan));
  lines.push("");
  lines.push(chalk.bold("Usage"));
  lines.push(row("Used", formatNumber(data.units.used)));
  lines.push(row("Remaining", formatNumber(data.units.remaining)));
  lines.push(row("Limit", formatNumber(data.units.limit)));
  lines.push("");
  lines.push(chalk.bold("Rate limit"));
  lines.push(row("Requests / minute", formatNumber(data.rateLimit.requestsPerMinute)));
  lines.push("");
  lines.push(chalk.bold("Billing period"));
  lines.push(`${formatDate(data.period.start)} → ${formatDate(data.period.end)}`);

  process.stdout.write(`${lines.join("\n")}\n`);
}
