# Contributing to netriskscan-cli

Thanks for your interest in improving `netriskscan-cli`.

## Scope

This project is a CLI and thin SDK client for the **public** NetRiskScan Developer API
(`/v1/*`) documented at the top of the [README](README.md). Please keep contributions
within that scope:

- Only call documented `/v1/*` endpoints (`GET /v1/ip-risk/{ip}`, `GET /v1/usage`).
- Never add calls to `/api/public/*` or any other internal/undocumented endpoint.
- Never re-implement, approximate, or "improve" the risk score client-side.
  `risk.index` from the API response is the only source of truth.
- Don't add telemetry, analytics, or tracking of any kind.
- Don't add heavyweight dependencies (frameworks, HTTP client libraries, etc.) - the
  project intentionally uses Node's built-in `fetch`.

If you need a capability the current API doesn't expose (e.g. a real batch endpoint),
please open an issue describing the use case instead of working around it client-side.

## Development setup

```bash
git clone https://github.com/netriskscan/netriskscan-cli.git
cd netriskscan-cli
npm install
```

Useful scripts:

```bash
npm run build       # bundle with tsup
npm run typecheck   # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest run
npm run dev          # tsup --watch
```

Run the CLI locally without installing it globally:

```bash
npm run build
node dist/cli.js check 1.1.1.1
```

## Tests

- Unit tests live in `tests/` and use [Vitest](https://vitest.dev).
- Tests must **not** make real network calls or consume production API quota. Mock
  `fetch` (see `tests/helpers.ts` and `tests/client.test.ts` for examples).
- Pay special attention to the tri-state flag handling (`true` / `false` / `null`) and
  to `risk.index` being a legitimate `0` - never use a truthiness check on either.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your change with tests.
3. Run `npm run lint && npm run typecheck && npm test && npm run build` locally.
4. Open a PR describing the change and why it's needed.

By contributing, you agree your contributions are licensed under the project's
[MIT License](LICENSE).
