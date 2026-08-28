import { NetRiskScanConfigError } from "../client/errors.js";

/**
 * Resolves the API key for endpoints that work without one (`check`, `batch`).
 *
 * Returning `undefined` is a valid outcome, not a failure: it selects the anonymous trial. The
 * precedence is `--api-key` > `NETRISKSCAN_API_KEY` > anonymous. A key that is present but wrong
 * is still passed through - the CLI never silently drops a key the user configured and retries
 * anonymously, because that would turn an authentication problem into a confusing success.
 */
export function resolveOptionalApiKey(cliValue?: string): string | undefined {
  return cliValue || process.env.NETRISKSCAN_API_KEY || undefined;
}

/**
 * Resolves the API key for account-level endpoints (`usage`), which have no anonymous form.
 *
 * The message names the command on purpose: a generic "API key is required" here would suggest
 * the whole CLI needs an account, which is no longer true.
 */
export function resolveRequiredApiKey(cliValue?: string): string {
  const apiKey = resolveOptionalApiKey(cliValue);
  if (!apiKey) {
    throw new NetRiskScanConfigError(
      "An API key is required for the usage command.\n\nSet NETRISKSCAN_API_KEY or use --api-key.",
    );
  }
  return apiKey;
}

export function resolveBaseUrl(cliValue?: string): string | undefined {
  return cliValue ?? process.env.NETRISKSCAN_BASE_URL;
}
