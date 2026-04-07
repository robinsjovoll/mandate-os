#!/usr/bin/env node

import path from 'node:path';

import {
  installMandateOsIntoCodex,
  readMandateOsCodexStatus,
} from './codex-setup.js';
import type { HostGatewayPermission } from './host-gateway.js';

type CodexInstallCommand = 'install' | 'status';

type CodexInstallCliOptions = {
  command: CodexInstallCommand;
  workspacePath: string;
  codexConfigPath?: string;
  identifier?: string;
  defaultMandateId?: string;
  sourcePrefix?: string;
  unmatchedPermission?: HostGatewayPermission;
  rulesFiles?: string[];
  installProjectMcp: boolean;
  installProjectHooks: boolean;
  enableHooksFeature: boolean;
  updateGitInfoExclude: boolean;
};

export async function runCodexInstallCommand(argv: string[]) {
  const options = parseCodexInstallArgs(argv);

  if (options.command === 'status') {
    const status = readMandateOsCodexStatus({
      workspacePath: options.workspacePath,
      codexConfigPath: options.codexConfigPath,
      identifier: options.identifier,
    });
    process.stdout.write(formatCodexStatus(status));
    return;
  }

  const sourcePrefix =
    normalizeOptionalText(options.sourcePrefix) || 'codex.mandateos';
  const result = installMandateOsIntoCodex({
    workspacePath: options.workspacePath,
    codexConfigPath: options.codexConfigPath,
    identifier: options.identifier,
    defaultMandateId: options.defaultMandateId,
    projectSource: `${sourcePrefix}.project`,
    hooksSource: `${sourcePrefix}.hooks`,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    rulesFiles: options.rulesFiles,
    installProjectMcp: options.installProjectMcp,
    installProjectHooks: options.installProjectHooks,
    enableHooksFeature: options.enableHooksFeature,
    updateGitInfoExclude: options.updateGitInfoExclude,
  });

  process.stdout.write(formatInstallResult(result));
}

function parseCodexInstallArgs(argv: string[]): CodexInstallCliOptions {
  const args = [...argv];
  let command: CodexInstallCommand = 'install';

  if (args[0] === 'install' || args[0] === 'status') {
    command = args.shift() as CodexInstallCommand;
  }

  const options: CodexInstallCliOptions = {
    command,
    workspacePath: process.cwd(),
    installProjectMcp: true,
    installProjectHooks: true,
    enableHooksFeature: true,
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
      case '--codex-config':
        options.codexConfigPath = readRequiredValue(args, token);
        break;
      case '--identifier':
        options.identifier = readRequiredValue(args, token);
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
      case '--no-project-mcp':
        options.installProjectMcp = false;
        break;
      case '--no-project-hooks':
        options.installProjectHooks = false;
        break;
      case '--no-hooks-feature':
        options.enableHooksFeature = false;
        break;
      case '--no-git-exclude':
        options.updateGitInfoExclude = false;
        break;
      case '--help':
      case '-h':
        process.stdout.write(getCodexInstallHelp());
        process.exit(0);
        return options;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function formatInstallResult(
  result: ReturnType<typeof installMandateOsIntoCodex>,
) {
  const lines = [
    'MandateOS Codex install complete.',
    `Workspace: ${result.workspacePath}`,
    `Codex config: ${result.codexConfigPath}`,
    `Hooks file: ${result.hooksPath}`,
    `Identifier: ${result.identifier}`,
    `Hooks feature enabled: ${result.hooksFeatureEnabled ? 'yes' : 'no'}`,
    `Project MCP configured: ${result.projectMcpConfigured ? 'yes' : 'no'}`,
    `Project hooks configured: ${result.projectHooksConfigured ? 'yes' : 'no'}`,
  ];

  if (result.gitInfoExcludePath) {
    lines.push(`Git exclude: ${result.gitInfoExcludePath}`);
  }

  lines.push('Rule bundles:');
  lines.push(...result.rulesFiles.map((value) => `- ${value}`));
  lines.push('Runtime environment Codex must inherit:');
  lines.push('- MANDATE_OS_BASE_URL');
  lines.push('- MANDATE_OS_AGENT_TOKEN');
  lines.push('- Optional: MANDATE_OS_MCP_DEFAULT_MANDATE_ID');
  lines.push('Next:');
  lines.push(`- Launch Codex from ${result.workspacePath}`);
  lines.push(
    '- Keep MANDATE_OS_BASE_URL and MANDATE_OS_AGENT_TOKEN in the shell or environment that starts Codex.',
  );
  lines.push(
    '- Try a Bash command in Codex and confirm MandateOS blocks or redirects sensitive work.',
  );
  lines.push(
    '- Note: current Codex hooks only expose Bash PreToolUse, so non-Bash tool interception is not available yet.',
  );

  return `${lines.join('\n')}\n`;
}

function formatCodexStatus(
  status: ReturnType<typeof readMandateOsCodexStatus>,
) {
  const lines = [
    'MandateOS Codex status',
    `Workspace: ${status.workspacePath}`,
    `Codex config: ${status.codexConfigPath}`,
    `Hooks file: ${status.hooksPath}`,
    `Identifier: ${status.identifier}`,
    `Codex config present: ${status.hasCodexConfig ? 'yes' : 'no'}`,
    `Hooks file present: ${status.hasHooksFile ? 'yes' : 'no'}`,
    `Hooks feature enabled: ${status.hasCodexConfig && status.hooksFeatureEnabled ? 'yes' : 'no'}`,
    `Project MCP configured: ${status.hasCodexConfig && status.projectServerConfigured ? 'yes' : 'no'}`,
    `PreToolUse Bash hook configured: ${status.hasHooksFile && status.preToolBashConfigured ? 'yes' : 'no'}`,
  ];

  if (status.gitInfoExcludePath) {
    lines.push(`Git exclude file: ${status.gitInfoExcludePath}`);
    lines.push(
      `Git exclude configured: ${status.gitInfoExcludeConfigured ? 'yes' : 'no'}`,
    );
  }

  lines.push(
    'Runtime reminder: Codex must inherit MANDATE_OS_BASE_URL and MANDATE_OS_AGENT_TOKEN.',
  );
  lines.push(
    'Current Codex trust boundary: Bash PreToolUse. Codex does not yet expose generic MCP-side hook interception.',
  );

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

function getCodexInstallHelp() {
  return `Usage: codex-install.js [install|status] [options]

Options:
  --workspace <path>              Workspace to configure. Defaults to the current directory.
  --codex-config <path>           Codex config.toml path. Defaults to <workspace>/.codex/config.toml.
  --identifier <id>               MCP server identifier. Defaults to mandateos.
  --mandate-id <id>               Optional default mandate id to write into config and hooks.
  --source-prefix <prefix>        Source prefix. Defaults to codex.mandateos.
  --rules-files <a,b,c>           Comma-separated host gateway rule bundle files.
  --unmatched-permission <mode>   Host gateway behavior for unmatched shell actions: allow, ask, or deny.
  --no-project-mcp                Skip writing the project-scoped MCP server entry.
  --no-project-hooks              Skip writing the project-scoped hooks.json file.
  --no-hooks-feature              Skip enabling [features].codex_hooks in config.toml.
  --no-git-exclude                Skip adding .codex/config.toml and .codex/hooks.json to .git/info/exclude.
`;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

const invokedAsEntrypoint =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedAsEntrypoint) {
  runCodexInstallCommand(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Codex installer failed.',
    );
    process.exit(1);
  });
}
