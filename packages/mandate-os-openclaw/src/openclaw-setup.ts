import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import type { PolicyGatewayPermission } from '@mandate-os/sdk';

export type OpenClawSandboxMode = 'all' | 'off';

export type OpenClawMcpServerEntry = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

export type OpenClawPluginEntry = {
  enabled?: boolean;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
  hooks?: Record<string, unknown>;
};

export type MandateOsOpenClawPluginRuntimeConfig = {
  bridgeScriptPath: string;
  baseUrl: string;
  defaultMandateId?: string;
  defaultSource: string;
  unmatchedPermission: PolicyGatewayPermission;
  identifier?: string;
  guardedAgentId?: string;
};

export type OpenClawAgentEntry = {
  id: string;
  name?: string;
  workspace?: string;
  sandbox?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OpenClawConfig = {
  mcp?: {
    servers?: Record<string, OpenClawMcpServerEntry>;
  };
  plugins?: {
    allow?: string[];
    entries?: Record<string, OpenClawPluginEntry>;
  };
  agents?: {
    list?: OpenClawAgentEntry[];
    defaults?: Record<string, unknown>;
  };
  [key: string]: unknown;
};

export type MandateOsOpenClawInstallOptions = {
  workspacePath: string;
  openClawStateDir?: string;
  configPath?: string;
  identifier?: string;
  bundleIdentifier?: string;
  guardedAgentId?: string;
  baseUrl: string;
  defaultMandateId?: string;
  pluginSource?: string;
  mcpSource?: string;
  unmatchedPermission?: PolicyGatewayPermission;
  sandboxMode?: OpenClawSandboxMode;
  bridgeScriptPath?: string;
  mcpEntryScriptPath?: string;
};

export type MandateOsOpenClawInstallResult = {
  workspacePath: string;
  openClawStateDir: string;
  configPath: string;
  identifier: string;
  bundleIdentifier: string;
  guardedAgentId: string;
  pluginDir: string;
  bundleDir: string;
  bridgeScriptPath: string;
  mcpEntryScriptPath: string;
};

export type MandateOsOpenClawRepairResult = MandateOsOpenClawInstallResult & {
  cleanedPaths: string[];
};

export type MandateOsOpenClawDoctorCheckStatus =
  | 'pass'
  | 'fail'
  | 'warn'
  | 'skip';

export type MandateOsOpenClawDoctorCheck = {
  id: string;
  title: string;
  status: MandateOsOpenClawDoctorCheckStatus;
  message: string;
  detail?: string;
};

export type MandateOsOpenClawDoctorResult = {
  overall: 'healthy' | 'degraded' | 'broken';
  status: MandateOsOpenClawStatus;
  checks: MandateOsOpenClawDoctorCheck[];
};

export type MandateOsOpenClawStatus = {
  workspacePath: string;
  openClawStateDir: string;
  configPath: string;
  identifier: string;
  bundleIdentifier: string;
  guardedAgentId: string;
  pluginDir: string;
  bundleDir: string;
  hasConfig: boolean;
  pluginInstalled: boolean;
  bundleInstalled: boolean;
  pluginEnabled: boolean;
  pluginAllowed: boolean;
  pluginAllowListPresent: boolean;
  mcpConfigured: boolean;
  mcpEnabled: boolean;
  bridgeConfigured: boolean;
  guardedAgentConfigured: boolean;
  baseUrlConfigured: boolean;
  runtimeTokenAvailable: boolean;
  bearerTokenAvailable: boolean;
  bridgeScriptConfigured: boolean;
  bridgeDefaultSource?: string;
  bridgeUnmatchedPermission?: PolicyGatewayPermission;
  defaultMandateIdConfigured: boolean;
  agentSandboxMode?: string;
  effectiveSandboxMode?: string;
  sandboxModeSource: 'agent' | 'global_default' | 'unset';
  sandboxModeScope: 'agent-scoped' | 'global default' | 'unset';
  globalDefaultsSandboxMode?: string;
  agentWorkspaceAccess?: string;
  agentBrowserEnabled?: boolean;
  agentExecHost?: string;
  runtimePluginLoaded: boolean;
  pluginLoadedAt?: string;
  wrapperToolNames: string[];
  wrapperRegistrationAttempted: boolean;
  wrapperRegisteredToolNames: string[];
  wrapperRegistrationFailures: string[];
  wrapperSessionRegistrationCount: number;
  wrapperToolExposureKnown: boolean;
  wrapperToolsBelievedAvailable: boolean | null;
  wrapperToolExposureState: 'available' | 'unavailable' | 'unknown';
  wrapperToolExposureSource:
    | 'session_registration'
    | 'registration_error'
    | 'plugin_registration'
    | 'unknown';
  wrapperToolExposureNote: string;
  installHealth: {
    state: 'healthy' | 'needs_repair';
    summary: string;
  };
  runtimeAuthorization: {
    state: 'ready' | 'missing_token';
    summary: string;
  };
  wrapperExposureVerification: {
    state: 'verified' | 'missing' | 'unverified';
    summary: string;
  };
  livePolicyCapability: {
    state:
      | 'ready'
      | 'missing_default_mandate'
      | 'missing_runtime_token'
      | 'missing_base_url'
      | 'install_incomplete';
    summary: string;
  };
  diagnosticCode:
    | 'ok'
    | 'install_repair_problem'
    | 'sandbox_problem'
    | 'wrapper_unavailable'
    | 'wrapper_exposure_unverified';
  diagnosticMessage: string;
  lastDenial?: Record<string, unknown>;
  lastDenialReason?: string;
};

const DEFAULT_IDENTIFIER = 'mandateos';
const DEFAULT_BUNDLE_IDENTIFIER = 'mandateos-bundle';
const DEFAULT_GUARDED_AGENT_ID = 'mandateos_guarded';
const DEFAULT_PLUGIN_SOURCE = 'openclaw.mandateos.plugin';
const DEFAULT_MCP_SOURCE = 'openclaw.mandateos.bundle';
const WRAPPER_TOOL_NAMES = [
  'mandateos_openclaw_exec',
  'mandateos_openclaw_browser_mutate',
  'mandateos_openclaw_spawn_agent',
] as const;
const require = createRequire(import.meta.url);

export function installMandateOsIntoOpenClaw(
  options: MandateOsOpenClawInstallOptions,
): MandateOsOpenClawInstallResult {
  const normalized = normalizeInstallOptions(options);
  const config = readOpenClawConfig(normalized.configPath);

  ensureDir(normalized.openClawStateDir);
  ensureDir(path.join(normalized.openClawStateDir, 'extensions'));
  copyExtensionAssets(normalized.pluginDir, resolvePackageAssetPath('plugin'));
  copyExtensionAssets(normalized.bundleDir, resolvePackageAssetPath('bundle'));
  installBridgeRuntimeBundle(normalized);
  writeBundleMcpConfig(normalized.bundleDir, normalized);
  writePluginRuntimeConfig(normalized.pluginRuntimeConfigPath, normalized);

  const nextConfig = upsertGuardedAgent(
    upsertPluginEntry(upsertMcpServer(config, normalized), normalized),
    normalized,
  );
  writeOpenClawConfig(normalized.configPath, nextConfig);

  return {
    workspacePath: normalized.workspacePath,
    openClawStateDir: normalized.openClawStateDir,
    configPath: normalized.configPath,
    identifier: normalized.identifier,
    bundleIdentifier: normalized.bundleIdentifier,
    guardedAgentId: normalized.guardedAgentId,
    pluginDir: normalized.pluginDir,
    bundleDir: normalized.bundleDir,
    bridgeScriptPath: normalized.bridgeScriptPath,
    mcpEntryScriptPath: normalized.mcpEntryScriptPath,
  };
}

export function repairMandateOsOpenClawInstall(
  options: MandateOsOpenClawInstallOptions,
): MandateOsOpenClawRepairResult {
  const normalized = normalizeInstallOptions(options);
  const cleanedPaths: string[] = [];

  for (const targetPath of [
    normalized.pluginDir,
    normalized.bundleDir,
    path.join(normalized.openClawStateDir, 'mandateos-openclaw-approvals.json'),
    path.join(normalized.openClawStateDir, 'mandateos-openclaw-status.json'),
  ]) {
    if (!existsSync(targetPath)) {
      continue;
    }

    rmSync(targetPath, { force: true, recursive: true });
    cleanedPaths.push(targetPath);
  }

  return {
    ...installMandateOsIntoOpenClaw(options),
    cleanedPaths,
  };
}

export function readMandateOsOpenClawStatus(
  options: Pick<
    MandateOsOpenClawInstallOptions,
    | 'workspacePath'
    | 'openClawStateDir'
    | 'configPath'
    | 'identifier'
    | 'bundleIdentifier'
    | 'guardedAgentId'
    | 'baseUrl'
  >,
): MandateOsOpenClawStatus {
  const openClawStateDir =
    options.openClawStateDir || resolveOpenClawStateDir();
  const normalized = normalizeInstallOptions({
    workspacePath: options.workspacePath,
    openClawStateDir,
    configPath: options.configPath,
    identifier: options.identifier,
    bundleIdentifier: options.bundleIdentifier,
    guardedAgentId: options.guardedAgentId,
    baseUrl:
      options.baseUrl ||
      process.env.MANDATE_OS_BASE_URL ||
      'http://status-only.invalid',
    mcpEntryScriptPath: path.join(openClawStateDir, '.status-only-mcp.js'),
  });
  const config = readOpenClawConfig(normalized.configPath);
  const runtimeConfig = readPluginRuntimeConfig(
    normalized.pluginRuntimeConfigPath,
  );
  const pluginEntry = config.plugins?.entries?.[normalized.identifier];
  const pluginAllow = config.plugins?.allow;
  const mcpEntry = config.mcp?.servers?.[normalized.identifier];
  const guardedAgent = config.agents?.list?.find(
    (agent) => agent.id === normalized.guardedAgentId,
  );
  const guardedSandbox = isRecord(guardedAgent?.sandbox)
    ? guardedAgent.sandbox
    : undefined;
  const guardedBrowser = isRecord(guardedSandbox?.browser)
    ? guardedSandbox.browser
    : undefined;
  const guardedTools = isRecord(guardedAgent?.tools)
    ? guardedAgent.tools
    : undefined;
  const guardedExec = isRecord(guardedTools?.exec)
    ? guardedTools.exec
    : undefined;
  const globalDefaults = isRecord(config.agents?.defaults)
    ? config.agents?.defaults
    : undefined;
  const globalSandbox = isRecord(globalDefaults?.sandbox)
    ? globalDefaults.sandbox
    : undefined;
  const agentSandboxMode = readOptionalString(guardedSandbox?.mode);
  const globalDefaultsSandboxMode = readOptionalString(globalSandbox?.mode);
  const effectiveSandboxMode = agentSandboxMode || globalDefaultsSandboxMode;
  const sandboxModeSource = agentSandboxMode
    ? 'agent'
    : globalDefaultsSandboxMode
      ? 'global_default'
      : 'unset';
  const statusStore = readStatusStore(
    path.join(normalized.openClawStateDir, 'mandateos-openclaw-status.json'),
  );
  const lastDenial = isRecord(statusStore.lastDenial)
    ? statusStore.lastDenial
    : undefined;
  const pluginLoadedAt = readOptionalString(statusStore.pluginLoadedAt);
  const toolRegistration = isRecord(statusStore.toolRegistration)
    ? statusStore.toolRegistration
    : undefined;
  const attemptedToolNames = readStringArray(
    toolRegistration?.attemptedToolNames,
  );
  const successfulToolNames = readStringArray(
    toolRegistration?.successfulToolNames,
  );
  const wrapperRegisteredToolNames = successfulToolNames.filter((toolName) =>
    WRAPPER_TOOL_NAMES.includes(
      toolName as (typeof WRAPPER_TOOL_NAMES)[number],
    ),
  );
  const wrapperRegistrationFailures = readRegistrationFailures(
    toolRegistration?.failures,
  ).filter((failure) =>
    WRAPPER_TOOL_NAMES.includes(
      failure.toolName as (typeof WRAPPER_TOOL_NAMES)[number],
    ),
  );
  const wrapperSessionRegistrations = readSessionRegistrations(
    toolRegistration?.sessionRegistrations,
  ).filter((registration) =>
    WRAPPER_TOOL_NAMES.includes(
      registration.toolName as (typeof WRAPPER_TOOL_NAMES)[number],
    ),
  );
  const wrapperToolExposureState =
    wrapperRegistrationFailures.length > 0
      ? 'unavailable'
      : wrapperSessionRegistrations.length > 0
        ? 'available'
        : 'unknown';
  const wrapperToolExposureSource =
    wrapperRegistrationFailures.length > 0
      ? 'registration_error'
      : wrapperSessionRegistrations.length > 0
        ? 'session_registration'
        : wrapperRegisteredToolNames.length === WRAPPER_TOOL_NAMES.length
          ? 'plugin_registration'
          : 'unknown';
  const wrapperToolsBelievedAvailable =
    wrapperRegistrationFailures.length > 0
      ? false
      : wrapperRegisteredToolNames.length === WRAPPER_TOOL_NAMES.length
        ? true
        : null;
  const wrapperToolExposureKnown = wrapperToolExposureState !== 'unknown';
  const bridgeScriptPresent = Boolean(
    runtimeConfig?.bridgeScriptPath &&
      existsSync(runtimeConfig.bridgeScriptPath),
  );
  const diagnosticCode = classifyStatusDiagnostic({
    pluginEnabled: pluginEntry?.enabled === true,
    mcpConfigured: Boolean(mcpEntry),
    mcpEnabled: Boolean(mcpEntry) && mcpEntry?.enabled !== false,
    bridgeConfigured: bridgeScriptPresent,
    baseUrlConfigured: Boolean(
      runtimeConfig?.baseUrl ||
        mcpEntry?.env?.MANDATE_OS_BASE_URL ||
        process.env.MANDATE_OS_BASE_URL,
    ),
    runtimeTokenAvailable: Boolean(process.env.MANDATE_OS_AGENT_TOKEN?.trim()),
    guardedAgentConfigured: Boolean(guardedAgent),
    effectiveSandboxMode,
    wrapperToolExposureState,
  });
  const wrapperToolExposureNote = describeWrapperExposure({
    state: wrapperToolExposureState,
    source: wrapperToolExposureSource,
    believedAvailable: wrapperToolsBelievedAvailable,
    wrapperRegistrationFailures,
  });
  const installHealth = describeInstallHealth({
    hasConfig: existsSync(normalized.configPath),
    pluginInstalled: existsSync(
      path.join(normalized.pluginDir, 'openclaw.plugin.json'),
    ),
    bundleInstalled: existsSync(
      path.join(normalized.bundleDir, '.codex-plugin', 'plugin.json'),
    ),
    pluginEnabled: pluginEntry?.enabled === true,
    pluginAllowed: Array.isArray(pluginAllow)
      ? pluginAllow.includes('*') || pluginAllow.includes(normalized.identifier)
      : true,
    mcpConfigured: Boolean(mcpEntry),
    mcpEnabled: Boolean(mcpEntry) && mcpEntry?.enabled !== false,
    bridgeConfigured: bridgeScriptPresent,
    guardedAgentConfigured: Boolean(guardedAgent),
  });
  const runtimeAuthorization = describeRuntimeAuthorization({
    runtimeTokenAvailable: Boolean(process.env.MANDATE_OS_AGENT_TOKEN?.trim()),
  });
  const wrapperExposureVerification = describeWrapperExposureVerification({
    wrapperToolExposureState,
    wrapperToolExposureNote,
  });
  const livePolicyCapability = describeLivePolicyCapability({
    installHealthy: installHealth.state === 'healthy',
    baseUrlConfigured: Boolean(
      runtimeConfig?.baseUrl ||
        mcpEntry?.env?.MANDATE_OS_BASE_URL ||
        process.env.MANDATE_OS_BASE_URL,
    ),
    runtimeTokenAvailable: Boolean(process.env.MANDATE_OS_AGENT_TOKEN?.trim()),
    defaultMandateIdConfigured: Boolean(
      runtimeConfig?.defaultMandateId ||
        mcpEntry?.env?.MANDATE_OS_MCP_DEFAULT_MANDATE_ID ||
        process.env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID ||
        process.env.MANDATE_OS_DEFAULT_MANDATE_ID,
    ),
  });
  const diagnosticMessage = describeStatusDiagnostic({
    code: diagnosticCode,
    wrapperToolExposureNote,
  });

  return {
    workspacePath: normalized.workspacePath,
    openClawStateDir: normalized.openClawStateDir,
    configPath: normalized.configPath,
    identifier: normalized.identifier,
    bundleIdentifier: normalized.bundleIdentifier,
    guardedAgentId: normalized.guardedAgentId,
    pluginDir: normalized.pluginDir,
    bundleDir: normalized.bundleDir,
    hasConfig: existsSync(normalized.configPath),
    pluginInstalled: existsSync(
      path.join(normalized.pluginDir, 'openclaw.plugin.json'),
    ),
    bundleInstalled: existsSync(
      path.join(normalized.bundleDir, '.codex-plugin', 'plugin.json'),
    ),
    pluginEnabled: pluginEntry?.enabled === true,
    pluginAllowed: Array.isArray(pluginAllow)
      ? pluginAllow.includes('*') || pluginAllow.includes(normalized.identifier)
      : true,
    pluginAllowListPresent: Array.isArray(pluginAllow),
    mcpConfigured: Boolean(mcpEntry),
    mcpEnabled: Boolean(mcpEntry) && mcpEntry?.enabled !== false,
    bridgeConfigured: bridgeScriptPresent,
    guardedAgentConfigured: Boolean(guardedAgent),
    baseUrlConfigured: Boolean(
      runtimeConfig?.baseUrl ||
        mcpEntry?.env?.MANDATE_OS_BASE_URL ||
        process.env.MANDATE_OS_BASE_URL,
    ),
    runtimeTokenAvailable: Boolean(process.env.MANDATE_OS_AGENT_TOKEN?.trim()),
    bearerTokenAvailable: Boolean(process.env.MANDATE_OS_AGENT_TOKEN?.trim()),
    bridgeScriptConfigured: bridgeScriptPresent,
    bridgeDefaultSource: runtimeConfig?.defaultSource,
    bridgeUnmatchedPermission: runtimeConfig?.unmatchedPermission,
    defaultMandateIdConfigured: Boolean(
      runtimeConfig?.defaultMandateId ||
        mcpEntry?.env?.MANDATE_OS_MCP_DEFAULT_MANDATE_ID ||
        process.env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID ||
        process.env.MANDATE_OS_DEFAULT_MANDATE_ID,
    ),
    agentSandboxMode,
    effectiveSandboxMode,
    sandboxModeSource,
    sandboxModeScope: describeSandboxModeSource(sandboxModeSource),
    globalDefaultsSandboxMode,
    agentWorkspaceAccess: readOptionalString(guardedSandbox?.workspaceAccess),
    agentBrowserEnabled:
      typeof guardedBrowser?.enabled === 'boolean'
        ? guardedBrowser.enabled
        : undefined,
    agentExecHost: readOptionalString(guardedExec?.host),
    runtimePluginLoaded: Boolean(pluginLoadedAt),
    pluginLoadedAt,
    wrapperToolNames: [...WRAPPER_TOOL_NAMES],
    wrapperRegistrationAttempted: attemptedToolNames.length > 0,
    wrapperRegisteredToolNames,
    wrapperRegistrationFailures: wrapperRegistrationFailures.map(
      (failure) => failure.message,
    ),
    wrapperSessionRegistrationCount: wrapperSessionRegistrations.length,
    wrapperToolExposureKnown,
    wrapperToolsBelievedAvailable,
    wrapperToolExposureState,
    wrapperToolExposureSource,
    wrapperToolExposureNote,
    installHealth,
    runtimeAuthorization,
    wrapperExposureVerification,
    livePolicyCapability,
    diagnosticCode,
    diagnosticMessage,
    lastDenial,
    lastDenialReason: readOptionalString(lastDenial?.reason),
  };
}

export async function runMandateOsOpenClawDoctor(
  options: Pick<
    MandateOsOpenClawInstallOptions,
    | 'workspacePath'
    | 'openClawStateDir'
    | 'configPath'
    | 'identifier'
    | 'bundleIdentifier'
    | 'guardedAgentId'
    | 'baseUrl'
  >,
  input: {
    bridgeCommandRunner?: typeof runOpenClawBridgeCommand;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<MandateOsOpenClawDoctorResult> {
  const env = input.env || process.env;
  const status = readMandateOsOpenClawStatus({
    ...options,
    baseUrl:
      options.baseUrl ||
      env.MANDATE_OS_BASE_URL ||
      'http://status-only.invalid',
  });
  const runtimeTokenAvailable = Boolean(env.MANDATE_OS_AGENT_TOKEN?.trim());
  const baseUrlConfigured = Boolean(
    options.baseUrl ||
      env.MANDATE_OS_BASE_URL?.trim() ||
      status.baseUrlConfigured,
  );
  const defaultMandateIdConfigured = Boolean(
    env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID?.trim() ||
      env.MANDATE_OS_DEFAULT_MANDATE_ID?.trim() ||
      status.defaultMandateIdConfigured,
  );
  const installHealthy =
    status.hasConfig &&
    status.pluginInstalled &&
    status.bundleInstalled &&
    status.pluginEnabled &&
    status.pluginAllowed &&
    status.mcpConfigured &&
    status.mcpEnabled &&
    status.guardedAgentConfigured &&
    status.bridgeScriptConfigured;

  const checks: MandateOsOpenClawDoctorCheck[] = [
    {
      id: 'install-status',
      title: 'Install status',
      status: installHealthy ? 'pass' : 'fail',
      message: installHealthy
        ? 'MandateOS install assets and OpenClaw config entries are present.'
        : status.diagnosticMessage,
      detail: `Diagnostic code: ${status.diagnosticCode}`,
    },
    {
      id: 'bridge-script',
      title: 'Bridge runtime',
      status: status.bridgeScriptConfigured ? 'pass' : 'fail',
      message: status.bridgeScriptConfigured
        ? `Bridge script present at ${status.pluginDir}.`
        : 'Bridge script is missing or not readable from the configured runtime path.',
      detail: status.bridgeScriptConfigured
        ? undefined
        : 'Repair the install so OpenClaw points at a real bridge runtime before starting a guarded session.',
    },
    {
      id: 'runtime-token',
      title: 'Runtime token',
      status: runtimeTokenAvailable ? 'pass' : 'fail',
      message: runtimeTokenAvailable
        ? 'MANDATE_OS_AGENT_TOKEN is available in the runtime environment.'
        : 'MANDATE_OS_AGENT_TOKEN is missing from the runtime environment.',
      detail: runtimeTokenAvailable
        ? undefined
        : 'The OpenClaw bridge cannot evaluate live policy without an agent token.',
    },
  ];

  const bridgeRunner = input.bridgeCommandRunner || runOpenClawBridgeCommand;
  const localSmoke = runBridgeSmokeTest({
    status,
    title: 'Local bridge smoke test',
    payload: {
      channel: 'shell',
      subject: 'git status',
      context: {
        command: 'git status',
      },
    },
    bridgeRunner,
    env,
    successDecisions: ['local_allow'],
    skipReason: null,
  });
  checks.push(localSmoke);

  const liveSkipReason = !defaultMandateIdConfigured
    ? 'Configure MANDATE_OS_MCP_DEFAULT_MANDATE_ID before running a live policy smoke test.'
    : !baseUrlConfigured
      ? 'Configure MANDATE_OS_BASE_URL before running a live policy smoke test.'
      : !runtimeTokenAvailable
        ? 'Add MANDATE_OS_AGENT_TOKEN to the runtime environment before running a live policy smoke test.'
        : null;
  const liveSmoke = runBridgeSmokeTest({
    status,
    title: 'Live policy smoke test',
    payload: {
      channel: 'browser',
      subject: 'click',
      context: {
        browserAction: 'click',
      },
    },
    bridgeRunner,
    env,
    successDecisions: [
      'redirect_enforced',
      'policy_allowed',
      'policy_approval',
      'policy_blocked',
    ],
    skipReason: liveSkipReason,
  });
  checks.push(liveSmoke);

  return {
    overall: classifyDoctorOverall(checks),
    status,
    checks,
  };
}

export function resolveOpenClawStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir(),
) {
  return (
    env.OPENCLAW_STATE_DIR?.trim() ||
    env.CLAWDBOT_STATE_DIR?.trim() ||
    path.join(homeDir, '.openclaw')
  );
}

function normalizeInstallOptions(options: MandateOsOpenClawInstallOptions) {
  const openClawStateDir =
    options.openClawStateDir || resolveOpenClawStateDir();
  const configPath =
    options.configPath || path.join(openClawStateDir, 'openclaw.json');
  const identifier = options.identifier || DEFAULT_IDENTIFIER;
  const bundleIdentifier =
    options.bundleIdentifier || DEFAULT_BUNDLE_IDENTIFIER;
  const guardedAgentId = options.guardedAgentId || DEFAULT_GUARDED_AGENT_ID;
  const pluginDir = path.join(openClawStateDir, 'extensions', identifier);
  const bundleDir = path.join(openClawStateDir, 'extensions', bundleIdentifier);
  const bridgeSourceScriptPath =
    options.bridgeScriptPath || resolveBuiltScriptPath('openclaw-bridge.js');
  const bridgeRuntimeDependencies = resolveBridgeRuntimeDependencies(
    bridgeSourceScriptPath,
  );
  const bridgeRuntimeDir = path.join(pluginDir, 'runtime');
  const bridgeScriptPath = bridgeRuntimeDependencies
    ? path.join(bridgeRuntimeDir, 'openclaw-bridge.js')
    : bridgeSourceScriptPath;
  const mcpEntryScriptPath =
    options.mcpEntryScriptPath || resolveMandateOsMcpEntryScriptPath();

  return {
    ...options,
    identifier,
    bundleIdentifier,
    guardedAgentId,
    openClawStateDir,
    configPath,
    pluginDir,
    bundleDir,
    pluginRuntimeConfigPath: path.join(
      openClawStateDir,
      'extensions',
      identifier,
      'mandateos.runtime.json',
    ),
    bridgeRuntimeDir,
    bridgeSourceScriptPath,
    bridgeRuntimeDependencies,
    bridgeScriptPath,
    mcpEntryScriptPath,
    pluginSource: options.pluginSource || DEFAULT_PLUGIN_SOURCE,
    mcpSource: options.mcpSource || DEFAULT_MCP_SOURCE,
    unmatchedPermission: options.unmatchedPermission || 'ask',
    sandboxMode: normalizeSandboxMode(options.sandboxMode),
  };
}

function upsertMcpServer(
  current: OpenClawConfig,
  input: ReturnType<typeof normalizeInstallOptions>,
): OpenClawConfig {
  const currentServers = current.mcp?.servers || {};
  const existingEntry = currentServers[input.identifier] || { command: 'node' };

  return {
    ...current,
    mcp: {
      ...(current.mcp || {}),
      servers: {
        ...currentServers,
        [input.identifier]: {
          ...existingEntry,
          command: 'node',
          args: [input.mcpEntryScriptPath],
          env: compactRecord({
            ...(existingEntry.env || {}),
            MANDATE_OS_BASE_URL: input.baseUrl,
            MANDATE_OS_MCP_DEFAULT_MANDATE_ID: input.defaultMandateId,
            MANDATE_OS_MCP_DEFAULT_SOURCE: input.mcpSource,
          }),
          enabled: true,
        },
      },
    },
  };
}

function upsertPluginEntry(
  current: OpenClawConfig,
  input: ReturnType<typeof normalizeInstallOptions>,
): OpenClawConfig {
  const currentPlugins = current.plugins || {};
  const currentEntry = currentPlugins.entries?.[input.identifier] || {};
  const { env: _unusedEnv, ...currentEntryWithoutEnv } = currentEntry;
  const nextAllow = Array.isArray(currentPlugins.allow)
    ? Array.from(new Set([...currentPlugins.allow, input.identifier]))
    : currentPlugins.allow;

  return {
    ...current,
    plugins: {
      ...currentPlugins,
      ...(nextAllow ? { allow: nextAllow } : {}),
      entries: {
        ...(currentPlugins.entries || {}),
        [input.identifier]: {
          ...currentEntryWithoutEnv,
          enabled: true,
        },
      },
    },
  };
}

function upsertGuardedAgent(
  current: OpenClawConfig,
  input: ReturnType<typeof normalizeInstallOptions>,
): OpenClawConfig {
  const currentAgents = current.agents || {};
  const list = [...(currentAgents.list || [])];
  const existingIndex = list.findIndex(
    (agent) => agent.id === input.guardedAgentId,
  );
  const existing = existingIndex >= 0 ? list[existingIndex] : undefined;
  const existingSandbox = isRecord(existing?.sandbox)
    ? existing.sandbox
    : undefined;
  const existingBrowser = isRecord(existingSandbox?.browser)
    ? existingSandbox.browser
    : undefined;
  const existingTools = isRecord(existing?.tools) ? existing.tools : undefined;
  const existingExec = isRecord(existingTools?.exec)
    ? existingTools.exec
    : undefined;
  const { exec: _unusedExec, ...existingToolsWithoutExec } =
    existingTools || {};
  const sandboxMode =
    input.sandboxMode || readOptionalString(existingSandbox?.mode) || 'all';
  const workspaceAccess =
    readOptionalString(existingSandbox?.workspaceAccess) || 'rw';
  const execHost = readOptionalString(existingExec?.host);
  const nextExec =
    sandboxMode === 'off'
      ? compactRecord({
          ...(existingExec || {}),
          host: execHost && execHost !== 'sandbox' ? execHost : undefined,
        })
      : compactRecord({
          ...(existingExec || {}),
          host: execHost || 'sandbox',
        });

  const nextAgent: OpenClawAgentEntry = {
    ...existing,
    id: input.guardedAgentId,
    name: existing?.name || 'MandateOS Guarded',
    workspace: input.workspacePath,
    sandbox: {
      ...(existingSandbox || {}),
      mode: sandboxMode,
      workspaceAccess,
      browser: {
        ...(existingBrowser || {}),
        enabled: true,
      },
    },
    tools: {
      ...existingToolsWithoutExec,
      allow: ['*'],
      ...(nextExec ? { exec: nextExec } : {}),
    },
  };

  if (existingIndex >= 0) {
    list.splice(existingIndex, 1, nextAgent);
  } else {
    list.push(nextAgent);
  }

  return {
    ...current,
    agents: {
      ...currentAgents,
      list,
    },
  };
}

function copyExtensionAssets(targetDir: string, sourceDir: string) {
  ensureDir(path.dirname(targetDir));
  cpSync(sourceDir, targetDir, {
    force: true,
    recursive: true,
  });
}

function installBridgeRuntimeBundle(
  input: ReturnType<typeof normalizeInstallOptions>,
) {
  if (!input.bridgeRuntimeDependencies) {
    return;
  }

  ensureDir(input.bridgeRuntimeDir);
  copyFileIfExists(
    input.bridgeSourceScriptPath,
    path.join(input.bridgeRuntimeDir, 'openclaw-bridge.js'),
  );
  copyFileIfExists(
    `${input.bridgeSourceScriptPath}.map`,
    path.join(input.bridgeRuntimeDir, 'openclaw-bridge.js.map'),
  );
  copyFileIfExists(
    input.bridgeRuntimeDependencies.policySourcePath,
    path.join(input.bridgeRuntimeDir, 'openclaw-policy.js'),
  );
  copyFileIfExists(
    `${input.bridgeRuntimeDependencies.policySourcePath}.map`,
    path.join(input.bridgeRuntimeDir, 'openclaw-policy.js.map'),
  );
  copyPackageRuntime(
    input.bridgeRuntimeDependencies.sdkRuntimePackageDir,
    path.join(input.pluginDir, 'node_modules', '@mandate-os', 'sdk'),
  );
}

function writePluginRuntimeConfig(
  runtimeConfigPath: string,
  input: ReturnType<typeof normalizeInstallOptions>,
) {
  ensureDir(path.dirname(runtimeConfigPath));
  writeFileSync(
    runtimeConfigPath,
    JSON.stringify(
      {
        bridgeScriptPath: input.bridgeScriptPath,
        baseUrl: input.baseUrl,
        defaultMandateId: input.defaultMandateId,
        defaultSource: input.pluginSource,
        unmatchedPermission: input.unmatchedPermission,
        identifier: input.identifier,
        guardedAgentId: input.guardedAgentId,
      } satisfies MandateOsOpenClawPluginRuntimeConfig,
      null,
      2,
    ),
    'utf8',
  );
}

function writeBundleMcpConfig(
  bundleDir: string,
  input: ReturnType<typeof normalizeInstallOptions>,
) {
  writeFileSync(
    path.join(bundleDir, '.mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          [input.identifier]: {
            command: 'node',
            args: [input.mcpEntryScriptPath],
            env: compactRecord({
              MANDATE_OS_BASE_URL: input.baseUrl,
              MANDATE_OS_MCP_DEFAULT_MANDATE_ID: input.defaultMandateId,
              MANDATE_OS_MCP_DEFAULT_SOURCE: input.mcpSource,
            }),
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
}

function readOpenClawConfig(configPath: string): OpenClawConfig {
  if (!existsSync(configPath)) {
    return {};
  }

  const raw = readFileSync(configPath, 'utf8').trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as OpenClawConfig;
  } catch {
    const parsed = vm.runInNewContext(`(${raw})`, Object.create(null), {
      timeout: 1000,
    });

    return isRecord(parsed) ? (parsed as OpenClawConfig) : {};
  }
}

function readPluginRuntimeConfig(
  runtimeConfigPath: string,
): MandateOsOpenClawPluginRuntimeConfig | null {
  if (!existsSync(runtimeConfigPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      readFileSync(runtimeConfigPath, 'utf8'),
    ) as Partial<MandateOsOpenClawPluginRuntimeConfig>;
    if (
      !parsed.bridgeScriptPath ||
      !parsed.baseUrl ||
      !parsed.defaultSource ||
      !parsed.unmatchedPermission
    ) {
      return null;
    }
    return {
      bridgeScriptPath: parsed.bridgeScriptPath,
      baseUrl: parsed.baseUrl,
      defaultMandateId: parsed.defaultMandateId,
      defaultSource: parsed.defaultSource,
      unmatchedPermission: parsed.unmatchedPermission,
      identifier: readOptionalString(parsed.identifier),
      guardedAgentId: readOptionalString(parsed.guardedAgentId),
    };
  } catch {
    return null;
  }
}

function readStatusStore(statusStorePath: string): Record<string, unknown> {
  if (!existsSync(statusStorePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(statusStorePath, 'utf8'));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readRegistrationFailures(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const toolName = readOptionalString(entry.toolName);
      const message = readOptionalString(entry.message);

      if (!toolName || !message) {
        return null;
      }

      return {
        toolName,
        message,
      };
    })
    .filter((entry): entry is { toolName: string; message: string } =>
      Boolean(entry),
    );
}

function readSessionRegistrations(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const toolName = readOptionalString(entry.toolName);

      if (!toolName) {
        return null;
      }

      return {
        toolName,
      };
    })
    .filter((entry): entry is { toolName: string } => Boolean(entry));
}

function classifyStatusDiagnostic(input: {
  pluginEnabled: boolean;
  mcpConfigured: boolean;
  mcpEnabled: boolean;
  bridgeConfigured: boolean;
  baseUrlConfigured: boolean;
  runtimeTokenAvailable: boolean;
  guardedAgentConfigured: boolean;
  effectiveSandboxMode?: string;
  wrapperToolExposureState: 'available' | 'unavailable' | 'unknown';
}): MandateOsOpenClawStatus['diagnosticCode'] {
  if (
    !input.pluginEnabled ||
    !input.mcpConfigured ||
    !input.mcpEnabled ||
    !input.bridgeConfigured ||
    !input.baseUrlConfigured ||
    !input.runtimeTokenAvailable
  ) {
    return 'install_repair_problem';
  }

  if (!input.guardedAgentConfigured || !input.effectiveSandboxMode) {
    return 'sandbox_problem';
  }

  if (input.wrapperToolExposureState === 'unavailable') {
    return 'wrapper_unavailable';
  }

  if (input.wrapperToolExposureState === 'unknown') {
    return 'wrapper_exposure_unverified';
  }

  return 'ok';
}

function describeWrapperExposure(input: {
  state: 'available' | 'unavailable' | 'unknown';
  source:
    | 'session_registration'
    | 'registration_error'
    | 'plugin_registration'
    | 'unknown';
  believedAvailable: boolean | null;
  wrapperRegistrationFailures: Array<{ toolName: string; message: string }>;
}) {
  if (input.state === 'available') {
    return 'MandateOS has seen wrapper tools instantiated for at least one OpenClaw session.';
  }

  if (input.state === 'unavailable') {
    return `MandateOS saw wrapper registration fail: ${input.wrapperRegistrationFailures
      .map((failure) => `${failure.toolName}: ${failure.message}`)
      .join('; ')}`;
  }

  if (
    input.source === 'plugin_registration' &&
    input.believedAvailable === true
  ) {
    return 'MandateOS registered the wrapper tools with OpenClaw, but it cannot verify from status alone that the live session exposes them in /tools.';
  }

  return 'MandateOS has not observed enough runtime information to verify whether the live session exposes the wrapper tools.';
}

function describeInstallHealth(input: {
  hasConfig: boolean;
  pluginInstalled: boolean;
  bundleInstalled: boolean;
  pluginEnabled: boolean;
  pluginAllowed: boolean;
  mcpConfigured: boolean;
  mcpEnabled: boolean;
  bridgeConfigured: boolean;
  guardedAgentConfigured: boolean;
}) {
  const ready =
    input.hasConfig &&
    input.pluginInstalled &&
    input.bundleInstalled &&
    input.pluginEnabled &&
    input.pluginAllowed &&
    input.mcpConfigured &&
    input.mcpEnabled &&
    input.bridgeConfigured &&
    input.guardedAgentConfigured;

  return {
    state: ready ? 'healthy' : 'needs_repair',
    summary: ready
      ? 'Install assets, OpenClaw config entries, and guarded-agent wiring are present.'
      : 'Install health is incomplete. Repair the plugin, bundle, MCP entry, bridge runtime, or guarded-agent config before trusting runtime checks.',
  } as const;
}

function describeRuntimeAuthorization(input: {
  runtimeTokenAvailable: boolean;
}) {
  return {
    state: input.runtimeTokenAvailable ? 'ready' : 'missing_token',
    summary: input.runtimeTokenAvailable
      ? 'OpenClaw runtime has MANDATE_OS_AGENT_TOKEN, so live authorization requests can reach MandateOS.'
      : 'OpenClaw runtime is missing MANDATE_OS_AGENT_TOKEN, so live authorization requests cannot run.',
  } as const;
}

function describeWrapperExposureVerification(input: {
  wrapperToolExposureState: 'available' | 'unavailable' | 'unknown';
  wrapperToolExposureNote: string;
}) {
  if (input.wrapperToolExposureState === 'available') {
    return {
      state: 'verified',
      summary: 'Wrapper exposure is verified for a live OpenClaw session.',
    } as const;
  }

  if (input.wrapperToolExposureState === 'unavailable') {
    return {
      state: 'missing',
      summary: `Wrapper exposure failed verification. ${input.wrapperToolExposureNote}`,
    } as const;
  }

  return {
    state: 'unverified',
    summary: `Wrapper exposure is not verified for a live session yet. ${input.wrapperToolExposureNote}`,
  } as const;
}

function describeLivePolicyCapability(input: {
  installHealthy: boolean;
  baseUrlConfigured: boolean;
  runtimeTokenAvailable: boolean;
  defaultMandateIdConfigured: boolean;
}) {
  if (!input.installHealthy) {
    return {
      state: 'install_incomplete',
      summary:
        'Live policy checks are blocked until the local install health is repaired.',
    } as const;
  }

  if (!input.baseUrlConfigured) {
    return {
      state: 'missing_base_url',
      summary:
        'Live policy checks cannot run until MANDATE_OS_BASE_URL is configured.',
    } as const;
  }

  if (!input.runtimeTokenAvailable) {
    return {
      state: 'missing_runtime_token',
      summary:
        'Live policy checks cannot run until OpenClaw starts with MANDATE_OS_AGENT_TOKEN.',
    } as const;
  }

  if (!input.defaultMandateIdConfigured) {
    return {
      state: 'missing_default_mandate',
      summary:
        'Local install health is fine, but live policy smoke tests still need MANDATE_OS_MCP_DEFAULT_MANDATE_ID.',
    } as const;
  }

  return {
    state: 'ready',
    summary:
      'Live policy capability is ready for doctor smoke tests and guarded runtime evaluation.',
  } as const;
}

function classifyDoctorOverall(checks: MandateOsOpenClawDoctorCheck[]) {
  if (checks.some((check) => check.status === 'fail')) {
    return 'broken';
  }

  if (checks.some((check) => check.status === 'warn')) {
    return 'degraded';
  }

  return 'healthy';
}

function runBridgeSmokeTest(input: {
  status: MandateOsOpenClawStatus;
  title: string;
  payload: Record<string, unknown>;
  env: NodeJS.ProcessEnv;
  bridgeRunner: typeof runOpenClawBridgeCommand;
  successDecisions: string[];
  skipReason: string | null;
}): MandateOsOpenClawDoctorCheck {
  if (input.skipReason) {
    return {
      id: slugifyDoctorCheckTitle(input.title),
      title: input.title,
      status: 'skip',
      message: input.skipReason,
    };
  }

  if (!input.status.bridgeScriptConfigured) {
    return {
      id: slugifyDoctorCheckTitle(input.title),
      title: input.title,
      status: 'fail',
      message:
        'Bridge runtime is unavailable, so the smoke test could not run.',
    };
  }

  const result = input.bridgeRunner({
    bridgeScriptPath: readPluginRuntimeConfig(
      path.join(input.status.pluginDir, 'mandateos.runtime.json'),
    )?.bridgeScriptPath,
    payload: input.payload,
    env: input.env,
  });

  if (!result.bridgeScriptPath) {
    return {
      id: slugifyDoctorCheckTitle(input.title),
      title: input.title,
      status: 'fail',
      message: 'Bridge runtime path is missing from the plugin runtime config.',
    };
  }

  if (result.errorMessage) {
    return {
      id: slugifyDoctorCheckTitle(input.title),
      title: input.title,
      status: 'fail',
      message: result.errorMessage,
      detail: result.stderr || undefined,
    };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = result.stdout.trim()
      ? (JSON.parse(result.stdout) as Record<string, unknown>)
      : null;
  } catch {
    return {
      id: slugifyDoctorCheckTitle(input.title),
      title: input.title,
      status: 'fail',
      message: 'Bridge smoke test returned invalid JSON.',
      detail: result.stdout || result.stderr || undefined,
    };
  }

  const decision = readOptionalString(parsed?.decision);
  if (
    result.exitCode === 0 &&
    decision &&
    input.successDecisions.includes(decision)
  ) {
    return {
      id: slugifyDoctorCheckTitle(input.title),
      title: input.title,
      status: 'pass',
      message: `Bridge returned ${decision}.`,
      detail: result.bridgeScriptPath,
    };
  }

  const message =
    readOptionalString(parsed?.userMessage) ||
    readOptionalString(parsed?.agentMessage) ||
    `Bridge returned an unexpected result${decision ? ` (${decision})` : ''}.`;
  const status = decision === 'misconfigured' ? 'warn' : 'fail';

  return {
    id: slugifyDoctorCheckTitle(input.title),
    title: input.title,
    status,
    message,
    detail: result.stdout || result.stderr || undefined,
  };
}

function slugifyDoctorCheckTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

type OpenClawBridgeCommandResult = {
  bridgeScriptPath?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorMessage?: string;
};

function runOpenClawBridgeCommand(input: {
  bridgeScriptPath?: string;
  payload: Record<string, unknown>;
  env: NodeJS.ProcessEnv;
}): OpenClawBridgeCommandResult {
  if (!input.bridgeScriptPath) {
    return {
      bridgeScriptPath: input.bridgeScriptPath,
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: 'Bridge runtime path is missing.',
    };
  }

  const result = spawnSync(
    process.execPath,
    [input.bridgeScriptPath, 'evaluate'],
    {
      env: input.env,
      input: JSON.stringify(input.payload),
      encoding: 'utf8',
    },
  );

  return {
    bridgeScriptPath: input.bridgeScriptPath,
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    errorMessage: result.error?.message,
  };
}

function describeStatusDiagnostic(input: {
  code: MandateOsOpenClawStatus['diagnosticCode'];
  wrapperToolExposureNote: string;
}) {
  if (input.code === 'install_repair_problem') {
    return 'MandateOS install or runtime prerequisites are incomplete. Check plugin, MCP, bridge, base URL, and runtime token configuration.';
  }

  if (input.code === 'sandbox_problem') {
    return 'MandateOS guarded-agent sandbox settings are incomplete for this workspace.';
  }

  if (input.code === 'wrapper_unavailable') {
    return 'MandateOS is active, but the required OpenClaw wrapper tools do not appear to be available at runtime. This looks like an integration/runtime exposure problem.';
  }

  if (input.code === 'wrapper_exposure_unverified') {
    return `MandateOS appears installed, but wrapper exposure is not verified for a live session yet. ${input.wrapperToolExposureNote}`;
  }

  return 'MandateOS installation and wrapper diagnostics look healthy for the last observed runtime state.';
}

function describeSandboxModeSource(
  source: 'agent' | 'global_default' | 'unset',
) {
  if (source === 'agent') {
    return 'agent-scoped';
  }

  if (source === 'global_default') {
    return 'global default';
  }

  return 'unset';
}

function writeOpenClawConfig(configPath: string, config: OpenClawConfig) {
  ensureDir(path.dirname(configPath));
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function resolvePackageAssetPath(...segments: string[]) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const distAssetsDir = path.resolve(moduleDir, 'assets');

  if (existsSync(distAssetsDir)) {
    return path.join(distAssetsDir, ...segments);
  }

  return path.resolve(moduleDir, '..', 'assets', ...segments);
}

function resolveBuiltScriptPath(fileName: string) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const distCandidate = path.resolve(moduleDir, fileName);

  if (existsSync(distCandidate)) {
    return distCandidate;
  }

  return path.resolve(
    moduleDir,
    '..',
    '..',
    '..',
    'dist',
    'packages',
    'mandate-os-openclaw',
    fileName,
  );
}

function resolveBridgeRuntimeDependencies(bridgeSourceScriptPath: string) {
  if (!existsSync(bridgeSourceScriptPath)) {
    return null;
  }

  const policySourcePath = path.join(
    path.dirname(bridgeSourceScriptPath),
    'openclaw-policy.js',
  );
  if (!existsSync(policySourcePath)) {
    return null;
  }

  const sdkRuntimePackageDir = resolveMandateOsSdkRuntimePackageDir(
    bridgeSourceScriptPath,
  );
  if (!sdkRuntimePackageDir) {
    return null;
  }

  return {
    policySourcePath,
    sdkRuntimePackageDir,
  };
}

function resolveMandateOsSdkRuntimePackageDir(bridgeSourceScriptPath: string) {
  const bridgeDir = path.dirname(bridgeSourceScriptPath);
  const candidates = [
    path.resolve(bridgeDir, '..', 'mandate-os-sdk'),
    path.resolve(
      bridgeDir,
      '..',
      '..',
      '..',
      'dist',
      'packages',
      'mandate-os-sdk',
    ),
  ];

  try {
    candidates.push(
      path.dirname(require.resolve('@mandate-os/sdk/package.json')),
    );
  } catch {
    // Ignore runtime package resolution failures here and fall back to other candidates.
  }

  return (
    candidates.find(
      (candidate) =>
        existsSync(path.join(candidate, 'package.json')) &&
        existsSync(path.join(candidate, 'index.js')),
    ) || null
  );
}

function resolveMandateOsMcpEntryScriptPath() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '..', 'mcp', 'index.js'),
    path.resolve(moduleDir, '..', 'mandate-os-mcp', 'index.js'),
    path.resolve(
      moduleDir,
      '..',
      '..',
      '..',
      'dist',
      'packages',
      'mandate-os-mcp',
      'index.js',
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    return require.resolve('@mandate-os/mcp');
  } catch (error) {
    throw new Error(
      `Unable to resolve the @mandate-os/mcp entrypoint for OpenClaw installation. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function copyPackageRuntime(sourceDir: string, targetDir: string) {
  ensureDir(path.dirname(targetDir));
  rmSync(targetDir, { force: true, recursive: true });
  cpSync(sourceDir, targetDir, {
    force: true,
    recursive: true,
  });
}

function copyFileIfExists(sourcePath: string, targetPath: string) {
  if (!existsSync(sourcePath)) {
    return;
  }

  ensureDir(path.dirname(targetPath));
  cpSync(sourcePath, targetPath, {
    force: true,
  });
}

function compactRecord(
  record: Record<string, string | undefined>,
): Record<string, string> | undefined {
  const entries = Object.entries(record).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0,
  ) as Array<[string, string]>;

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeSandboxMode(value: unknown): OpenClawSandboxMode | undefined {
  return value === 'all' || value === 'off' ? value : undefined;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureDir(dirPath: string) {
  mkdirSync(dirPath, { recursive: true });
}
