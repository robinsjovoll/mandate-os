#!/usr/bin/env bash
set -euo pipefail

INFRA_PARAMETERS_FILE="${MANDATE_OS_HOMEPAGE_INFRA_PARAMETERS_FILE:-apps/mandate-os-homepage/infrastructure/main.parameters.json}"
OUTPUT_LOCATION="${SWA_OUTPUT_LOCATION:-dist/apps/mandate-os-homepage/browser}"
DEPLOY_ENV="${SWA_DEPLOY_ENV:-production}"
DEPLOY_TOKEN="${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APPS_API_TOKEN:-${AZURE_STATIC_WEB_APPS_API_TOKEN:-}}"

read_infra_parameter() {
  local parameter_name="$1"
  local file_path="$2"

  if [[ ! -f "${file_path}" ]]; then
    return 0
  fi

  node -e '
    const fs = require("fs");
    const filePath = process.argv[1];
    const parameterName = process.argv[2];
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const value = data?.parameters?.[parameterName]?.value;
      if (typeof value === "string") process.stdout.write(value);
    } catch {}
  ' "${file_path}" "${parameter_name}"
}

INFRA_SWA_NAME="$(read_infra_parameter "staticWebAppName" "${INFRA_PARAMETERS_FILE}")"
INFRA_RESOURCE_GROUP="$(read_infra_parameter "resourceGroupName" "${INFRA_PARAMETERS_FILE}")"

SWA_NAME="${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_NAME:-${SWA_NAME:-${INFRA_SWA_NAME:-swa-mandate-os-homepage-westeurope}}}"
SWA_RESOURCE_GROUP="${MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_RESOURCE_GROUP:-${SWA_RESOURCE_GROUP:-${INFRA_RESOURCE_GROUP:-}}}"

resolve_deploy_token() {
  local name="$1"
  local group="$2"

  az staticwebapp secrets list \
    --name "${name}" \
    --resource-group "${group}" \
    --query "properties.apiKey" \
    -o tsv 2>/dev/null || true
}

if [[ ! -d "${OUTPUT_LOCATION}" ]]; then
  echo "Build output directory not found: ${OUTPUT_LOCATION}"
  echo "Run 'nx run mandate-os-homepage:build' before deploy."
  exit 1
fi

if [[ -z "${DEPLOY_TOKEN}" ]]; then
  if ! command -v az >/dev/null 2>&1; then
    echo "Azure CLI (az) is required when deployment token is not provided."
    exit 1
  fi

  if [[ -z "${SWA_RESOURCE_GROUP}" ]]; then
    echo "Unable to resolve resource group for SWA '${SWA_NAME}'."
    echo "Set MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_RESOURCE_GROUP or configure resourceGroupName in ${INFRA_PARAMETERS_FILE}."
    exit 1
  fi

  echo "Resolving deployment token for SWA '${SWA_NAME}' in '${SWA_RESOURCE_GROUP}'..."
  DEPLOY_TOKEN="$(resolve_deploy_token "${SWA_NAME}" "${SWA_RESOURCE_GROUP}")"
fi

if [[ -z "${DEPLOY_TOKEN}" ]]; then
  echo "Failed to resolve Azure Static Web Apps deployment token for SWA '${SWA_NAME}' in resource group '${SWA_RESOURCE_GROUP}'."
  echo "Ensure deploy variables match infrastructure parameters in ${INFRA_PARAMETERS_FILE}."
  exit 1
fi

DEPLOY_COMMAND=(
  npx --yes @azure/static-web-apps-cli deploy "${OUTPUT_LOCATION}"
  --deployment-token "${DEPLOY_TOKEN}"
  --env "${DEPLOY_ENV}"
  --app-name "${SWA_NAME}"
)

if [[ -n "${SWA_RESOURCE_GROUP}" ]]; then
  DEPLOY_COMMAND+=(--resource-group "${SWA_RESOURCE_GROUP}")
fi

echo "Deploying '${SWA_NAME}' from ${OUTPUT_LOCATION}..."
"${DEPLOY_COMMAND[@]}"
echo "Deployment completed."
