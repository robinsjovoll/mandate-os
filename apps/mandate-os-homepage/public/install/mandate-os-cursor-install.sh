#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_PATH="${1:-$PWD}"

if [[ $# -gt 0 ]]; then
  shift
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "$name must be set before running the MandateOS Cursor installer." >&2
    exit 1
  fi
}

require_env "MANDATE_OS_BASE_URL"
require_env "MANDATE_OS_AGENT_TOKEN"

echo "Installing MandateOS into Cursor for ${WORKSPACE_PATH}"

npx --yes --package @mandate-os/mcp@0.1.1 \
  mandate-os-cursor-install install \
  --workspace "$WORKSPACE_PATH" \
  "$@"
