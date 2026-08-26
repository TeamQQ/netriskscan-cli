import { NetRiskScanConfigError } from "../client/errors.js";

export function resolveApiKey(cliValue?: string): string {
  const apiKey = cliValue ?? process.env.NETRISKSCAN_API_KEY;
  if (!apiKey) {
    throw new NetRiskScanConfigError(
      "NetRiskScan API key is required.\n\nSet NETRISKSCAN_API_KEY or use --api-key.",
    );
  }
  return apiKey;
}

export function resolveBaseUrl(cliValue?: string): string | undefined {
  return cliValue ?? process.env.NETRISKSCAN_BASE_URL;
}
