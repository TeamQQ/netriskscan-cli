# [1.5.0](https://github.com/TeamQQ/netriskscan-cli/compare/v1.4.0...v1.5.0) (2026-09-02)


### Features

* add geolocation and risk reasons to CLI ([7a47c02](https://github.com/TeamQQ/netriskscan-cli/commit/7a47c022c70ca108025edee7c24b9b851cbe8bde))

### Details

- IP geolocation output for `check` (`Location`: country, region, city, time zone), shown
  only for the fields the server actually resolved
- Public risk-reason rendering for `check` (`Risk Reasons`), shown only when the server
  sent any
- SDK typings for `location` and `risk.reasons`: `IpLocation` and `RiskReason`, both
  exported from the package entry point
- Forward-compatible handling of future reason codes, categories and severities - an
  unrecognised value renders instead of throwing or being dropped

### Notes

- `--json` / `--jsonl` remain a passthrough of the API response, so both new fields appear
  there in their raw machine form with no remapping
- A server that predates either field still works unchanged, and neither field affects
  `risk.index`, `--fail-below`, `--fail-on`, or any exit code

# [1.4.0](https://github.com/TeamQQ/netriskscan-cli/compare/v1.3.0...v1.4.0) (2026-09-02)


### Features

* **check:** show proxy type and verified search crawler identity ([4386353](https://github.com/TeamQQ/netriskscan-cli/commit/43863534b3d51bb8ce7ba22ac5b0b07fc03c48ee))

# [1.3.0](https://github.com/TeamQQ/netriskscan-cli/compare/v1.2.0...v1.3.0) (2026-08-28)


### Features

* **cli:** add anonymous IP check trial ([a02c9df](https://github.com/TeamQQ/netriskscan-cli/commit/a02c9df33fc443cba253d95770f8cb27d6435bdb))

# [1.2.0](https://github.com/TeamQQ/netriskscan-cli/compare/v1.1.0...v1.2.0) (2026-08-27)


### Features

* **check:** add Explore footer and API key signup CTA ([dc68f27](https://github.com/TeamQQ/netriskscan-cli/commit/dc68f27b3c3c477e1dc8823a49358348c31869de))

# [1.1.0](https://github.com/TeamQQ/netriskscan-cli/compare/v1.0.0...v1.1.0) (2026-08-27)


### Features

* **check:** show Profile and Service for known infrastructure ([f0e84a2](https://github.com/TeamQQ/netriskscan-cli/commit/f0e84a2953a6f77ac23ee7f677b8b7919a31bb5a))

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-08-26

### Added

- `netriskscan check <ip>` - query `GET /v1/ip-risk/{ip}`, with human, `--json`,
  `--verbose`, `--fail-below`, and `--fail-on` output modes.
- `netriskscan usage` - query `GET /v1/usage`.
- `netriskscan batch <file>` - client-side batch over `GET /v1/ip-risk/{ip}` with
  controlled concurrency, `--jsonl` output, and `-` for stdin.
- `NetRiskScanClient` SDK (`checkIp`, `getUsage`) with typed responses, automatic
  retry on `429`/`503` honoring `Retry-After`, request timeouts, and `X-Request-Id`
  support.
- Strict tri-state handling for `flags.*` (`true` / `false` / `null`) and for
  `risk.index` (including `0` and `null`).
- Stable CLI exit codes (0-7), documented in the README.
