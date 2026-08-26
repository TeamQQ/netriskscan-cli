import Table from "cli-table3";
import chalk from "chalk";
import type { BatchItemResult } from "../commands/batch.js";
import { formatIndex, formatTriState } from "./format.js";

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
}
