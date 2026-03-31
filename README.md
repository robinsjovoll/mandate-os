# MandateOS

Operational guardrails for AI agents.

This repository is the public MandateOS workspace. It contains the developer-facing integrations, starter policy bundles, and the marketing homepage that make MandateOS easy to inspect, install, and extend.

## What is in this repo

- `packages/mandate-os-sdk`: TypeScript SDK for mandate issuance, evaluation, grants, and verification
- `packages/mandate-os-mcp`: MCP server plus Cursor and Claude Code installer CLIs
- `packages/mandate-os-openclaw`: OpenClaw bridge, plugin bundle, and installer
- `apps/mandate-os-homepage`: public marketing homepage and its Azure Static Web Apps infrastructure
- `scripts/releases/publish-mandate-os-packages.mjs`: npm package release helper

## What is intentionally not in this repo

- the hosted multi-tenant MandateOS control plane
- workspace auth, billing, and customer-specific data handling
- managed secrets custody and MandateOS-owned production execute routes
- production infrastructure for the private control plane

The short version is:

- public repo = trust layer, install layer, docs, starter bundles, homepage
- private repo = hosted control plane, customer ops, secrets, enterprise operation

More detail lives in [OPEN_SOURCE_BOUNDARY.md](./OPEN_SOURCE_BOUNDARY.md).

## Quickstart

```bash
pnpm install
pnpm build
pnpm test
```

Run the homepage locally:

```bash
pnpm mandate-os:homepage:start
```

Useful package commands:

```bash
pnpm mandate-os:mcp:build
pnpm mandate-os:cursor:install
pnpm mandate-os:claude:install
pnpm mandate-os:openclaw:install
```

## Open-source hygiene

- keep customer data, private control-plane code, and production secrets out of this repo
- prefer adding generic integrations, starter policies, docs, and verification tooling here
- if a change needs hosted secrets or customer-specific execution, it probably belongs in the private repo

## GitHub Actions

This repo ships:

- CI for build and test
- npm package publishing for the public packages
- homepage infrastructure and deployment workflow

See [`.github/workflows/README.md`](./.github/workflows/README.md) for the repo variables and secrets those workflows expect.
