#!/usr/bin/env node

import path from 'node:path';

import { readMandateOsMcpConfig } from './config.js';
import { isInvokedAsEntrypoint } from './entrypoint.js';
import {
  installMandateOsIntoClaude,
  readMandateOsClaudeStatus,
} from './claude-setup.js';
import type { HostGatewayPermission } from './host-gateway.js';

type ClaudeInstallCommand = 'install' | 'status';

type ClaudeInstallCliOptions = {
  command: ClaudeInstallCommand;
  workspacePath: string;
  claudeConfigPath?: string;
  identifier?: string;
  installLocalMcp: boolean;
  installLocalHooks: boolean;
  updateGitInfoExclude: boolean;
  baseUrl?: string;
  bearerToken?: string;
  defaultMandateId?: string;
  sourcePrefix?: string;
  unmatchedPermission?: HostGatewayPermission;
  rulesFiles?: string[];
};

export async function runClaudeInstallCommand(argv: string[]) {
  const options = parseClaudeInstallArgs(argv);

  if (options.command === 'status') {
    const status = readMandateOsClaudeStatus({
      workspacePath: options.workspacePath,
      claudeConfigPath: options.claudeConfigPath,
      identifier: options.identifier,
    });
    process.stdout.write(formatClaudeStatus(status));
    return;
  }

  const env = {
    ...process.env,
  };

  if (options.baseUrl) {
    env.MANDATE_OS_BASE_URL = options.baseUrl;
  }

  if (options.bearerToken) {
    env.MANDATE_OS_AGENT_TOKEN = options.bearerToken;
  }

  if (options.defaultMandateId) {
    env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID = options.defaultMandateId;
  }

  const config = readMandateOsMcpConfig(env);
  const sourcePrefix =
    normalizeOptionalText(options.sourcePrefix) || 'claude.mandateos';
  const result = installMandateOsIntoClaude({
    workspacePath: options.workspacePath,
    claudeConfigPath: options.claudeConfigPath,
    identifier: options.identifier,
    baseUrl: config.baseUrl,
    bearerToken: config.bearerToken,
    defaultMandateId: options.defaultMandateId || config.defaultMandateId,
    localSource: `${sourcePrefix}.local`,
    hooksSource: `${sourcePrefix}.hooks`,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    rulesFiles: options.rulesFiles,
    installLocalMcp: options.installLocalMcp,
    installLocalHooks: options.installLocalHooks,
    updateGitInfoExclude: options.updateGitInfoExclude,
  });

  process.stdout.write(formatInstallResult(result));
}

function parseClaudeInstallArgs(argv: string[]): ClaudeInstallCliOptions {
  const args = [...argv];
  let command: ClaudeInstallCommand = 'install';

  if (args[0] === 'install' || args[0] === 'status') {
    command = args.shift() as ClaudeInstallCommand;
  }

  const options: ClaudeInstallCliOptions = {
    command,
    workspacePath: process.cwd(),
    installLocalMcp: true,
    installLocalHooks: true,
    updateGitInfoExclude: true,
  };

  while (args.length > 0) {
    const token = args.shift();

    if (!token) {
      break;
    }

    if (token === '--') {
      continue;
    }

    switch (token) {
      case '--workspace':
        options.workspacePath = readRequiredValue(args, token);
        break;
      case '--claude-config':
        options.claudeConfigPath = readRequiredValue(args, token);
        break;
      case '--identifier':
        options.identifier = readRequiredValue(args, token);
        break;
      case '--base-url':
        options.baseUrl = readRequiredValue(args, token);
        break;
      case '--token':
        options.bearerToken = readRequiredValue(args, token);
        break;
      case '--mandate-id':
        options.defaultMandateId = readRequiredValue(args, token);
        break;
      case '--source-prefix':
        options.sourcePrefix = readRequiredValue(args, token);
        break;
      case '--rules-files':
        options.rulesFiles = readRequiredValue(args, token)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => path.resolve(value));
        break;
      case '--unmatched-permission':
        options.unmatchedPermission = readHostGatewayPermission(
          readRequiredValue(args, token),
        );
        break;
      case '--no-local-mcp':
        options.installLocalMcp = false;
        break;
      case '--no-local-hooks':
        options.installLocalHooks = false;
        break;
      case '--no-git-exclude':
        options.updateGitInfoExclude = false;
        break;
      case '--help':
      case '-h':
        process.stdout.write(getClaudeInstallHelp());
        process.exit(0);
        return options;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function formatInstallResult(
  result: ReturnType<typeof installMandateOsIntoClaude>,
) {
  const lines = [
    'MandateOS Claude Code install complete.',
    `Workspace: ${result.workspacePath}`,
    `Claude config: ${result.claudeConfigPath}`,
    `Identifier: ${result.identifier}`,
    `Project key: ${result.projectKey}`,
    `Local MCP configured: ${result.localMcpConfigured ? 'yes' : 'no'}`,
    `Local hooks configured: ${result.localHooksConfigured ? 'yes' : 'no'}`,
  ];

  if (result.localSettingsPath) {
    lines.push(`Local settings: ${result.localSettingsPath}`);
  }

  if (result.gitInfoExcludePath) {
    lines.push(`Git exclude: ${result.gitInfoExcludePath}`);
  }

  lines.push('Rule bundles:');
  lines.push(...result.rulesFiles.map((value) => `- ${value}`));
  lines.push('Next:');
  lines.push(`- Open Claude Code in ${result.workspacePath}`);
  lines.push(
    '- Try: Use the mandateos_get_context tool and tell me which MandateOS tools are available here.',
  );

  return `${lines.join('\n')}\n`;
}

function formatClaudeStatus(
  status: ReturnType<typeof readMandateOsClaudeStatus>,
) {
  const lines = [
    'MandateOS Claude Code status',
    `Workspace: ${status.workspacePath}`,
    `Claude config: ${status.claudeConfigPath}`,
    `Identifier: ${status.identifier}`,
    'Project key candidates:',
    ...status.projectKeyCandidates.map((value) => `- ${value}`),
    `Local MCP configured: ${status.hasClaudeConfig && status.localServerConfigured ? 'yes' : 'no'}`,
    `Local settings file: ${status.localSettingsPath}`,
    `PreToolUse Bash hook configured: ${status.hasLocalSettings && status.preToolBashConfigured ? 'yes' : 'no'}`,
    `PreToolUse MCP hook configured: ${status.hasLocalSettings && status.preToolMcpConfigured ? 'yes' : 'no'}`,
  ];

  if (status.gitInfoExcludePath) {
    lines.push(`Git exclude file: ${status.gitInfoExcludePath}`);
    lines.push(
      `Git exclude configured: ${status.gitInfoExcludeConfigured ? 'yes' : 'no'}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function readRequiredValue(args: string[], flagName: string) {
  const value = args.shift();

  if (!value) {
    throw new Error(`${flagName} requires a value.`);
  }

  return value;
}

function readHostGatewayPermission(value: string): HostGatewayPermission {
  if (value === 'allow' || value === 'ask' || value === 'deny') {
    return value;
  }

  throw new Error(
    `Invalid --unmatched-permission value: ${value}. Expected allow, ask, or deny.`,
  );
}

function getClaudeInstallHelp() {
  return `Usage: claude-install.js [install|status] [options]

Options:
  --workspace <path>              Workspace to configure. Defaults to the current directory.
  --claude-config <path>          Claude local config file. Defaults to ~/.claude.json.
  --base-url <url>                MandateOS base URL. Falls back to MANDATE_OS_BASE_URL.
  --token <token>                 MandateOS operator or service token. Falls back to MANDATE_OS_AGENT_TOKEN.
  --mandate-id <id>               Default mandate id for the local MCP and hooks.
  --source-prefix <prefix>        Source prefix. Defaults to claude.mandateos.
  --rules-files <a,b,c>           Comma-separated host gateway rule bundle files.
  --unmatched-permission <mode>   Host gateway behavior for unmatched actions: allow, ask, or deny.
  --no-local-mcp                  Skip writing the local-scope Claude MCP server into ~/.claude.json.
  --no-local-hooks                Skip writing .claude/settings.local.json hooks.
  --no-git-exclude                Skip adding .claude/settings.local.json to .git/info/exclude.
`;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || '';
}

if (isInvokedAsEntrypoint(import.meta.url)) {
  runClaudeInstallCommand(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Claude installer failed.',
    );
    process.exit(1);
  });
}
