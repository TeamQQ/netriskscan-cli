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
