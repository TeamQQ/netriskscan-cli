# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `check` now shows `Profile` and `Service` in the Network block when the server identifies the address as
  known infrastructure — e.g. `search_crawler` / `Applebot` for an address inside Apple's published
  Applebot ranges. Both rows are omitted entirely when the server sends no such identity, so ordinary
  addresses render exactly as before.

  These come from the server's new optional `network.profile` / `network.service` fields. The CLI reads
  them defensively, so it keeps working against servers that predate them.

  A value in `Service` means the address was found in a range list the operator itself publishes — never
  that its ASN or organization merely looked like a crawler's.

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
