import * as z from 'zod/v4';
import {
  decisions,
  getExpectedActionToolForExecutionKind,
  isEnforcedExecutionKind,
  regionIds,
  riskLevels,
  toolIds,
  type EnforcedExecutionKind,
  zones,
} from '@mandate-os/sdk';

export const detailsSchema = z
  .record(z.string(), z.unknown())
  .describe('Optional JSON metadata copied into MandateOS audit details.');

export const mandateDraftSchema = z.object({
  presetId: z
    .string()
    .trim()
    .min(1)
    .describe('Mandate preset id or custom label.'),
  owner: z
    .string()
    .trim()
    .min(1)
    .describe('Human or team that owns the mandate.'),
  agentName: z
    .string()
    .trim()
    .min(1)
    .describe('Stable agent identity or workflow name.'),
  purpose: z
    .string()
    .trim()
    .min(1)
    .describe('Natural-language purpose of the mandate.'),
  monthlyCapNok: z
    .number()
    .finite()
    .nonnegative()
    .describe('Monthly spending cap in NOK. Use 0 for no-spend workflows.'),
  approvalTermMonths: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Maximum auto-approved term length in months before approval is required.',
    ),
  allowedRegion: z
    .enum(regionIds)
    .describe('Maximum allowed region boundary for this mandate.'),
  allowedTools: z
    .array(z.enum(toolIds))
    .min(1)
    .describe('Tools this mandate may authorize.'),
});

export const actionScenarioSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .describe('Stable scenario id for the proposed action.'),
  title: z
    .string()
    .trim()
    .min(1)
    .describe('Short human-readable action title.'),
  description: z
    .string()
    .trim()
    .min(1)
    .describe('Detailed description of the proposed external action.'),
  tool: z.enum(toolIds).describe('Tool category the action belongs to.'),
  amountNok: z
    .number()
    .finite()
    .nonnegative()
    .describe('Financial exposure of the action in NOK.'),
  termMonths: z
    .number()
    .int()
    .nonnegative()
    .describe('Contract or commitment duration in months.'),
  zone: z.enum(zones).describe('Execution boundary of the action.'),
  riskLevel: z.enum(riskLevels).describe('Risk classification for the action.'),
  receiptSuffix: z
    .string()
    .trim()
    .min(1)
    .describe('Short suffix used for receipt ids and traceability.'),
});

export const evaluateActionsInputSchema = z.object({
  mandateId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      'Mandate id to evaluate against. Optional when the MCP server has a default mandate configured.',
    ),
  source: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      'Stable workflow source label. Defaults to the MCP server source if configured.',
    ),
  details: detailsSchema.optional(),
  actions: z
    .array(actionScenarioSchema)
    .min(1)
    .describe('Proposed actions to evaluate through MandateOS.'),
});

export const verifyMandateInputSchema = z.object({
  mandateId: z.string().trim().min(1).describe('Mandate id to verify.'),
});

export const verifyReceiptInputSchema = z.object({
  receiptId: z.string().trim().min(1).describe('Receipt id to verify.'),
});

export const verifyExecutionGrantInputSchema = z.object({
  grantId: z.string().trim().min(1).describe('Execution grant id to verify.'),
});

export const githubIssueLabelExecutionPayloadSchema = z.object({
  owner: z.string().trim().min(1).describe('GitHub repository owner.'),
  repo: z.string().trim().min(1).describe('GitHub repository name.'),
  issueNumber: z
    .number()
    .int()
    .positive()
    .describe('GitHub issue number to label.'),
  labels: z
    .array(z.string().trim().min(1))
    .min(1)
    .describe(
      'Labels to apply through the MandateOS-owned GitHub integration.',
    ),
});

export const githubPullRequestDraftExecutionPayloadSchema = z.object({
  owner: z.string().trim().min(1).describe('GitHub repository owner.'),
  repo: z.string().trim().min(1).describe('GitHub repository name.'),
  pullRequestNumber: z
    .number()
    .int()
    .positive()
    .describe('GitHub pull request number to keep in draft.'),
});

const enforcedExecutionPayloadSchemas = {
  'github.issue.label': githubIssueLabelExecutionPayloadSchema,
  'github.pull_request.draft': githubPullRequestDraftExecutionPayloadSchema,
} as const;

function createExecuteEnforcedActionInputSchema<
  K extends EnforcedExecutionKind,
>(kind: K) {
  const actionTool = getExpectedActionToolForExecutionKind(kind);

  return z.object({
    mandateId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Mandate id to evaluate against. Optional when the MCP server has a default mandate configured.',
      ),
    source: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Stable workflow source label. Defaults to the MCP server source if configured.',
      ),
    details: detailsSchema.optional(),
    kind: z.literal(kind),
    action: actionScenarioSchema
      .refine((action) => action.tool === actionTool, {
        path: ['tool'],
        message: `action.tool must be ${actionTool}.`,
      })
      .describe(
        'Action scenario to evaluate before the MandateOS-owned enforcement route executes.',
      ),
    payload: enforcedExecutionPayloadSchemas[kind],
    grantExpiresInSeconds: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional execution grant ttl in seconds.'),
  });
}

export const issueExecutionGrantInputSchema = z.object({
  receiptId: z
    .string()
    .trim()
    .min(1)
    .describe('Allowed receipt id used to mint the grant.'),
  kind: z.string().trim().min(1).refine(isEnforcedExecutionKind, {
    message: 'kind must be a supported MandateOS enforced execution kind.',
  }),
  payload: detailsSchema.describe(
    'Capability-specific payload for the enforced execution grant.',
  ),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Optional grant ttl in seconds.'),
});

export const executeEnforcedActionInputSchema = z
  .object({
    mandateId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Mandate id to evaluate against. Optional when the MCP server has a default mandate configured.',
      ),
    source: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Stable workflow source label. Defaults to the MCP server source if configured.',
      ),
    details: detailsSchema.optional(),
    kind: z.string().trim().min(1).refine(isEnforcedExecutionKind, {
      message: 'kind must be a supported MandateOS enforced execution kind.',
    }),
    action: actionScenarioSchema.describe(
      'Action scenario to evaluate before the MandateOS-owned enforcement route executes.',
    ),
    payload: detailsSchema.describe(
      'Capability-specific payload for the enforced execution route.',
    ),
    grantExpiresInSeconds: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional execution grant ttl in seconds.'),
  })
  .superRefine((input, ctx) => {
    if (!isEnforcedExecutionKind(input.kind)) {
      return;
    }

    const actionTool = getExpectedActionToolForExecutionKind(input.kind);

    if (input.action.tool !== actionTool) {
      ctx.addIssue({
        code: 'custom',
        path: ['action', 'tool'],
        message: `action.tool must be ${actionTool}.`,
      });
    }
  });

export const executeGitHubIssueLabelInputSchema =
  createExecuteEnforcedActionInputSchema('github.issue.label').omit({
    kind: true,
  });

export const executeGitHubPullRequestDraftInputSchema =
  createExecuteEnforcedActionInputSchema('github.pull_request.draft').omit({
    kind: true,
  });

export const policyCatalogSchema = z.object({
  defaultPresetId: z.string(),
  tools: z.array(
    z.object({
      id: z.enum(toolIds),
      label: z.string(),
      hint: z.string(),
    }),
  ),
  presets: z.array(
    z.object({
      presetId: z.string(),
      label: z.string(),
      summary: z.string(),
      owner: z.string(),
      agentName: z.string(),
      purpose: z.string(),
      monthlyCapNok: z.number(),
      approvalTermMonths: z.number(),
      allowedRegion: z.enum(regionIds),
      allowedTools: z.array(z.enum(toolIds)),
    }),
  ),
  regionLabels: z.record(z.string(), z.string()),
  zoneLabels: z.record(z.string(), z.string()),
});

export const contextSummarySchema = z.object({
  baseUrl: z.string(),
  serverName: z.string(),
  serverVersion: z.string(),
  defaultMandateId: z.string().nullable(),
  defaultSource: z.string().nullable(),
  genericTools: z.array(z.string()),
  enforcedTools: z.array(z.string()),
  workflowGuidance: z.array(z.string()),
});

export const decisionEnumSchema = z.enum(decisions);
