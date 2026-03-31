import { describe, expect, it, vi } from 'vitest';

import { MandateOsAgentClientError } from '@mandate-os/sdk';

import {
  createMandateOsMcpHandlers,
  normalizeMandateOsError,
  toToolErrorResult,
} from './handlers';
import type { MandateOsMcpConfig } from './config';

function createConfig(
  overrides: Partial<MandateOsMcpConfig> = {},
): MandateOsMcpConfig {
  return {
    baseUrl: 'http://localhost:4330',
    bearerToken: 'agt_example.secret',
    defaultMandateId: 'mdt_default',
    defaultSource: 'mcp.mandate_os',
    serverName: 'mandate-os-mcp',
    serverVersion: '0.0.0',
    ...overrides,
  };
}

describe('createMandateOsMcpHandlers', () => {
  it('returns local context and policy catalog guidance', async () => {
    const handlers = createMandateOsMcpHandlers({
      client: {
        issueMandate: vi.fn(),
        evaluateActions: vi.fn(),
        issueExecutionGrant: vi.fn(),
        verifyMandate: vi.fn(),
        verifyReceipt: vi.fn(),
        verifyExecutionGrant: vi.fn(),
      } as never,
      config: createConfig(),
    });

    await expect(handlers.getContext()).resolves.toMatchObject({
      defaultMandateId: 'mdt_default',
      genericTools: expect.arrayContaining(['mandateos_evaluate_actions']),
      enforcedTools: expect.arrayContaining([
        'mandateos_execute_enforced_action',
      ]),
    });

    await expect(handlers.getPolicyCatalog()).resolves.toMatchObject({
      defaultPresetId: 'repo-steward',
    });
  });

  it('uses configured mandate and source defaults for generic action evaluation', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
      },
    });
    const handlers = createMandateOsMcpHandlers({
      client: {
        issueMandate: vi.fn(),
        evaluateActions,
        issueExecutionGrant: vi.fn(),
        verifyMandate: vi.fn(),
        verifyReceipt: vi.fn(),
        verifyExecutionGrant: vi.fn(),
      } as never,
      config: createConfig(),
    });

    await handlers.evaluateActions({
      actions: [
        {
          id: 'pr-7-draft',
          title: 'Keep PR #7 in draft',
          description: 'Hold the pull request for human review.',
          tool: 'pr.draft',
          amountNok: 0,
          termMonths: 0,
          zone: 'domestic',
          riskLevel: 'low',
          receiptSuffix: 'pr7',
        },
      ],
    });

    expect(evaluateActions).toHaveBeenCalledWith({
      mandateId: 'mdt_default',
      source: 'mcp.mandate_os',
      details: undefined,
      actions: expect.any(Array),
    });
  });

  it('creates middleware with configured defaults for enforced PR draft execution', async () => {
    const executeEnforcedAction = vi.fn().mockResolvedValue({
      execution: {
        grantId: 'grt_123',
      },
    });
    const createMiddleware = vi.fn().mockReturnValue({
      executeEnforcedAction,
      executeGitHubIssueLabel: vi.fn(),
      executeGitHubPullRequestDraft: executeEnforcedAction,
    });
    const handlers = createMandateOsMcpHandlers({
      client: {
        issueMandate: vi.fn(),
        evaluateActions: vi.fn(),
        issueExecutionGrant: vi.fn(),
        verifyMandate: vi.fn(),
        verifyReceipt: vi.fn(),
        verifyExecutionGrant: vi.fn(),
      } as never,
      config: createConfig(),
      createMiddleware,
    });

    await handlers.executeGitHubPullRequestDraft({
      action: {
        id: 'pr-7-draft',
        title: 'Keep PR #7 in draft',
        description: 'Hold the pull request for human review.',
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

    expect(createMiddleware).toHaveBeenCalledWith({
      mandateId: 'mdt_default',
      source: 'mcp.mandate_os',
      details: undefined,
    });
    expect(executeEnforcedAction).toHaveBeenCalledOnce();
  });
});

describe('tool error formatting', () => {
  it('normalizes MandateOS API errors for MCP responses', () => {
    const error = new MandateOsAgentClientError(
      'MandateOS request failed.',
      409,
      'conflict',
      'req_123',
      [{ path: 'mandateId', message: 'mandateId is invalid.' }],
    );

    expect(normalizeMandateOsError(error)).toEqual({
      type: 'mandate_os_api',
      message: 'MandateOS request failed.',
      status: 409,
      code: 'conflict',
      requestId: 'req_123',
      issues: [{ path: 'mandateId', message: 'mandateId is invalid.' }],
    });

    expect(toToolErrorResult(error)).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          code: 'conflict',
        },
      },
    });
  });
});
