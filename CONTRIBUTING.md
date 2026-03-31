# Contributing

Thanks for contributing to MandateOS.

## Before you open a PR

- keep changes generic and reusable
- avoid adding customer-specific logic, credentials, or operational data
- if your change needs hosted control-plane secrets or private execution routes, stop and move that work to the private repo instead

## Local development

```bash
pnpm install
pnpm build
pnpm test
```

Homepage:

```bash
pnpm mandate-os:homepage:start
```

Packages:

```bash
pnpm mandate-os:sdk:test
pnpm mandate-os:mcp:test
pnpm mandate-os:openclaw:test
```

## Scope for this repo

Good fits:

- SDK improvements
- MCP tooling
- installer fixes
- starter bundles
- docs and examples
- homepage content and infrastructure

Bad fits:

- customer data models
- billing internals
- auth/session handling for the hosted control plane
- production control-plane infrastructure
- secrets, tokens, or private tenant config

## Release flow

Public npm packages are released through GitHub Actions with trusted publishing. See [`.github/workflows/publish-packages.yml`](./.github/workflows/publish-packages.yml).
