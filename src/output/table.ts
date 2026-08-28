import Table from "cli-table3";
import chalk from "chalk";
import type { BatchItemResult } from "../commands/batch.js";
import { ANONYMOUS_DAILY_LIMIT_CODE } from "../client/errors.js";
import { formatIndex, formatNumber, formatTriState, row } from "./format.js";

/**
 * Anonymous-trial summary for a finished batch.
 *
 * The batch runs concurrently, so responses do not arrive in the order the server charged them:
 * one reply can say 22 remaining while a later-numbered one says 19. The lowest value observed is
 * the closest thing to the truth, so that is what gets reported. If any request was actually
 * refused for exhausting the trial, the answer is 0 no matter what the successful replies said.
 */
function anonymousSummaryLines(results: readonly BatchItemResult[]): string[] {
  const remainings: number[] = [];
  const dailyLimits: number[] = [];
  let exhausted = false;

  for (const item of results) {
    if (item.ok) {
      const usage = item.result.usage;
      if (usage?.mode !== "anonymous") continue;
      if (typeof usage.remaining === "number") remainings.push(usage.remaining);
      if (typeof usage.dailyLimit === "number") dailyLimits.push(usage.dailyLimit);
    } else if (item.error.code === ANONYMOUS_DAILY_LIMIT_CODE) {
      exhausted = true;
      const limit = item.error.anonymousUsage?.dailyLimit;
      if (typeof limit === "number") dailyLimits.push(limit);
    }
  }

  if (!exhausted && remainings.length === 0) return [];

  const available = exhausted ? 0 : Math.min(...remainings);
  const lines = ["", chalk.bold("Anonymous trial"), row("Available", formatNumber(available))];
  if (dailyLimits.length > 0) {
    lines.push(row("Daily Limit", formatNumber(Math.max(...dailyLimits))));
  }
  return lines;
}

export function renderBatchTable(results: readonly BatchItemResult[]): void {
  const table = new Table({
    head: ["IP", "Index", "Band", "Proxy", "VPN", "Tor", "Status"],
    style: { head: [], border: [] },
  });

  for (const item of results) {
    if (item.ok) {
      const { result } = item;
      table.push([
        item.ip,
        formatIndex(result.risk.index),
        result.risk.band ?? "N/A",
        formatTriState(result.flags.proxy),
        formatTriState(result.flags.vpn),
        formatTriState(result.flags.tor),
        chalk.green("ok"),
      ]);
    } else {
      table.push([item.ip, "-", "-", "-", "-", "-", chalk.red(`error: ${item.error.code}`)]);
    }
  }

  process.stdout.write(`${table.toString()}\n`);

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  process.stdout.write(`\n${okCount} succeeded, ${failCount} failed\n`);

  const anonymous = anonymousSummaryLines(results);
  if (anonymous.length > 0) {
    process.stdout.write(`${anonymous.join("\n")}\n`);
  }
}
