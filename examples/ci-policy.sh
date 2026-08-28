#!/usr/bin/env bash
# Example CI gate: fail the build if the target IP looks risky.
#
# Usage: TARGET_IP=1.2.3.4 ./examples/ci-policy.sh
#
# NETRISKSCAN_API_KEY is optional here: without it the check uses the anonymous daily
# trial, which is metered per public IP and shared by every job on a CI runner. Set a key
# for anything running on a schedule.
set -euo pipefail

: "${TARGET_IP:?Set TARGET_IP to the address you want to check}"

netriskscan check "$TARGET_IP" --fail-below 60 --fail-on tor --fail-on proxy
