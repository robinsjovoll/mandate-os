import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { ActionScenario } from '@mandate-os/sdk';

import {
  createMandateOsHostGateway,
  parseHostGatewayRules,
  readHostGatewayRulesFromEnv,
  readHostGatewayUnmatchedPermission,
  toClaudeHookResponse,
  toCursorHookResponse,
} from './host-gateway';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function createGateway(
  evaluateActions = vi.fn(),
  overrides: Parameters<typeof createMandateOsHostGateway>[0] = {
    client: {
      evaluateActions,
    } as never,
  },
) {
  return createMandateOsHostGateway({
    client: {
      evaluateActions,
    } as never,
    defaultMandateId: 'mdt_default',
    defaultSource: 'cursor.beforeShellExecution',
    hostName: 'cursor',
    unmatchedPermission: 'ask',
    ...overrides,
  });
}

function receipt(decision: 'allowed' | 'approval' | 'blocked') {
  return {
    id: `rcpt_${decision}`,
    batchId: 'sim_123',
    receiptType: 'simulation',
    workspaceId: 'ws_123',
    mandateId: 'mdt_default',
    mandateVersion: 1,
    createdAt: '2026-03-16T08:00:00.000Z',
    scenarioId: 'shell.github.issue.label.command.abc123',
    title: 'Test action',
    description: 'Test action description',
    tool: 'issue.label',
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
      signedAt: '2026-03-16T08:00:00.000Z',
    },
    audit: {
      requestId: 'req_123',
      source: 'cursor.beforeShellExecution',
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

describe('MandateOsHostGateway', () => {
  it('allows read-only shell commands without calling MandateOS', async () => {
    const evaluateActions = vi.fn();
    const gateway = createGateway(evaluateActions);

    await expect(
      gateway.evaluateShellCommand({
        command: 'git diff --stat',
      }),
    ).resolves.toMatchObject({
      permission: 'allow',
      decision: 'local_allow',
    });

    expect(evaluateActions).not.toHaveBeenCalled();
  });

  it('evaluates generic shell mutations through MandateOS and allows when approved by policy', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('allowed')],
      },
    });
    const gateway = createGateway(evaluateActions);

    const result = await gateway.evaluateShellCommand({
      command: 'terraform apply -auto-approve',
      cwd: '/repo',
    });

    expect(result).toMatchObject({
      permission: 'allow',
      decision: 'policy_allowed',
      ruleId: 'terraform.mutation.command',
      route: 'generic',
    });
    expect(evaluateActions).toHaveBeenCalledWith({
      mandateId: 'mdt_default',
      source: 'cursor.beforeShellExecution',
      details: expect.objectContaining({
        channel: 'shell',
        matchedRuleId: 'terraform.mutation.command',
        cwd: '/repo',
      }),
      actions: [
        expect.objectContaining<ActionScenario>({
          tool: 'deploy.prod',
          riskLevel: 'high',
        }),
      ],
    });
  });

  it('redirects known enforced adapters onto MandateOS execute tools', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('allowed')],
      },
    });
    const gateway = createGateway(evaluateActions);

    const result = await gateway.evaluateShellCommand({
      command: 'gh issue edit 42 --add-label bug',
    });

    expect(result).toMatchObject({
      permission: 'deny',
      decision: 'redirect_enforced',
      recommendedTool: 'mandateos_execute_enforced_action',
    });
  });

  it('asks when policy returns approval', async () => {
    const evaluateActions = vi.fn().mockResolvedValue({
      data: {
        batchId: 'sim_123',
        receipts: [receipt('approval')],
      },
    });
    const gateway = createGateway(evaluateActions);

    await expect(
      gateway.evaluateShellCommand({
        command: 'kubectl apply -f prod.yaml',
      }),
    ).resolves.toMatchObject({
      permission: 'ask',
      decision: 'policy_approval',
    });
  });

  it('uses unmatched permission for unknown actions', async () => {
    const evaluateActions = vi.fn();
    const gateway = createGateway(evaluateActions, {
      client: {
        evaluateActions,
      } as never,
      unmatchedPermission: 'deny',
    });

    await expect(
      gateway.evaluateShellCommand({
        command: 'customctl do-the-thing',
      }),
    ).resolves.toMatchObject({
      permission: 'deny',
      decision: 'unmatched',
    });
  });

  it('allows MandateOS MCP tool calls without re-evaluating them', async () => {
    const evaluateActions = vi.fn();
    const gateway = createGateway(evaluateActions);

    await expect(
      gateway.evaluateMcpToolCall({
        toolName: 'mcp__mandateos__mandateos_get_context',
      }),
    ).resolves.toMatchObject({
      permission: 'allow',
      decision: 'local_allow',
    });

    expect(evaluateActions).not.toHaveBeenCalled();
  });
});

describe('host gateway helpers', () => {
  it('parses custom JSON rules and env permissions', () => {
    expect(
      parseHostGatewayRules([
        {
          id: 'custom.deploy',
          channel: 'shell',
          matcher: '^flyctl\\s+deploy\\b',
          tool: 'deploy.prod',
          title: 'Deploy with Fly.io',
          description: 'Deploy with command: {command}',
          zone: 'oecd',
          riskLevel: 'high',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'custom.deploy',
        route: 'generic',
      }),
    ]);

    expect(
      readHostGatewayUnmatchedPermission({
        MANDATE_OS_HOST_GATEWAY_UNMATCHED_PERMISSION: 'deny',
      }),
    ).toBe('deny');
    expect(
      toCursorHookResponse({ permission: 'ask', decision: 'unmatched' }),
    ).toEqual({
      continue: true,
      permission: 'ask',
    });
    expect(
      toClaudeHookResponse({
        permission: 'deny',
        decision: 'redirect_enforced',
        agentMessage: 'Use mandateos_execute_enforced_action instead.',
      }),
    ).toEqual({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Use mandateos_execute_enforced_action instead.',
      },
    });
  });

  it('parses starter bundles and supports multiple rule files from env', () => {
    const releasePlatformPath = path.resolve(
      rootDir,
      '../rules/starter-bundles/release-platform.json',
    );
    const docsContentPath = path.resolve(
      rootDir,
      '../rules/starter-bundles/docs-content.json',
    );
    const financeSupportPath = path.resolve(
      rootDir,
      '../rules/starter-bundles/finance-support.json',
    );

    expect(
      parseHostGatewayRules(
        JSON.parse(readFileSync(releasePlatformPath, 'utf8')),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'vercel.deploy.command',
          tool: 'deploy.prod',
        }),
      ]),
    );
    expect(
      parseHostGatewayRules(JSON.parse(readFileSync(docsContentPath, 'utf8'))),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'notion.publish.tool',
          tool: 'docs.publish',
        }),
      ]),
    );
    expect(
      parseHostGatewayRules(
        JSON.parse(readFileSync(financeSupportPath, 'utf8')),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'payment.execute.tool',
          tool: 'payment.execute',
        }),
      ]),
    );

    expect(
      readHostGatewayRulesFromEnv({
        MANDATE_OS_HOST_GATEWAY_RULES_FILES: [
          releasePlatformPath,
          docsContentPath,
        ].join(','),
        MANDATE_OS_HOST_GATEWAY_RULES_FILE: financeSupportPath,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'vercel.deploy.command' }),
        expect.objectContaining({ id: 'notion.publish.tool' }),
        expect.objectContaining({ id: 'payment.execute.tool' }),
      ]),
    );
  });
});
