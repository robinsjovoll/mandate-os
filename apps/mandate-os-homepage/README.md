# MandateOS Homepage (SPA)

Single-page Angular app for the public MandateOS marketing homepage.

## Local development

```bash
pnpm nx run mandate-os-homepage:serve
```

## Build

```bash
pnpm nx run mandate-os-homepage:build
```

## Deploy

This project exposes an Nx `deploy` target:

```bash
pnpm nx run mandate-os-homepage:deploy
```

The deploy script supports these environment variables:

- `MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_NAME` (optional override; default comes from `infrastructure/main.parameters.json`)
- `MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APP_RESOURCE_GROUP` (optional override; default comes from `infrastructure/main.parameters.json`)
- `MANDATE_OS_HOMEPAGE_INFRA_PARAMETERS_FILE` (optional path override; default: `apps/mandate-os-homepage/infrastructure/main.parameters.json`)
- `MANDATE_OS_HOMEPAGE_AZURE_STATIC_WEB_APPS_API_TOKEN` (optional direct token)
- `SWA_OUTPUT_LOCATION` (default: `dist/apps/mandate-os-homepage/browser`)
- `SWA_DEPLOY_ENV` (default: `production`)

## Infrastructure as code (Azure)

This project exposes an Nx `infrastructure` target:

```bash
pnpm nx run mandate-os-homepage:infrastructure
```

IaC files live in:

- `apps/mandate-os-homepage/infrastructure/main.bicep`
- `apps/mandate-os-homepage/infrastructure/main.parameters.json`

The default resource group is `rg-mandate-os-homepage-westeurope`.
