#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_PATH="${1:-$PWD}"

if [[ $# -gt 0 ]]; then
  shift
fi

if [[ -z "${MANDATE_OS_BASE_URL:-}" ]]; then
  echo "MANDATE_OS_BASE_URL must be set before running the MandateOS OpenClaw installer." >&2
  exit 1
fi

if [[ -z "${MANDATE_OS_AGENT_TOKEN:-}" ]]; then
  echo "MANDATE_OS_AGENT_TOKEN is not set. Installation can continue, but OpenClaw will need that token in its runtime environment to enforce MandateOS policy." >&2
fi

echo "Installing MandateOS into OpenClaw for ${WORKSPACE_PATH}"

MANDATE_OS_OPENCLAW_WORKSPACE_PATH="$WORKSPACE_PATH" \
  npx --yes --package @mandate-os/openclaw@latest \
    mandate-os-openclaw-install install \
    "$@"
