#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommanderError } from "commander";
import { registerCheckCommand } from "./commands/check.js";
import { registerUsageCommand } from "./commands/usage.js";
import { registerBatchCommand } from "./commands/batch.js";
import { ExitCode } from "./utils/exitCode.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

const program = new Command();

program
  .name("netriskscan")
  .description(
    "Query IP risk, network intelligence and reputation data from the NetRiskScan Developer API.",
  )
  .version(pkg.version, "-V, --version", "Show the CLI version")
  .addHelpText(
    "after",
    `
Examples:
  $ netriskscan check 1.1.1.1                 # no account or API key needed
  $ netriskscan check 1.1.1.1 --json
  $ netriskscan usage                         # needs an API key
  $ netriskscan batch ips.txt --jsonl

check and batch work with no setup at all: without an API key they use the
anonymous daily trial, metered by public IP. The server reports how many
requests are left; the CLI never estimates it.

Environment variables:
  NETRISKSCAN_API_KEY      Optional for check/batch; required for account usage.

NetRiskScan provides diagnostic network intelligence. Results should not be
treated as proof of malicious activity or used as the sole basis for legal,
employment, credit, identity, or other high-impact decisions.

Learn more: https://github.com/TeamQQ/netriskscan-cli
`,
  );

registerCheckCommand(program);
registerUsageCommand(program);
registerBatchCommand(program);

program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof CommanderError) {
    if (err.code === "commander.helpDisplayed" || err.code === "commander.version") {
      process.exitCode = ExitCode.Success;
    } else {
      process.exitCode = ExitCode.InvalidArgument;
    }
  } else {
    process.stderr.write(`Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = ExitCode.GeneralError;
  }
}
