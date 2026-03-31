# `@mandate-os/openclaw`

MandateOS bridge, plugin bundle, and installer for OpenClaw.

This package provides:

- `mandate-os-openclaw-install` to configure OpenClaw for a guarded workspace
- `mandate-os-openclaw-bridge` for policy evaluation inside the OpenClaw plugin flow
- the bundled OpenClaw extension assets that enable the guarded workflow

## Environment

The installer expects:

- `MANDATE_OS_BASE_URL`

Optional during install:

- `MANDATE_OS_MCP_DEFAULT_MANDATE_ID`
- `MANDATE_OS_OPENCLAW_SANDBOX_MODE` (`all` or `off`)

Required at OpenClaw runtime:

- `MANDATE_OS_AGENT_TOKEN`

## One-Command Install

```bash
MANDATE_OS_BASE_URL=https://mandateos.example.com \
MANDATE_OS_AGENT_TOKEN='key_id.secret' \
MANDATE_OS_MCP_DEFAULT_MANDATE_ID='mdt_123' \
MANDATE_OS_OPENCLAW_WORKSPACE_PATH=/absolute/path/to/your/repo \
npx --yes --package @mandate-os/openclaw mandate-os-openclaw-install install
```

That command:

- installs the MandateOS plugin bundle under the local OpenClaw state directory
- configures the MandateOS MCP entry for the guarded workspace
- creates or updates the `mandateos_guarded` agent profile

To install the guarded agent with sandboxing disabled, pass either:

```bash
MANDATE_OS_OPENCLAW_SANDBOX_MODE=off \
npx --yes --package @mandate-os/openclaw mandate-os-openclaw-install install
```

or:

```bash
npx --yes --package @mandate-os/openclaw mandate-os-openclaw-install install --sandbox-mode=off
```

If you omit the option, fresh installs default to `all`, while existing guarded
agents keep their current sandbox setting.

Inspect the current install state with:

```bash
MANDATE_OS_OPENCLAW_WORKSPACE_PATH=/absolute/path/to/your/repo \
npx --yes --package @mandate-os/openclaw mandate-os-openclaw-install status
```

Repair an existing OpenClaw install in place with a clean MandateOS asset reset:

```bash
MANDATE_OS_BASE_URL=https://mandateos.example.com \
MANDATE_OS_MCP_DEFAULT_MANDATE_ID='mdt_123' \
MANDATE_OS_OPENCLAW_WORKSPACE_PATH=/absolute/path/to/your/repo \
npx --yes --package @mandate-os/openclaw mandate-os-openclaw-install repair
```

That repair flow removes the MandateOS-owned OpenClaw plugin and bundle
directories plus local MandateOS approval/status cache files, then reinstalls
the current assets and repairs the MandateOS config entries. It preserves
existing guarded-agent overrides such as `mandateos_guarded.sandbox.mode = off`.
You can also change the guarded-agent sandbox mode during repair with
`--sandbox-mode=all|off`.

## Runtime note

OpenClaw must still start with `MANDATE_OS_AGENT_TOKEN` in its runtime
environment so the bridge can evaluate actions against MandateOS policy.

## Interpreting `status`

`status` is intentionally narrower than `doctor`. Read these sections
independently:

- `installHealth`: local install health for the plugin, bundle, MCP entry,
  bridge runtime, and guarded agent wiring
- `runtimeAuthorization`: whether the live OpenClaw runtime has
  `MANDATE_OS_AGENT_TOKEN`
- `wrapperExposureVerification`: whether a live OpenClaw session exposed the
  MandateOS wrapper tools
- `livePolicyCapability`: whether base URL, runtime token, and default mandate
  are all present for live-policy checks

That split matters because these states can diverge. Example: install health can
be good while runtime authorization is still missing, or wrapper exposure can be
unverified even though the plugin registered successfully.

## Interpreting `doctor`

`doctor` adds smoke tests on top of `status`:

- `Install status` checks the local install footprint.
- `Runtime token` confirms runtime authorization input.
- `Local bridge smoke test` confirms the bridge can execute locally.
- `Live policy smoke test` requires `MANDATE_OS_BASE_URL`,
  `MANDATE_OS_AGENT_TOKEN`, and `MANDATE_OS_MCP_DEFAULT_MANDATE_ID`.

If you want live OpenClaw policy evaluation, the backing API key used for
`MANDATE_OS_AGENT_TOKEN` must include `simulate:write`.
