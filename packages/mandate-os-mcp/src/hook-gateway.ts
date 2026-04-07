#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import { createMandateOsClient } from './handlers.js';
import {
  createMandateOsHostGateway,
  readHostGatewayRulesFromEnv,
  readHostGatewayUnmatchedPermission,
  toClaudeHookResponse,
  toCodexHookResponse,
  toCursorHookResponse,
} from './host-gateway.js';
import { readMandateOsMcpConfig } from './config.js';

type SupportedHost = 'cursor' | 'claude' | 'codex';
type SupportedCursorEvent = 'before-shell' | 'before-mcp';
type SupportedClaudeEvent = 'pre-tool-bash' | 'pre-tool-mcp';
type SupportedCodexEvent = 'pre-tool-bash';

export async function runHookGatewayCommand(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  stdinText = readFileSync(0, 'utf8'),
) {
  const [host, event] = argv as [
    SupportedHost | undefined,
    SupportedCursorEvent | SupportedClaudeEvent | SupportedCodexEvent | undefined,
  ];

  const isSupportedCursorEvent =
    host === 'cursor' && (event === 'before-shell' || event === 'before-mcp');
  const isSupportedClaudeEvent =
    host === 'claude' &&
    (event === 'pre-tool-bash' || event === 'pre-tool-mcp');
  const isSupportedCodexEvent = host === 'codex' && event === 'pre-tool-bash';

  if (!isSupportedCursorEvent && !isSupportedClaudeEvent && !isSupportedCodexEvent) {
    throw new Error(
      'Usage: hook-gateway.js cursor before-shell|before-mcp | claude pre-tool-bash|pre-tool-mcp | codex pre-tool-bash',
    );
  }

  const config = readMandateOsMcpConfig(env);
  const gateway = createMandateOsHostGateway({
    client: createMandateOsClient(config),
    defaultMandateId: config.defaultMandateId,
    defaultSource: config.defaultSource,
    hostName: host,
    unmatchedPermission: readHostGatewayUnmatchedPermission(env),
    rules: readHostGatewayRulesFromEnv(env),
  });
  const rawInput = stdinText.trim();
  const input =
    rawInput.length > 0
      ? (JSON.parse(rawInput) as Record<string, unknown>)
      : {};

  if (host === 'cursor' && event === 'before-shell') {
    const result = await gateway.evaluateShellCommand({
      host,
      source: `${host}.beforeShellExecution`,
      command: String(input.command || ''),
      cwd: typeof input.cwd === 'string' ? input.cwd : null,
      sandbox: typeof input.sandbox === 'boolean' ? input.sandbox : undefined,
      details: {
        hook: 'beforeShellExecution',
      },
    });

    return toCursorHookResponse(result);
  }

  if (host === 'cursor' && event === 'before-mcp') {
    const result = await gateway.evaluateMcpToolCall({
      host,
      source: `${host}.beforeMCPExecution`,
      toolName: String(input.tool_name || input.toolName || ''),
      toolInput: input.tool_input ?? input.toolInput,
      serverCommand:
        typeof input.command === 'string' ? input.command : undefined,
      serverUrl: typeof input.url === 'string' ? input.url : undefined,
      details: {
        hook: 'beforeMCPExecution',
      },
    });

    return toCursorHookResponse(result);
  }

  if (host === 'claude' && event === 'pre-tool-bash') {
    const toolInput = readToolInput(input);
    const result = await gateway.evaluateShellCommand({
      host,
      source: `${host}.PreToolUse.Bash`,
      command:
        typeof toolInput.command === 'string'
          ? toolInput.command
          : String(input.command || ''),
      cwd: typeof input.cwd === 'string' ? input.cwd : null,
      details: {
        hook: 'PreToolUse',
        toolName: String(input.tool_name || input.toolName || 'Bash'),
      },
    });

    return toClaudeHookResponse(result);
  }

  if (host === 'codex' && event === 'pre-tool-bash') {
    const toolInput = readToolInput(input);
    const result = await gateway.evaluateShellCommand({
      host,
      source: `${host}.PreToolUse.Bash`,
      command:
        typeof toolInput.command === 'string'
          ? toolInput.command
          : String(input.command || ''),
      cwd: typeof input.cwd === 'string' ? input.cwd : null,
      details: {
        hook: 'PreToolUse',
        toolName: String(input.tool_name || input.toolName || 'Bash'),
        toolUseId:
          typeof input.tool_use_id === 'string' ? input.tool_use_id : null,
        turnId: typeof input.turn_id === 'string' ? input.turn_id : null,
        sessionId:
          typeof input.session_id === 'string' ? input.session_id : null,
      },
    });

    return toCodexHookResponse(result);
  }

  const result = await gateway.evaluateMcpToolCall({
    host: 'claude',
    source: 'claude.PreToolUse.MCP',
    toolName: String(input.tool_name || input.toolName || ''),
    toolInput: input.tool_input ?? input.toolInput,
    details: {
      hook: 'PreToolUse',
      toolName: String(input.tool_name || input.toolName || ''),
    },
  });

  return toClaudeHookResponse(result);
}

function readToolInput(input: Record<string, unknown>) {
  const toolInput =
    input.tool_input ?? input.toolInput ?? input.input ?? input.toolInputJson;

  return toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)
    ? (toolInput as Record<string, unknown>)
    : {};
}

async function main() {
  const response = await runHookGatewayCommand(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

const invokedAsEntrypoint =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedAsEntrypoint) {
  main().catch((error) => {
    const [host] = process.argv.slice(2) as [SupportedHost | undefined];
    const message =
      error instanceof Error ? error.message : 'Unknown hook failure.';
    const response =
      host === 'claude'
        ? toClaudeHookResponse({
            permission: 'deny',
            decision: 'misconfigured',
            userMessage: 'MandateOS hook execution failed.',
            agentMessage: message,
          })
        : host === 'codex'
          ? toCodexHookResponse({
              permission: 'deny',
              decision: 'misconfigured',
              userMessage: 'MandateOS hook execution failed.',
              agentMessage: message,
            })
        : toCursorHookResponse({
            permission: 'deny',
            decision: 'misconfigured',
            userMessage: 'MandateOS hook execution failed.',
            agentMessage: message,
          });
    process.stdout.write(`${JSON.stringify(response)}\n`);
    process.exit(1);
  });
}
