# NetRiskScan CLI

The official command-line client and TypeScript SDK for [NetRiskScan](https://www.netriskscan.com) -
IP reputation, risk assessment, and network intelligence directly from your terminal.

[![CI](https://github.com/TeamQQ/netriskscan-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/TeamQQ/netriskscan-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/netriskscan-cli.svg)](https://www.npmjs.com/package/netriskscan-cli)
[![Website](https://img.shields.io/badge/website-netriskscan.com-informational)](https://www.netriskscan.com)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Website](https://www.netriskscan.com) · [npm](https://www.npmjs.com/package/netriskscan-cli) · [Developer API](#developer-api) · [Official resources](#official-resources)

```bash
npx netriskscan-cli check 17.241.200.160
```

```text
NetRiskScan

IP                17.241.200.160
Index             97
Band              excellent
Assessment        complete

Risk Reasons
Verified Search Crawler       info
Public Infrastructure         info

Network
Type              public_infrastructure
Profile           search_crawler
Service           Applebot
Connection        direct
ASN               AS714
Organization      Apple Inc.

Location
Country           United States (US)
Region            California (CA)
City              Cupertino
Time Zone         America/Los_Angeles

Signals
Proxy             No
Proxy Type        -
VPN               No
Tor               No
Datacenter        No
Scanner           Unknown
Abuse             No

Identity
Search Crawler    Yes
Crawler           Applebot

Usage
Available         29
Daily Limit       30
Reset             2026-08-29 00:00 UTC

Request ID        req_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Explore
Web               https://www.netriskscan.com
GitHub            https://github.com/TeamQQ/netriskscan-cli
```

**No account or API key required** for the anonymous trial - the command above works on a
clean machine. The `Usage` block is the server telling you how much of today's free
allowance is left; the CLI never estimates it. Add an API key when you need more
(see [Getting an API key](#getting-an-api-key)).

Example output - actual values come from the live API and can change as reputation and
threat data changes.

## Why NetRiskScan?

- Known infrastructure identification for services such as search crawlers and public
  infrastructure, instead of treating every address as a generic business or datacenter IP
- Proxy, VPN, Tor, abuse, blacklist and threat signals
- Network-level IP geolocation (country, region, city, time zone)
- Public risk reasons: the server's own explanation of *why* an address scored as it did
- One normalized NetRiskScan Index instead of raw provider scores - higher is cleaner
- `unknown` and `not applicable` states are preserved, never collapsed into "false"
- Anonymous daily trial: run your first check with no account, no key, no configuration
- Human-readable CLI output plus JSON / JSONL for scripts, batches and CI

NetRiskScan can identify known infrastructure such as search crawlers, public DNS
resolvers and other published infrastructure, instead of treating every address as a
generic business or datacenter IP. Known infrastructure does not automatically mean
safe - proxy, VPN, Tor, abuse and threat signals are still evaluated separately on
every address. NetRiskScan normalizes multiple categories of evidence into one
consistent assessment rather than exposing a single provider's raw score.

> NetRiskScan provides diagnostic network intelligence. Results should not be treated as
> proof of malicious activity and should not be used as the sole basis for legal,
> employment, credit, identity, or other high-impact decisions.

Powered by the [NetRiskScan Developer API](#developer-api).

## Table of contents

- [Why NetRiskScan?](#why-netriskscan)
- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Anonymous trial](#anonymous-trial)
- [Getting an API key](#getting-an-api-key)
- [Quick start](#quick-start)
- [IP risk check](#ip-risk-check)
- [Usage & quota](#usage--quota)
- [Batch processing](#batch-processing)
- [JSON output](#json-output)
- [JSONL output](#jsonl-output)
- [CI/CD](#cicd)
- [Environment variables](#environment-variables)
- [Exit codes](#exit-codes)
- [API errors](#api-errors)
- [Rate limits & quota](#rate-limits--quota)
- [SDK usage](#sdk-usage)
- [Security](#security)
- [Developer API](#developer-api)
- [Official resources](#official-resources)
- [Contributing](#contributing)
- [License](#license)

## Introduction

`netriskscan-cli` is the official command-line client and thin TypeScript SDK for
[NetRiskScan](https://www.netriskscan.com), an IP reputation and network intelligence
service.

It connects to the NetRiskScan Developer API and returns machine-readable IP reputation
scores, network attribution, and risk signals. Give it an IP address, get back a result
you can pipe, gate on, or store.

This is a read-only diagnostic tool. It does not make decisions for you, and the CLI
never recomputes or approximates a risk score client-side - the `risk.index` returned by
the server is always the single source of truth.

**A higher NetRiskScan Index means a cleaner address, not a riskier one.** `95` is
`excellent`; `42` is `poor`. It is a cleanliness score, not a threat score - never read
`90` as "high risk".

## Features

- `check` and `batch` with no API key at all, via the anonymous daily trial
- `check`, `usage`, and client-side `batch` commands
- IPv4 and IPv6 support
- Proxy type classification (residential, ISP, mobile, datacenter) for detected proxies,
  and verified search crawler identity (Googlebot, Bingbot, Applebot, ...)
- IP geolocation and server-generated risk reasons in `check`, `--json` and `--jsonl`
- Human-readable terminal output, `--json`, and `--jsonl` (batch) modes
- Correct three-state handling of risk flags (`true` / `false` / `null` - never coerced)
- CI-friendly exit codes and `--fail-below` / `--fail-on` policy gates
- Automatic retry with backoff on `429` / `503`, respecting `Retry-After`
- Rate limit and quota visibility via `--verbose`
- Zero telemetry
- A typed `NetRiskScanClient` SDK you can import directly in Node.js/TypeScript

## Installation

Run it without installing anything:

```bash
npx netriskscan-cli check 1.1.1.1
```

Or install it globally:

```bash
npm install -g netriskscan-cli
netriskscan check 1.1.1.1
```

Requires Node.js >= 20.

## Anonymous trial

`check` and `batch` work without any credentials. When no API key is configured, the CLI
sends **no** `Authorization` header at all, and the Developer API serves the request from
an anonymous daily trial metered by the caller's public IP (currently 30 requests per
public IP per UTC day - the allowance reported in the response is always the authority,
not this number).

```bash
npx netriskscan-cli check 8.8.8.8
```

Every anonymous response reports where you stand, and the CLI prints it verbatim:

```text
Usage
Available         29
Daily Limit       30
Reset             2026-08-29 00:00 UTC
```

`Available` is `usage.remaining` exactly as returned. The CLI keeps no local counter and
never recomputes it from `dailyLimit - used`.

When the day's allowance is spent, the next request returns
`429 anonymous_daily_limit_reached` and the CLI exits `5` with:

```text
NetRiskScan

Anonymous daily trial limit reached.

Usage
Available         0
Daily Limit       30
Reset             2026-08-29 00:00 UTC

Get more queries
https://www.netriskscan.com/developers
```

That response is deterministic until the reset, so it is **never** retried automatically.

Which commands need a key:

| Command             | API key                                                         |
| ------------------- | --------------------------------------------------------------- |
| `netriskscan check` | Optional - anonymous trial when omitted                         |
| `netriskscan batch` | Optional - anonymous trial when omitted                         |
| `netriskscan usage` | **Required** - reports Developer Account plan and billing quota |

A key that the server rejects is never downgraded to an anonymous request: a configured
key that fails returns `401 invalid_api_key` and exit code `3`. The access mode is decided
purely by whether a key is present.

## Getting an API key

The anonymous trial does not require an API key. Create one when you need:

- more requests than the daily trial allows
- account quota instead of a per-IP allowance
- billing-period usage reporting (`netriskscan usage`)
- a production integration

1. Create a NetRiskScan Developer account and open the **Developer Dashboard**.
2. Go to **API Keys** and create one, selecting the scopes you need
   (`ip-risk:read`, `usage:read`).
3. Copy the full key immediately - it is shown in full only once, right after creation.

A NetRiskScan Developer account includes a **Free Plan** (no credit card required), so
you can try the real API with real data before committing to a paid plan. Current
pricing, rate limits, quotas, and concurrency limits are shown on the Developer
Dashboard's **Pricing** and **Usage** pages and are not duplicated here, since they
change over time.

Store your key in an environment variable rather than typing it inline (inline values
can end up in your shell history):

```bash
export NETRISKSCAN_API_KEY="nrs_live_xxx"
```

## Quick start

```bash
npx netriskscan-cli check 1.1.1.1
```

No setup required - no account, no key, no configuration file.

With an API key, for higher volume, account quota and `usage`:

```bash
export NETRISKSCAN_API_KEY="nrs_live_xxx"

netriskscan check 1.1.1.1
netriskscan usage
netriskscan batch ips.txt --jsonl > results.jsonl
```

## IP risk check

```bash
netriskscan check <ip> [options]
```

Calls `GET /v1/ip-risk/{ip}` - no query string parameters are ever sent. An API key is
optional; without one the request uses the [anonymous trial](#anonymous-trial).

```bash
$ netriskscan check 1.1.1.1

NetRiskScan

IP                1.1.1.1
Index             92
Band              excellent
Assessment        complete

Risk Reasons
Public Infrastructure         info

Network
Type              public_infrastructure
Connection        direct
ASN               AS13335
Organization      Cloudflare, Inc.

Location
Country           United States (US)
Time Zone         America/Los_Angeles

Signals
Proxy             No
Proxy Type        -
VPN               No
Tor               No
Datacenter        Unknown
Scanner           No
Abuse             No

Identity
Search Crawler    No
Crawler           -

Request ID        req_xxxxxxxx
```

Output above is illustrative of the format - actual values always come from the live
API response.

### Proxy Type

`Proxy Type` is a classification detail for an address already detected as a proxy - it
refines `Proxy`, it does not replace it. It renders as `-`, not `Unknown`, whenever the
address is not a proxy at all:

```text
Signals
Proxy             Yes
Proxy Type        Residential Proxy
```

The server-reported machine value (`residential_proxy`, `isp_proxy`, `mobile_proxy`,
`datacenter_proxy`, `unknown_proxy`) is what `--json`/`--jsonl` carry; the CLI only maps
it to a human-readable label (`Residential Proxy`, `ISP Proxy`, ...) in the default
terminal output.

### Search Crawler

The `Identity` block shows whether the NetRiskScan API has verified this address as a
known search engine crawler, and if so, its canonical name (`Googlebot`, `Bingbot`,
`Applebot`, ...) exactly as the server sends it - the CLI never reformats, cases, or
enumerates crawler names locally. **The CLI does not perform crawler verification
itself; it only displays the classification the API already returned.** A verified
crawler is identity information, not a risk signal, so it never affects `risk.index`,
`--fail-on`, or the CLI's exit code.

### Risk Reasons

`risk.reasons` is the server's own explanation of the assessment it just returned - the
CLI renders it and **never derives, infers, or invents a reason** from the flags it can
see. `flags.tor: true` is not enough to claim `TOR_EXIT_NODE`; only the server can say
whether an address is an exit node or an ordinary relay, and the CLI prints whichever it
actually sent.

```text
Risk Reasons
Residential Proxy Detected    high
```

Reasons are **not proof of fraud or malicious activity**. `VPN_DETECTED` means a VPN was
detected, nothing more. Nor are they all negative: `VERIFIED_SEARCH_CRAWLER`,
`PUBLIC_INFRASTRUCTURE` and `RESIDENTIAL_NETWORK` are exactly the reasons an address
scores *well*, which is why the block is called `Risk Reasons` and not "threats".

```text
Risk Reasons
Verified Search Crawler       info
Public Infrastructure         info
```

Each reason carries a `code`, a `category` and a `severity`. The default output shows a
readable label (`Residential Proxy Detected`) and the severity; `--json` / `--jsonl`
always carry the raw machine values (`RESIDENTIAL_PROXY_DETECTED`, `anonymity`, `high`).
The vocabulary is **additive** - the API can introduce new codes at any time, and an
already-installed CLI renders an unfamiliar one rather than failing or hiding it.

Reasons are display-only: they never affect `risk.index`, `--fail-below`, `--fail-on`, or
the exit code. A server that predates the field simply omits it, and the section is not
shown when there is nothing to explain.

### Location

`location` is **network-level IP geolocation**: where the address is registered and
routed. It is **not** device or GPS location, and not the precise physical location of
whoever is using the address - a city can be the operator's aggregation point rather than
the user's town.

```text
Location
Country           United States (US)
Region            California (CA)
City              Mountain View
Time Zone         America/Los_Angeles
```

Every field is independently optional. Geo resolution is often partial, and the CLI shows
only what the server actually resolved rather than padding the block with placeholders -
a country-only result prints one row, and an address with no location at all prints no
`Location` section at all:

```text
Location
Country           Germany (DE)
Time Zone         Europe/Berlin
```

Names and codes are server-owned strings, printed verbatim: never translated,
re-capitalized, or derived from one another. `location` has no effect on the risk
assessment or on any exit code.

### Addresses that can't be scored

Private, loopback, reserved, and other non-routable addresses still return `HTTP 200`,
but with `risk.assessmentGrade: "insufficient"` and `risk.index` / `risk.band` set to
`null`. The CLI shows this as:

```text
Index             N/A
Band              N/A
Assessment        insufficient

This address could not be reliably assessed.
```

This is a normal, successful response - the CLI's default exit code stays `0` unless
you opt into CI policy checks with `--fail-below` (see [CI/CD](#cicd)).

### Options

| Option                 | Description                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `--api-key <key>`      | API key for this call, optional (overrides `NETRISKSCAN_API_KEY`; anonymous trial when omitted) |
| `--base-url <url>`     | Override the API base URL (advanced)                                                            |
| `--json`               | Machine-readable JSON output (see [JSON output](#json-output))                                  |
| `--verbose`            | Also print rate limit, quota, and request id                                                    |
| `--debug`              | Print a stack trace / extra detail on failure                                                   |
| `--timeout <ms>`       | Request timeout in milliseconds (default `10000`)                                               |
| `--max-retries <n>`    | Max automatic retries for `429`/`503` (default `3`)                                             |
| `--fail-below <index>` | CI gate: exit non-zero if `risk.index` is below this threshold                                  |
| `--fail-on <flag>`     | CI gate: exit non-zero if the given flag is `true` (repeatable)                                 |

## Usage & quota

```bash
netriskscan usage
```

Calls `GET /v1/usage`. **This command requires an API key** (with the `usage:read`
scope): it reports Developer Account plan, billing period and quota, which has no
anonymous equivalent. Without a key it fails immediately, without sending a request:

```text
Error: An API key is required for the usage command.

Set NETRISKSCAN_API_KEY or use --api-key.
```

```bash
$ netriskscan usage

NetRiskScan Usage

Plan                 growth

Usage
Used                 12,450
Remaining            37,550
Limit                50,000

Rate limit
Requests / minute    120

Billing period
2026-08-01 → 2026-09-01
```

Supports `--json`, `--verbose`, `--api-key`, `--timeout`, and `--max-retries` just like
`check`.

## Batch processing

```bash
netriskscan batch <file> [options]
```

**Important:** NetRiskScan does not currently expose a server-side batch endpoint. This
command is a **client-side batch**: it sends individual `GET /v1/ip-risk/{ip}` requests
with a controlled concurrency limit. An API key is optional here too - without one, every
request draws on the [anonymous trial](#anonymous-trial), and the summary reports what the
server says is left. It never calls `/v1/ip-risk/batch` or
`/v1/ip-risk/query` - those endpoints are not open and currently return
`404 feature_not_available`.

Input is one IP per line; blank lines and lines starting with `#` are ignored:

```text
# ips.txt
1.1.1.1
8.8.8.8
9.9.9.9
2606:4700:4700::1111
```

```bash
netriskscan batch ips.txt
cat ips.txt | netriskscan batch -
netriskscan batch ips.txt --concurrency 10 --jsonl > results.jsonl
```

### Concurrency

```bash
netriskscan batch ips.txt --concurrency 5   # default
netriskscan batch ips.txt --concurrency 10
```

Concurrency defaults to a conservative `5` and is capped at `20` regardless of what you
pass - it is never unbounded. Make sure the concurrency you choose complies with the
limits shown in your NetRiskScan Developer Dashboard for your plan.

A failure on one IP never drops the others - every input line gets a result.

Run anonymously and the human summary ends with the trial position:

```text
4 succeeded, 0 failed

Anonymous trial
Available         19
Daily Limit       30
```

`Available` is the **lowest** `usage.remaining` seen in the batch, because concurrent
responses do not arrive in the order the server charged them. If any request came back
`anonymous_daily_limit_reached`, it reports `0`. The CLI never rejects an input file for
being longer than the daily allowance: it cannot know how much of today's allowance you
have already spent - only the server can. `--jsonl` output is unaffected; each line's
`result.usage` object already carries this, and no plain text is ever mixed into the
stream.

### Options

| Option              | Description                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `--api-key <key>`   | API key for this run, optional (overrides `NETRISKSCAN_API_KEY`; anonymous trial when omitted) |
| `--base-url <url>`  | Override the API base URL (advanced)                                                           |
| `--concurrency <n>` | Concurrent requests (default `5`, max `20`)                                                    |
| `--jsonl`           | Newline-delimited JSON output (see [JSONL output](#jsonl-output))                              |
| `--timeout <ms>`    | Per-request timeout in milliseconds (default `10000`)                                          |
| `--max-retries <n>` | Max automatic retries per request for `429`/`503` (default `3`)                                |

## JSON output

```bash
netriskscan check 1.1.1.1 --json
```

Prints exactly the API response body as JSON, with `null` preserved as `null` (never
coerced to `false`, `0`, or a string):

```json
{
  "requestId": "req_example",
  "risk": {
    "index": 95,
    "band": "excellent",
    "assessmentGrade": "complete",
    "reasons": [
      { "code": "VERIFIED_SEARCH_CRAWLER", "category": "identity", "severity": "info" }
    ]
  },
  "network": {
    "type": "public_infrastructure",
    "profile": "search_crawler",
    "service": "Googlebot",
    "connectionType": "direct",
    "asn": "AS15169",
    "organization": "Google LLC"
  },
  "location": {
    "countryCode": "US",
    "country": "United States",
    "regionCode": "CA",
    "region": "California",
    "city": "Mountain View",
    "timeZone": "America/Los_Angeles"
  },
  "flags": {
    "proxy": false,
    "proxyType": null,
    "vpn": false,
    "tor": false,
    "datacenter": false,
    "scanner": null,
    "abuse": false,
    "searchCrawler": true,
    "searchCrawlerName": "Googlebot"
  }
}
```

`risk.reasons`, `location`, `flags.proxyType` (when `flags.proxy` is `true`),
`flags.searchCrawler`, and `flags.searchCrawlerName` carry the server's raw machine values
in `--json`/`--jsonl` - e.g. `"RESIDENTIAL_PROXY_DETECTED"` and `"residential_proxy"`,
never the `Residential Proxy Detected` / `Residential Proxy` labels shown in the default
terminal output. A server that predates these fields simply omits the keys; the CLI does
not synthesize them.

In `--json` mode there is no spinner, no ANSI color, and no banner - stdout carries only
the JSON. Errors always go to stderr, so this composes cleanly:

```bash
netriskscan check 1.1.1.1 --json | jq '.risk.index'
```

## JSONL output

```bash
netriskscan batch ips.txt --jsonl
```

One JSON object per line, one line per input IP:

```json
{"ip":"1.1.1.1","ok":true,"result":{"requestId":"req_...","risk":{...,"reasons":[...]},"network":{...},"location":{...},"flags":{...}}}
{"ip":"8.8.8.8","ok":true,"result":{...}}
{"ip":"bad-ip","ok":false,"error":{"code":"invalid_ip","message":"..."}}
```

Designed for `netriskscan batch ips.txt --jsonl > results.jsonl` and downstream
line-oriented processing (`jq`, `grep`, log pipelines, etc.). A failed IP never causes
the whole batch to fail or drops output for the rest.

The envelope (`ip`, `ok`, `result` / `error`) belongs to the CLI; everything under
`result` is the API response verbatim, so `location` and `risk.reasons` appear there
untouched. The default batch table deliberately stays narrow - it grows no country, city
or reason columns - so use `--jsonl` when you need the full record.

## CI/CD

Use `check` with policy flags as a build/deploy gate:

```bash
netriskscan check "$TARGET_IP" --fail-below 60
netriskscan check "$TARGET_IP" --fail-on tor --fail-on proxy
```

Rules:

- `risk.index >= threshold` → exit `0`
- `risk.index < threshold` → exit `6` (CI policy failed)
- `risk.index == null` (address could not be assessed) → exit `7`, a distinct code from
  a normal policy failure
- `--fail-on <flag>` only trips on an explicit `true`. A `null` (unknown) value is never
  treated as a hit - that would silently turn "we don't know" into "blocked".

## Environment variables

| Variable               | Description                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `NETRISKSCAN_API_KEY`  | Default API key, used when `--api-key` is not passed. Optional for `check`/`batch`; required for `usage` |
| `NETRISKSCAN_BASE_URL` | Advanced: override the API base URL, used when `--base-url` is not passed                                |

## Exit codes

| Code | Meaning                                                             |
| ---- | ------------------------------------------------------------------- |
| `0`  | Success                                                             |
| `1`  | General CLI error                                                   |
| `2`  | Invalid CLI argument                                                |
| `3`  | Authentication / authorization failure                              |
| `4`  | API request failure                                                 |
| `5`  | Rate limit / quota exceeded, including the anonymous daily trial    |
| `6`  | CI policy failed (`--fail-below` / `--fail-on`)                     |
| `7`  | Assessment unavailable (`--fail-below` used against a `null` index) |

These codes are stable and part of the CLI's public contract.

## API errors

The API returns a consistent error shape:

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "Billing period quota exhausted.",
    "requestId": "req_8f3ab21c9d"
  }
}
```

The CLI prints this as:

```text
NetRiskScan API error

Code       quota_exceeded
Status     429
Message    Billing period quota exhausted.
Request ID req_8f3ab21c9d
```

Known error codes:

| HTTP status | `error.code`                    | Meaning                                                                                               |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 400         | `invalid_ip`                    | The address is not a valid IPv4/IPv6 address                                                          |
| 400         | `invalid_request`               | Unsupported query parameter, or request too large                                                     |
| 400         | `unsupported_parameter`         | e.g. `forceRefresh` / `force_refresh` / `refresh` - not supported                                     |
| 401         | `invalid_api_key`               | Missing/malformed `Authorization` header, or key doesn't exist                                        |
| 403         | `api_key_disabled`              | Key revoked/expired, or account/plan unavailable                                                      |
| 403         | `scope_not_allowed`             | Key lacks the scope required for this endpoint                                                        |
| 404         | `not_found`                     | Unknown path                                                                                          |
| 404         | `feature_not_available`         | Endpoint not yet available (e.g. batch, see above)                                                    |
| 429         | `rate_limit_exceeded`           | Per-minute request limit exceeded                                                                     |
| 429         | `quota_exceeded`                | Billing-period quota exhausted                                                                        |
| 429         | `anonymous_daily_limit_reached` | Anonymous daily trial exhausted. Never retried automatically - it cannot succeed before the UTC reset |
| 503         | `temporarily_unavailable`       | Transient upstream/service issue - retry later                                                        |

Transient `429 rate_limit_exceeded` and `503` responses may be retried automatically,
honoring `Retry-After` when present and falling back to exponential backoff with jitter
otherwise. `anonymous_daily_limit_reached` is **never** retried, even though it is also a
`429`: the daily allowance cannot come back before the UTC reset, so retrying would only
repeat the same failure three more times. `400` / `401` / `403` / `404` are never retried
either.

Pass `--debug` to any command to include a stack trace on failure. Without it, errors
are shown as a clean summary - never a raw stack dump.

## Rate limits & quota

The anonymous daily trial and a plan's billing-period quota are different things, reported
through different channels. Do not read one as the other.

### Anonymous daily trial

Reported in the response body, on every request:

| Field              | Meaning                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `usage.mode`       | `anonymous` when the request was served by the trial             |
| `usage.remaining`  | Requests still available today - authoritative, never recomputed |
| `usage.dailyLimit` | The trial's daily allowance                                      |
| `usage.resetAt`    | When the allowance resets (UTC day boundary)                     |

### API key quota

Every successful `/v1/*` response carries live rate limit and quota headers, so you
don't need a separate call to `/v1/usage` to know where you stand:

| Header                                                              | Meaning                                             |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` | Per-minute limit                                    |
| `X-Quota-Limit` / `X-Quota-Used` / `X-Quota-Remaining`              | Billing-period quota                                |
| `X-Request-Id`                                                      | Request trace id (echoes yours, or a generated one) |
| `Retry-After`                                                       | Present on `429` responses                          |

See them with:

```bash
netriskscan check 1.1.1.1 --verbose
```

```text
Rate limit    118 / 120 remaining
Quota         37,550 / 50,000 remaining
Request ID    req_xxxxxxxx
```

## SDK usage

The API client is a standalone module, independent of the CLI layer, so it can be used
directly from Node.js/TypeScript and will move to `@netriskscan/sdk` in a future release
without changing its shape:

The client needs no configuration at all. Without an API key it sends no `Authorization`
header and uses the anonymous trial:

```ts
import { NetRiskScanClient } from "netriskscan-cli";

const client = new NetRiskScanClient();

const { data } = await client.checkIp("1.1.1.1");
console.log(data.risk.index);

if (data.usage?.mode === "anonymous") {
  console.log("available:", data.usage.remaining);
}
```

Pass `apiKey` to use Developer Account quota instead. `getUsage()` is account data and
always requires a key - without one it throws `NetRiskScanConfigError` before any request
is made:

```ts
import { NetRiskScanClient, NetRiskScanApiError } from "netriskscan-cli";

const client = new NetRiskScanClient({
  apiKey: process.env.NETRISKSCAN_API_KEY,
  timeout: 10000,
  maxRetries: 3,
});

try {
  const { data, meta } = await client.checkIp("1.1.1.1");
  console.log(data.risk.index, data.risk.band, data.flags.vpn);
  console.log(meta.rateLimit.remaining, meta.quota.remaining);
} catch (err) {
  if (err instanceof NetRiskScanApiError) {
    console.error(`${err.code}: ${err.message} (requestId=${err.requestId})`);
  } else {
    throw err;
  }
}
```

```ts
const usage = await client.getUsage();
console.log(usage.data.units.remaining);
```

The response types are exported too, including `IpLocation` and `RiskReason`:

```ts
import type { IpRiskResponse, IpLocation, RiskReason } from "netriskscan-cli";

const { data } = await client.checkIp("66.249.87.5");

for (const reason of data.risk.reasons ?? []) {
  console.log(reason.code, reason.severity);
}
console.log(data.location?.country ?? "unknown");
```

Both are optional on `IpRiskResponse`, and every field inside `IpLocation` is nullable: an
older server omits them entirely, and a newer one can resolve a country without a city.
`RiskReason.code` / `category` / `severity` are plain `string`s on purpose, so a reason
code added server-side after your build still type-checks and still renders.

See [examples/](examples/) for runnable scripts.

## Security

- The CLI never prints, logs, or includes a full API key in error output or telemetry.
- There is no telemetry: **the CLI does not collect usage analytics or telemetry** of any
  kind, in any version.
- If `--debug` needs to show an authorization value, it is redacted
  (`Bearer nrs_live_abcd****1234`) - never printed in full.
- Prefer `export NETRISKSCAN_API_KEY=...` over passing `--api-key` inline, to keep the
  key out of shell history and process listings where practical.
- See [SECURITY.md](SECURITY.md) for how to report vulnerabilities and what to do if a
  key leaks.

## Developer API

|                 |                                             |
| --------------- | ------------------------------------------- |
| Base URL        | `https://api.netriskscan.com`               |
| Current version | `v1` (path prefix `/v1`, **not** `/api/v1`) |

This is a completely separate system from the netriskscan.com website's internal
`/api/public/*` endpoints - different auth, different response shapes, no compatibility
guarantees between the two. `netriskscan-cli` only ever calls `/v1/*`.

Currently available endpoints:

- `GET /v1/ip-risk/{ip}`
  - anonymous access supported
  - API key optional
  - API key requests use account quota and require `ip-risk:read`
- `GET /v1/usage` - requires an API key with `usage:read`

There is currently **no** server-side batch, history, or key-management endpoint
(`POST /v1/ip-risk/batch`, `POST /v1/ip-risk/query`, `GET /v1/history`,
`GET|POST /v1/key`, etc. are not implemented). API key creation/rotation/revocation is
only available through the Developer Dashboard.

`/v1/*` never accepts query string parameters - all inputs are path parameters.

See the official [Methodology](https://www.netriskscan.com/methodology.html) page for
how the NetRiskScan Index itself is computed (this project does not - and will not -
reimplement that logic client-side).

## Official resources

- [NetRiskScan](https://www.netriskscan.com) - web-based IP reputation and network
  intelligence
- [NetRiskScan methodology](https://www.netriskscan.com/methodology.html) - how the
  NetRiskScan Index and assessment model work
- [netriskscan-cli on npm](https://www.npmjs.com/package/netriskscan-cli)
- [GitHub repository](https://github.com/TeamQQ/netriskscan-cli)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
