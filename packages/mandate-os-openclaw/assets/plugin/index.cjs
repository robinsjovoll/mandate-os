const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

const APPROVAL_TTL_MS = 5 * 60 * 1000;
const READ_ONLY_SHELL_PATTERNS = [
  /^\s*(ls|pwd|cat|sed|rg|find)\b/i,
  /^\s*git\s+(status|diff|log|show)\b/i,
  /^\s*(pnpm|npm)\s+(test|lint|build)\b/i,
  /^\s*(vitest|jest|tsc|eslint)\b/i,
];
const BROWSER_READ_ACTIONS = new Set([
  'status',
  'profiles',
  'tabs',
  'snapshot',
  'screenshot',
  'console',
  'network',
  'pdf',
  'inspect',
  'open',
  'focus',
  'close',
]);
const WRAPPER_TOOL_NAMES = {
  exec: 'mandateos_openclaw_exec',
  browser: 'mandateos_openclaw_browser_mutate',
  sessions_spawn: 'mandateos_openclaw_spawn_agent',
};
const WRAPPER_TOOL_NAME_LIST = Object.values(WRAPPER_TOOL_NAMES);
const RUNTIME_CONFIG_FILE = 'mandateos.runtime.json';
const LOCAL_BRIDGE_FILE = 'openclaw-bridge.js';
const STATUS_STORE_FILE = 'mandateos-openclaw-status.json';
const DEFAULT_IDENTIFIER = 'mandateos';
const DEFAULT_GUARDED_AGENT_ID = 'mandateos_guarded';

function stableStringify(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function normalizeBrowserAction(params) {
  return String((params && params.action) || '')
    .trim()
    .toLowerCase();
}

function isReadOnlyShellCommand(command) {
  return READ_ONLY_SHELL_PATTERNS.some((pattern) =>
    pattern.test(command || ''),
  );
}

function isBrowserMutation(params) {
  const action = normalizeBrowserAction(params);
  if (!action) {
    return true;
  }
  return !BROWSER_READ_ACTIONS.has(action);
}

function approvalHash(toolName, params, ctx) {
  return createHash('sha256')
    .update(
      stableStringify({
        toolName,
        params,
        sessionKey: ctx && ctx.sessionKey ? ctx.sessionKey : null,
        sessionId: ctx && ctx.sessionId ? ctx.sessionId : null,
        agentId: ctx && ctx.agentId ? ctx.agentId : null,
      }),
    )
    .digest('hex');
}

function resolveStateDir(api) {
  const runtimeStateDir =
    api &&
    api.runtime &&
    api.runtime.state &&
    typeof api.runtime.state.resolveStateDir === 'function'
      ? api.runtime.state.resolveStateDir()
      : null;
  return (
    runtimeStateDir ||
    process.env.OPENCLAW_STATE_DIR ||
    process.env.CLAWDBOT_STATE_DIR ||
    path.join(os.homedir(), '.openclaw')
  );
}

function resolveApprovalStorePath(api) {
  return path.join(resolveStateDir(api), 'mandateos-openclaw-approvals.json');
}

function readRuntimeConfig() {
  const runtimeConfigPath = path.join(__dirname, RUNTIME_CONFIG_FILE);
  if (!fs.existsSync(runtimeConfigPath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOpenClawConfig(api) {
  const configPath = path.join(resolveStateDir(api), 'openclaw.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, 'utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    try {
      const parsed = vm.runInNewContext(`(${raw})`, Object.create(null), {
        timeout: 1000,
      });
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}

function resolveRuntimeIdentifiers() {
  const runtimeConfig = readRuntimeConfig();
  return {
    identifier:
      readOptionalString(runtimeConfig.identifier) || DEFAULT_IDENTIFIER,
    guardedAgentId:
      readOptionalString(runtimeConfig.guardedAgentId) ||
      DEFAULT_GUARDED_AGENT_ID,
  };
}

function resolveStatusStorePath(api) {
  return path.join(resolveStateDir(api), STATUS_STORE_FILE);
}

function readStatusStore(api) {
  const storePath = resolveStatusStorePath(api);
  if (!fs.existsSync(storePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStatusStore(api, value) {
  const storePath = resolveStatusStorePath(api);
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(value, null, 2), 'utf8');
}

function updateStatusStore(api, patch) {
  const current = readStatusStore(api);
  writeStatusStore(api, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

function uniqueStrings(values) {
  return Array.from(
    new Set(values.filter((value) => typeof value === 'string' && value)),
  );
}

function sessionIdentity(ctx) {
  return compactRecord({
    sessionKey: readOptionalString(ctx && ctx.sessionKey),
    sessionId: readOptionalString(ctx && ctx.sessionId),
    agentId: readOptionalString(ctx && ctx.agentId),
  });
}

function hasSessionIdentity(identity) {
  return Boolean(identity.sessionKey || identity.sessionId || identity.agentId);
}

function sameSessionIdentity(left, right) {
  if (!left || !right) {
    return false;
  }
  if (left.sessionKey && right.sessionKey) {
    return left.sessionKey === right.sessionKey;
  }
  if (left.sessionId && right.sessionId) {
    return left.sessionId === right.sessionId;
  }
  if (left.agentId && right.agentId) {
    return left.agentId === right.agentId;
  }
  return false;
}

function readToolRegistrationState(api) {
  const store = readStatusStore(api);
  const toolRegistration = isRecord(store.toolRegistration)
    ? store.toolRegistration
    : {};

  return {
    attemptedToolNames: Array.isArray(toolRegistration.attemptedToolNames)
      ? uniqueStrings(toolRegistration.attemptedToolNames)
      : [],
    successfulToolNames: Array.isArray(toolRegistration.successfulToolNames)
      ? uniqueStrings(toolRegistration.successfulToolNames)
      : [],
    failures: Array.isArray(toolRegistration.failures)
      ? toolRegistration.failures.filter((entry) => {
          return (
            isRecord(entry) &&
            readOptionalString(entry.toolName) &&
            readOptionalString(entry.message)
          );
        })
      : [],
    sessionRegistrations: Array.isArray(toolRegistration.sessionRegistrations)
      ? toolRegistration.sessionRegistrations.filter((entry) => {
          return isRecord(entry) && readOptionalString(entry.toolName);
        })
      : [],
  };
}

function writeToolRegistrationState(api, nextState) {
  updateStatusStore(api, {
    toolRegistration: {
      attemptedToolNames: nextState.attemptedToolNames,
      successfulToolNames: nextState.successfulToolNames,
      failures: nextState.failures,
      sessionRegistrations: nextState.sessionRegistrations,
    },
  });
}

function recordPluginLoaded(api) {
  const current = readStatusStore(api);
  if (readOptionalString(current.pluginLoadedAt)) {
    return;
  }

  updateStatusStore(api, {
    pluginLoadedAt: new Date().toISOString(),
  });
}

function recordToolRegistrationAttempt(api, toolName) {
  const state = readToolRegistrationState(api);
  writeToolRegistrationState(api, {
    ...state,
    attemptedToolNames: uniqueStrings([...state.attemptedToolNames, toolName]),
  });
}

function recordToolRegistrationSuccess(api, toolName) {
  const state = readToolRegistrationState(api);
  writeToolRegistrationState(api, {
    ...state,
    successfulToolNames: uniqueStrings([
      ...state.successfulToolNames,
      toolName,
    ]),
  });
}

function recordToolRegistrationFailure(api, toolName, error) {
  const state = readToolRegistrationState(api);
  const message =
    error instanceof Error ? error.message : String(error || 'Unknown error');

  writeToolRegistrationState(api, {
    ...state,
    failures: [
      ...state.failures.filter((entry) => {
        return !(entry.toolName === toolName && entry.message === message);
      }),
      {
        toolName,
        message,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

function recordToolSessionRegistration(api, toolName, toolCtx) {
  const identity = sessionIdentity(toolCtx || {});
  if (!hasSessionIdentity(identity)) {
    return;
  }

  const state = readToolRegistrationState(api);
  const nextEntry = {
    toolName,
    ...identity,
    registeredAt: new Date().toISOString(),
  };

  writeToolRegistrationState(api, {
    ...state,
    sessionRegistrations: [
      ...state.sessionRegistrations.filter((entry) => {
        return !(
          entry.toolName === toolName && sameSessionIdentity(entry, identity)
        );
      }),
      nextEntry,
    ],
  });
}

function recordWrapperCall(api, toolName, toolCtx) {
  updateStatusStore(api, {
    lastWrapperCall: {
      toolName,
      ...sessionIdentity(toolCtx || {}),
      timestamp: new Date().toISOString(),
    },
  });
}

function toolNamesFromCandidate(candidate) {
  if (Array.isArray(candidate)) {
    return uniqueStrings(
      candidate.flatMap((entry) => {
        if (typeof entry === 'string') {
          return [entry];
        }

        if (!isRecord(entry)) {
          return [];
        }

        return [
          readOptionalString(entry.name),
          readOptionalString(entry.toolName),
          readOptionalString(entry.id),
        ].filter(Boolean);
      }),
    );
  }

  if (!isRecord(candidate)) {
    return [];
  }

  if (Array.isArray(candidate.list)) {
    return toolNamesFromCandidate(candidate.list);
  }

  const namesFromValues = uniqueStrings(
    Object.values(candidate).flatMap((value) => toolNamesFromCandidate(value)),
  );
  if (namesFromValues.length > 0) {
    return namesFromValues;
  }

  const keys = Object.keys(candidate).filter((key) => {
    const value = candidate[key];
    return value === true || value === false || isRecord(value);
  });

  return uniqueStrings(keys);
}

function resolveLiveToolInventory(event, ctx) {
  const candidates = [
    { source: 'ctx.availableTools', value: ctx && ctx.availableTools },
    { source: 'ctx.tools', value: ctx && ctx.tools },
    { source: 'ctx.toolNames', value: ctx && ctx.toolNames },
    {
      source: 'ctx.session.availableTools',
      value: ctx && ctx.session && ctx.session.availableTools,
    },
    {
      source: 'ctx.session.tools',
      value: ctx && ctx.session && ctx.session.tools,
    },
    { source: 'event.availableTools', value: event && event.availableTools },
    { source: 'event.tools', value: event && event.tools },
    { source: 'event.toolNames', value: event && event.toolNames },
  ];

  for (const candidate of candidates) {
    const toolNames = toolNamesFromCandidate(candidate.value);
    if (toolNames.length > 0) {
      return {
        source: candidate.source,
        toolNames,
      };
    }
  }

  return null;
}

function collectWrapperExposure(api, input) {
  const requiredToolNames =
    input &&
    Array.isArray(input.requiredToolNames) &&
    input.requiredToolNames.length > 0
      ? uniqueStrings(input.requiredToolNames)
      : WRAPPER_TOOL_NAME_LIST;
  const liveInventory = resolveLiveToolInventory(
    input && input.event,
    input && input.ctx,
  );
  const registrationState = readToolRegistrationState(api);
  const sessionCtx = sessionIdentity((input && input.ctx) || {});
  const sessionRegistrations = hasSessionIdentity(sessionCtx)
    ? registrationState.sessionRegistrations.filter((entry) =>
        sameSessionIdentity(entry, sessionCtx),
      )
    : [];
  const sessionToolNames = uniqueStrings(
    sessionRegistrations
      .map((entry) => readOptionalString(entry.toolName))
      .filter(Boolean),
  );
  const failureMessages = registrationState.failures
    .filter((entry) => requiredToolNames.includes(entry.toolName))
    .map((entry) => `${entry.toolName}: ${entry.message}`);
  const missingFromInventory = liveInventory
    ? requiredToolNames.filter(
        (toolName) => !liveInventory.toolNames.includes(toolName),
      )
    : [];
  const missingFromSession =
    sessionRegistrations.length > 0
      ? requiredToolNames.filter(
          (toolName) => !sessionToolNames.includes(toolName),
        )
      : [];
  let state = 'unknown';
  let known = false;
  let believedAvailable = null;
  let source = 'unknown';
  let note =
    'MandateOS cannot verify from inside the plugin whether OpenClaw exposed the wrapper tools in this live session.';

  if (liveInventory) {
    state = missingFromInventory.length === 0 ? 'available' : 'unavailable';
    known = true;
    believedAvailable = missingFromInventory.length === 0;
    source = 'tool_inventory';
    note =
      missingFromInventory.length === 0
        ? `OpenClaw reported the required wrapper tools in ${liveInventory.source}.`
        : `OpenClaw reported a live tool list in ${liveInventory.source}, but it is missing: ${missingFromInventory.join(', ')}.`;
  } else if (failureMessages.length > 0) {
    state = 'unavailable';
    known = true;
    believedAvailable = false;
    source = 'registration_error';
    note = `MandateOS failed while registering wrapper tools: ${failureMessages.join('; ')}.`;
  } else if (sessionRegistrations.length > 0) {
    state = missingFromSession.length === 0 ? 'available' : 'unavailable';
    known = true;
    believedAvailable = missingFromSession.length === 0;
    source = 'session_registration';
    note =
      missingFromSession.length === 0
        ? 'MandateOS saw the required wrapper tools instantiated for this session.'
        : `MandateOS saw some MandateOS tools instantiated for this session, but not the required wrapper tools: ${missingFromSession.join(', ')}.`;
  } else if (
    requiredToolNames.every((toolName) =>
      registrationState.successfulToolNames.includes(toolName),
    )
  ) {
    believedAvailable = true;
    source = 'plugin_registration';
    note =
      'MandateOS registered the wrapper tools with OpenClaw, but the plugin cannot prove from here that /tools exposed them to this session.';
  }

  return {
    state,
    known,
    believedAvailable,
    source,
    note,
    liveInventorySource: liveInventory ? liveInventory.source : null,
    liveInventoryToolNames: liveInventory ? liveInventory.toolNames : [],
    missingToolNames:
      missingFromInventory.length > 0
        ? missingFromInventory
        : missingFromSession.length > 0
          ? missingFromSession
          : [],
    registrationAttempted: registrationState.attemptedToolNames.length > 0,
    registeredToolNames: registrationState.successfulToolNames.filter(
      (toolName) => WRAPPER_TOOL_NAME_LIST.includes(toolName),
    ),
    registrationFailures: failureMessages,
    sessionRegistrationCount: sessionRegistrations.filter((entry) =>
      WRAPPER_TOOL_NAME_LIST.includes(entry.toolName),
    ).length,
  };
}

function readApprovalStore(api) {
  const storePath = resolveApprovalStorePath(api);
  if (!fs.existsSync(storePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeApprovalStore(api, entries) {
  const storePath = resolveApprovalStorePath(api);
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(entries, null, 2), 'utf8');
}

function pruneEntries(entries) {
  const now = Date.now();
  return entries.filter((entry) => {
    const expiresAt = typeof entry.expiresAt === 'number' ? entry.expiresAt : 0;
    return expiresAt > now;
  });
}

function storeApproval(api, toolName, params, ctx, receiptId, ttlMs) {
  const entries = pruneEntries(readApprovalStore(api));
  const hash = approvalHash(toolName, params, ctx);
  const nextEntry = {
    hash,
    toolName,
    receiptId,
    expiresAt: Date.now() + ttlMs,
  };
  const nextEntries = [
    ...entries.filter(
      (entry) => !(entry.toolName === toolName && entry.hash === hash),
    ),
    nextEntry,
  ];
  writeApprovalStore(api, nextEntries);
  return nextEntry;
}

function consumeApproval(api, toolName, params, ctx) {
  const entries = pruneEntries(readApprovalStore(api));
  const hash = approvalHash(toolName, params, ctx);
  const match = entries.find(
    (entry) => entry.toolName === toolName && entry.hash === hash,
  );
  if (!match) {
    writeApprovalStore(api, entries);
    return null;
  }
  writeApprovalStore(
    api,
    entries.filter(
      (entry) => !(entry.toolName === toolName && entry.hash === hash),
    ),
  );
  return match;
}

function bridgePath() {
  const configuredPath = process.env.MANDATE_OS_OPENCLAW_BRIDGE_PATH;
  if (configuredPath) {
    return configuredPath;
  }

  const runtimeConfig = readRuntimeConfig();
  if (runtimeConfig.bridgeScriptPath) {
    return runtimeConfig.bridgeScriptPath;
  }

  const bundledBridgePath = path.join(__dirname, LOCAL_BRIDGE_FILE);
  return fs.existsSync(bundledBridgePath) ? bundledBridgePath : null;
}

function bridgeEnv() {
  const runtimeConfig = readRuntimeConfig();
  const env = {
    ...process.env,
  };

  if (!env.MANDATE_OS_BASE_URL && runtimeConfig.baseUrl) {
    env.MANDATE_OS_BASE_URL = runtimeConfig.baseUrl;
  }
  if (
    !env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID &&
    runtimeConfig.defaultMandateId
  ) {
    env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID = runtimeConfig.defaultMandateId;
  }
  if (!env.MANDATE_OS_OPENCLAW_DEFAULT_SOURCE && runtimeConfig.defaultSource) {
    env.MANDATE_OS_OPENCLAW_DEFAULT_SOURCE = runtimeConfig.defaultSource;
  }
  if (
    !env.MANDATE_OS_OPENCLAW_UNMATCHED_PERMISSION &&
    runtimeConfig.unmatchedPermission
  ) {
    env.MANDATE_OS_OPENCLAW_UNMATCHED_PERMISSION =
      runtimeConfig.unmatchedPermission;
  }

  return env;
}

function describeSandboxModeSource(source) {
  if (source === 'agent') {
    return 'agent-scoped';
  }
  if (source === 'global_default') {
    return 'global default';
  }
  return 'unset';
}

function compactRecord(value) {
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(([, entryValue]) => {
    return entryValue !== undefined;
  });

  return Object.fromEntries(entries);
}

function statusSnapshot(status) {
  return compactRecord({
    pluginEnabled: status.pluginEnabled,
    pluginAllowed: status.pluginAllowed,
    mcpConfigured: status.mcpConfigured,
    mcpEnabled: status.mcpEnabled,
    bridgeConfigured: status.bridgeConfigured,
    baseUrlConfigured: status.baseUrlConfigured,
    runtimeTokenAvailable: status.runtimeTokenAvailable,
    effectiveSandboxMode: status.effectiveSandboxMode || null,
    sandboxModeScope: status.sandboxModeScope,
    wrapperToolNames: status.wrapperToolNames,
    wrapperToolExposureState: status.wrapperToolExposureState,
    wrapperToolExposureKnown: status.wrapperToolExposureKnown,
    wrapperToolsBelievedAvailable: status.wrapperToolsBelievedAvailable,
    wrapperToolExposureSource: status.wrapperToolExposureSource,
  });
}

function statusFactsText(status) {
  return (
    `plugin enabled=${status.pluginEnabled}, ` +
    `MCP enabled=${status.mcpEnabled}, ` +
    `bridge configured=${status.bridgeConfigured}, ` +
    `base URL configured=${status.baseUrlConfigured}, ` +
    `runtime token available=${status.runtimeTokenAvailable}, ` +
    `effective sandbox mode=${status.effectiveSandboxMode || 'unset'} ` +
    `(${status.sandboxModeScope}), ` +
    `wrapper exposure=${status.wrapperToolExposureState}`
  );
}

function classifyNativeBlockProblem(status) {
  if (
    !status.pluginEnabled ||
    !status.mcpConfigured ||
    !status.mcpEnabled ||
    !status.bridgeConfigured ||
    !status.runtimeConfigAvailable ||
    !status.baseUrlConfigured ||
    !status.runtimeTokenAvailable
  ) {
    return {
      category: 'misconfigured',
      code: 'install_repair_problem',
      label: 'install/repair problem',
    };
  }

  if (!status.guardedAgentConfigured || !status.effectiveSandboxMode) {
    return {
      category: 'misconfigured',
      code: 'sandbox_misconfiguration',
      label: 'sandbox problem',
    };
  }

  if (status.wrapperToolExposureState === 'unavailable') {
    return {
      category: 'integration_problem',
      code: 'wrapper_unavailable',
      label: 'wrapper unavailable / integration misconfigured',
    };
  }

  return {
    category: 'approval_missing',
    code: 'approval_missing',
    label: 'approval missing',
  };
}

function createNativeBlockDetails(api, toolName, wrapperTool, event, ctx) {
  const status = collectStatus(api, {
    event,
    ctx,
    requiredToolNames: [wrapperTool],
  });
  const problem = classifyNativeBlockProblem(status);
  const summary =
    problem.code === 'approval_missing'
      ? `MandateOS blocked native ${toolName} because this exact call does not have an active wrapper approval yet.`
      : problem.code === 'wrapper_unavailable'
        ? `MandateOS blocked native ${toolName}, but the required wrapper tool ${wrapperTool} does not appear to be available in this OpenClaw session.`
        : problem.code === 'sandbox_misconfiguration'
          ? `MandateOS blocked native ${toolName} and the guarded agent sandbox state looks incomplete for this workspace.`
          : `MandateOS blocked native ${toolName} and the OpenClaw integration looks partially configured.`;
  const nextStep =
    problem.code === 'approval_missing'
      ? `Call ${wrapperTool} with the exact same parameters, wait for approval, then retry the native ${toolName} tool.`
      : problem.code === 'wrapper_unavailable'
        ? `This is an integration/runtime exposure issue, not a normal approval block. If /tools in this session does not list ${wrapperTool}, restart or repair the OpenClaw integration, then retry. Use mandateos_openclaw_get_context if it is available, or run mandate-os-openclaw-install status/repair outside the session.`
        : problem.code === 'sandbox_misconfiguration'
          ? `Run mandateos_openclaw_get_context, confirm mandateos_guarded has the intended agent-scoped sandbox mode for this workspace, then retry via ${wrapperTool}.`
          : `Run mandateos_openclaw_get_context, confirm plugin/MCP/bridge/base URL/token are all configured, repair the workspace if needed, then retry via ${wrapperTool}.`;
  const reason = [
    summary,
    `Issue type: ${problem.label}.`,
    `Try this next: ${nextStep}`,
    `Status: ${statusFactsText(status)}.`,
    'Run mandateos_openclaw_get_context for the full MandateOS state and last denial details.',
  ].join(' ');

  return {
    timestamp: new Date().toISOString(),
    source: 'plugin',
    toolName,
    wrapperTool,
    decision: 'redirect_enforced',
    permission: 'deny',
    category: problem.category,
    code: problem.code,
    summary,
    nextStep,
    reason,
    status: statusSnapshot(status),
    wrapperToolExposureNote: status.wrapperToolExposureNote,
    wrapperToolsMissing: status.wrapperToolsMissing,
  };
}

function classifyEvaluationDenial(api, result) {
  if (result.decision === 'policy_blocked') {
    return {
      category: 'blocked_by_policy',
      code: 'policy_block',
      label: 'policy block',
    };
  }

  if (result.decision === 'policy_approval') {
    return {
      category: 'approval_required',
      code: 'approval_required',
      label: 'approval required',
    };
  }

  if (result.decision === 'unmatched') {
    return {
      category: 'misconfigured',
      code: 'policy_unmatched',
      label: 'policy classification gap',
    };
  }

  if (result.decision === 'misconfigured') {
    const status = collectStatus(api);
    if (!status.guardedAgentConfigured || !status.effectiveSandboxMode) {
      return {
        category: 'misconfigured',
        code: 'sandbox_misconfiguration',
        label: 'sandbox problem',
      };
    }
    return {
      category: 'misconfigured',
      code: 'install_repair_problem',
      label: 'install/repair problem',
    };
  }

  return null;
}

function createEvaluationDenial(api, toolName, payload, result) {
  const problem = classifyEvaluationDenial(api, result);

  if (!problem) {
    return null;
  }

  const status = collectStatus(api);
  const summary =
    result.userMessage ||
    result.agentMessage ||
    `MandateOS returned ${result.decision}.`;
  const nextStep =
    problem.code === 'policy_block'
      ? 'Do not retry the native action directly. Change the plan or policy, then evaluate again.'
      : problem.code === 'approval_required'
        ? 'Request approval in MandateOS, then rerun this wrapper tool with the same parameters.'
        : problem.code === 'sandbox_misconfiguration'
          ? 'Run mandateos_openclaw_get_context, confirm the guarded agent sandbox settings for this workspace, then retry.'
          : problem.code === 'policy_unmatched'
            ? 'Call mandateos_openclaw_evaluate_action explicitly or add a matching MandateOS rule before retrying.'
            : 'Run mandateos_openclaw_get_context, confirm bridge/base URL/token/mandate configuration, repair if needed, then retry.';
  const reason = [
    summary,
    `Issue type: ${problem.label}.`,
    `Try this next: ${nextStep}`,
    `Status: ${statusFactsText(status)}.`,
  ].join(' ');

  return compactRecord({
    timestamp: new Date().toISOString(),
    source: 'bridge',
    toolName,
    channel: payload.channel,
    subject: payload.subject,
    decision: result.decision,
    permission: result.permission,
    category: problem.category,
    code: problem.code,
    summary,
    nextStep,
    reason,
    recommendedTool: result.recommendedTool || null,
    ruleId: result.ruleId || null,
    route: result.route || null,
    receiptId: result.receipt ? result.receipt.id : null,
    status: statusSnapshot(status),
  });
}

function collectStatus(api, runtimeInput) {
  const runtimeConfig = readRuntimeConfig();
  const config = readOpenClawConfig(api);
  const statusStore = readStatusStore(api);
  const identifiers = resolveRuntimeIdentifiers();
  const pluginEntry =
    config.plugins &&
    config.plugins.entries &&
    config.plugins.entries[identifiers.identifier];
  const pluginAllow =
    config.plugins && Array.isArray(config.plugins.allow)
      ? config.plugins.allow
      : null;
  const mcpEntry =
    config.mcp &&
    config.mcp.servers &&
    config.mcp.servers[identifiers.identifier];
  const guardedAgent =
    config.agents && Array.isArray(config.agents.list)
      ? config.agents.list.find(
          (agent) => agent.id === identifiers.guardedAgentId,
        )
      : null;
  const guardedSandbox =
    guardedAgent && isRecord(guardedAgent.sandbox)
      ? guardedAgent.sandbox
      : null;
  const guardedBrowser =
    guardedSandbox && isRecord(guardedSandbox.browser)
      ? guardedSandbox.browser
      : null;
  const guardedTools =
    guardedAgent && isRecord(guardedAgent.tools) ? guardedAgent.tools : null;
  const guardedExec =
    guardedTools && isRecord(guardedTools.exec) ? guardedTools.exec : null;
  const globalDefaults =
    config.agents && isRecord(config.agents.defaults)
      ? config.agents.defaults
      : null;
  const globalSandbox =
    globalDefaults && isRecord(globalDefaults.sandbox)
      ? globalDefaults.sandbox
      : null;
  const agentSandboxMode = readOptionalString(
    guardedSandbox && guardedSandbox.mode,
  );
  const globalDefaultsSandboxMode = readOptionalString(
    globalSandbox && globalSandbox.mode,
  );
  const effectiveSandboxMode = agentSandboxMode || globalDefaultsSandboxMode;
  const sandboxModeSource = agentSandboxMode
    ? 'agent'
    : globalDefaultsSandboxMode
      ? 'global_default'
      : 'unset';
  const wrapperExposure = collectWrapperExposure(api, runtimeInput);

  return {
    identifier: identifiers.identifier,
    guardedAgentId: identifiers.guardedAgentId,
    pluginEnabled: pluginEntry ? pluginEntry.enabled === true : false,
    pluginAllowed: pluginAllow
      ? pluginAllow.includes('*') ||
        pluginAllow.includes(identifiers.identifier)
      : true,
    pluginAllowListPresent: Boolean(pluginAllow),
    mcpConfigured: Boolean(mcpEntry),
    mcpEnabled: Boolean(mcpEntry) && mcpEntry.enabled !== false,
    bridgeConfigured: Boolean(bridgePath()),
    bridgeScriptPath: bridgePath(),
    runtimeConfigAvailable: fs.existsSync(
      path.join(__dirname, RUNTIME_CONFIG_FILE),
    ),
    baseUrlConfigured: Boolean(bridgeEnv().MANDATE_OS_BASE_URL),
    runtimeTokenAvailable: Boolean(process.env.MANDATE_OS_AGENT_TOKEN),
    bearerTokenConfigured: Boolean(process.env.MANDATE_OS_AGENT_TOKEN),
    bridgeDefaultSource: readOptionalString(runtimeConfig.defaultSource),
    bridgeUnmatchedPermission:
      readOptionalString(runtimeConfig.unmatchedPermission) || 'ask',
    defaultMandateIdConfigured: Boolean(
      readOptionalString(runtimeConfig.defaultMandateId) ||
        readOptionalString(bridgeEnv().MANDATE_OS_MCP_DEFAULT_MANDATE_ID),
    ),
    guardedAgentConfigured: Boolean(guardedAgent),
    agentSandboxMode,
    effectiveSandboxMode,
    sandboxModeSource,
    sandboxModeScope: describeSandboxModeSource(sandboxModeSource),
    globalDefaultsSandboxMode,
    agentWorkspaceAccess: readOptionalString(
      guardedSandbox && guardedSandbox.workspaceAccess,
    ),
    agentBrowserEnabled: readOptionalBoolean(
      guardedBrowser && guardedBrowser.enabled,
    ),
    agentExecHost: readOptionalString(guardedExec && guardedExec.host),
    runtimePluginLoaded: Boolean(
      readOptionalString(statusStore.pluginLoadedAt),
    ),
    pluginLoadedAt: readOptionalString(statusStore.pluginLoadedAt),
    wrapperToolNames:
      runtimeInput &&
      Array.isArray(runtimeInput.requiredToolNames) &&
      runtimeInput.requiredToolNames.length > 0
        ? uniqueStrings(runtimeInput.requiredToolNames)
        : WRAPPER_TOOL_NAME_LIST,
    wrapperRegistrationAttempted: wrapperExposure.registrationAttempted,
    wrapperRegisteredToolNames: wrapperExposure.registeredToolNames,
    wrapperRegistrationFailures: wrapperExposure.registrationFailures,
    wrapperSessionRegistrationCount: wrapperExposure.sessionRegistrationCount,
    wrapperToolExposureKnown: wrapperExposure.known,
    wrapperToolsBelievedAvailable: wrapperExposure.believedAvailable,
    wrapperToolExposureState: wrapperExposure.state,
    wrapperToolExposureSource: wrapperExposure.source,
    wrapperToolExposureNote: wrapperExposure.note,
    wrapperToolsVisibleInContext: wrapperExposure.liveInventoryToolNames,
    wrapperToolsMissing: wrapperExposure.missingToolNames,
    configPath: path.join(resolveStateDir(api), 'openclaw.json'),
  };
}

function summarizeResult(result) {
  return (
    result.agentMessage ||
    result.userMessage ||
    `MandateOS returned ${result.decision}.`
  );
}

function recordEvaluation(api, toolName, payload, result) {
  const entry = {
    timestamp: new Date().toISOString(),
    toolName,
    channel: payload.channel,
    subject: payload.subject,
    decision: result.decision,
    permission: result.permission,
    recommendedTool: result.recommendedTool || null,
    reason: summarizeResult(result),
    receiptId: result.receipt ? result.receipt.id : null,
  };
  const denial = createEvaluationDenial(api, toolName, payload, result);

  updateStatusStore(api, {
    lastEvaluation: entry,
    ...(denial
      ? {
          lastDenial: denial,
        }
      : {}),
  });
}

function recordNativeBlock(api, denial) {
  updateStatusStore(api, {
    lastNativeBlock: denial,
    lastDenial: denial,
  });
}

function evaluateWithStatus(api, toolName, payload) {
  try {
    const result = runBridgeEvaluate(payload);
    recordEvaluation(api, toolName, payload, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = {
      permission: 'deny',
      decision: 'misconfigured',
      userMessage:
        'MandateOS could not evaluate this action because the OpenClaw bridge is unavailable or misconfigured.',
      agentMessage: `MandateOS bridge evaluation failed for ${toolName}. ${message}`,
    };
    recordEvaluation(api, toolName, payload, result);
    return result;
  }
}

function runBridgeEvaluate(payload) {
  const bridge = bridgePath();
  if (!bridge) {
    throw new Error(
      'MANDATE_OS_OPENCLAW_BRIDGE_PATH is missing. Re-run the MandateOS OpenClaw installer.',
    );
  }
  const result = spawnSync(process.execPath, [bridge, 'evaluate'], {
    encoding: 'utf8',
    env: bridgeEnv(),
    input: JSON.stringify(payload),
    maxBuffer: 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (!result.stdout) {
    throw new Error(
      result.stderr || 'MandateOS OpenClaw bridge returned no output.',
    );
  }
  return JSON.parse(result.stdout);
}

function buildTextResult(text, details) {
  return {
    content: [{ type: 'text', text }],
    details,
  };
}

function buildDecisionText(result) {
  if (result.decision === 'policy_blocked') {
    const summary =
      result.userMessage ||
      result.agentMessage ||
      'MandateOS blocked this action.';
    return `${summary} Try this next: choose a different action or adjust policy before retrying.`;
  }
  if (result.decision === 'policy_approval') {
    const summary =
      result.userMessage ||
      result.agentMessage ||
      'MandateOS requires approval before this action can continue.';
    return `${summary} Try this next: get approval in MandateOS, then rerun this wrapper tool with the same parameters.`;
  }
  if (result.decision === 'misconfigured') {
    const summary =
      result.userMessage ||
      result.agentMessage ||
      'MandateOS is misconfigured.';
    return `${summary} Try this next: run mandateos_openclaw_get_context, verify bridge/base URL/token/mandate setup, repair if needed, then retry.`;
  }
  if (result.decision === 'unmatched') {
    const summary =
      result.userMessage ||
      result.agentMessage ||
      'MandateOS could not classify this action automatically.';
    return `${summary} Try this next: call mandateos_openclaw_evaluate_action explicitly or add a matching MandateOS rule.`;
  }
  return (
    result.agentMessage ||
    result.userMessage ||
    'MandateOS evaluated this action.'
  );
}

function wrapperAllowsNativeTool(result, wrapperName) {
  return (
    result.decision === 'policy_allowed' ||
    (result.decision === 'redirect_enforced' &&
      result.recommendedTool === wrapperName)
  );
}

function registerMandateTool(api, toolName, tool) {
  recordToolRegistrationAttempt(api, toolName);
  try {
    api.registerTool(tool, { optional: true });
    recordToolRegistrationSuccess(api, toolName);
  } catch (error) {
    recordToolRegistrationFailure(api, toolName, error);
    throw error;
  }
}

function createEvaluateTool(api, toolCtx) {
  recordToolSessionRegistration(
    api,
    'mandateos_openclaw_evaluate_action',
    toolCtx,
  );
  return {
    name: 'mandateos_openclaw_evaluate_action',
    label: 'MandateOS Evaluate Action',
    description:
      'Evaluate an OpenClaw action through MandateOS without executing it.',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        subject: { type: 'string' },
        context: { type: 'object', additionalProperties: true },
        details: { type: 'object', additionalProperties: true },
        mandateId: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['channel', 'subject'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params) {
      const payload = {
        channel: params.channel,
        subject: params.subject,
        context: params.context || {},
        details: params.details || {},
        mandateId: params.mandateId,
        source: params.source,
        host: 'openclaw',
      };
      const result = evaluateWithStatus(
        api,
        'mandateos_openclaw_evaluate_action',
        payload,
      );
      return buildTextResult(buildDecisionText(result), result);
    },
  };
}

function createContextTool(api, toolCtx) {
  recordToolSessionRegistration(api, 'mandateos_openclaw_get_context', toolCtx);
  return {
    name: 'mandateos_openclaw_get_context',
    label: 'MandateOS OpenClaw Context',
    description:
      'Return the OpenClaw wrapper tool names and whether the MandateOS bridge environment is configured.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    async execute() {
      const status = collectStatus(api, {
        ctx: toolCtx || {},
      });
      const lastDenial = readStatusStore(api).lastDenial || null;
      const details = {
        wrappers: WRAPPER_TOOL_NAMES,
        ...status,
        ...readStatusStore(api),
        lastDenialReason:
          lastDenial && lastDenial.reason ? lastDenial.reason : null,
      };
      const lastDenialText =
        lastDenial && lastDenial.code
          ? ` Last denial: ${lastDenial.code}.`
          : '';
      return buildTextResult(
        `MandateOS OpenClaw status: ${statusFactsText(status)}, unmatched permission=${status.bridgeUnmatchedPermission}. ${status.wrapperToolExposureNote}${lastDenialText}`,
        details,
      );
    },
  };
}

function createExecWrapperTool(api, toolCtx) {
  recordToolSessionRegistration(api, WRAPPER_TOOL_NAMES.exec, toolCtx);
  return {
    name: WRAPPER_TOOL_NAMES.exec,
    label: 'MandateOS OpenClaw Exec',
    description:
      'Evaluate a shell command through MandateOS and approve the exact next OpenClaw exec call if allowed.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        workdir: { type: 'string' },
        env: { type: 'object', additionalProperties: { type: 'string' } },
        yieldMs: { type: 'number' },
        background: { type: 'boolean' },
        timeout: { type: 'number' },
        pty: { type: 'boolean' },
        elevated: { type: 'boolean' },
        host: { type: 'string' },
        security: { type: 'string' },
        ask: { type: 'string' },
        node: { type: 'string' },
        mandateId: { type: 'string' },
        source: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
        approvalTtlSeconds: { type: 'number' },
      },
      required: ['command'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params) {
      const execParams = {
        command: params.command,
        ...(params.workdir ? { workdir: params.workdir } : {}),
        ...(params.env ? { env: params.env } : {}),
        ...(typeof params.yieldMs === 'number'
          ? { yieldMs: params.yieldMs }
          : {}),
        ...(typeof params.background === 'boolean'
          ? { background: params.background }
          : {}),
        ...(typeof params.timeout === 'number'
          ? { timeout: params.timeout }
          : {}),
        ...(typeof params.pty === 'boolean' ? { pty: params.pty } : {}),
        ...(typeof params.elevated === 'boolean'
          ? { elevated: params.elevated }
          : {}),
        ...(params.host ? { host: params.host } : {}),
        ...(params.security ? { security: params.security } : {}),
        ...(params.ask ? { ask: params.ask } : {}),
        ...(params.node ? { node: params.node } : {}),
      };
      const payload = {
        channel: 'shell',
        subject: params.command,
        context: {
          command: params.command,
          cwd: params.workdir || null,
        },
        details: {
          cwd: params.workdir || null,
          ...(params.details || {}),
        },
        mandateId: params.mandateId,
        source: params.source,
        host: 'openclaw',
      };
      const result = evaluateWithStatus(api, WRAPPER_TOOL_NAMES.exec, payload);
      const denial = createEvaluationDenial(
        api,
        WRAPPER_TOOL_NAMES.exec,
        payload,
        result,
      );

      if (!wrapperAllowsNativeTool(result, WRAPPER_TOOL_NAMES.exec)) {
        return buildTextResult(buildDecisionText(result), {
          ...result,
          ...(denial ? { denial } : {}),
        });
      }

      recordWrapperCall(api, WRAPPER_TOOL_NAMES.exec, toolCtx || {});
      const approval = storeApproval(
        api,
        'exec',
        execParams,
        toolCtx || {},
        result.receipt ? result.receipt.id : null,
        (typeof params.approvalTtlSeconds === 'number' &&
        params.approvalTtlSeconds > 0
          ? params.approvalTtlSeconds
          : APPROVAL_TTL_MS / 1000) * 1000,
      );

      return buildTextResult(
        `MandateOS approved this command. Call the native exec tool next with the exact same parameters before the approval expires.`,
        {
          approved: true,
          nextTool: 'exec',
          nextArgs: execParams,
          approval,
          evaluation: result,
        },
      );
    },
  };
}

function createBrowserMutateWrapperTool(api, toolCtx) {
  recordToolSessionRegistration(api, WRAPPER_TOOL_NAMES.browser, toolCtx);
  return {
    name: WRAPPER_TOOL_NAMES.browser,
    label: 'MandateOS Browser Mutate',
    description:
      'Evaluate a mutating browser action through MandateOS and approve the exact next native browser call if allowed.',
    parameters: {
      type: 'object',
      properties: {
        params: { type: 'object', additionalProperties: true },
        mandateId: { type: 'string' },
        source: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
        approvalTtlSeconds: { type: 'number' },
      },
      required: ['params'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params) {
      const browserParams = params.params || {};
      const browserAction = normalizeBrowserAction(browserParams);
      const payload = {
        channel: 'browser',
        subject: browserAction,
        context: {
          browserAction,
        },
        details: params.details || {},
        mandateId: params.mandateId,
        source: params.source,
        host: 'openclaw',
      };
      const result = evaluateWithStatus(
        api,
        WRAPPER_TOOL_NAMES.browser,
        payload,
      );
      const denial = createEvaluationDenial(
        api,
        WRAPPER_TOOL_NAMES.browser,
        payload,
        result,
      );

      if (!wrapperAllowsNativeTool(result, WRAPPER_TOOL_NAMES.browser)) {
        return buildTextResult(buildDecisionText(result), {
          ...result,
          ...(denial ? { denial } : {}),
        });
      }

      recordWrapperCall(api, WRAPPER_TOOL_NAMES.browser, toolCtx || {});
      const approval = storeApproval(
        api,
        'browser',
        browserParams,
        toolCtx || {},
        result.receipt ? result.receipt.id : null,
        (typeof params.approvalTtlSeconds === 'number' &&
        params.approvalTtlSeconds > 0
          ? params.approvalTtlSeconds
          : APPROVAL_TTL_MS / 1000) * 1000,
      );

      return buildTextResult(
        'MandateOS approved this browser mutation. Call the native browser tool next with the exact same params.',
        {
          approved: true,
          nextTool: 'browser',
          nextArgs: browserParams,
          approval,
          evaluation: result,
        },
      );
    },
  };
}

function createSpawnWrapperTool(api, toolCtx) {
  recordToolSessionRegistration(
    api,
    WRAPPER_TOOL_NAMES.sessions_spawn,
    toolCtx,
  );
  return {
    name: WRAPPER_TOOL_NAMES.sessions_spawn,
    label: 'MandateOS Spawn Agent',
    description:
      'Evaluate a sub-agent spawn through MandateOS and approve the exact next native sessions_spawn call if allowed.',
    parameters: {
      type: 'object',
      properties: {
        params: { type: 'object', additionalProperties: true },
        mandateId: { type: 'string' },
        source: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
        approvalTtlSeconds: { type: 'number' },
      },
      required: ['params'],
      additionalProperties: false,
    },
    async execute(_toolCallId, params) {
      const spawnParams = params.params || {};
      const payload = {
        channel: 'agent',
        subject: 'sessions_spawn',
        context: {
          message:
            typeof spawnParams.message === 'string' ? spawnParams.message : '',
        },
        details: params.details || {},
        mandateId: params.mandateId,
        source: params.source,
        host: 'openclaw',
      };
      const result = evaluateWithStatus(
        api,
        WRAPPER_TOOL_NAMES.sessions_spawn,
        payload,
      );
      const denial = createEvaluationDenial(
        api,
        WRAPPER_TOOL_NAMES.sessions_spawn,
        payload,
        result,
      );

      if (!wrapperAllowsNativeTool(result, WRAPPER_TOOL_NAMES.sessions_spawn)) {
        return buildTextResult(buildDecisionText(result), {
          ...result,
          ...(denial ? { denial } : {}),
        });
      }

      recordWrapperCall(api, WRAPPER_TOOL_NAMES.sessions_spawn, toolCtx || {});
      const approval = storeApproval(
        api,
        'sessions_spawn',
        spawnParams,
        toolCtx || {},
        result.receipt ? result.receipt.id : null,
        (typeof params.approvalTtlSeconds === 'number' &&
        params.approvalTtlSeconds > 0
          ? params.approvalTtlSeconds
          : APPROVAL_TTL_MS / 1000) * 1000,
      );

      return buildTextResult(
        'MandateOS approved this sub-agent spawn. Call the native sessions_spawn tool next with the exact same params.',
        {
          approved: true,
          nextTool: 'sessions_spawn',
          nextArgs: spawnParams,
          approval,
          evaluation: result,
        },
      );
    },
  };
}

module.exports = {
  id: 'mandateos',
  name: 'MandateOS',
  description: 'MandateOS guardrails for OpenClaw tool calls.',
  register(api) {
    recordPluginLoaded(api);
    registerMandateTool(api, 'mandateos_openclaw_get_context', (toolCtx) =>
      createContextTool(api, toolCtx),
    );
    registerMandateTool(api, 'mandateos_openclaw_evaluate_action', (toolCtx) =>
      createEvaluateTool(api, toolCtx),
    );
    registerMandateTool(api, WRAPPER_TOOL_NAMES.exec, (toolCtx) =>
      createExecWrapperTool(api, toolCtx),
    );
    registerMandateTool(api, WRAPPER_TOOL_NAMES.browser, (toolCtx) =>
      createBrowserMutateWrapperTool(api, toolCtx),
    );
    registerMandateTool(api, WRAPPER_TOOL_NAMES.sessions_spawn, (toolCtx) =>
      createSpawnWrapperTool(api, toolCtx),
    );

    if (typeof api.on === 'function') {
      api.on('before_tool_call', (event, ctx) => {
        if (
          !event ||
          !event.toolName ||
          String(event.toolName).startsWith('mandateos_')
        ) {
          return;
        }

        if (event.toolName === 'exec') {
          const command =
            typeof event.params.command === 'string'
              ? event.params.command
              : '';
          if (isReadOnlyShellCommand(command)) {
            return;
          }
          const approval = consumeApproval(
            api,
            'exec',
            event.params,
            ctx || {},
          );
          if (approval) {
            return;
          }
          const denial = createNativeBlockDetails(
            api,
            'exec',
            WRAPPER_TOOL_NAMES.exec,
            event,
            ctx || {},
          );
          recordNativeBlock(api, denial);
          return {
            block: true,
            blockReason: denial.reason,
            mandateOsDenial: denial,
          };
        }

        if (event.toolName === 'browser') {
          if (!isBrowserMutation(event.params)) {
            return;
          }
          const approval = consumeApproval(
            api,
            'browser',
            event.params,
            ctx || {},
          );
          if (approval) {
            return;
          }
          const denial = createNativeBlockDetails(
            api,
            'browser',
            WRAPPER_TOOL_NAMES.browser,
            event,
            ctx || {},
          );
          recordNativeBlock(api, denial);
          return {
            block: true,
            blockReason: denial.reason,
            mandateOsDenial: denial,
          };
        }

        if (event.toolName === 'sessions_spawn') {
          const approval = consumeApproval(
            api,
            'sessions_spawn',
            event.params,
            ctx || {},
          );
          if (approval) {
            return;
          }
          const denial = createNativeBlockDetails(
            api,
            'sessions_spawn',
            WRAPPER_TOOL_NAMES.sessions_spawn,
            event,
            ctx || {},
          );
          recordNativeBlock(api, denial);
          return {
            block: true,
            blockReason: denial.reason,
            mandateOsDenial: denial,
          };
        }
      });
    }
  },
};
