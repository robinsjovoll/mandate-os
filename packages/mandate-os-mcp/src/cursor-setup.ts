import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HostGatewayPermission } from './host-gateway.js';
import {
  createMandateOsNodeRuntimeCommand,
  isMandateOsHookGatewayInvocation,
  toMandateOsRuntimeFileReference,
} from './runtime-command.js';

export type CursorMcpServerEntry = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  headers?: Record<string, string>;
};

export type CursorMcpConfig = {
  mcpServers: Record<string, CursorMcpServerEntry>;
};

export type CursorHooksConfig = {
  version: number;
  hooks: Record<string, unknown[]>;
};

export type MandateOsCursorInstallOptions = {
  workspacePath: string;
  cursorHomeDir?: string;
  identifier?: string;
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  userSource?: string;
  projectSource?: string;
  hooksSource?: string;
  unmatchedPermission?: HostGatewayPermission;
  rulesFiles?: string[];
  installUserMcp?: boolean;
  installProjectMcp?: boolean;
  installProjectHooks?: boolean;
};

export type MandateOsCursorInstallResult = {
  workspacePath: string;
  cursorHomeDir: string;
  identifier: string;
  userMcpPath?: string;
  projectMcpPath?: string;
  projectHooksPath?: string;
  approvalPaths: string[];
  rulesFiles: string[];
};

export type MandateOsCursorStatus = {
  workspacePath: string;
  cursorHomeDir: string;
  identifier: string;
  userMcpPath: string;
  projectMcpPath: string;
  projectHooksPath: string;
  hasUserMcp: boolean;
  hasProjectMcp: boolean;
  hasProjectHooks: boolean;
  userServerConfigured: boolean;
  projectServerConfigured: boolean;
  beforeShellConfigured: boolean;
  beforeMcpConfigured: boolean;
  approvalPaths: Array<{
    path: string;
    exists: boolean;
    approved: boolean;
  }>;
};

const DEFAULT_IDENTIFIER = 'mandateos';
const DEFAULT_HOOK_TIMEOUT_SECONDS = 25;
const DEFAULT_HOOK_SOURCE = 'cursor.mandateos.hooks';
const DEFAULT_PROJECT_SOURCE = 'cursor.mandateos.project';
const DEFAULT_USER_SOURCE = 'cursor.mandateos.user';

export function installMandateOsIntoCursor(
  options: MandateOsCursorInstallOptions,
): MandateOsCursorInstallResult {
  const normalized = normalizeInstallOptions(options);

  if (normalized.installUserMcp) {
    const currentUserConfig = readJsonFile<CursorMcpConfig>(
      normalized.userMcpPath,
      createEmptyCursorMcpConfig,
    );
    const nextUserConfig = upsertCursorMcpServer(
      currentUserConfig,
      normalized.identifier,
      buildMandateOsMcpEntry({
        baseUrl: normalized.baseUrl,
        bearerToken: normalized.bearerToken,
        defaultSource: normalized.userSource,
      }),
    );
    writeJsonFile(normalized.userMcpPath, nextUserConfig);
  }

  if (normalized.installProjectMcp) {
    const currentProjectConfig = readJsonFile<CursorMcpConfig>(
      normalized.projectMcpPath,
      createEmptyCursorMcpConfig,
    );
    const nextProjectConfig = upsertCursorMcpServer(
      currentProjectConfig,
      normalized.identifier,
      buildMandateOsMcpEntry({
        baseUrl: normalized.baseUrl,
        bearerToken: normalized.bearerToken,
        defaultMandateId: normalized.defaultMandateId,
        defaultSource: normalized.projectSource,
      }),
    );
    writeJsonFile(normalized.projectMcpPath, nextProjectConfig);
  }

  if (normalized.installProjectHooks) {
    const currentHooksConfig = readJsonFile<CursorHooksConfig>(
      normalized.projectHooksPath,
      createEmptyCursorHooksConfig,
    );
    const nextHooksConfig = upsertMandateOsHooks(currentHooksConfig, {
      baseUrl: normalized.baseUrl,
      bearerToken: normalized.bearerToken,
      defaultMandateId: normalized.defaultMandateId,
      defaultSource: normalized.hooksSource,
      unmatchedPermission: normalized.unmatchedPermission,
      rulesFiles: normalized.rulesFiles,
      hookGatewayPath: normalized.hookGatewayPath,
    });
    writeJsonFile(normalized.projectHooksPath, nextHooksConfig);
  }

  return {
    workspacePath: normalized.workspacePath,
    cursorHomeDir: normalized.cursorHomeDir,
    identifier: normalized.identifier,
    userMcpPath: normalized.installUserMcp ? normalized.userMcpPath : undefined,
    projectMcpPath: normalized.installProjectMcp
      ? normalized.projectMcpPath
      : undefined,
    projectHooksPath: normalized.installProjectHooks
      ? normalized.projectHooksPath
      : undefined,
    approvalPaths: normalized.approvalPaths,
    rulesFiles: normalized.rulesFiles,
  };
}

export function readMandateOsCursorStatus(
  options: Pick<
    MandateOsCursorInstallOptions,
    'workspacePath' | 'cursorHomeDir' | 'identifier'
  >,
): MandateOsCursorStatus {
  const normalized = normalizeInstallOptions({
    ...options,
    baseUrl: 'http://status-only.invalid',
    bearerToken: 'status-only',
    installUserMcp: false,
    installProjectMcp: false,
    installProjectHooks: false,
  });

  const userConfig = readJsonFile<CursorMcpConfig>(
    normalized.userMcpPath,
    createEmptyCursorMcpConfig,
  );
  const projectConfig = readJsonFile<CursorMcpConfig>(
    normalized.projectMcpPath,
    createEmptyCursorMcpConfig,
  );
  const hooksConfig = readJsonFile<CursorHooksConfig>(
    normalized.projectHooksPath,
    createEmptyCursorHooksConfig,
  );

  return {
    workspacePath: normalized.workspacePath,
    cursorHomeDir: normalized.cursorHomeDir,
    identifier: normalized.identifier,
    userMcpPath: normalized.userMcpPath,
    projectMcpPath: normalized.projectMcpPath,
    projectHooksPath: normalized.projectHooksPath,
    hasUserMcp: existsSync(normalized.userMcpPath),
    hasProjectMcp: existsSync(normalized.projectMcpPath),
    hasProjectHooks: existsSync(normalized.projectHooksPath),
    userServerConfigured: Boolean(userConfig.mcpServers[normalized.identifier]),
    projectServerConfigured: Boolean(
      projectConfig.mcpServers[normalized.identifier],
    ),
    beforeShellConfigured: hasMandateOsHook(
      hooksConfig,
      'beforeShellExecution',
      normalized.hookGatewayPath,
      'before-shell',
    ),
    beforeMcpConfigured: hasMandateOsHook(
      hooksConfig,
      'beforeMCPExecution',
      normalized.hookGatewayPath,
      'before-mcp',
    ),
    approvalPaths: normalized.approvalPaths.map((approvalPath) => {
      const approvals = readJsonFile<string[]>(approvalPath, () => []);
      return {
        path: approvalPath,
        exists: existsSync(approvalPath),
        approved: approvals.some((value) =>
          value.startsWith(`${normalized.identifier}-`),
        ),
      };
    }),
  };
}

export function buildMandateOsMcpEntry(input: {
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource: string;
  entryScriptPath?: string;
}): CursorMcpServerEntry {
  const entryScriptPath =
    input.entryScriptPath || resolvePackageAssetPath('index.js');
  const runtimeCommand = createMandateOsNodeRuntimeCommand({
    scriptPath: entryScriptPath,
    binaryName: 'mandate-os-mcp',
  });
  const env: Record<string, string> = {
    MANDATE_OS_BASE_URL: input.baseUrl,
    MANDATE_OS_AGENT_TOKEN: input.bearerToken,
    MANDATE_OS_MCP_DEFAULT_SOURCE: input.defaultSource,
  };

  if (input.defaultMandateId) {
    env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID = input.defaultMandateId;
  }

  return {
    command: runtimeCommand.command,
    args: runtimeCommand.args,
    env,
  };
}

export function upsertCursorMcpServer(
  current: CursorMcpConfig,
  identifier: string,
  server: CursorMcpServerEntry,
): CursorMcpConfig {
  return {
    ...current,
    mcpServers: {
      ...(current.mcpServers || {}),
      [identifier]: server,
    },
  };
}

export function upsertMandateOsHooks(
  current: CursorHooksConfig,
  input: {
    baseUrl: string;
    bearerToken: string;
    defaultMandateId?: string;
    defaultSource: string;
    unmatchedPermission: HostGatewayPermission;
    rulesFiles: string[];
    hookGatewayPath?: string;
  },
): CursorHooksConfig {
  const hookGatewayPath =
    input.hookGatewayPath || resolvePackageAssetPath('hook-gateway.js');
  const nextHooks = {
    ...(current.hooks || {}),
  };

  nextHooks.beforeShellExecution = upsertMandateOsHookStep(
    nextHooks.beforeShellExecution,
    buildMandateOsHookEntry({
      hookGatewayPath,
      event: 'before-shell',
      baseUrl: input.baseUrl,
      bearerToken: input.bearerToken,
      defaultMandateId: input.defaultMandateId,
      defaultSource: input.defaultSource,
      unmatchedPermission: input.unmatchedPermission,
      rulesFiles: input.rulesFiles,
    }),
    hookGatewayPath,
    'before-shell',
  );

  nextHooks.beforeMCPExecution = upsertMandateOsHookStep(
    nextHooks.beforeMCPExecution,
    buildMandateOsHookEntry({
      hookGatewayPath,
      event: 'before-mcp',
      baseUrl: input.baseUrl,
      bearerToken: input.bearerToken,
      defaultMandateId: input.defaultMandateId,
      defaultSource: input.defaultSource,
      unmatchedPermission: input.unmatchedPermission,
      rulesFiles: input.rulesFiles,
    }),
    hookGatewayPath,
    'before-mcp',
  );

  return {
    version: current.version || 1,
    hooks: nextHooks,
  };
}

export function resolveDefaultCursorRulesFiles() {
  return [
    resolvePackageAssetPath('rules/starter-bundles/local-workspace.json'),
    resolvePackageAssetPath('rules/starter-bundles/release-platform.json'),
    resolvePackageAssetPath('rules/starter-bundles/docs-content.json'),
    resolvePackageAssetPath('rules/starter-bundles/finance-support.json'),
  ];
}

export function getCursorProjectApprovalPaths(
  workspacePath: string,
  cursorHomeDir = path.join(os.homedir(), '.cursor'),
) {
  const candidates = new Set<string>();
  candidates.add(path.resolve(workspacePath));

  try {
    candidates.add(realpathSync(workspacePath));
  } catch {
    // Ignore realpath resolution errors and keep the resolved workspace path.
  }

  return [...candidates].map((candidate) =>
    path.join(
      cursorHomeDir,
      'projects',
      toCursorProjectId(candidate),
      'mcp-approvals.json',
    ),
  );
}

function normalizeInstallOptions(options: MandateOsCursorInstallOptions) {
  const workspacePath = path.resolve(options.workspacePath || process.cwd());
  const cursorHomeDir = path.resolve(
    options.cursorHomeDir || path.join(os.homedir(), '.cursor'),
  );
  const identifier =
    normalizeOptionalText(options.identifier) || DEFAULT_IDENTIFIER;
  const cursorProjectDir = path.join(workspacePath, '.cursor');
  const rulesFiles =
    options.rulesFiles?.filter(Boolean).map((value) => path.resolve(value)) ||
    resolveDefaultCursorRulesFiles();
  const installUserMcp = options.installUserMcp !== false;
  const installProjectMcp = options.installProjectMcp !== false;
  const installProjectHooks = options.installProjectHooks !== false;

  return {
    workspacePath,
    cursorHomeDir,
    identifier,
    baseUrl: options.baseUrl,
    bearerToken: options.bearerToken,
    defaultMandateId:
      normalizeOptionalText(options.defaultMandateId) || undefined,
    userSource:
      normalizeOptionalText(options.userSource) || DEFAULT_USER_SOURCE,
    projectSource:
      normalizeOptionalText(options.projectSource) || DEFAULT_PROJECT_SOURCE,
    hooksSource:
      normalizeOptionalText(options.hooksSource) || DEFAULT_HOOK_SOURCE,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    rulesFiles,
    installUserMcp,
    installProjectMcp,
    installProjectHooks,
    userMcpPath: path.join(cursorHomeDir, 'mcp.json'),
    projectMcpPath: path.join(cursorProjectDir, 'mcp.json'),
    projectHooksPath: path.join(cursorProjectDir, 'hooks.json'),
    hookGatewayPath: resolvePackageAssetPath('hook-gateway.js'),
    approvalPaths: getCursorProjectApprovalPaths(workspacePath, cursorHomeDir),
  };
}

function buildMandateOsHookEntry(input: {
  hookGatewayPath: string;
  event: 'before-shell' | 'before-mcp';
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource: string;
  unmatchedPermission: HostGatewayPermission;
  rulesFiles: string[];
}) {
  const runtimeCommand = createMandateOsNodeRuntimeCommand({
    scriptPath: input.hookGatewayPath,
    binaryName: 'mandate-os-hook-gateway',
  });
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
      input.rulesFiles.map(toMandateOsRuntimeFileReference).join(','),
    ]);
  }

  const command = [
    'env',
    ...envPairs.map(([key, value]) => `${key}=${shellQuote(value)}`),
    ...runtimeCommand.shellWords.map(shellQuote),
    'cursor',
    input.event,
  ].join(' ');

  return {
    command,
    timeout: DEFAULT_HOOK_TIMEOUT_SECONDS,
    failClosed: true,
  };
}

function upsertMandateOsHookStep(
  currentStep: unknown,
  entry: Record<string, unknown>,
  hookGatewayPath: string,
  event: 'before-shell' | 'before-mcp',
) {
  const existingEntries = Array.isArray(currentStep) ? currentStep : [];
  const filteredEntries = existingEntries.filter((value) => {
    if (!value || typeof value !== 'object') {
      return true;
    }

    const command = normalizeOptionalText(
      (value as { command?: string }).command,
    );

    if (!command) {
      return true;
    }

    return !isMandateOsHookCommand(command, hookGatewayPath, event);
  });

  return [entry, ...filteredEntries];
}

function hasMandateOsHook(
  config: CursorHooksConfig,
  stepName: string,
  hookGatewayPath: string,
  event: 'before-shell' | 'before-mcp',
) {
  const stepEntries = config.hooks?.[stepName];

  if (!Array.isArray(stepEntries)) {
    return false;
  }

  return stepEntries.some((value) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const command = normalizeOptionalText(
      (value as { command?: string }).command,
    );

    return isMandateOsHookCommand(command, hookGatewayPath, event);
  });
}

function isMandateOsHookCommand(
  command: string,
  hookGatewayPath: string,
  event: 'before-shell' | 'before-mcp',
) {
  return (
    command.includes(`cursor ${event}`) &&
    isMandateOsHookGatewayInvocation(command, hookGatewayPath)
  );
}

function createEmptyCursorMcpConfig(): CursorMcpConfig {
  return {
    mcpServers: {},
  };
}

function createEmptyCursorHooksConfig(): CursorHooksConfig {
  return {
    version: 1,
    hooks: {},
  };
}

function readJsonFile<T>(filePath: string, fallback: () => T): T {
  if (!existsSync(filePath)) {
    return fallback();
  }

  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as T;
  return parsed;
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

  const resolvedPath =
    candidatePaths.find((candidatePath) => existsSync(candidatePath)) ||
    candidatePaths[0];

  return resolvedPath;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || '';
}

function toCursorProjectId(workspacePath: string) {
  return workspacePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-');
}
