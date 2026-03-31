import type {
  EnforcedExecutionPayloadByKind,
  EnforcedExecutionResultByKind,
  ExecutionGrantIssueInput,
  ExecutionGrantRecord,
  GitHubIssueLabelExecutionPayload,
  GitHubIssueLabelExecutionResult,
  GitHubPullRequestDraftExecutionPayload,
  GitHubPullRequestDraftExecutionResult,
  ReceiptRecord,
  RuntimeSimulationBatch,
} from './contracts.js';
import {
  getEnforcedExecutionCapability,
  type EnforcedExecutionKind,
} from './enforced-capabilities.js';
import type { ActionScenario } from './mandates.js';
import { MandateOsAgentClient } from './agent-client.js';

type BaseActionOptions = {
  mandateId?: string;
  source?: string;
  details?: Record<string, unknown>;
  evaluationIdempotencyKey?: string;
};

type GitHubIssueLabelActionOptions = BaseActionOptions & {
  action: ActionScenario;
  payload: GitHubIssueLabelExecutionPayload;
  grantExpiresInSeconds?: number;
  grantIdempotencyKey?: string;
  executeIdempotencyKey?: string;
};

type GitHubPullRequestDraftActionOptions = BaseActionOptions & {
  action: ActionScenario;
  payload: GitHubPullRequestDraftExecutionPayload;
  grantExpiresInSeconds?: number;
  grantIdempotencyKey?: string;
  executeIdempotencyKey?: string;
};

type EnforcedActionOptions<K extends EnforcedExecutionKind> =
  BaseActionOptions & {
    kind: K;
    action: ActionScenario;
    payload: EnforcedExecutionPayloadByKind[K];
    grantExpiresInSeconds?: number;
    grantIdempotencyKey?: string;
    executeIdempotencyKey?: string;
  };

export class MandateOsPolicyDecisionError extends Error {
  constructor(readonly receipt: ReceiptRecord) {
    super(
      `MandateOS returned ${receipt.decision} for ${receipt.title}: ${receipt.reasons.join(' ')}`,
    );
    this.name = 'MandateOsPolicyDecisionError';
  }
}

export class MandateOsAgentMiddleware {
  constructor(
    private readonly client: MandateOsAgentClient,
    private readonly defaults: {
      mandateId?: string;
      source?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {}

  async evaluateAction(input: BaseActionOptions & { action: ActionScenario }) {
    const mandateId = input.mandateId || this.defaults.mandateId;

    if (!mandateId) {
      throw new Error(
        'Mandate id is required. Pass it to the middleware defaults or the action call.',
      );
    }

    const evaluation = await this.client.evaluateActions(
      {
        mandateId,
        source: input.source || this.defaults.source,
        details: {
          ...(this.defaults.details || {}),
          ...(input.details || {}),
        },
        actions: [input.action],
      },
      {
        idempotencyKey: input.evaluationIdempotencyKey,
      },
    );
    const receipt = evaluation.data.receipts[0];

    if (!receipt) {
      throw new Error(
        'MandateOS did not return a receipt for the evaluated action.',
      );
    }

    return {
      evaluation: evaluation.data,
      receipt,
    };
  }

  async requireAllowed(input: BaseActionOptions & { action: ActionScenario }) {
    const result = await this.evaluateAction(input);

    if (result.receipt.decision !== 'allowed') {
      throw new MandateOsPolicyDecisionError(result.receipt);
    }

    return result;
  }

  async withMandateCheck<T>(
    input: BaseActionOptions & { action: ActionScenario },
    executor: (input: {
      receipt: ReceiptRecord;
      evaluation: RuntimeSimulationBatch;
    }) => Promise<T>,
  ) {
    const result = await this.requireAllowed(input);

    return executor(result);
  }

  async executeGitHubIssueLabel(input: GitHubIssueLabelActionOptions): Promise<{
    evaluation: RuntimeSimulationBatch;
    receipt: ReceiptRecord;
    grant: ExecutionGrantRecord;
    execution: GitHubIssueLabelExecutionResult;
  }> {
    return this.executeEnforcedAction({
      ...input,
      kind: 'github.issue.label',
    });
  }

  async executeGitHubPullRequestDraft(
    input: GitHubPullRequestDraftActionOptions,
  ): Promise<{
    evaluation: RuntimeSimulationBatch;
    receipt: ReceiptRecord;
    grant: ExecutionGrantRecord;
    execution: GitHubPullRequestDraftExecutionResult;
  }> {
    return this.executeEnforcedAction({
      ...input,
      kind: 'github.pull_request.draft',
    });
  }

  async executeEnforcedAction<K extends EnforcedExecutionKind>(
    input: EnforcedActionOptions<K>,
  ): Promise<{
    evaluation: RuntimeSimulationBatch;
    receipt: ReceiptRecord;
    grant: ExecutionGrantRecord;
    execution: EnforcedExecutionResultByKind[K];
  }> {
    const capability = getEnforcedExecutionCapability(input.kind);

    if (input.action.tool !== capability.actionTool) {
      throw new Error(
        `action.tool must be ${capability.actionTool} for ${input.kind}.`,
      );
    }

    const allowed = await this.requireAllowed(input);
    const grantInput = {
      receiptId: allowed.receipt.id,
      kind: input.kind,
      payload: input.payload,
      expiresInSeconds: input.grantExpiresInSeconds,
    } as ExecutionGrantIssueInput;
    const grant = await this.client.issueExecutionGrant(grantInput, {
      idempotencyKey: input.grantIdempotencyKey,
    });
    const execution = await this.client.executeEnforcedAction(
      input.kind,
      {
        grantId: grant.data.id,
        payload: input.payload,
      },
      {
        idempotencyKey: input.executeIdempotencyKey,
      },
    );

    return {
      evaluation: allowed.evaluation,
      receipt: allowed.receipt,
      grant: grant.data,
      execution: execution.data,
    };
  }
}
