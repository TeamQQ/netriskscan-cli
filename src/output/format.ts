/**
 * Formats a tri-state flag. `null`/`undefined` means "not enough signal to judge" and
 * must never collapse into "No" - that would silently turn "unknown" into "false".
 */
export function formatTriState(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

const PROXY_TYPE_LABELS: Record<string, string> = {
  residential_proxy: "Residential Proxy",
  isp_proxy: "ISP Proxy",
  mobile_proxy: "Mobile Proxy",
  datacenter_proxy: "Datacenter Proxy",
  unknown_proxy: "Unknown Proxy",
};

const PROXY_TYPE_LABELS_COMPACT: Record<string, string> = {
  residential_proxy: "Residential",
  isp_proxy: "ISP",
  mobile_proxy: "Mobile",
  datacenter_proxy: "Datacenter",
  unknown_proxy: "Unknown",
};

/**
 * Human-readable label for `flags.proxyType`. This is a classification detail, not a tri-state
 * signal - it only refines an address already flagged `proxy: true` - so missing/`null`/empty
 * renders as `-`, matching the placeholder every other Signals row uses for "not applicable", never
 * "Unknown".
 *
 * An unrecognised raw value renders as itself rather than throwing: `ProxyType` is a documented
 * union, but this reads live server JSON that a compile-time cast cannot actually enforce, and a
 * server that adds a new proxy subtype must not crash CLIs already in the wild.
 */
export function formatProxyType(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return PROXY_TYPE_LABELS[value] ?? value;
}

/** Same mapping as {@link formatProxyType}, abbreviated for the batch table's narrower columns. */
export function formatProxyTypeCompact(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return PROXY_TYPE_LABELS_COMPACT[value] ?? value;
}

/**
 * Passes a server-owned display name through unchanged (e.g. `flags.searchCrawlerName`) - never
 * reformatted, title-cased, or mapped through an enum, because the server already sends the
 * canonical form. Missing/`null`/empty renders as `-`.
 */
export function formatOrDash(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : value;
}

/**
 * Joins a geo display name with its code: `United States` + `US` -> `United States (US)`.
 *
 * The server owns both halves, so neither is title-cased, translated, or derived from the other -
 * a bare code renders as the code, a bare name as the name. Returns `undefined` when the server
 * sent neither, so the caller drops the row instead of printing a placeholder for a field the
 * server never claimed to know.
 */
export function formatGeoName(
  name: string | null | undefined,
  code: string | null | undefined,
): string | undefined {
  const hasName = name !== null && name !== undefined && name !== "";
  const hasCode = code !== null && code !== undefined && code !== "";
  if (hasName && hasCode) return `${name} (${code})`;
  if (hasName) return name;
  if (hasCode) return code;
  return undefined;
}

/**
 * Display labels for the reason codes the server emits today. Deliberately a lookup table and not
 * an exhaustive union: {@link formatRiskReasonCode} falls back for anything absent here, which is
 * what keeps an already-installed CLI working when the server adds a code.
 */
const RISK_REASON_LABELS: Record<string, string> = {
  RESIDENTIAL_PROXY_DETECTED: "Residential Proxy Detected",
  ISP_PROXY_DETECTED: "ISP Proxy Detected",
  MOBILE_PROXY_DETECTED: "Mobile Proxy Detected",
  DATACENTER_PROXY_DETECTED: "Datacenter Proxy Detected",
  PROXY_DETECTED: "Proxy Detected",
  VPN_DETECTED: "VPN Detected",
  TOR_RELAY: "Tor Relay",
  TOR_EXIT_NODE: "Tor Exit Node",
  KNOWN_SCANNER: "Known Scanner",
  ABUSE_ACTIVITY: "Abuse Activity",
  BLACKLIST_MATCH: "Blacklist Match",
  BOTNET_C2: "Botnet C2",
  COMPROMISED_HOST: "Compromised Host",
  VERIFIED_SEARCH_CRAWLER: "Verified Search Crawler",
  PUBLIC_INFRASTRUCTURE: "Public Infrastructure",
  RESIDENTIAL_NETWORK: "Residential Network",
  CONFLICTING_EVIDENCE: "Conflicting Evidence",
  INSUFFICIENT_EVIDENCE: "Insufficient Evidence",
};

/**
 * Human label for a `risk.reasons[].code`, for the default terminal output only - `--json` and
 * `--jsonl` always carry the raw `RESIDENTIAL_PROXY_DETECTED` form.
 *
 * An unrecognised code is title-cased rather than dropped, hidden behind "Unknown", or thrown on:
 * the reason vocabulary is additive server-side, so a CLI in the wild will meet codes that did not
 * exist when it shipped, and showing `NEW_FUTURE_SIGNAL` as `New Future Signal` still tells the
 * reader what the server said.
 */
export function formatRiskReasonCode(code: string | null | undefined): string {
  if (code === null || code === undefined || code === "") return "-";
  const known = RISK_REASON_LABELS[code];
  if (known !== undefined) return known;
  const words = code.split(/[_\s]+/).filter((word) => word !== "");
  if (words.length === 0) return code;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

/** `index` can legitimately be 0, so this must not use a falsy check. */
export function formatIndex(value: number | null): string {
  return value === null ? "N/A" : String(value);
}

export function formatNullable(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "N/A" : value;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Shared label column so `check`, `batch` and the error renderers line up identically. */
export const LABEL_WIDTH = 18;

export function row(label: string, value: string): string {
  return `${label.padEnd(LABEL_WIDTH)}${value}`;
}

/**
 * Reason labels are sentences ("Residential Proxy Detected"), not the short keys the rest of the
 * output uses, so they get their own wider column rather than pushing {@link LABEL_WIDTH} out and
 * re-indenting every other section.
 */
export const REASON_LABEL_WIDTH = 30;

export function reasonRow(label: string, value: string): string {
  return value === "" ? label : `${label.padEnd(REASON_LABEL_WIDTH)}${value}`;
}

/**
 * Renders an ISO-8601 instant as `2026-08-29 00:00 UTC`, deliberately *not* in local time: the
 * anonymous allowance resets on the UTC day, and a localized timestamp would misdescribe when
 * that happens for most of the world.
 *
 * Returns `undefined` for a missing or unparseable value so callers can drop the row rather than
 * print "Invalid Date".
 */
export function formatUtcTimestamp(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  );
}
