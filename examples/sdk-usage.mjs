// Run with: NETRISKSCAN_API_KEY=nrs_live_xxx node examples/sdk-usage.mjs
import { NetRiskScanApiError, NetRiskScanClient } from "netriskscan-cli";

const client = new NetRiskScanClient({
  apiKey: process.env.NETRISKSCAN_API_KEY,
});

try {
  const { data, meta } = await client.checkIp("1.1.1.1");

  console.log("index:", data.risk.index);
  console.log("band:", data.risk.band);
  console.log("vpn:", data.flags.vpn); // true | false | null - never coerced
  console.log("rate limit remaining:", meta.rateLimit.remaining);
} catch (err) {
  if (err instanceof NetRiskScanApiError) {
    console.error(`${err.code}: ${err.message} (requestId=${err.requestId})`);
    process.exitCode = 1;
  } else {
    throw err;
  }
}
