# Open-Source Boundary

This file exists to make the public/private split explicit.

## Keep public

- `packages/mandate-os-sdk`
- `packages/mandate-os-mcp`
- `packages/mandate-os-openclaw`
- starter rule bundles and generic policy helpers
- verification code and signature handling
- installer scripts and host integrations
- public docs, examples, and the homepage
- homepage infrastructure and deployment automation

## Keep private

- multi-tenant hosted control-plane code
- workspace auth, sessions, org administration, and billing internals
- customer-specific policies, tenant config, logs, and audit data
- production secrets and key material
- production infrastructure for the hosted control plane
- MandateOS-owned execution routes that require managed credentials

## Rule of thumb

If a contribution increases trust, portability, or developer adoption, it is probably a good fit for the public repo.

If a contribution depends on customer data, managed secrets, or internal operating knowledge, it probably belongs in the private repo.

## Why this split is smart

- the public repo helps people understand and trust MandateOS
- the private repo protects customer operations and managed-service value
- the line is easier to maintain if it is written down before the repo grows
