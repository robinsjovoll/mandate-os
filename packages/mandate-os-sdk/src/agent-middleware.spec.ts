import { describe, expect, it, vi } from 'vitest';

import type {
  ExecutionGrantRecord,
  GitHubIssueLabelExecutionResult,
  GitHubPullRequestDraftExecutionResult,
  ReceiptRecord,
  RuntimeSimulationBatch,
} from './contracts';
import type { MandateOsAgentClient } from './agent-client';
import {
  MandateOsAgentMiddleware,
  MandateOsPolicyDecisionError,
} from './agent-middleware';

function createReceipt(
  decision: ReceiptRecord['decision'] = 'allowed',
): ReceiptRecord {
  return {
    id: 'rcpt_123',
    batchId: 'sim_123',
    receiptType: 'simulation',
    workspaceId: 'wrk_123',
    mandateId: 'mdt_123',
    mandateVersion: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    scenarioId: 'issue-123-label',
    title: 'Apply a bug label to issue #123',
    description:
      'Label the issue after classifying the bug report and confirming it is internal.',
    tool: 'issue.label',
    amountNok: 0,
    termMonths: 0,
    zone: 'domestic',
    decision,
    reasons:
      decision === 'allowed'
        ? ['Action is fully covered by the active mandate.']
        : ['Public action requires approval.'],
    signature: {
      algorithm: 'hmac-sha256',
      keyId: 'test-key',
      payloadHash: 'hash',
      signature: 'signature',
      signedAt: '2026-03-12T00:00:00.000Z',
    },
    audit: {
      requestId: 'req_receipt',
      source: 'mandate-os',
      actor: {
        id: 'agt_operator',
        type: 'service',
        displayName: 'Agent Operator',
      },
      workspaceId: 'wrk_123',
      ipAddress: null,
      userAgent: null,
    },
  };
}

function createEvaluation(
  decision: ReceiptRecord['decision'] = 'allowed',
): RuntimeSimulationBatch {
  const receipt = createReceipt(decision);

  return {
    batchId: receipt.batchId,
    generatedAt: receipt.createdAt,
    mandate: {
      id: receipt.mandateId,
      workspaceId: receipt.workspaceId,
      version: receipt.mandateVersion,
      status: 'active',
      issuedAt: receipt.createdAt,
      updatedAt: receipt.createdAt,
      owner: 'Engineering',
      agentName: 'repo_steward',
      purpose:
        'Triage repository work and require signed receipts before external actions.',
      monthlyCapNok: 25000,
      allowedRegion: 'oecd',
      fingerprint: 'fingerprint',
    },
    receipts: [receipt],
    audit: receipt.audit,
  };
}

function createGrant(
  overrides: Partial<ExecutionGrantRecord> = {},
): ExecutionGrantRecord {
  return {
    id: 'grt_123',
    workspaceId: 'wrk_123',
    receiptId: 'rcpt_123',
    mandateId: 'mdt_123',
    kind: 'github.issue.label',
    payloadHash: 'payload-hash',
    payloadPreview: {
      owner: 'acme',
      repo: 'platform',
      issueNumber: 123,
      labels: ['bug'],
    },
    status: 'active',
    createdAt: '2026-03-12T00:00:00.000Z',
    expiresAt: '2026-03-12T00:05:00.000Z',
    consumedAt: null,
    consumedRequestId: null,
    revokedAt: null,
    audit: createReceipt().audit,
    signature: createReceipt().signature,
    ...overrides,
  };
}

function createExecutionResult(): GitHubIssueLabelExecutionResult {
  return {
    grantId: 'grt_123',
    receiptId: 'rcpt_123',
    mandateId: 'mdt_123',
    executedAt: '2026-03-12T00:00:05.000Z',
    owner: 'acme',
    repo: 'platform',
    issueNumber: 123,
    labels: ['bug'],
  };
}

function createPullRequestDraftExecutionResult(): GitHubPullRequestDraftExecutionResult {
  return {
    grantId: 'grt_456',
    receiptId: 'rcpt_456',
    mandateId: 'mdt_123',
    executedAt: '2026-03-12T00:00:05.000Z',
    owner: 'acme',
    repo: 'platform',
    pullRequestNumber: 7,
    isDraft: true,
    wasAlreadyDraft: false,
    url: 'https://github.com/acme/platform/pull/7',
  };
}

describe('MandateOsAgentMiddleware', () => {
  it('wraps the evaluate -> grant -> execute flow for a GitHub label action', async () => {
    const client = {
      evaluateActions: vi.fn(async () => ({
        data: createEvaluation('allowed'),
      })),
      issueExecutionGrant: vi.fn(async () => ({
        data: createGrant(),
      })),
      executeEnforcedAction: vi.fn(async () => ({
        data: createExecutionResult(),
      })),
    } as unknown as MandateOsAgentClient;
    const middleware = new MandateOsAgentMiddleware(client, {
      mandateId: 'mdt_123',
      source: 'codex.repo_steward',
      details: {
        repository: 'acme/platform',
      },
    });

    const result = await middleware.executeGitHubIssueLabel({
      action: {
        id: 'issue-123-label',
        title: 'Apply a bug label to issue #123',
        description:
          'Label the issue after classifying the bug report and confirming it is internal.',
        tool: 'issue.label',
        amountNok: 0,
        termMonths: 0,
        zone: 'domestic',
        riskLevel: 'low',
        receiptSuffix: 'iss123',
      },
      payload: {
        owner: 'acme',
        repo: 'platform',
        issueNumber: 123,
        labels: ['bug'],
      },
    });

    expect(client.evaluateActions).toHaveBeenCalledOnce();
    expect(client.issueExecutionGrant).toHaveBeenCalledOnce();
    expect(client.executeEnforcedAction).toHaveBeenCalledWith(
      'github.issue.label',
      {
        grantId: 'grt_123',
        payload: {
          owner: 'acme',
          repo: 'platform',
          issueNumber: 123,
          labels: ['bug'],
        },
      },
      {
        idempotencyKey: undefined,
      },
    );
    expect(result.execution.grantId).toBe('grt_123');
  });

  it('throws a policy decision error when MandateOS does not allow the action', async () => {
    const client = {
      evaluateActions: vi.fn(async () => ({
        data: createEvaluation('approval'),
      })),
    } as unknown as MandateOsAgentClient;
    const middleware = new MandateOsAgentMiddleware(client, {
      mandateId: 'mdt_123',
    });

    await expect(() =>
      middleware.requireAllowed({
        action: {
          id: 'docs-release-notes',
          title: 'Publish release notes to the docs site',
          description:
            'Push release notes to the public documentation surface for a new release.',
          tool: 'docs.publish',
          amountNok: 0,
          termMonths: 0,
          zone: 'oecd',
          riskLevel: 'high',
          receiptSuffix: 'docs123',
        },
      }),
    ).rejects.toBeInstanceOf(MandateOsPolicyDecisionError);
  });

  it('wraps the evaluate -> grant -> execute flow for a GitHub pull request draft action', async () => {
    const client = {
      evaluateActions: vi.fn(async () => ({
        data: createEvaluation('allowed'),
      })),
      issueExecutionGrant: vi.fn(async () => ({
        data: createGrant({
          id: 'grt_456',
          receiptId: 'rcpt_456',
          kind: 'github.pull_request.draft',
          payloadPreview: {
            owner: 'acme',
            repo: 'platform',
            pullRequestNumber: 7,
          },
        }),
      })),
      executeEnforcedAction: vi.fn(async () => ({
        data: createPullRequestDraftExecutionResult(),
      })),
    } as unknown as MandateOsAgentClient;
    const middleware = new MandateOsAgentMiddleware(client, {
      mandateId: 'mdt_123',
      source: 'codex.repo_steward',
    });

    const result = await middleware.executeGitHubPullRequestDraft({
      action: {
        id: 'pr-7-draft',
        title: 'Keep pull request #7 in draft',
        description:
          'Ensure the pull request stays in draft until a human reviews it.',
        tool: 'pr.draft',
        amountNok: 0,
        termMonths: 0,
        zone: 'domestic',
        riskLevel: 'low',
        receiptSuffix: 'pr7',
      },
      payload: {
        owner: 'acme',
        repo: 'platform',
        pullRequestNumber: 7,
      },
    });

    expect(client.evaluateActions).toHaveBeenCalledOnce();
    expect(client.issueExecutionGrant).toHaveBeenCalledOnce();
    expect(client.executeEnforcedAction).toHaveBeenCalledWith(
      'github.pull_request.draft',
      {
        grantId: 'grt_456',
        payload: {
          owner: 'acme',
          repo: 'platform',
          pullRequestNumber: 7,
        },
      },
      {
        idempotencyKey: undefined,
      },
    );
    expect(result.execution.pullRequestNumber).toBe(7);
    expect(result.execution.isDraft).toBe(true);
  });
});
