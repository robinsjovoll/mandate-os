import { readFileSync } from 'node:fs';

import {
  type RuntimeSimulationBatch,
  type ReceiptRecord,
  MandateOsAgentClient,
  MandateOsPolicyGateway,
  defaultHostGatewayRules,
  isMandateOsToolName,
  isReadOnlyShellCommand,
  normalizeMcpToolName,
  normalizeOptionalText,
  normalizePermission,
  parsePolicyGatewayRules,
  splitCommaSeparatedList,
  summarizeJson,
  type ActionScenario,
  type MandateOsPolicyGatewayRule,
  type PolicyGatewayChannel,
  type PolicyGatewayPermission,
  type PolicyGatewayRoute,
} from '@mandate-os/sdk';

import { resolveMandateOsRuntimeFileReference } from './runtime-command.js';

export type HostGatewayPermission = PolicyGatewayPermission;
export type HostGatewayChannel = Extract<PolicyGatewayChannel, 'shell' | 'mcp'>;
export type HostGatewayRoute = PolicyGatewayRoute;

export type MandateOsHostGatewayRule = Omit<
  MandateOsPolicyGatewayRule,
  'channel' | 'route'
> & {
  channel: HostGatewayChannel;
  route?: HostGatewayRoute;
};

export type MandateOsHostGatewayOptions = {
  client: Pick<MandateOsAgentClient, 'evaluateActions'>;
  defaultMandateId?: string;
  defaultSource?: string;
  hostName?: string;
  unmatchedPermission?: HostGatewayPermission;
  rules?: MandateOsHostGatewayRule[];
};

export type ShellGatewayInput = {
  command: string;
  cwd?: string | null;
  sandbox?: boolean;
  mandateId?: string;
  source?: string;
  details?: Record<string, unknown>;
  host?: string;
};

export type McpGatewayInput = {
  toolName: string;
  toolInput?: unknown;
  serverCommand?: string | null;
  serverUrl?: string | null;
  mandateId?: string;
  source?: string;
  details?: Record<string, unknown>;
  host?: string;
};

export type HostGatewayDecision =
  | 'local_allow'
  | 'policy_allowed'
  | 'policy_approval'
  | 'policy_blocked'
  | 'redirect_enforced'
  | 'unmatched'
  | 'misconfigured';

export type HostGatewayEvaluationResult = {
  permission: HostGatewayPermission;
  decision: HostGatewayDecision;
  ruleId?: string;
  route?: HostGatewayRoute;
  action?: ActionScenario;
  receipt?: ReceiptRecord;
  evaluation?: RuntimeSimulationBatch;
  userMessage?: string;
  agentMessage?: string;
  recommendedTool?: string;
};

export class MandateOsHostGateway {
  private readonly gateway: MandateOsPolicyGateway;

  constructor(private readonly options: MandateOsHostGatewayOptions) {
    this.gateway = new MandateOsPolicyGateway({
      client: options.client,
      defaultMandateId: options.defaultMandateId,
      defaultSource: options.defaultSource,
      hostName: options.hostName || 'host-gateway',
      unmatchedPermission: options.unmatchedPermission,
      rules: [...(options.rules || []), ...defaultHostGatewayRules],
    });
  }

  async evaluateShellCommand(
    input: ShellGatewayInput,
  ): Promise<HostGatewayEvaluationResult> {
    const command = input.command.trim();

    if (!command) {
      return {
        permission: 'allow',
        decision: 'local_allow',
      };
    }

    if (isReadOnlyShellCommand(command)) {
      return {
        permission: 'allow',
        decision: 'local_allow',
      };
    }

    return toHostGatewayResult(
      await this.gateway.evaluateAttempt({
        channel: 'shell',
        subject: command,
        mandateId: input.mandateId,
        source: input.source,
        host: input.host,
        details: {
          cwd: input.cwd || null,
          sandbox: input.sandbox ?? null,
          ...input.details,
        },
        context: {
          command,
          cwd: input.cwd || null,
        },
      }),
    );
  }

  async evaluateMcpToolCall(
    input: McpGatewayInput,
  ): Promise<HostGatewayEvaluationResult> {
    const toolName = normalizeMcpToolName(input.toolName);

    if (!toolName || isMandateOsToolName(toolName)) {
      return {
        permission: 'allow',
        decision: 'local_allow',
      };
    }
    return toHostGatewayResult(
      await this.gateway.evaluateAttempt({
        channel: 'mcp',
        subject: toolName,
        mandateId: input.mandateId,
        source: input.source,
        host: input.host,
        details: {
          serverCommand: input.serverCommand || null,
          serverUrl: input.serverUrl || null,
          ...input.details,
        },
        context: {
          toolName,
          toolInputText: summarizeJson(input.toolInput),
          serverCommand: input.serverCommand || null,
          serverUrl: input.serverUrl || null,
        },
      }),
    );
  }
}

export function createMandateOsHostGateway(
  options: MandateOsHostGatewayOptions,
) {
  return new MandateOsHostGateway(options);
}

export function parseHostGatewayRules(
  input: unknown,
): MandateOsHostGatewayRule[] {
  return parsePolicyGatewayRules(input) as MandateOsHostGatewayRule[];
}

export function readHostGatewayRulesFromEnv(
  env: NodeJS.ProcessEnv = process.env,
) {
  const fromEnv = normalizeOptionalText(env.MANDATE_OS_HOST_GATEWAY_RULES_JSON);
  const fromFile = normalizeOptionalText(
    env.MANDATE_OS_HOST_GATEWAY_RULES_FILE,
  );
  const fromFiles = splitCommaSeparatedList(
    normalizeOptionalText(env.MANDATE_OS_HOST_GATEWAY_RULES_FILES),
  );
  const parsedRules: MandateOsHostGatewayRule[] = [];

  for (const filePath of [...fromFiles, ...(fromFile ? [fromFile] : [])]) {
    parsedRules.push(
      ...parseHostGatewayRules(
        JSON.parse(
          readFileSync(resolveMandateOsRuntimeFileReference(filePath), 'utf8'),
        ),
      ),
    );
  }

  if (fromEnv) {
    parsedRules.push(...parseHostGatewayRules(JSON.parse(fromEnv)));
  }

  return parsedRules;
}

export function readHostGatewayUnmatchedPermission(
  env: NodeJS.ProcessEnv = process.env,
) {
  return normalizePermission(
    normalizeOptionalText(env.MANDATE_OS_HOST_GATEWAY_UNMATCHED_PERMISSION) ||
      'ask',
    'ask',
  );
}

export function toCursorHookResponse(result: HostGatewayEvaluationResult) {
  return {
    continue: true,
    permission: result.permission,
    ...(result.userMessage
      ? {
          user_message: result.userMessage,
        }
      : {}),
    ...(result.agentMessage
      ? {
          agent_message: result.agentMessage,
        }
      : {}),
  };
}

export function toClaudeHookResponse(result: HostGatewayEvaluationResult) {
  const reason = result.agentMessage || result.userMessage;

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: result.permission,
      ...(reason
        ? {
            permissionDecisionReason: reason,
          }
        : {}),
    },
  };
}

export function toCodexHookResponse(result: HostGatewayEvaluationResult) {
  const reason = result.agentMessage || result.userMessage;
  const permissionDecision = result.permission === 'allow' ? 'allow' : 'deny';

  return {
    ...(reason
      ? {
          systemMessage: reason,
        }
      : {}),
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      ...(reason
        ? {
            permissionDecisionReason: reason,
          }
        : {}),
    },
  };
}

function toHostGatewayResult(
  result: Omit<HostGatewayEvaluationResult, 'route'> & {
    route?: PolicyGatewayRoute;
  },
): HostGatewayEvaluationResult {
  return {
    ...result,
    route: result.route as HostGatewayRoute | undefined,
  };
}
