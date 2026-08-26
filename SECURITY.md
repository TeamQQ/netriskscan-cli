# Security Policy

## Reporting a vulnerability

Please email **support@netriskscan.com** rather than opening a public GitHub issue.

When reporting, please **do not** include:

- Your NetRiskScan API key or any `Authorization` header value
- Full request/response logs that contain authentication headers
- Other sensitive account or billing information

A `requestId` (from a CLI error message, `--verbose` output, or the `X-Request-Id` /
`requestId` field) is safe to share and helps us investigate faster.

## If your API key is exposed

If you believe a NetRiskScan API key has been leaked (committed to a public repo, printed
in a CI log, pasted somewhere public, etc.), **do not wait for a response here** - go
straight to the [NetRiskScan Developer Dashboard](https://www.netriskscan.com/) and:

1. Open **API Keys**
2. **Revoke** or **rotate** the affected key immediately
3. Update any deployments/CI secrets that reference the old key

## Scope

This policy covers the `netriskscan-cli` source code and its published npm package. It
does not cover the NetRiskScan API service itself, the NetRiskScan website, or NetRiskScan
account/billing systems - please report those directly to support@netriskscan.com as well.

## Supported versions

Only the latest published major version of `netriskscan-cli` receives security fixes.
