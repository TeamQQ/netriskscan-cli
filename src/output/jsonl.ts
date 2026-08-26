/** One compact JSON object per line, so a failed line never breaks the rest of the stream. */
export function printJsonLine(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data)}\n`);
}
