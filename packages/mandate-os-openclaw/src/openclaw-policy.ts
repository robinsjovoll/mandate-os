import {
  MandateOsAgentClient,
  MandateOsPolicyGateway,
  defaultHostGatewayRules,
  isMandateOsToolName,
  isReadOnlyShellCommand,
  normalizeMcpToolName,
  openClawPolicyGatewayRules,
  type PolicyGatewayAttempt,
  type PolicyGatewayEvaluationResult,
  type PolicyGatewayPermission,
} from '@mandate-os/sdk';

export type MandateOsOpenClawBridgeConfig = {
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource?: string;
  unmatchedPermission?: PolicyGatewayPermission;
  hostName?: string;
  client?: Pick<MandateOsAgentClient, 'evaluateActions'>;
};

export function readMandateOsOpenClawBridgeConfig(
  env: NodeJS.ProcessEnv = process.env,
): MandateOsOpenClawBridgeConfig {
  const baseUrl = env.MANDATE_OS_BASE_URL?.trim();
  const bearerToken = env.MANDATE_OS_AGENT_TOKEN?.trim();

  if (!baseUrl) {
    throw new Error(
      'MANDATE_OS_BASE_URL is required for OpenClaw bridge execution.',
    );
  }

  if (!bearerToken) {
    throw new Error(
      'MANDATE_OS_AGENT_TOKEN is required in the OpenClaw runtime environment.',
    );
  }

  return {
    baseUrl,
    bearerToken,
    defaultMandateId:
      env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID?.trim() ||
      env.MANDATE_OS_DEFAULT_MANDATE_ID?.trim() ||
      undefined,
    defaultSource:
      env.MANDATE_OS_OPENCLAW_DEFAULT_SOURCE?.trim() ||
      env.MANDATE_OS_MCP_DEFAULT_SOURCE?.trim() ||
      'openclaw.mandateos',
    unmatchedPermission:
      env.MANDATE_OS_OPENCLAW_UNMATCHED_PERMISSION === 'allow' ||
      env.MANDATE_OS_OPENCLAW_UNMATCHED_PERMISSION === 'deny'
        ? env.MANDATE_OS_OPENCLAW_UNMATCHED_PERMISSION
        : 'ask',
    hostName: env.MANDATE_OS_OPENCLAW_HOST_NAME?.trim() || 'openclaw',
  };
}

export function createMandateOsOpenClawGateway(
  config: MandateOsOpenClawBridgeConfig,
) {
  const client =
    config.client ||
    new MandateOsAgentClient({
      baseUrl: config.baseUrl,
      bearerToken: config.bearerToken,
      defaultSource: config.defaultSource,
    });

  return new MandateOsPolicyGateway({
    client,
    defaultMandateId: config.defaultMandateId,
    defaultSource: config.defaultSource,
    hostName: config.hostName || 'openclaw',
    unmatchedPermission: config.unmatchedPermission || 'ask',
    rules: [...defaultHostGatewayRules, ...openClawPolicyGatewayRules],
  });
}

export async function evaluateOpenClawPolicy(
  gateway: MandateOsPolicyGateway,
  input: PolicyGatewayAttempt,
): Promise<PolicyGatewayEvaluationResult> {
  const normalizedSubject =
    input.channel === 'mcp'
      ? normalizeMcpToolName(input.subject)
      : input.subject.trim();

  if (!normalizedSubject) {
    return {
      permission: 'allow',
      decision: 'local_allow',
    };
  }

  if (input.channel === 'shell' && isReadOnlyShellCommand(normalizedSubject)) {
    return {
      permission: 'allow',
      decision: 'local_allow',
    };
  }

  if (input.channel === 'mcp' && isMandateOsToolName(normalizedSubject)) {
    return {
      permission: 'allow',
      decision: 'local_allow',
    };
  }

  return gateway.evaluateAttempt({
    ...input,
    subject: normalizedSubject,
  });
}
