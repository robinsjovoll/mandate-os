#!/usr/bin/env node

import path from 'node:path';

import { readMandateOsMcpConfig } from './config.js';
import { isInvokedAsEntrypoint } from './entrypoint.js';
import {
  installMandateOsIntoCursor,
  readMandateOsCursorStatus,
} from './cursor-setup.js';
import type { HostGatewayPermission } from './host-gateway.js';

type CursorInstallCommand = 'install' | 'status';

type CursorInstallCliOptions = {
  command: CursorInstallCommand;
  workspacePath: string;
  cursorHomeDir?: string;
  identifier?: string;
  installUserMcp: boolean;
  installProjectMcp: boolean;
  installProjectHooks: boolean;
  baseUrl?: string;
  bearerToken?: string;
  defaultMandateId?: string;
  sourcePrefix?: string;
  unmatchedPermission?: HostGatewayPermission;
  rulesFiles?: string[];
};

export async function runCursorInstallCommand(argv: string[]) {
  const options = parseCursorInstallArgs(argv);

  if (options.command === 'status') {
    const status = readMandateOsCursorStatus({
      workspacePath: options.workspacePath,
      cursorHomeDir: options.cursorHomeDir,
      identifier: options.identifier,
    });
    process.stdout.write(formatCursorStatus(status));
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
    normalizeOptionalText(options.sourcePrefix) || 'cursor.mandateos';

  const result = installMandateOsIntoCursor({
    workspacePath: options.workspacePath,
    cursorHomeDir: options.cursorHomeDir,
    identifier: options.identifier,
    baseUrl: config.baseUrl,
    bearerToken: config.bearerToken,
    defaultMandateId: options.defaultMandateId || config.defaultMandateId,
    userSource: `${sourcePrefix}.user`,
    projectSource: `${sourcePrefix}.project`,
    hooksSource: `${sourcePrefix}.hooks`,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    rulesFiles: options.rulesFiles,
    installUserMcp: options.installUserMcp,
    installProjectMcp: options.installProjectMcp,
    installProjectHooks: options.installProjectHooks,
  });

  process.stdout.write(formatInstallResult(result));
}

function parseCursorInstallArgs(argv: string[]): CursorInstallCliOptions {
  const args = [...argv];
  let command: CursorInstallCommand = 'install';

  if (args[0] === 'install' || args[0] === 'status') {
    command = args.shift() as CursorInstallCommand;
  }

  const options: CursorInstallCliOptions = {
    command,
    workspacePath: process.cwd(),
    installUserMcp: true,
    installProjectMcp: true,
    installProjectHooks: true,
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
      case '--cursor-home':
        options.cursorHomeDir = readRequiredValue(args, token);
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
      case '--no-user-mcp':
        options.installUserMcp = false;
        break;
      case '--no-project-mcp':
        options.installProjectMcp = false;
        break;
      case '--no-project-hooks':
        options.installProjectHooks = false;
        break;
      case '--help':
      case '-h':
        process.stdout.write(getCursorInstallHelp());
        process.exit(0);
        return options;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function formatInstallResult(
  result: ReturnType<typeof installMandateOsIntoCursor>,
) {
  const lines = [
    'MandateOS Cursor install complete.',
    `Workspace: ${result.workspacePath}`,
    `Cursor home: ${result.cursorHomeDir}`,
    `Identifier: ${result.identifier}`,
  ];

  if (result.userMcpPath) {
    lines.push(`User MCP: ${result.userMcpPath}`);
  }

  if (result.projectMcpPath) {
    lines.push(`Project MCP: ${result.projectMcpPath}`);
  }

  if (result.projectHooksPath) {
    lines.push(`Project hooks: ${result.projectHooksPath}`);
  }

  lines.push('Rule bundles:');
  lines.push(...result.rulesFiles.map((value) => `- ${value}`));
  lines.push('Approval files to watch:');
  lines.push(...result.approvalPaths.map((value) => `- ${value}`));
  lines.push('Next:');
  lines.push(`- Open Cursor on ${result.workspacePath}`);
  lines.push('- Approve the `mandateos` MCP if Cursor asks');
  lines.push(
    '- Try: Use the mandateos_get_context tool and tell me which MandateOS tools are available here.',
  );

  return `${lines.join('\n')}\n`;
}

function formatCursorStatus(
  status: ReturnType<typeof readMandateOsCursorStatus>,
) {
  const lines = [
    'MandateOS Cursor status',
    `Workspace: ${status.workspacePath}`,
    `Cursor home: ${status.cursorHomeDir}`,
    `Identifier: ${status.identifier}`,
    `User MCP file: ${status.userMcpPath}`,
    `User MCP configured: ${status.hasUserMcp && status.userServerConfigured ? 'yes' : 'no'}`,
    `Project MCP file: ${status.projectMcpPath}`,
    `Project MCP configured: ${status.hasProjectMcp && status.projectServerConfigured ? 'yes' : 'no'}`,
    `Project hooks file: ${status.projectHooksPath}`,
    `beforeShellExecution hook configured: ${status.hasProjectHooks && status.beforeShellConfigured ? 'yes' : 'no'}`,
    `beforeMCPExecution hook configured: ${status.hasProjectHooks && status.beforeMcpConfigured ? 'yes' : 'no'}`,
    'Approval files:',
    ...status.approvalPaths.map((value) => {
      const marker =
        value.exists && value.approved
          ? 'approved'
          : value.exists
            ? 'present'
            : 'missing';
      return `- ${value.path}: ${marker}`;
    }),
  ];

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

function getCursorInstallHelp() {
  return `Usage: cursor-install.js [install|status] [options]

Options:
  --workspace <path>              Workspace to configure. Defaults to the current directory.
  --cursor-home <path>            Cursor home directory. Defaults to ~/.cursor.
  --base-url <url>                MandateOS base URL. Falls back to MANDATE_OS_BASE_URL.
  --token <token>                 MandateOS operator or service token. Falls back to MANDATE_OS_AGENT_TOKEN.
  --mandate-id <id>               Default mandate id for the project MCP and hooks.
  --source-prefix <prefix>        Source prefix. Defaults to cursor.mandateos.
  --rules-files <a,b,c>           Comma-separated rule bundle files for the hook gateway.
  --unmatched-permission <value>  Hook fallback for unmatched commands: allow, ask, or deny.
  --no-user-mcp                   Skip updating ~/.cursor/mcp.json.
  --no-project-mcp                Skip updating <workspace>/.cursor/mcp.json.
  --no-project-hooks              Skip updating <workspace>/.cursor/hooks.json.
  -h, --help                      Show this help.
`;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || '';
}

async function main() {
  await runCursorInstallCommand(process.argv.slice(2));
}

if (isInvokedAsEntrypoint(import.meta.url)) {
  main().catch((error) => {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown Cursor install failure.';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
