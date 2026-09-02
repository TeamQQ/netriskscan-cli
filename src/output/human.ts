import chalk from "chalk";
import type {
  IpLocation,
  IpRiskResponse,
  RequestUsage,
  ResponseMeta,
  RiskBand,
  RiskReason,
  UsageResponse,
} from "../client/types.js";
import {
  formatDate,
  formatGeoName,
  formatIndex,
  formatNullable,
  formatNumber,
  formatOrDash,
  formatProxyType,
  formatRiskReasonCode,
  formatTriState,
  formatUtcTimestamp,
  reasonRow,
  row,
} from "./format.js";

/**
 * Anonymous-trial rows for the human `check` output.
 *
 * `Available` is printed verbatim from `usage.remaining` - the server is the only authority on
 * what is left, so this never falls back to `dailyLimit - used`. Each row is emitted only when
 * its value is actually a number, because `0` is a legitimate value that a truthiness check
 * would swallow on exactly the run where it matters most.
 */
function anonymousUsageLines(usage: RequestUsage): string[] {
  const lines: string[] = [];
  if (typeof usage.remaining === "number") {
    lines.push(row("Available", formatNumber(usage.remaining)));
  }
  if (typeof usage.dailyLimit === "number") {
    lines.push(row("Daily Limit", formatNumber(usage.dailyLimit)));
  }
  const reset = formatUtcTimestamp(usage.resetAt);
  if (reset !== undefined) {
    lines.push(row("Reset", reset));
  }
  return lines;
}

/**
 * Rows for the server's own explanations of the assessment.
 *
 * Rendering only: the list is whatever `risk.reasons` contained, in the server's order, with no
 * entry derived from `flags`/`network`, none filtered out, and none re-ranked. An empty or absent
 * list yields no rows at all, so the caller drops the section rather than printing a heading over
 * nothing - the common case for an ordinary address.
 */
function riskReasonLines(reasons: readonly RiskReason[] | undefined): string[] {
  if (reasons === undefined || reasons.length === 0) return [];
  return reasons.map((reason) => {
    const severity = reason.severity ?? "";
    return reasonRow(formatRiskReasonCode(reason.code), severityColor(severity)(severity));
  });
}

/**
 * Severity is a secondary cue, never the message itself: the label already says what was found, so
 * an unrecognised severity simply renders uncoloured instead of being mapped to a guessed level.
 *
 * `info` is deliberately dim rather than warning-coloured - `Verified Search Crawler` and
 * `Public Infrastructure` explain why an address is *clean*, and colouring them like a threat
 * would misrepresent the server's own assessment.
 */
function severityColor(severity: string): (text: string) => string {
  switch (severity) {
    case "critical":
    case "high":
      return chalk.red;
    case "medium":
      return chalk.yellow;
    case "info":
      return chalk.gray;
    default:
      return (text: string) => text;
  }
}

/**
 * Rows for network-level geolocation - where the network is routed, not where a device is.
 *
 * Each row appears only when the server actually sent that field: geo resolution is independently
 * partial (a country with no city is normal), and five "N/A" rows would be noise dressed up as
 * data. An absent `location` object yields no rows, so the caller drops the whole section.
 */
function locationLines(location: IpLocation | null | undefined): string[] {
  if (!location) return [];
  const lines: string[] = [];
  const country = formatGeoName(location.country, location.countryCode);
  if (country !== undefined) lines.push(row("Country", country));
  const region = formatGeoName(location.region, location.regionCode);
  if (region !== undefined) lines.push(row("Region", region));
  if (location.city) lines.push(row("City", location.city));
  if (location.timeZone) lines.push(row("Time Zone", location.timeZone));
  return lines;
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
  lines.push(
    row("Band", data.risk.band ? bandColor(data.risk.band)(data.risk.band) : chalk.gray("N/A")),
  );
  lines.push(row("Assessment", data.risk.assessmentGrade));
  lines.push("");

  if (data.risk.assessmentGrade === "insufficient" && data.risk.index === null) {
    lines.push(chalk.yellow("This address could not be reliably assessed."));
    lines.push("");
  }

  // Directly under the verdict it explains, and only when the server sent one: these are the
  // server's reasons, so an empty or absent list means there is nothing to show - never a cue for
  // the CLI to work some out from flags.
  const reasonLines = riskReasonLines(data.risk.reasons);
  if (reasonLines.length > 0) {
    lines.push(chalk.bold("Risk Reasons"));
    lines.push(...reasonLines);
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

  const geoLines = locationLines(data.location);
  if (geoLines.length > 0) {
    lines.push(chalk.bold("Location"));
    lines.push(...geoLines);
    lines.push("");
  }

  lines.push(chalk.bold("Signals"));
  lines.push(row("Proxy", formatTriState(data.flags.proxy)));
  lines.push(row("Proxy Type", formatProxyType(data.flags.proxyType)));
  lines.push(row("VPN", formatTriState(data.flags.vpn)));
  lines.push(row("Tor", formatTriState(data.flags.tor)));
  lines.push(row("Datacenter", formatTriState(data.flags.datacenter)));
  lines.push(row("Scanner", formatTriState(data.flags.scanner)));
  lines.push(row("Abuse", formatTriState(data.flags.abuse)));
  lines.push("");

  // Identity, not a risk signal: a verified crawler must never read as a threat, so it gets its own
  // section rather than living inside Signals.
  lines.push(chalk.bold("Identity"));
  lines.push(row("Search Crawler", formatTriState(data.flags.searchCrawler)));
  lines.push(row("Crawler", formatOrDash(data.flags.searchCrawlerName)));
  lines.push("");

  // Only for the anonymous trial. An API-key caller's allowance is a billing-period quota, a
  // different thing entirely, and stays behind --verbose where it always was.
  if (data.usage?.mode === "anonymous") {
    const usageLines = anonymousUsageLines(data.usage);
    if (usageLines.length > 0) {
      lines.push(chalk.bold("Usage"));
      lines.push(...usageLines);
      lines.push("");
    }
  }

  lines.push(row("Request ID", data.requestId));
  lines.push("");

  lines.push(chalk.bold("Explore"));
  lines.push(row("Web", "https://www.netriskscan.com"));
  lines.push(row("GitHub", "https://github.com/TeamQQ/netriskscan-cli"));

  process.stdout.write(`${lines.join("\n")}\n`);
}

export function renderVerboseMeta(meta: ResponseMeta): void {
  const lines: string[] = [""];
  if (meta.rateLimit.remaining !== undefined && meta.rateLimit.limit !== undefined) {
    lines.push(
      row(
        "Rate limit",
        `${formatNumber(meta.rateLimit.remaining)} / ${formatNumber(meta.rateLimit.limit)} remaining`,
      ),
    );
  }
  if (meta.quota.remaining !== undefined && meta.quota.limit !== undefined) {
    lines.push(
      row(
        "Quota",
        `${formatNumber(meta.quota.remaining)} / ${formatNumber(meta.quota.limit)} remaining`,
      ),
    );
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
