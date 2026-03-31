import {
  MandateOsAgentClient,
  MandateOsAgentClientError,
  MandateOsAgentMiddleware,
  MandateOsPolicyDecisionError,
  type ActionScenario,
  type EnforcedExecutionKind,
  listMandateOsEnforcedToolNames,
  type ExecutionGrantIssueInput,
  type GitHubIssueLabelExecutionPayload,
  type GitHubPullRequestDraftExecutionPayload,
  type MandateDraft,
  type MandateOsClientResponse,
  type SignatureVerificationResult,
} from '@mandate-os/sdk';

import type { MandateOsMcpConfig } from './config.js';
import {
  defaultMandate,
  presets,
  regionLabels,
  toolCatalog,
  zoneLabels,
} from './catalog.js';

type MiddlewareDefaults = {
  mandateId?: string;
  source?: string;
  details?: Record<string, unknown>;
};

type MandateOsToolClient = Pick<
  MandateOsAgentClient,
  | 'evaluateActions'
  | 'issueExecutionGrant'
  | 'issueMandate'
  | 'verifyExecutionGrant'
  | 'verifyMandate'
  | 'verifyReceipt'
>;

type MandateOsToolMiddleware = Pick<
  MandateOsAgentMiddleware,
  | 'executeEnforcedAction'
  | 'executeGitHubIssueLabel'
  | 'executeGitHubPullRequestDraft'
>;

type CreateMiddleware = (
  defaults: MiddlewareDefaults,
) => MandateOsToolMiddleware;

type ToolArgs = {
  mandateId?: string;
  source?: string;
  details?: Record<string, unknown>;
};

export type MandateOsMcpHandlerDependencies = {
  client: MandateOsToolClient;
  config: MandateOsMcpConfig;
  createMiddleware?: CreateMiddleware;
};

export function createMandateOsMcpHandlers(
  dependencies: MandateOsMcpHandlerDependencies,
) {
  const createMiddleware =
    dependencies.createMiddleware ||
    ((defaults: MiddlewareDefaults) =>
      new MandateOsAgentMiddleware(
        dependencies.client as MandateOsAgentClient,
        defaults,
      ));

  const resolveMandateId = (mandateId?: string) => {
    const resolved = mandateId?.trim() || dependencies.config.defaultMandateId;

    if (!resolved) {
      throw new Error(
        'Mandate id is required. Pass one in the tool input or configure MANDATE_OS_MCP_DEFAULT_MANDATE_ID.',
      );
    }

    return resolved;
  };

  const resolveSource = (source?: string) =>
    source?.trim() || dependencies.config.defaultSource;

  const resolveMiddlewareDefaults = (input: ToolArgs): MiddlewareDefaults => ({
    mandateId: resolveMandateId(input.mandateId),
    source: resolveSource(input.source),
    details: input.details,
  });

  const executeEnforcedAction = (input: {
    mandateId?: string;
    source?: string;
    details?: Record<string, unknown>;
    kind: EnforcedExecutionKind;
    action: ActionScenario;
    payload: Record<string, unknown>;
    grantExpiresInSeconds?: number;
  }) => {
    const middleware = createMiddleware(resolveMiddlewareDefaults(input));

    return middleware.executeEnforcedAction({
      kind: input.kind,
      action: input.action,
      payload: input.payload as never,
      grantExpiresInSeconds: input.grantExpiresInSeconds,
    });
  };

  return {
    async getContext() {
      return {
        baseUrl: dependencies.config.baseUrl,
        serverName: dependencies.config.serverName,
        serverVersion: dependencies.config.serverVersion,
        defaultMandateId: dependencies.config.defaultMandateId || null,
        defaultSource: dependencies.config.defaultSource || null,
        genericTools: [
          'mandateos_get_policy_catalog',
          'mandateos_issue_mandate',
          'mandateos_evaluate_actions',
          'mandateos_issue_execution_grant',
          'mandateos_verify_mandate',
          'mandateos_verify_receipt',
          'mandateos_verify_execution_grant',
        ],
        enforcedTools: [
          ...listMandateOsEnforcedToolNames('mcp', {
            includeLegacyToolNames: true,
          }),
        ],
        workflowGuidance: [
          'Use mandateos_evaluate_actions before any side effect that MandateOS does not execute itself.',
          'Prefer mandateos_execute_enforced_action for any MandateOS-owned enforcement route. Legacy aliases remain available for compatibility.',
          'Only continue with non-MandateOS tools when the returned receipt decision is allowed.',
        ],
      };
    },

    async getPolicyCatalog() {
      return {
        defaultPresetId: defaultMandate.presetId,
        tools: toolCatalog,
        presets,
        regionLabels,
        zoneLabels,
      };
    },

    async issueMandate(input: MandateDraft) {
      return dependencies.client.issueMandate(input);
    },

    async evaluateActions(input: {
      mandateId?: string;
      source?: string;
      details?: Record<string, unknown>;
      actions: ActionScenario[];
    }) {
      return dependencies.client.evaluateActions({
        mandateId: resolveMandateId(input.mandateId),
        source: resolveSource(input.source),
        details: input.details,
        actions: input.actions,
      });
    },

    async issueExecutionGrant(input: ExecutionGrantIssueInput) {
      return dependencies.client.issueExecutionGrant(input);
    },

    async verifyMandate(input: { mandateId: string }) {
      return dependencies.client.verifyMandate(input.mandateId);
    },

    async verifyReceipt(input: { receiptId: string }) {
      return dependencies.client.verifyReceipt(input.receiptId);
    },

    async verifyExecutionGrant(input: { grantId: string }) {
      return dependencies.client.verifyExecutionGrant(input.grantId);
    },

    async executeGitHubIssueLabel(input: {
      mandateId?: string;
      source?: string;
      details?: Record<string, unknown>;
      action: ActionScenario;
      payload: GitHubIssueLabelExecutionPayload;
      grantExpiresInSeconds?: number;
    }) {
      return executeEnforcedAction({
        ...input,
        kind: 'github.issue.label',
        payload: input.payload as Record<string, unknown>,
      });
    },

    async executeEnforcedAction(input: {
      mandateId?: string;
      source?: string;
      details?: Record<string, unknown>;
      kind: EnforcedExecutionKind;
      action: ActionScenario;
      payload: Record<string, unknown>;
      grantExpiresInSeconds?: number;
    }) {
      return executeEnforcedAction(input);
    },

    async executeGitHubPullRequestDraft(input: {
      mandateId?: string;
      source?: string;
      details?: Record<string, unknown>;
      action: ActionScenario;
      payload: GitHubPullRequestDraftExecutionPayload;
      grantExpiresInSeconds?: number;
    }) {
      return executeEnforcedAction({
        ...input,
        kind: 'github.pull_request.draft',
        payload: input.payload as Record<string, unknown>,
      });
    },
  };
}

export function createMandateOsClient(config: MandateOsMcpConfig) {
  return new MandateOsAgentClient({
    baseUrl: config.baseUrl,
    bearerToken: config.bearerToken,
    defaultSource: config.defaultSource,
  });
}

export function toToolSuccessResult(
  data:
    | MandateOsClientResponse<unknown>
    | SignatureVerificationResult
    | Record<string, unknown>,
) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

export function toToolErrorResult(error: unknown) {
  const normalized = normalizeMandateOsError(error);

  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: normalized }, null, 2),
      },
    ],
    structuredContent: {
      error: normalized,
    },
  };
}

export function normalizeMandateOsError(error: unknown) {
  if (error instanceof MandateOsPolicyDecisionError) {
    return {
      type: 'policy_decision',
      message: error.message,
      receipt: error.receipt,
    };
  }

  if (error instanceof MandateOsAgentClientError) {
    return {
      type: 'mandate_os_api',
      message: error.message,
      status: error.status,
      code: error.code || null,
      requestId: error.requestId || null,
      issues: error.issues || [],
    };
  }

  if (error instanceof Error) {
    return {
      type: 'runtime',
      message: error.message,
    };
  }

  return {
    type: 'runtime',
    message: 'Unknown MandateOS MCP error.',
  };
}
