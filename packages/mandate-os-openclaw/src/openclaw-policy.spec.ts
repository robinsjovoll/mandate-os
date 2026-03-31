import { describe, expect, it, vi } from 'vitest';

import {
  createMandateOsOpenClawGateway,
  evaluateOpenClawPolicy,
} from './openclaw-policy';

function receipt(decision: 'allowed' | 'approval' | 'blocked') {
  return {
    id: `rcpt_${decision}`,
    batchId: 'sim_123',
    receiptType: 'simulation',
    workspaceId: 'ws_123',
    mandateId: 'mdt_123',
    mandateVersion: 1,
    createdAt: '2026-03-17T10:00:00.000Z',
    scenarioId: 'shell.openclaw.shell.exec.123',
    title: 'OpenClaw action',
    description: 'OpenClaw action description',
    tool: 'shell.exec',
    amountNok: 0,
    termMonths: 0,
    zone: 'domestic',
    decision,
    reasons: [`${decision} reason`],
    signature: {
      algorithm: 'hmac-sha256',
      keyId: 'primary',
      payloadHash: 'hash',
      signature: 'sig',
      signedAt: '2026-03-17T10:00:00.000Z',
    },
    audit: {
      requestId: 'req_123',
      source: 'openclaw.test',
      actor: {
        type: 'agent',
        id: 'agt_123',
        displayName: 'Agent',
      },
      workspaceId: 'ws_123',
      ipAddress: null,
      userAgent: null,
    },
  };
}

describe('OpenClaw policy gateway', () => {
  it('allows read-only shell commands locally', async () => {
    const evaluateActions = vi.fn();
    const gateway = createMandateOsOpenClawGateway({
      baseUrl: 'https://mandate.example',
      bearerToken: 'token',
      client: {
        evaluateActions,
      },
    });

    await expect(
      evaluateOpenClawPolicy(gateway, {
        channel: 'shell',
        subject: 'git diff --stat',
      }),
    ).resolves.toMatchObject({
      permission: 'allow',
      decision: 'local_allow',
    });

    expect(evaluateActions).not.toHaveBeenCalled();
  });

  it('maps browser mutations onto the MandateOS browser wrapper route', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('allowed')],
      },
    });
    const gateway = createMandateOsOpenClawGateway({
      baseUrl: 'https://mandate.example',
      bearerToken: 'token',
      defaultMandateId: 'mdt_123',
      client: {
        evaluateActions,
      },
    });

    await expect(
      evaluateOpenClawPolicy(gateway, {
        channel: 'browser',
        subject: 'click',
        context: {
          browserAction: 'click',
        },
      }),
    ).resolves.toMatchObject({
      permission: 'deny',
      decision: 'redirect_enforced',
      recommendedTool: 'mandateos_openclaw_browser_mutate',
      userMessage: expect.stringContaining(
        'Use mandateos_openclaw_browser_mutate instead.',
      ),
    });
  });

  it('uses the shell.exec fallback for unmatched OpenClaw exec commands', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('allowed')],
      },
    });
    const gateway = createMandateOsOpenClawGateway({
      baseUrl: 'https://mandate.example',
      bearerToken: 'token',
      defaultMandateId: 'mdt_123',
      client: {
        evaluateActions,
      },
    });

    const result = await evaluateOpenClawPolicy(gateway, {
      channel: 'shell',
      subject: 'customctl do-the-thing',
      context: {
        command: 'customctl do-the-thing',
      },
    });

    expect(result).toMatchObject({
      decision: 'redirect_enforced',
      recommendedTool: 'mandateos_openclaw_exec',
      agentMessage: expect.stringContaining(
        'policy-wrapper block, not a sandbox or plugin startup error',
      ),
    });
    expect(evaluateActions).toHaveBeenCalledWith({
      mandateId: 'mdt_123',
      source: 'openclaw.shell',
      details: expect.objectContaining({
        channel: 'shell',
        matchedRuleId: 'openclaw.shell.exec',
      }),
      actions: [
        expect.objectContaining({
          tool: 'shell.exec',
        }),
      ],
    });
  });

  it('surfaces policy denial reasons as actionable blocking text', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('blocked')],
      },
    });
    const gateway = createMandateOsOpenClawGateway({
      baseUrl: 'https://mandate.example',
      bearerToken: 'token',
      defaultMandateId: 'mdt_123',
      client: {
        evaluateActions,
      },
    });

    await expect(
      evaluateOpenClawPolicy(gateway, {
        channel: 'shell',
        subject: 'git push origin main',
        context: {
          command: 'git push origin main',
        },
      }),
    ).resolves.toMatchObject({
      permission: 'deny',
      decision: 'policy_blocked',
      userMessage: expect.stringContaining('Reasons: blocked reason'),
      agentMessage: expect.stringContaining(
        'policy denial, not a sandbox or plugin startup failure',
      ),
    });
  });

  it('surfaces approval requirements distinctly from hard policy blocks', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('approval')],
      },
    });
    const gateway = createMandateOsOpenClawGateway({
      baseUrl: 'https://mandate.example',
      bearerToken: 'token',
      defaultMandateId: 'mdt_123',
      client: {
        evaluateActions,
      },
    });

    await expect(
      evaluateOpenClawPolicy(gateway, {
        channel: 'shell',
        subject: 'git push origin main',
        context: {
          command: 'git push origin main',
        },
      }),
    ).resolves.toMatchObject({
      permission: 'ask',
      decision: 'policy_approval',
      userMessage: expect.stringContaining('requires approval'),
      agentMessage: expect.stringContaining('approval requirement'),
    });
  });
});
