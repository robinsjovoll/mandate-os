import { describe, expect, it, vi } from 'vitest';

import type {
  ExecutionGrantRecord,
  GitHubIssueLabelExecutionResult,
  GitHubPullRequestDraftExecutionResult,
  MandateRecord,
  RuntimeSimulationBatch,
  SignatureVerificationResult,
} from './contracts';
import {
  MandateOsAgentClient,
  MandateOsAgentClientError,
} from './agent-client';

function createMandateRecord(): MandateRecord {
  return {
    id: 'mdt_123',
    workspaceId: 'wrk_123',
    version: 1,
    status: 'active',
    issuedAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z',
    presetId: 'custom',
    owner: 'Acme Platform',
    agentName: 'repo_policy_agent',
    purpose:
      'Review repo operations and require receipts before external actions.',
    monthlyCapNok: 25000,
    approvalTermMonths: 12,
    allowedRegion: 'oecd',
    allowedTools: ['issue.label', 'pr.draft', 'docs.publish'],
    policyText: 'policy',
    fingerprint: 'fingerprint',
    signature: {
      algorithm: 'hmac-sha256',
      keyId: 'test-key',
      payloadHash: 'payload-hash',
      signature: 'signature',
      signedAt: '2026-03-12T00:00:00.000Z',
    },
    audit: {
      requestId: 'req_issue',
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

function createSimulationBatch(): RuntimeSimulationBatch {
  const mandate = createMandateRecord();

  return {
    batchId: 'sim_123',
    generatedAt: '2026-03-12T00:00:00.000Z',
    mandate: {
      id: mandate.id,
      workspaceId: mandate.workspaceId,
      version: mandate.version,
      status: mandate.status,
      issuedAt: mandate.issuedAt,
      updatedAt: mandate.updatedAt,
      owner: mandate.owner,
      agentName: mandate.agentName,
      purpose: mandate.purpose,
      monthlyCapNok: mandate.monthlyCapNok,
      allowedRegion: mandate.allowedRegion,
      fingerprint: mandate.fingerprint,
    },
    receipts: [],
    audit: mandate.audit,
  };
}

function createExecutionGrantRecord(
  overrides: Partial<ExecutionGrantRecord> = {},
): ExecutionGrantRecord {
  return {
    id: 'grt_123',
    workspaceId: 'wrk_123',
    receiptId: 'rcp_123',
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
    audit: createMandateRecord().audit,
    signature: {
      algorithm: 'hmac-sha256',
      keyId: 'test-key',
      payloadHash: 'payload-hash',
      signature: 'signature',
      signedAt: '2026-03-12T00:00:00.000Z',
    },
    ...overrides,
  };
}

function createExecutionResult(): GitHubIssueLabelExecutionResult {
  return {
    grantId: 'grt_123',
    receiptId: 'rcp_123',
    mandateId: 'mdt_123',
    executedAt: '2026-03-12T00:01:00.000Z',
    owner: 'acme',
    repo: 'platform',
    issueNumber: 123,
    labels: ['bug'],
  };
}

function createPullRequestDraftExecutionResult(): GitHubPullRequestDraftExecutionResult {
  return {
    grantId: 'grt_456',
    receiptId: 'rcp_456',
    mandateId: 'mdt_123',
    executedAt: '2026-03-12T00:02:00.000Z',
    owner: 'acme',
    repo: 'platform',
    pullRequestNumber: 7,
    isDraft: true,
    wasAlreadyDraft: false,
    url: 'https://github.com/acme/platform/pull/7',
  };
}

function createVerificationResult(
  resourceType: SignatureVerificationResult['resourceType'],
): SignatureVerificationResult {
  return {
    valid: true,
    resourceType,
    resourceId:
      resourceType === 'execution_grant'
        ? 'grt_123'
        : resourceType === 'receipt'
          ? 'rcp_123'
          : 'mdt_123',
    keyId: 'test-key',
    algorithm: 'hmac-sha256',
    verifiedAt: '2026-03-12T00:01:00.000Z',
  };
}

describe('MandateOsAgentClient', () => {
  it('posts runtime action evaluations with bearer auth and idempotency metadata', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: createSimulationBatch(),
            meta: {
              requestId: 'req_runtime',
            },
          }),
          {
            status: 201,
            headers: {
              'content-type': 'application/json',
              'x-idempotency-key': 'idem_123',
              'x-idempotency-status': 'created',
            },
          },
        ),
    );
    const client = new MandateOsAgentClient({
      baseUrl: 'http://localhost:4330/',
      bearerToken: 'agt_operator.secret',
      defaultSource: 'agent.codex',
      fetchImpl,
    });

    const result = await client.evaluateActions({
      mandateId: 'mdt_123',
      actions: [
        {
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
      ],
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;

    expect(url).toBe('http://localhost:4330/api/v1/runtime/evaluate-actions');
    expect(init.method).toBe('POST');
    expect(headers.get('authorization')).toBe('Bearer agt_operator.secret');
    expect(headers.get('idempotency-key')).toMatch(/^agent_/);
    expect(result.data.batchId).toBe('sim_123');
    expect(result.headers.idempotencyKey).toBe('idem_123');
    expect(result.headers.idempotencyStatus).toBe('created');
  });

  it('surfaces API failures as typed client errors', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'Runtime action evaluation payload failed validation.',
              issues: [
                {
                  path: 'actions[0].tool',
                  message: 'Action tool is invalid.',
                },
              ],
            },
            meta: {
              requestId: 'req_invalid',
            },
          }),
          {
            status: 400,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
    );
    const client = new MandateOsAgentClient({
      baseUrl: 'http://localhost:4330',
      bearerToken: 'agt_operator.secret',
      fetchImpl,
    });

    await expect(() =>
      client.issueMandate({
        presetId: 'custom',
        owner: 'Acme Platform',
        agentName: 'x',
        purpose: 'too short',
        monthlyCapNok: 10,
        approvalTermMonths: 1,
        allowedRegion: 'oecd',
        allowedTools: ['issue.label'],
      }),
    ).rejects.toEqual(
      expect.objectContaining<MandateOsAgentClientError>({
        name: 'MandateOsAgentClientError',
        status: 400,
        code: 'validation_error',
        requestId: 'req_invalid',
        issues: [
          {
            path: 'actions[0].tool',
            message: 'Action tool is invalid.',
          },
        ],
      }),
    );
  });

  it('calls execution grant, execute, and verification routes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createExecutionGrantRecord(),
            meta: { requestId: 'req_grant' },
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createExecutionResult(),
            meta: { requestId: 'req_execute' },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createVerificationResult('execution_grant'),
            meta: { requestId: 'req_verify' },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    const client = new MandateOsAgentClient({
      baseUrl: 'http://localhost:4330',
      bearerToken: 'agt_operator.secret',
      fetchImpl,
    });

    const grant = await client.issueExecutionGrant({
      receiptId: 'rcp_123',
      kind: 'github.issue.label',
      payload: {
        owner: 'acme',
        repo: 'platform',
        issueNumber: 123,
        labels: ['bug'],
      },
    });
    const execution = await client.executeGitHubIssueLabel({
      grantId: grant.data.id,
      payload: {
        owner: 'acme',
        repo: 'platform',
        issueNumber: 123,
        labels: ['bug'],
      },
    });
    const verification = await client.verifyExecutionGrant(grant.data.id);

    expect(grant.data.id).toBe('grt_123');
    expect(execution.data.issueNumber).toBe(123);
    expect(verification.data.resourceType).toBe('execution_grant');
  });

  it('calls the GitHub pull request draft execute route', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createExecutionGrantRecord({
              id: 'grt_456',
              receiptId: 'rcp_456',
              kind: 'github.pull_request.draft',
              payloadPreview: {
                owner: 'acme',
                repo: 'platform',
                pullRequestNumber: 7,
              },
            }),
            meta: { requestId: 'req_pr_grant' },
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createPullRequestDraftExecutionResult(),
            meta: { requestId: 'req_pr_execute' },
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
    const client = new MandateOsAgentClient({
      baseUrl: 'http://localhost:4330',
      bearerToken: 'agt_operator.secret',
      fetchImpl,
    });

    const grant = await client.issueExecutionGrant({
      receiptId: 'rcp_456',
      kind: 'github.pull_request.draft',
      payload: {
        owner: 'acme',
        repo: 'platform',
        pullRequestNumber: 7,
      },
    });
    const execution = await client.executeGitHubPullRequestDraft({
      grantId: grant.data.id,
      payload: {
        owner: 'acme',
        repo: 'platform',
        pullRequestNumber: 7,
      },
    });

    expect(grant.data.kind).toBe('github.pull_request.draft');
    expect(execution.data.pullRequestNumber).toBe(7);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      'http://localhost:4330/api/v1/integrations/github/pull-request/draft/execute',
    );
  });
});
