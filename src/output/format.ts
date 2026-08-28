/**
 * Formats a tri-state flag. `null`/`undefined` means "not enough signal to judge" and
 * must never collapse into "No" - that would silently turn "unknown" into "false".
 */
export function formatTriState(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
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
