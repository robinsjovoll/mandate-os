# `@mandate-os/mcp`

MandateOS MCP server for agent hosts such as Codex, Cursor, and Claude Code.

This package exposes:

- Generic MandateOS control-plane tools for issuing mandates, evaluating actions, minting grants, and verifying signatures
- Enforced adapter tools for the MandateOS-owned GitHub execution routes
- A stdio entrypoint that can be registered directly as an MCP server

## Why this exists

This MCP is intentionally broader than the current GitHub adapters.

- Use the generic MandateOS tools when your agent still performs the side effect itself and you want MandateOS to act as the policy decision point.
- Use the enforced adapter tools when MandateOS already owns the side effect and should act as both the policy decision point and the enforcement point.

## Environment

The MCP server expects:

- `MANDATE_OS_BASE_URL`
- `MANDATE_OS_AGENT_TOKEN`

Optional defaults:

- `MANDATE_OS_MCP_DEFAULT_MANDATE_ID`
- `MANDATE_OS_MCP_DEFAULT_SOURCE`
- `MANDATE_OS_MCP_SERVER_NAME`
- `MANDATE_OS_MCP_SERVER_VERSION`

The API key behind `MANDATE_OS_AGENT_TOKEN` should usually include:

- `control-plane:read` for workspace and mandate context
- `mandates:read` and `receipts:read` for mandate and receipt lookups
- `simulate:write` for live runtime evaluation, execution-grant issuance, and
  enforced GitHub execution routes

If the host only reads control-plane state, keep scopes narrower. If it must run
live OpenClaw or enforced GitHub policy flows, `simulate:write` is required.

## One-Command Cursor Install

If you want Cursor to pick up MandateOS as the default path in a workspace, use the published installer CLI:

```bash
MANDATE_OS_BASE_URL=http://localhost:4330 \
MANDATE_OS_AGENT_TOKEN='key_id.secret' \
MANDATE_OS_MCP_DEFAULT_MANDATE_ID='mdt_123' \
npx --yes --package @mandate-os/mcp mandate-os-cursor-install install \
  --workspace /absolute/path/to/your/repo
```

That command:

- updates `~/.cursor/mcp.json` with a global `mandateos` MCP entry
- updates `/absolute/path/to/your/repo/.cursor/mcp.json` with a workspace override
- updates `/absolute/path/to/your/repo/.cursor/hooks.json` with MandateOS `beforeShellExecution` and `beforeMCPExecution` hooks

The default installer uses all bundled starter rule files:

- `release-platform.json`
- `docs-content.json`
- `finance-support.json`

You can inspect what is installed with:

```bash
npx --yes --package @mandate-os/mcp mandate-os-cursor-install status \
  --workspace /absolute/path/to/your/repo
```

Useful install flags:

- `--no-user-mcp` to skip `~/.cursor/mcp.json`
- `--no-project-mcp` to skip workspace `.cursor/mcp.json`
- `--no-project-hooks` to skip workspace `.cursor/hooks.json`
- `--rules-files /a.json,/b.json` to override the bundled starter rules
- `--unmatched-permission allow|ask|deny` to control how unmatched shell or MCP actions are handled

The current tested trust boundary is Cursor desktop. In local testing:

- Cursor desktop loaded the MandateOS MCP and the MandateOS project hooks
- direct `gh issue edit ... --add-label ...` was blocked in the desktop app and redirected to `mandateos_execute_enforced_action`
- `cursor-agent --print` did not invoke `beforeShellExecution`, so it should not yet be treated as equivalent to the desktop enforcement surface

## One-Command Claude Code Install

If you want Claude Code to pick up MandateOS as the default path in a workspace, use the published installer CLI:

```bash
MANDATE_OS_BASE_URL=http://localhost:4330 \
MANDATE_OS_AGENT_TOKEN='key_id.secret' \
MANDATE_OS_MCP_DEFAULT_MANDATE_ID='mdt_123' \
npx --yes --package @mandate-os/mcp mandate-os-claude-install install \
  --workspace /absolute/path/to/your/repo
```

That command:

- updates `~/.claude.json` with a local-scoped `mandateos` MCP entry for that workspace
- updates `/absolute/path/to/your/repo/.claude/settings.local.json` with MandateOS `PreToolUse` hooks for `Bash` and `mcp__.*`
- adds `.claude/settings.local.json` to `.git/info/exclude` when the workspace is a Git repository

The default installer uses all bundled starter rule files:

- `release-platform.json`
- `docs-content.json`
- `finance-support.json`

You can inspect what is installed with:

```bash
npx --yes --package @mandate-os/mcp mandate-os-claude-install status \
  --workspace /absolute/path/to/your/repo
```

Useful install flags:

- `--no-local-mcp` to skip the workspace entry inside `~/.claude.json`
- `--no-local-hooks` to skip workspace `.claude/settings.local.json`
- `--no-git-exclude` to skip `.git/info/exclude` updates
- `--rules-files /a.json,/b.json` to override the bundled starter rules
- `--unmatched-permission allow|ask|deny` to control how unmatched shell or MCP actions are handled

The current tested trust boundary for Claude Code is the Claude Code CLI and local project settings:

- the local-scoped `mandateos` MCP entry was loaded from `~/.claude.json`
- the local `PreToolUse` hooks were loaded from `.claude/settings.local.json`
- direct `gh issue edit ... --add-label ...` was blocked and redirected to `mandateos_execute_enforced_action`

## Tool surface

Generic workflow tools:

- `mandateos_get_context`
- `mandateos_get_policy_catalog`
- `mandateos_issue_mandate`
- `mandateos_evaluate_actions`
- `mandateos_issue_execution_grant`
- `mandateos_verify_mandate`
- `mandateos_verify_receipt`
- `mandateos_verify_execution_grant`

Enforced adapter tools:

- `mandateos_execute_enforced_action`
- legacy aliases remain available for compatibility, including `mandateos_execute_github_issue_label` and `mandateos_execute_github_pull_request_draft`

## Hooks and Host Enforcement

MCP makes MandateOS available to the agent. Hooks are what help make MandateOS the default path instead of an optional one.

The important architectural point is:

- hooks should not replace MandateOS policy
- hooks should intercept host activity and ask MandateOS whether that activity is allowed

In other words, the hook is the local gate and MandateOS remains the central policy decision point.

For hosts like Cursor, the most useful hooks are:

- `beforeShellExecution` as the main bypass blocker for direct shell-based side effects
- `beforeMCPExecution` as the main bypass blocker for side-effecting tools exposed by other MCP servers
- `beforeSubmitPrompt` as a soft reminder to start with MandateOS, not as the primary enforcement point
- `afterShellExecution` and `afterMCPExecution` for audit and reconciliation
- `sessionStart` for injecting session defaults such as workspace context, source, or mandate id

If you want MandateOS to sit in front of "anything dangerous", the practical pattern is:

1. Register this MandateOS MCP server.
2. Allow all `mandateos_*` tools.
3. Use `beforeShellExecution` to intercept direct provider or mutation commands such as `gh`, `curl`, `kubectl`, `terraform`, `aws`, `gcloud`, `npm publish`, or `git push`, then call MandateOS to decide whether they are allowed.
4. Use `beforeMCPExecution` to intercept side-effecting tools from non-MandateOS MCP servers, then call MandateOS to decide whether they are allowed.
5. Keep provider credentials out of the agent process whenever possible.
6. For generic workflows, require a fresh MandateOS receipt before allowing the side effect.
7. For enforced adapters, deny the direct path and force the agent onto `mandateos_execute_enforced_action` or a supported legacy alias.

The practical hook flow is:

1. Cursor calls `beforeShellExecution` or `beforeMCPExecution`.
2. The hook normalizes the attempted command or tool call into a MandateOS action shape.
3. The hook calls MandateOS, usually through `@mandate-os/sdk` or a direct API request.
4. The hook maps the MandateOS decision back to Cursor's `allow`, `deny`, or `ask`.

For example:

- `gh issue edit --add-label bug` becomes a `github.issue.label` action proposal
- `kubectl apply -f prod.yaml` becomes a deployment or cluster mutation action proposal
- `terraform apply` becomes an infrastructure mutation action proposal
- an unknown but side-effecting command can fall back to a coarse action like `shell.command.execute` and require approval or deny-by-default

Cursor's hooks docs currently describe `beforeShellExecution` and `beforeMCPExecution` as running before any shell command or MCP tool call, and they support `failClosed: true`, which is the right default for security-sensitive MandateOS hooks:

- [Cursor Hooks](https://cursor.com/docs/hooks)

Example `hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      {
        "type": "prompt",
        "prompt": "If this task could change an external system, use MandateOS first. Prefer mandateos_execute_* when available. Otherwise issue or load a mandate and call mandateos_evaluate_actions before continuing.",
        "timeout": 10
      }
    ],
    "beforeShellExecution": [
      {
        "command": "node /absolute/path/to/dist/packages/mandate-os-mcp/hook-gateway.js cursor before-shell",
        "timeout": 5,
        "failClosed": true
      }
    ],
    "beforeMCPExecution": [
      {
        "command": "node /absolute/path/to/dist/packages/mandate-os-mcp/hook-gateway.js cursor before-mcp",
        "timeout": 5,
        "failClosed": true
      }
    ]
  }
}
```

That built hook gateway reads:

- `MANDATE_OS_BASE_URL`
- `MANDATE_OS_AGENT_TOKEN`
- `MANDATE_OS_MCP_DEFAULT_MANDATE_ID`
- `MANDATE_OS_MCP_DEFAULT_SOURCE` (optional)
- `MANDATE_OS_HOST_GATEWAY_UNMATCHED_PERMISSION` with `ask` by default
- `MANDATE_OS_HOST_GATEWAY_RULES_FILES` for a comma-separated list of starter or custom bundle files
- `MANDATE_OS_HOST_GATEWAY_RULES_JSON` or `MANDATE_OS_HOST_GATEWAY_RULES_FILE` for custom domain rules

Included starter bundles:

- `dist/packages/mandate-os-mcp/rules/starter-bundles/release-platform.json`
- `dist/packages/mandate-os-mcp/rules/starter-bundles/docs-content.json`
- `dist/packages/mandate-os-mcp/rules/starter-bundles/finance-support.json`

Example:

```bash
export MANDATE_OS_HOST_GATEWAY_RULES_FILES="/absolute/path/to/dist/packages/mandate-os-mcp/rules/starter-bundles/release-platform.json,/absolute/path/to/dist/packages/mandate-os-mcp/rules/starter-bundles/docs-content.json"
```

Example `beforeShellExecution` logic if you want to customize your own wrapper instead of calling the built helper directly:

```js
import { readFileSync } from 'node:fs';
import { MandateOsAgentClient } from '@mandate-os/sdk';
import { createMandateOsHostGateway, toCursorHookResponse } from '@mandate-os/mcp';

const input = JSON.parse(readFileSync(0, 'utf8'));
const gateway = createMandateOsHostGateway({
  client: new MandateOsAgentClient({
    baseUrl: process.env.MANDATE_OS_BASE_URL,
    bearerToken: process.env.MANDATE_OS_AGENT_TOKEN,
  }),
  defaultMandateId: process.env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID,
  defaultSource: 'cursor.beforeShellExecution',
  hostName: 'cursor',
});

const result = await gateway.evaluateShellCommand({
  host: 'cursor',
  source: 'cursor.beforeShellExecution',
  command: String(input.command || ''),
  cwd: typeof input.cwd === 'string' ? input.cwd : null,
});

console.log(JSON.stringify(toCursorHookResponse(result)));
```

Example `beforeMCPExecution` logic:

```js
import { readFileSync } from 'node:fs';
import { MandateOsAgentClient } from '@mandate-os/sdk';
import { createMandateOsHostGateway, toCursorHookResponse } from '@mandate-os/mcp';

const input = JSON.parse(readFileSync(0, 'utf8'));
const gateway = createMandateOsHostGateway({
  client: new MandateOsAgentClient({
    baseUrl: process.env.MANDATE_OS_BASE_URL,
    bearerToken: process.env.MANDATE_OS_AGENT_TOKEN,
  }),
  defaultMandateId: process.env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID,
  defaultSource: 'cursor.beforeMCPExecution',
  hostName: 'cursor',
});

const result = await gateway.evaluateMcpToolCall({
  host: 'cursor',
  source: 'cursor.beforeMCPExecution',
  toolName: String(input.tool_name || ''),
  toolInput: input.tool_input,
  serverCommand: typeof input.command === 'string' ? input.command : null,
  serverUrl: typeof input.url === 'string' ? input.url : null,
});

console.log(JSON.stringify(toCursorHookResponse(result)));
```

Hooks are still defense-in-depth, not the entire trust boundary.

- If the agent still has raw GitHub, cloud, payment, or deployment credentials, it may still bypass MandateOS through some other route.
- The strongest setup is: MandateOS MCP exposed, direct shell or tool bypasses blocked with hooks, and external credentials held only by MandateOS.
- The ideal long-term setup is a small MandateOS host-gateway helper that hooks call directly, so policy translation and receipt handling stay consistent across Cursor, Codex, and other hosts.

## Registering the server

After building:

```bash
pnpm mandate-os:mcp:build
```

register the built stdio command in your MCP-capable host:

```bash
node /absolute/path/to/dist/packages/mandate-os-mcp/index.js
```

with the MandateOS env vars above injected into the server process.
