#!/usr/bin/env bash
# Example CI gate: fail the build if the target IP looks risky.
#
# Usage: TARGET_IP=1.2.3.4 NETRISKSCAN_API_KEY=nrs_live_xxx ./examples/ci-policy.sh
set -euo pipefail

: "${TARGET_IP:?Set TARGET_IP to the address you want to check}"

netriskscan check "$TARGET_IP" --fail-below 60 --fail-on tor --fail-on proxy
