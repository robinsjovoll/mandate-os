import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

import type { HostGatewayPermission } from './host-gateway.js';
import {
  createMandateOsNodeRuntimeCommand,
  isMandateOsHookGatewayInvocation,
  toMandateOsRuntimeFileReference,
} from './runtime-command.js';

export type CodexMcpServerEntry = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  env_vars?: string[];
  cwd?: string;
  startup_timeout_sec?: number;
  tool_timeout_sec?: number;
  enabled?: boolean;
  required?: boolean;
  enabled_tools?: string[];
  disabled_tools?: string[];
  [key: string]: unknown;
};

export type CodexConfig = {
  features?: Record<string, unknown> & {
    codex_hooks?: boolean;
  };
  mcp_servers?: Record<string, CodexMcpServerEntry>;
  [key: string]: unknown;
};

export type CodexHookCommandEntry = {
  type: 'command';
  command: string;
  statusMessage?: string;
  timeout?: number;
  timeoutSec?: number;
};

export type CodexHookMatcherEntry = {
  matcher?: string;
  hooks: CodexHookCommandEntry[];
};

export type CodexHooksConfig = {
  hooks?: {
    PreToolUse?: unknown[];
    PostToolUse?: unknown[];
    SessionStart?: unknown[];
    UserPromptSubmit?: unknown[];
    Stop?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type MandateOsCodexInstallOptions = {
  workspacePath: string;
  codexConfigPath?: string;
  identifier?: string;
  defaultMandateId?: string;
  projectSource?: string;
  hooksSource?: string;
  unmatchedPermission?: HostGatewayPermission;
  rulesFiles?: string[];
  installProjectMcp?: boolean;
  installProjectHooks?: boolean;
  enableHooksFeature?: boolean;
  updateGitInfoExclude?: boolean;
};

export type MandateOsCodexInstallResult = {
  workspacePath: string;
  codexConfigPath: string;
  hooksPath: string;
  identifier: string;
  hooksFeatureEnabled: boolean;
  projectMcpConfigured: boolean;
  projectHooksConfigured: boolean;
  gitInfoExcludePath?: string;
  rulesFiles: string[];
  displayRulesFiles: string[];
};

export type MandateOsCodexStatus = {
  workspacePath: string;
  codexConfigPath: string;
  hooksPath: string;
  identifier: string;
  hasCodexConfig: boolean;
  hasHooksFile: boolean;
  hooksFeatureEnabled: boolean;
  projectServerConfigured: boolean;
  preToolBashConfigured: boolean;
  gitInfoExcludePath?: string;
  gitInfoExcludeConfigured: boolean;
};

const DEFAULT_IDENTIFIER = 'mandateos';
const DEFAULT_HOOKS_SOURCE = 'codex.mandateos.hooks';
const DEFAULT_PROJECT_SOURCE = 'codex.mandateos.project';
const CODEX_BASH_MATCHER = 'Bash';
const DEFAULT_HOOK_TIMEOUT_SECONDS = 8;

export function installMandateOsIntoCodex(
  options: MandateOsCodexInstallOptions,
): MandateOsCodexInstallResult {
  const normalized = normalizeInstallOptions(options);
  const currentConfig = readTomlFile<CodexConfig>(
    normalized.codexConfigPath,
    createEmptyCodexConfig,
  );
  let nextConfig = currentConfig;

  if (normalized.enableHooksFeature) {
    nextConfig = upsertCodexHooksFeature(nextConfig);
  }

  if (normalized.installProjectMcp) {
    nextConfig = upsertCodexMcpServer(
      nextConfig,
      normalized.identifier,
      buildMandateOsCodexMcpEntry({
        defaultMandateId: normalized.defaultMandateId,
        defaultSource: normalized.projectSource,
        entryScriptPath: normalized.entryScriptPath,
      }),
    );
  }

  if (normalized.enableHooksFeature || normalized.installProjectMcp) {
    writeTomlFile(normalized.codexConfigPath, nextConfig);
  }

  if (normalized.installProjectHooks) {
    const currentHooks = readJsonFile<CodexHooksConfig>(
      normalized.hooksPath,
      createEmptyCodexHooksConfig,
    );
    const nextHooks = upsertMandateOsCodexHooks(currentHooks, {
      defaultMandateId: normalized.defaultMandateId,
      defaultSource: normalized.hooksSource,
      unmatchedPermission: normalized.unmatchedPermission,
      rulesFiles: normalized.rulesFiles,
      hookGatewayPath: normalized.hookGatewayPath,
    });
    writeJsonFile(normalized.hooksPath, nextHooks);
  }

  if (normalized.updateGitInfoExclude && normalized.gitInfoExcludePath) {
    ensureGitInfoExcludeEntry(normalized.gitInfoExcludePath, '.codex/config.toml');
    ensureGitInfoExcludeEntry(normalized.gitInfoExcludePath, '.codex/hooks.json');
  }

  return {
    workspacePath: normalized.workspacePath,
    codexConfigPath: normalized.codexConfigPath,
    hooksPath: normalized.hooksPath,
    identifier: normalized.identifier,
    hooksFeatureEnabled: normalized.enableHooksFeature,
    projectMcpConfigured: normalized.installProjectMcp,
    projectHooksConfigured: normalized.installProjectHooks,
    gitInfoExcludePath: normalized.gitInfoExcludePath,
    rulesFiles: normalized.rulesFiles,
    displayRulesFiles: normalized.displayRulesFiles,
  };
}

export function readMandateOsCodexStatus(
  options: Pick<
    MandateOsCodexInstallOptions,
    'workspacePath' | 'codexConfigPath' | 'identifier'
  >,
): MandateOsCodexStatus {
  const normalized = normalizeInstallOptions({
    ...options,
    installProjectMcp: false,
    installProjectHooks: false,
    enableHooksFeature: false,
    updateGitInfoExclude: false,
  });
  const currentConfig = readTomlFile<CodexConfig>(
    normalized.codexConfigPath,
    createEmptyCodexConfig,
  );
  const currentHooks = readJsonFile<CodexHooksConfig>(
    normalized.hooksPath,
    createEmptyCodexHooksConfig,
  );

  return {
    workspacePath: normalized.workspacePath,
    codexConfigPath: normalized.codexConfigPath,
    hooksPath: normalized.hooksPath,
    identifier: normalized.identifier,
    hasCodexConfig: existsSync(normalized.codexConfigPath),
    hasHooksFile: existsSync(normalized.hooksPath),
    hooksFeatureEnabled: currentConfig.features?.codex_hooks === true,
    projectServerConfigured: Boolean(
      currentConfig.mcp_servers?.[normalized.identifier],
    ),
    preToolBashConfigured: hasMandateOsCodexHook(
      currentHooks,
      normalized.hookGatewayPath,
      'pre-tool-bash',
      CODEX_BASH_MATCHER,
    ),
    gitInfoExcludePath: normalized.gitInfoExcludePath,
    gitInfoExcludeConfigured: normalized.gitInfoExcludePath
      ? gitInfoExcludeContainsAll(normalized.gitInfoExcludePath, [
          '.codex/config.toml',
          '.codex/hooks.json',
        ])
      : false,
  };
}

export function buildMandateOsCodexMcpEntry(input: {
  defaultMandateId?: string;
  defaultSource: string;
  entryScriptPath?: string;
}): CodexMcpServerEntry {
  const entryScriptPath =
    input.entryScriptPath || resolvePackageAssetPath('index.js');
  const runtimeCommand = createMandateOsNodeRuntimeCommand({
    scriptPath: entryScriptPath,
    binaryName: 'mandate-os-mcp',
  });
  const env: Record<string, string> = {
    MANDATE_OS_MCP_DEFAULT_SOURCE: input.defaultSource,
  };
  const envVars = ['MANDATE_OS_BASE_URL', 'MANDATE_OS_AGENT_TOKEN'];

  if (input.defaultMandateId) {
    env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID = input.defaultMandateId;
  } else {
    envVars.push('MANDATE_OS_MCP_DEFAULT_MANDATE_ID');
  }

  return {
    command: runtimeCommand.command,
    args: runtimeCommand.args,
    env,
    env_vars: envVars,
  };
}

export function upsertCodexHooksFeature(current: CodexConfig): CodexConfig {
  return {
    ...current,
    features: {
      ...(current.features || {}),
      codex_hooks: true,
    },
  };
}

export function upsertCodexMcpServer(
  current: CodexConfig,
  identifier: string,
  server: CodexMcpServerEntry,
): CodexConfig {
  return {
    ...current,
    mcp_servers: {
      ...(current.mcp_servers || {}),
      [identifier]: server,
    },
  };
}

export function upsertMandateOsCodexHooks(
  current: CodexHooksConfig,
  input: {
    defaultMandateId?: string;
    defaultSource: string;
    unmatchedPermission: HostGatewayPermission;
    rulesFiles: string[];
    hookGatewayPath?: string;
  },
): CodexHooksConfig {
  const hookGatewayPath =
    input.hookGatewayPath || resolvePackageAssetPath('hook-gateway.js');
  const currentHooks = current.hooks || {};

  return {
    ...current,
    hooks: {
      ...currentHooks,
      PreToolUse: upsertMandateOsCodexHookMatcher(
        currentHooks.PreToolUse,
        buildMandateOsCodexHookMatcherEntry({
          matcher: CODEX_BASH_MATCHER,
          event: 'pre-tool-bash',
          hookGatewayPath,
          defaultMandateId: input.defaultMandateId,
          defaultSource: input.defaultSource,
          unmatchedPermission: input.unmatchedPermission,
          rulesFiles: input.rulesFiles,
        }),
        hookGatewayPath,
        'pre-tool-bash',
        CODEX_BASH_MATCHER,
      ),
    },
  };
}

export function resolveDefaultCodexRulesFiles() {
  return [
    resolvePackageAssetPath('rules/starter-bundles/local-workspace.json'),
    resolvePackageAssetPath('rules/starter-bundles/release-platform.json'),
    resolvePackageAssetPath('rules/starter-bundles/docs-content.json'),
    resolvePackageAssetPath('rules/starter-bundles/finance-support.json'),
  ];
}

function normalizeInstallOptions(options: MandateOsCodexInstallOptions) {
  const workspacePath = path.resolve(options.workspacePath || process.cwd());
  const codexConfigPath = path.resolve(
    options.codexConfigPath ||
      path.join(workspacePath, '.codex', 'config.toml'),
  );
  const hooksPath = path.join(path.dirname(codexConfigPath), 'hooks.json');
  const rulesFiles =
    options.rulesFiles?.filter(Boolean).map((value) => path.resolve(value)) ||
    resolveDefaultCodexRulesFiles();
  const displayRulesFiles = rulesFiles.map(toMandateOsRuntimeFileReference);
  const installProjectMcp = options.installProjectMcp !== false;
  const installProjectHooks = options.installProjectHooks !== false;
  const enableHooksFeature = options.enableHooksFeature !== false;
  const gitInfoExcludePath = resolveGitInfoExcludePath(workspacePath);
  const configAndHooksAreWorkspaceLocal =
    isWithinWorkspace(codexConfigPath, workspacePath) &&
    isWithinWorkspace(hooksPath, workspacePath);

  return {
    workspacePath,
    codexConfigPath,
    hooksPath,
    identifier: normalizeOptionalText(options.identifier) || DEFAULT_IDENTIFIER,
    defaultMandateId:
      normalizeOptionalText(options.defaultMandateId) || undefined,
    projectSource:
      normalizeOptionalText(options.projectSource) || DEFAULT_PROJECT_SOURCE,
    hooksSource:
      normalizeOptionalText(options.hooksSource) || DEFAULT_HOOKS_SOURCE,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    rulesFiles,
    displayRulesFiles,
    installProjectMcp,
    installProjectHooks,
    enableHooksFeature,
    updateGitInfoExclude:
      options.updateGitInfoExclude !== false && configAndHooksAreWorkspaceLocal,
    gitInfoExcludePath,
    entryScriptPath: resolvePackageAssetPath('index.js'),
    hookGatewayPath: resolvePackageAssetPath('hook-gateway.js'),
  };
}

function buildMandateOsCodexHookMatcherEntry(input: {
  matcher: string;
  event: 'pre-tool-bash';
  hookGatewayPath: string;
  defaultMandateId?: string;
  defaultSource: string;
  unmatchedPermission: HostGatewayPermission;
  rulesFiles: string[];
}): CodexHookMatcherEntry {
  const runtimeCommand = createMandateOsNodeRuntimeCommand({
    scriptPath: input.hookGatewayPath,
    binaryName: 'mandate-os-hook-gateway',
  });
  const envPairs: Array<[string, string]> = [
    ['MANDATE_OS_MCP_DEFAULT_SOURCE', input.defaultSource],
    ['MANDATE_OS_HOST_GATEWAY_UNMATCHED_PERMISSION', input.unmatchedPermission],
  ];

  if (input.defaultMandateId) {
    envPairs.push([
      'MANDATE_OS_MCP_DEFAULT_MANDATE_ID',
      input.defaultMandateId,
    ]);
  }

  if (input.rulesFiles.length > 0) {
    envPairs.push([
      'MANDATE_OS_HOST_GATEWAY_RULES_FILES',
      input.rulesFiles.map(toMandateOsRuntimeFileReference).join(','),
    ]);
  }

  return {
    matcher: input.matcher,
    hooks: [
      {
        type: 'command',
        command: [
          'env',
          ...envPairs.map(([key, value]) => `${key}=${shellQuote(value)}`),
          ...runtimeCommand.shellWords.map(shellQuote),
          'codex',
          input.event,
        ].join(' '),
        statusMessage: 'Checking Bash command',
        timeout: DEFAULT_HOOK_TIMEOUT_SECONDS,
      },
    ],
  };
}

function upsertMandateOsCodexHookMatcher(
  current: unknown,
  entry: CodexHookMatcherEntry,
  hookGatewayPath: string,
  event: 'pre-tool-bash',
  matcher: string,
) {
  const matcherEntries = Array.isArray(current) ? current : [];
  const nextEntries: unknown[] = [];
  let inserted = false;

  for (const value of matcherEntries) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      nextEntries.push(value);
      continue;
    }

    const currentMatcher = normalizeOptionalText(
      (value as { matcher?: string }).matcher,
    );
    const currentHooksValue = (value as { hooks?: unknown[] }).hooks;
    const currentHooks = Array.isArray(currentHooksValue)
      ? [...currentHooksValue]
      : [];

    const filteredHooks = currentHooks.filter((hookEntry) => {
      if (
        !hookEntry ||
        typeof hookEntry !== 'object' ||
        Array.isArray(hookEntry)
      ) {
        return true;
      }

      const command = normalizeOptionalText(
        (hookEntry as { command?: string }).command,
      );

      return !isMandateOsCodexHookCommand(command, hookGatewayPath, event);
    });

    if (currentMatcher === matcher) {
      if (!inserted) {
        nextEntries.push({
          ...value,
          matcher,
          hooks: [...entry.hooks, ...filteredHooks],
        });
        inserted = true;
      } else if (filteredHooks.length > 0) {
        nextEntries.push({
          ...value,
          hooks: filteredHooks,
        });
      }
      continue;
    }

    if (filteredHooks.length !== currentHooks.length) {
      nextEntries.push({
        ...value,
        hooks: filteredHooks,
      });
      continue;
    }

    nextEntries.push(value);
  }

  if (!inserted) {
    nextEntries.unshift(entry);
  }

  return nextEntries;
}

function hasMandateOsCodexHook(
  config: CodexHooksConfig,
  hookGatewayPath: string,
  event: 'pre-tool-bash',
  matcher: string,
) {
  const preToolUseEntries = config.hooks?.PreToolUse;

  if (!Array.isArray(preToolUseEntries)) {
    return false;
  }

  return preToolUseEntries.some((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    if (
      normalizeOptionalText((value as { matcher?: string }).matcher) !== matcher
    ) {
      return false;
    }

    const hooks = (value as { hooks?: unknown[] }).hooks;

    if (!Array.isArray(hooks)) {
      return false;
    }

    return hooks.some((hookEntry) => {
      if (
        !hookEntry ||
        typeof hookEntry !== 'object' ||
        Array.isArray(hookEntry)
      ) {
        return false;
      }

      const command = normalizeOptionalText(
        (hookEntry as { command?: string }).command,
      );

      return isMandateOsCodexHookCommand(command, hookGatewayPath, event);
    });
  });
}

function isMandateOsCodexHookCommand(
  command: string,
  hookGatewayPath: string,
  event: 'pre-tool-bash',
) {
  return (
    command.includes(`codex ${event}`) &&
    isMandateOsHookGatewayInvocation(command, hookGatewayPath)
  );
}

function createEmptyCodexConfig(): CodexConfig {
  return {};
}

function createEmptyCodexHooksConfig(): CodexHooksConfig {
  return {
    hooks: {},
  };
}

function readJsonFile<T>(filePath: string, fallback: () => T): T {
  if (!existsSync(filePath)) {
    return fallback();
  }

  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function writeJsonFile(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readTomlFile<T>(filePath: string, fallback: () => T): T {
  if (!existsSync(filePath)) {
    return fallback();
  }

  return parseToml(readFileSync(filePath, 'utf8')) as T;
}

function writeTomlFile(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const serialized = stringifyToml(value);
  writeFileSync(
    filePath,
    serialized.endsWith('\n') ? serialized : `${serialized}\n`,
    'utf8',
  );
}

function ensureGitInfoExcludeEntry(filePath: string, line: string) {
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const lines = existing
    .split(/\r?\n/g)
    .map((value) => value.trim())
    .filter(Boolean);

  if (lines.includes(line)) {
    return;
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  const nextContent =
    existing.length > 0 && !existing.endsWith('\n')
      ? `${existing}\n${line}\n`
      : `${existing}${line}\n`;
  writeFileSync(filePath, nextContent, 'utf8');
}

function gitInfoExcludeContainsAll(filePath: string, lines: string[]) {
  if (!existsSync(filePath)) {
    return false;
  }

  const existing = new Set(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/g)
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return lines.every((line) => existing.has(line));
}

function resolveGitInfoExcludePath(workspacePath: string) {
  const dotGitPath = path.join(workspacePath, '.git');

  if (!existsSync(dotGitPath)) {
    return undefined;
  }

  try {
    const stats = statSync(dotGitPath);

    if (stats.isDirectory()) {
      return path.join(dotGitPath, 'info', 'exclude');
    }
  } catch {
    // Ignore filesystem errors and fall back to alternate .git handling.
  }

  try {
    const gitPointer = readFileSync(dotGitPath, 'utf8');
    const match = gitPointer.match(/^gitdir:\s*(.+)\s*$/m);

    if (!match?.[1]) {
      return undefined;
    }

    const gitDir = path.resolve(workspacePath, match[1].trim());
    return path.join(gitDir, 'info', 'exclude');
  } catch {
    return undefined;
  }
}

function isWithinWorkspace(filePath: string, workspacePath: string) {
  const relativePath = path.relative(workspacePath, filePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function resolvePackageAssetPath(relativePath: string) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, relativePath),
    path.resolve(currentDir, '../', relativePath),
  ];

  return (
    candidatePaths.find((candidatePath) => existsSync(candidatePath)) ||
    candidatePaths[0]
  );
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
