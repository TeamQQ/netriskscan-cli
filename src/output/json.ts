/** Pretty JSON to stdout. Preserves `null` exactly as returned by the API - never coerced. */
export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
