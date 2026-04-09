#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  getLegacyToolNameForExecutionKind,
  mandateOsGenericEnforcedExecuteToolName,
} from '@mandate-os/sdk';

export * from './host-gateway.js';

import {
  createMandateOsClient,
  createMandateOsMcpHandlers,
  toToolErrorResult,
  toToolSuccessResult,
} from './handlers.js';
import { readMandateOsMcpConfig } from './config.js';
import { isInvokedAsEntrypoint } from './entrypoint.js';
import {
  contextSummarySchema,
  evaluateActionsInputSchema,
  executeEnforcedActionInputSchema,
  executeGitHubIssueLabelInputSchema,
  executeGitHubPullRequestDraftInputSchema,
  issueExecutionGrantInputSchema,
  mandateDraftSchema,
  policyCatalogSchema,
  verifyExecutionGrantInputSchema,
  verifyMandateInputSchema,
  verifyReceiptInputSchema,
} from './schemas.js';

export function createMandateOsMcpServer() {
  const config = readMandateOsMcpConfig();
  const client = createMandateOsClient(config);
  const handlers = createMandateOsMcpHandlers({
    client,
    config,
  });
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  const registerTool = <TToolConfig>(
    name: string,
    toolConfig: TToolConfig,
    handler: (args: unknown) => Promise<unknown>,
  ) => {
    server.registerTool(name, toolConfig as never, async (args) => {
      try {
        return toToolSuccessResult(
          (await handler(args)) as Record<string, unknown>,
        );
      } catch (error) {
        return toToolErrorResult(error);
      }
    });
  };

  registerTool(
    'mandateos_get_context',
    {
      title: 'MandateOS Context',
      description:
        'Returns the MandateOS MCP defaults and the recommended generic versus enforced workflow.',
      outputSchema: contextSummarySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    () => handlers.getContext(),
  );

  registerTool(
    'mandateos_get_policy_catalog',
    {
      title: 'MandateOS Policy Catalog',
      description:
        'Returns the local MandateOS preset catalog, tool catalog, and region or zone labels so agents can construct mandates and actions correctly.',
      outputSchema: policyCatalogSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    () => handlers.getPolicyCatalog(),
  );

  registerTool(
    'mandateos_issue_mandate',
    {
      title: 'Issue Mandate',
      description:
        'Creates a new MandateOS mandate for the current workspace. Use this when no suitable mandate id is already configured.',
      inputSchema: mandateDraftSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      handlers.issueMandate(
        args as Parameters<typeof handlers.issueMandate>[0],
      ),
  );

  registerTool(
    'mandateos_evaluate_actions',
    {
      title: 'Evaluate Actions',
      description:
        'Evaluates one or more proposed actions through MandateOS and returns signed receipts with allowed, approval, or blocked decisions. Use this before any side effect that MandateOS does not execute itself.',
      inputSchema: evaluateActionsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      handlers.evaluateActions(
        args as Parameters<typeof handlers.evaluateActions>[0],
      ),
  );

  registerTool(
    'mandateos_issue_execution_grant',
    {
      title: 'Issue Execution Grant',
      description:
        'Mints a short-lived MandateOS execution grant from an allowed receipt for one of the currently enforced adapters.',
      inputSchema: issueExecutionGrantInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      handlers.issueExecutionGrant(
        args as Parameters<typeof handlers.issueExecutionGrant>[0],
      ),
  );

  registerTool(
    'mandateos_verify_mandate',
    {
      title: 'Verify Mandate Signature',
      description:
        'Verifies the signature envelope of a MandateOS mandate record.',
      inputSchema: verifyMandateInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      handlers.verifyMandate(
        args as Parameters<typeof handlers.verifyMandate>[0],
      ),
  );

  registerTool(
    'mandateos_verify_receipt',
    {
      title: 'Verify Receipt Signature',
      description:
        'Verifies the signature envelope of a MandateOS receipt record.',
      inputSchema: verifyReceiptInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      handlers.verifyReceipt(
        args as Parameters<typeof handlers.verifyReceipt>[0],
      ),
  );

  registerTool(
    'mandateos_verify_execution_grant',
    {
      title: 'Verify Execution Grant Signature',
      description:
        'Verifies the signature envelope of a MandateOS execution grant.',
      inputSchema: verifyExecutionGrantInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      handlers.verifyExecutionGrant(
        args as Parameters<typeof handlers.verifyExecutionGrant>[0],
      ),
  );

  registerTool(
    mandateOsGenericEnforcedExecuteToolName,
    {
      title: 'Execute Enforced Action',
      description:
        'Runs the full MandateOS evaluate -> grant -> execute loop for any MandateOS-owned enforcement route.',
      inputSchema: executeEnforcedActionInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    (args) =>
      handlers.executeEnforcedAction(
        args as Parameters<typeof handlers.executeEnforcedAction>[0],
      ),
  );

  const githubIssueLabelLegacyTool =
    getLegacyToolNameForExecutionKind('github.issue.label') ||
    'mandateos_execute_github_issue_label';
  registerTool(
    githubIssueLabelLegacyTool,
    {
      title: 'Execute GitHub Issue Label',
      description:
        'Legacy alias for the generic MandateOS enforced execution tool, preconfigured for GitHub issue labeling.',
      inputSchema: executeGitHubIssueLabelInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    (args) =>
      handlers.executeEnforcedAction({
        ...(args as Parameters<typeof handlers.executeGitHubIssueLabel>[0]),
        kind: 'github.issue.label',
      }),
  );

  const githubPullRequestDraftLegacyTool =
    getLegacyToolNameForExecutionKind('github.pull_request.draft') ||
    'mandateos_execute_github_pull_request_draft';
  registerTool(
    githubPullRequestDraftLegacyTool,
    {
      title: 'Execute GitHub Pull Request Draft',
      description:
        'Legacy alias for the generic MandateOS enforced execution tool, preconfigured for GitHub pull request draft control.',
      inputSchema: executeGitHubPullRequestDraftInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    (args) =>
      handlers.executeEnforcedAction({
        ...(args as Parameters<
          typeof handlers.executeGitHubPullRequestDraft
        >[0]),
        kind: 'github.pull_request.draft',
      }),
  );

  return server;
}

async function main() {
  const server = createMandateOsMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('MandateOS MCP server running on stdio');
}

if (isInvokedAsEntrypoint(import.meta.url)) {
  main().catch((error) => {
    console.error('MandateOS MCP server failed:', error);
    process.exit(1);
  });
}
