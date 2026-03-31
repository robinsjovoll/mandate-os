import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HostGatewayPermission } from './host-gateway.js';

export type ClaudeMcpServerEntry = {
  type?: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

export type ClaudeProjectState = {
  allowedTools?: string[];
  mcpContextUris?: string[];
  mcpServers?: Record<string, ClaudeMcpServerEntry>;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  hasTrustDialogAccepted?: boolean;
  projectOnboardingSeenCount?: number;
  hasClaudeMdExternalIncludesApproved?: boolean;
  hasClaudeMdExternalIncludesWarningShown?: boolean;
  [key: string]: unknown;
};

export type ClaudeLocalConfig = {
  projects?: Record<string, ClaudeProjectState>;
  [key: string]: unknown;
};

export type ClaudeHookCommandEntry = {
  type: 'command';
  command: string;
};

export type ClaudeHookMatcherEntry = {
  matcher: string;
  hooks: ClaudeHookCommandEntry[];
};

export type ClaudeSettingsConfig = {
  hooks?: {
    PreToolUse?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type MandateOsClaudeInstallOptions = {
  workspacePath: string;
  claudeConfigPath?: string;
  identifier?: string;
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  localSource?: string;
  hooksSource?: string;
  unmatchedPermission?: HostGatewayPermission;
  rulesFiles?: string[];
  installLocalMcp?: boolean;
  installLocalHooks?: boolean;
  updateGitInfoExclude?: boolean;
};

export type MandateOsClaudeInstallResult = {
  workspacePath: string;
  claudeConfigPath: string;
  identifier: string;
  projectKey: string;
  localMcpConfigured: boolean;
  localHooksConfigured: boolean;
  localSettingsPath?: string;
  gitInfoExcludePath?: string;
  rulesFiles: string[];
};

export type MandateOsClaudeStatus = {
  workspacePath: string;
  claudeConfigPath: string;
  identifier: string;
  projectKeyCandidates: string[];
  localSettingsPath: string;
  gitInfoExcludePath?: string;
  hasClaudeConfig: boolean;
  hasLocalSettings: boolean;
  localServerConfigured: boolean;
  preToolBashConfigured: boolean;
  preToolMcpConfigured: boolean;
  gitInfoExcludeConfigured: boolean;
};

const DEFAULT_IDENTIFIER = 'mandateos';
const DEFAULT_HOOKS_SOURCE = 'claude.mandateos.hooks';
const DEFAULT_LOCAL_SOURCE = 'claude.mandateos.local';
const CLAUDE_BASH_MATCHER = 'Bash';
const CLAUDE_MCP_MATCHER = 'mcp__.*';

export function installMandateOsIntoClaude(
  options: MandateOsClaudeInstallOptions,
): MandateOsClaudeInstallResult {
  const normalized = normalizeInstallOptions(options);

  if (normalized.installLocalMcp) {
    const currentClaudeConfig = readJsonFile<ClaudeLocalConfig>(
      normalized.claudeConfigPath,
      createEmptyClaudeLocalConfig,
    );
    const nextClaudeConfig = upsertClaudeLocalMcpServer(
      currentClaudeConfig,
      normalized.projectKey,
      normalized.identifier,
      buildMandateOsClaudeMcpEntry({
        baseUrl: normalized.baseUrl,
        bearerToken: normalized.bearerToken,
        defaultMandateId: normalized.defaultMandateId,
        defaultSource: normalized.localSource,
      }),
    );
    writeJsonFile(normalized.claudeConfigPath, nextClaudeConfig);
  }

  if (normalized.installLocalHooks) {
    const currentSettings = readJsonFile<ClaudeSettingsConfig>(
      normalized.localSettingsPath,
      createEmptyClaudeSettingsConfig,
    );
    const nextSettings = upsertMandateOsClaudeHooks(currentSettings, {
      baseUrl: normalized.baseUrl,
      bearerToken: normalized.bearerToken,
      defaultMandateId: normalized.defaultMandateId,
      defaultSource: normalized.hooksSource,
      unmatchedPermission: normalized.unmatchedPermission,
      rulesFiles: normalized.rulesFiles,
      hookGatewayPath: normalized.hookGatewayPath,
    });
    writeJsonFile(normalized.localSettingsPath, nextSettings);
  }

  if (normalized.updateGitInfoExclude && normalized.gitInfoExcludePath) {
    ensureGitInfoExcludeEntry(
      normalized.gitInfoExcludePath,
      '.claude/settings.local.json',
    );
  }

  return {
    workspacePath: normalized.workspacePath,
    claudeConfigPath: normalized.claudeConfigPath,
    identifier: normalized.identifier,
    projectKey: normalized.projectKey,
    localMcpConfigured: normalized.installLocalMcp,
    localHooksConfigured: normalized.installLocalHooks,
    localSettingsPath: normalized.installLocalHooks
      ? normalized.localSettingsPath
      : undefined,
    gitInfoExcludePath: normalized.gitInfoExcludePath,
    rulesFiles: normalized.rulesFiles,
  };
}

export function readMandateOsClaudeStatus(
  options: Pick<
    MandateOsClaudeInstallOptions,
    'workspacePath' | 'claudeConfigPath' | 'identifier'
  >,
): MandateOsClaudeStatus {
  const normalized = normalizeInstallOptions({
    ...options,
    baseUrl: 'http://status-only.invalid',
    bearerToken: 'status-only',
    installLocalMcp: false,
    installLocalHooks: false,
    updateGitInfoExclude: false,
  });
  const claudeConfig = readJsonFile<ClaudeLocalConfig>(
    normalized.claudeConfigPath,
    createEmptyClaudeLocalConfig,
  );
  const localSettings = readJsonFile<ClaudeSettingsConfig>(
    normalized.localSettingsPath,
    createEmptyClaudeSettingsConfig,
  );

  return {
    workspacePath: normalized.workspacePath,
    claudeConfigPath: normalized.claudeConfigPath,
    identifier: normalized.identifier,
    projectKeyCandidates: normalized.projectKeyCandidates,
    localSettingsPath: normalized.localSettingsPath,
    gitInfoExcludePath: normalized.gitInfoExcludePath,
    hasClaudeConfig: existsSync(normalized.claudeConfigPath),
    hasLocalSettings: existsSync(normalized.localSettingsPath),
    localServerConfigured: normalized.projectKeyCandidates.some((projectKey) =>
      Boolean(
        claudeConfig.projects?.[projectKey]?.mcpServers?.[
          normalized.identifier
        ],
      ),
    ),
    preToolBashConfigured: hasMandateOsClaudeHook(
      localSettings,
      CLAUDE_BASH_MATCHER,
      normalized.hookGatewayPath,
      'pre-tool-bash',
    ),
    preToolMcpConfigured: hasMandateOsClaudeHook(
      localSettings,
      CLAUDE_MCP_MATCHER,
      normalized.hookGatewayPath,
      'pre-tool-mcp',
    ),
    gitInfoExcludeConfigured: normalized.gitInfoExcludePath
      ? gitInfoExcludeContains(
          normalized.gitInfoExcludePath,
          '.claude/settings.local.json',
        )
      : false,
  };
}

export function buildMandateOsClaudeMcpEntry(input: {
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource: string;
  entryScriptPath?: string;
}): ClaudeMcpServerEntry {
  const entryScriptPath =
    input.entryScriptPath || resolvePackageAssetPath('index.js');
  const env: Record<string, string> = {
    MANDATE_OS_BASE_URL: input.baseUrl,
    MANDATE_OS_AGENT_TOKEN: input.bearerToken,
    MANDATE_OS_MCP_DEFAULT_SOURCE: input.defaultSource,
  };

  if (input.defaultMandateId) {
    env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID = input.defaultMandateId;
  }

  return {
    type: 'stdio',
    command: 'node',
    args: [entryScriptPath],
    env,
  };
}

export function upsertClaudeLocalMcpServer(
  current: ClaudeLocalConfig,
  projectKey: string,
  identifier: string,
  server: ClaudeMcpServerEntry,
): ClaudeLocalConfig {
  const currentProject =
    current.projects?.[projectKey] || createEmptyClaudeProjectState();

  return {
    ...current,
    projects: {
      ...(current.projects || {}),
      [projectKey]: {
        ...currentProject,
        mcpServers: {
          ...(currentProject.mcpServers || {}),
          [identifier]: server,
        },
      },
    },
  };
}

export function upsertMandateOsClaudeHooks(
  current: ClaudeSettingsConfig,
  input: {
    baseUrl: string;
    bearerToken: string;
    defaultMandateId?: string;
    defaultSource: string;
    unmatchedPermission: HostGatewayPermission;
    rulesFiles: string[];
    hookGatewayPath?: string;
  },
): ClaudeSettingsConfig {
  const hookGatewayPath =
    input.hookGatewayPath || resolvePackageAssetPath('hook-gateway.js');
  const currentHooks = current.hooks || {};
  const nextPreToolUse = upsertMandateOsClaudeHookMatcher(
    currentHooks.PreToolUse,
    buildMandateOsClaudeHookMatcherEntry({
      matcher: CLAUDE_BASH_MATCHER,
      event: 'pre-tool-bash',
      hookGatewayPath,
      baseUrl: input.baseUrl,
      bearerToken: input.bearerToken,
      defaultMandateId: input.defaultMandateId,
      defaultSource: input.defaultSource,
      unmatchedPermission: input.unmatchedPermission,
      rulesFiles: input.rulesFiles,
    }),
    hookGatewayPath,
    'pre-tool-bash',
    CLAUDE_BASH_MATCHER,
  );

  return {
    ...current,
    hooks: {
      ...currentHooks,
      PreToolUse: upsertMandateOsClaudeHookMatcher(
        nextPreToolUse,
        buildMandateOsClaudeHookMatcherEntry({
          matcher: CLAUDE_MCP_MATCHER,
          event: 'pre-tool-mcp',
          hookGatewayPath,
          baseUrl: input.baseUrl,
          bearerToken: input.bearerToken,
          defaultMandateId: input.defaultMandateId,
          defaultSource: input.defaultSource,
          unmatchedPermission: input.unmatchedPermission,
          rulesFiles: input.rulesFiles,
        }),
        hookGatewayPath,
        'pre-tool-mcp',
        CLAUDE_MCP_MATCHER,
      ),
    },
  };
}

export function resolveDefaultClaudeRulesFiles() {
  return [
    resolvePackageAssetPath('rules/starter-bundles/release-platform.json'),
    resolvePackageAssetPath('rules/starter-bundles/docs-content.json'),
    resolvePackageAssetPath('rules/starter-bundles/finance-support.json'),
  ];
}

function normalizeInstallOptions(options: MandateOsClaudeInstallOptions) {
  const workspacePath = path.resolve(options.workspacePath || process.cwd());
  const projectKey = resolveClaudeProjectKey(workspacePath);
  const projectKeyCandidates = getClaudeProjectKeyCandidates(workspacePath);
  const claudeConfigPath = path.resolve(
    options.claudeConfigPath || path.join(os.homedir(), '.claude.json'),
  );
  const localSettingsPath = path.join(
    workspacePath,
    '.claude',
    'settings.local.json',
  );
  const rulesFiles =
    options.rulesFiles?.filter(Boolean).map((value) => path.resolve(value)) ||
    resolveDefaultClaudeRulesFiles();
  const installLocalMcp = options.installLocalMcp !== false;
  const installLocalHooks = options.installLocalHooks !== false;
  const gitInfoExcludePath = resolveGitInfoExcludePath(workspacePath);

  return {
    workspacePath,
    projectKey,
    projectKeyCandidates,
    claudeConfigPath,
    localSettingsPath,
    identifier: normalizeOptionalText(options.identifier) || DEFAULT_IDENTIFIER,
    baseUrl: options.baseUrl,
    bearerToken: options.bearerToken,
    defaultMandateId:
      normalizeOptionalText(options.defaultMandateId) || undefined,
    localSource:
      normalizeOptionalText(options.localSource) || DEFAULT_LOCAL_SOURCE,
    hooksSource:
      normalizeOptionalText(options.hooksSource) || DEFAULT_HOOKS_SOURCE,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    rulesFiles,
    installLocalMcp,
    installLocalHooks,
    updateGitInfoExclude: options.updateGitInfoExclude !== false,
    gitInfoExcludePath,
    hookGatewayPath: resolvePackageAssetPath('hook-gateway.js'),
  };
}

function buildMandateOsClaudeHookMatcherEntry(input: {
  matcher: string;
  event: 'pre-tool-bash' | 'pre-tool-mcp';
  hookGatewayPath: string;
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource: string;
  unmatchedPermission: HostGatewayPermission;
  rulesFiles: string[];
}): ClaudeHookMatcherEntry {
  const envPairs: Array<[string, string]> = [
    ['MANDATE_OS_BASE_URL', input.baseUrl],
    ['MANDATE_OS_AGENT_TOKEN', input.bearerToken],
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
      input.rulesFiles.join(','),
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
          'node',
          shellQuote(input.hookGatewayPath),
          'claude',
          input.event,
        ].join(' '),
      },
    ],
  };
}

function upsertMandateOsClaudeHookMatcher(
  current: unknown,
  entry: ClaudeHookMatcherEntry,
  hookGatewayPath: string,
  event: 'pre-tool-bash' | 'pre-tool-mcp',
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

      return !isMandateOsClaudeHookCommand(command, hookGatewayPath, event);
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

function hasMandateOsClaudeHook(
  config: ClaudeSettingsConfig,
  matcher: string,
  hookGatewayPath: string,
  event: 'pre-tool-bash' | 'pre-tool-mcp',
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

      return isMandateOsClaudeHookCommand(command, hookGatewayPath, event);
    });
  });
}

function isMandateOsClaudeHookCommand(
  command: string,
  hookGatewayPath: string,
  event: 'pre-tool-bash' | 'pre-tool-mcp',
) {
  return (
    command.includes(hookGatewayPath) && command.includes(`claude ${event}`)
  );
}

function createEmptyClaudeLocalConfig(): ClaudeLocalConfig {
  return {
    projects: {},
  };
}

function createEmptyClaudeProjectState(): ClaudeProjectState {
  return {
    allowedTools: [],
    mcpContextUris: [],
    mcpServers: {},
    enabledMcpjsonServers: [],
    disabledMcpjsonServers: [],
    hasTrustDialogAccepted: false,
    projectOnboardingSeenCount: 0,
    hasClaudeMdExternalIncludesApproved: false,
    hasClaudeMdExternalIncludesWarningShown: false,
  };
}

function createEmptyClaudeSettingsConfig(): ClaudeSettingsConfig {
  return {
    hooks: {},
  };
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

function gitInfoExcludeContains(filePath: string, line: string) {
  if (!existsSync(filePath)) {
    return false;
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/g)
    .map((value) => value.trim())
    .includes(line);
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

function getClaudeProjectKeyCandidates(workspacePath: string) {
  const candidates = new Set<string>();
  candidates.add(path.resolve(workspacePath));

  try {
    candidates.add(realpathSync(workspacePath));
  } catch {
    // Ignore realpath resolution errors and keep the resolved workspace path.
  }

  return [...candidates];
}

function resolveClaudeProjectKey(workspacePath: string) {
  try {
    return realpathSync(workspacePath);
  } catch {
    return path.resolve(workspacePath);
  }
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
