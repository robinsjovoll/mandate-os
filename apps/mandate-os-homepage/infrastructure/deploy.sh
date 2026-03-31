#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${INFRA_TEMPLATE_FILE:-${SCRIPT_DIR}/main.bicep}"
PARAMETERS_FILE="${INFRA_PARAMETERS_FILE:-${SCRIPT_DIR}/main.parameters.json}"
DEPLOYMENT_LOCATION="${AZURE_INFRA_DEPLOYMENT_LOCATION:-westeurope}"
DEPLOYMENT_NAME="${AZURE_INFRA_DEPLOYMENT_NAME:-mandate-os-homepage-infra-$(date +%Y%m%d%H%M%S)}"

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required for infrastructure target."
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  echo "Azure CLI is not logged in. Run 'az login' or use azure/login in CI."
  exit 1
fi

PARAMETER_OVERRIDES=()

if [[ -n "${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_NAME:-}" ]]; then
  PARAMETER_OVERRIDES+=("staticWebAppName=${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_NAME}")
fi

if [[ -n "${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_RESOURCE_GROUP:-}" ]]; then
  PARAMETER_OVERRIDES+=("resourceGroupName=${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_RESOURCE_GROUP}")
fi

echo "Deploying MandateOS homepage infrastructure with ${TEMPLATE_FILE}..."
az deployment sub create \
  --name "${DEPLOYMENT_NAME}" \
  --location "${DEPLOYMENT_LOCATION}" \
  --template-file "${TEMPLATE_FILE}" \
  --parameters @"${PARAMETERS_FILE}" \
  "${PARAMETER_OVERRIDES[@]}"

echo "Infrastructure deployment completed."
