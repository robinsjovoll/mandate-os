# GitHub Actions

This public repository ships three workflows:

- `ci.yml`: build and test the public repo
- `publish-packages.yml`: publish the public npm packages
- `deploy-homepage.yml`: provision and deploy the public homepage

## Recommended repo variables

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_INFRA_DEPLOYMENT_LOCATION`
- `MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_NAME`
- `MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_RESOURCE_GROUP`

## Recommended repo secrets

- `MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APPS_API_TOKEN`

## npm publishing

The package publish workflow is set up for GitHub trusted publishing. That is the safest option for a public repo because it avoids long-lived npm tokens.

## What should not be added to Actions in this repo

- control-plane deployment workflows
- customer-specific environment values
- private data migrations
- production secrets for the hosted MandateOS control plane
