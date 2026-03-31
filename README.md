# MandateOS

Operational guardrails for AI agents.

MandateOS is an open-core system:

- this public repo contains the open-source SDKs, MCP server, shell installers, starter policy bundles, and docs
- the managed MandateOS control plane handles hosted approvals, workspace operations, retained audit history, and customer administration

Start with the public packages here, then connect them to the hosted control plane when you want team-wide operations and managed review flows.

Project site: [getmandateos.com](https://getmandateos.com)

## Community docs

- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Open-source boundary](./OPEN_SOURCE_BOUNDARY.md)

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
- private repo = hosted control plane, approval workflows, customer ops, secrets, enterprise operation

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

## How to evaluate MandateOS

- use the open-source packages in this repo when you want to inspect the trust layer, install local integrations, or build your own policy-aware tooling
- use the managed control plane when you want hosted workspace operations, approvals, retained audit history, and org-level administration
- use both together when you want the cleanest production setup

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
