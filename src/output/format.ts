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
