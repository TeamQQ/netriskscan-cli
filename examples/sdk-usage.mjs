// Run with: node examples/sdk-usage.mjs
//
// No API key needed: without one the client sends no Authorization header and the request is
// served by the anonymous daily trial. Set NETRISKSCAN_API_KEY to use Developer Account quota
// instead - an undefined apiKey is a supported value, not a misconfiguration.
import { NetRiskScanApiError, NetRiskScanClient } from "netriskscan-cli";

const client = new NetRiskScanClient({
  apiKey: process.env.NETRISKSCAN_API_KEY,
});

try {
  const { data, meta } = await client.checkIp("1.1.1.1");

  console.log("index:", data.risk.index);
  console.log("band:", data.risk.band);
  console.log("vpn:", data.flags.vpn); // true | false | null - never coerced

  if (data.usage?.mode === "anonymous") {
    // Printed exactly as the server reported it - never dailyLimit - used.
    console.log("available:", data.usage.remaining, "of", data.usage.dailyLimit);
    console.log("resets at:", data.usage.resetAt);
  } else {
    console.log("rate limit remaining:", meta.rateLimit.remaining);
  }
} catch (err) {
  if (err instanceof NetRiskScanApiError) {
    if (err.code === "anonymous_daily_limit_reached") {
      console.error("Anonymous daily trial limit reached.");
      console.error("Get more queries:", err.anonymousUsage?.signupUrl);
    } else {
      console.error(`${err.code}: ${err.message} (requestId=${err.requestId})`);
    }
    process.exitCode = 1;
  } else {
    throw err;
  }
}
