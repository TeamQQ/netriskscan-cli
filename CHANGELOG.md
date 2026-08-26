# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-08-26

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
