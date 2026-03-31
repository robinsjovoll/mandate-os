import { createHash } from 'node:crypto';

import type { ReceiptRecord, RuntimeSimulationBatch } from './contracts.js';
import type { ActionScenario, RiskLevel, ToolId, Zone } from './mandates.js';
import { isRiskLevel, isToolId, isZone } from './mandates.js';
import type { MandateOsAgentClient } from './agent-client.js';
import {
  isPolicyGatewayRoute,
  recommendedToolForRoute,
  type PolicyGatewayRoute,
} from './enforced-capabilities.js';

export type PolicyGatewayPermission = 'allow' | 'ask' | 'deny';
export type PolicyGatewayChannel =
  | 'shell'
  | 'mcp'
  | 'browser'
  | 'agent'
  | 'node'
  | 'session';

export type MandateOsPolicyGatewayRule = {
  id: string;
  channel: PolicyGatewayChannel;
  matcher: string | RegExp;
  flags?: string;
  tool: ToolId;
  title: string;
  description: string;
  amountNok?: number;
  termMonths?: number;
  zone: Zone;
  riskLevel: RiskLevel;
  route?: PolicyGatewayRoute;
};

export type MandateOsPolicyGatewayOptions = {
  client: Pick<MandateOsAgentClient, 'evaluateActions'>;
  defaultMandateId?: string;
  defaultSource?: string;
  hostName?: string;
  unmatchedPermission?: PolicyGatewayPermission;
  rules: MandateOsPolicyGatewayRule[];
};

export type PolicyGatewayDecision =
  | 'local_allow'
  | 'policy_allowed'
  | 'policy_approval'
  | 'policy_blocked'
  | 'redirect_enforced'
  | 'unmatched'
  | 'misconfigured';

export type PolicyGatewayEvaluationResult = {
  permission: PolicyGatewayPermission;
  decision: PolicyGatewayDecision;
  ruleId?: string;
  route?: PolicyGatewayRoute;
  action?: ActionScenario;
  receipt?: ReceiptRecord;
  evaluation?: RuntimeSimulationBatch;
  userMessage?: string;
  agentMessage?: string;
  recommendedTool?: string;
};

export type PolicyGatewayAttempt = {
  channel: PolicyGatewayChannel;
  subject: string;
  mandateId?: string;
  source?: string;
  host?: string;
  details?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

type ResolvedPolicyGatewayRule = Omit<MandateOsPolicyGatewayRule, 'matcher'> & {
  pattern: RegExp;
};

export const readOnlyShellPatterns = [
  /^\s*(ls|pwd|cat|sed|rg|find)\b/i,
  /^\s*git\s+(status|diff|log|show)\b/i,
  /^\s*(pnpm|npm)\s+(test|lint|build)\b/i,
  /^\s*(vitest|jest|tsc|eslint)\b/i,
] as const;

export const defaultHostGatewayRules: MandateOsPolicyGatewayRule[] = [
  {
    id: 'github.issue.label.command',
    channel: 'shell',
    matcher: '^gh\\s+issue\\s+edit\\b(?=.*(?:--add-label|--remove-label)\\b)',
    flags: 'i',
    tool: 'issue.label',
    title: 'Change GitHub issue labels',
    description:
      'Attempt to change labels on a GitHub issue with command: {command}',
    zone: 'domestic',
    riskLevel: 'low',
    route: 'enforced.github.issue.label',
  },
  {
    id: 'github.pr.draft.command',
    channel: 'shell',
    matcher: '^gh\\s+pr\\s+ready\\b(?=.*--undo\\b)',
    flags: 'i',
    tool: 'pr.draft',
    title: 'Convert a GitHub pull request to draft',
    description:
      'Attempt to convert a GitHub pull request to draft with command: {command}',
    zone: 'domestic',
    riskLevel: 'low',
    route: 'enforced.github.pull_request.draft',
  },
  {
    id: 'github.repo.read.command',
    channel: 'shell',
    matcher: '^gh\\s+(issue|pr|repo)\\s+(view|list|status)\\b',
    flags: 'i',
    tool: 'repo.read',
    title: 'Read GitHub repository state',
    description: 'Inspect GitHub repository state with command: {command}',
    zone: 'domestic',
    riskLevel: 'low',
    route: 'generic',
  },
  {
    id: 'git.push.command',
    channel: 'shell',
    matcher: '^git\\s+push\\b',
    flags: 'i',
    tool: 'pr.draft',
    title: 'Push code changes to a remote branch',
    description: 'Push a git branch with command: {command}',
    zone: 'domestic',
    riskLevel: 'medium',
    route: 'generic',
  },
  {
    id: 'release.publish.command',
    channel: 'shell',
    matcher: '^(npm|pnpm)\\s+publish\\b',
    flags: 'i',
    tool: 'deploy.prod',
    title: 'Publish a package or release artifact',
    description:
      'Publish a package or release artifact with command: {command}',
    zone: 'oecd',
    riskLevel: 'high',
    route: 'generic',
  },
  {
    id: 'kubernetes.mutation.command',
    channel: 'shell',
    matcher:
      '^(kubectl|helm)\\s+(apply|delete|patch|scale|rollout|set|replace|upgrade|uninstall)\\b',
    flags: 'i',
    tool: 'deploy.prod',
    title: 'Mutate cluster state',
    description: 'Apply a cluster mutation with command: {command}',
    zone: 'oecd',
    riskLevel: 'high',
    route: 'generic',
  },
  {
    id: 'terraform.mutation.command',
    channel: 'shell',
    matcher: '^terraform\\s+(apply|destroy)\\b',
    flags: 'i',
    tool: 'deploy.prod',
    title: 'Mutate infrastructure with Terraform',
    description: 'Apply infrastructure changes with command: {command}',
    zone: 'oecd',
    riskLevel: 'high',
    route: 'generic',
  },
  {
    id: 'cloud.mutation.command',
    channel: 'shell',
    matcher:
      '^(aws|gcloud|az)\\b.*\\b(create|delete|deploy|apply|start|stop|update|put|run|invoke)\\b',
    flags: 'i',
    tool: 'deploy.prod',
    title: 'Mutate cloud infrastructure',
    description:
      'Apply a cloud infrastructure mutation with command: {command}',
    zone: 'oecd',
    riskLevel: 'high',
    route: 'generic',
  },
  {
    id: 'github.issue.label.tool',
    channel: 'mcp',
    matcher:
      '(^|[._:-])(github|gh)([._:-].*)?(issue|issues)([._:-].*)?label([._:-]|$)',
    flags: 'i',
    tool: 'issue.label',
    title: 'Change GitHub issue labels',
    description:
      'Attempt to change GitHub issue labels with MCP tool {toolName}',
    zone: 'domestic',
    riskLevel: 'low',
    route: 'enforced.github.issue.label',
  },
  {
    id: 'github.pr.draft.tool',
    channel: 'mcp',
    matcher:
      '(^|[._:-])(github|gh)([._:-].*)?(pull[_-]?request|pr)([._:-].*)?draft([._:-]|$)',
    flags: 'i',
    tool: 'pr.draft',
    title: 'Convert a GitHub pull request to draft',
    description:
      'Attempt to convert a GitHub pull request to draft with MCP tool {toolName}',
    zone: 'domestic',
    riskLevel: 'low',
    route: 'enforced.github.pull_request.draft',
  },
  {
    id: 'repo.read.tool',
    channel: 'mcp',
    matcher:
      '(github|repo|git).*(read|get|view|list|search|fetch)|(read|get|view|list|search|fetch).*(github|repo|git)',
    flags: 'i',
    tool: 'repo.read',
    title: 'Read repository state',
    description: 'Inspect repository state with MCP tool {toolName}',
    zone: 'domestic',
    riskLevel: 'low',
    route: 'generic',
  },
  {
    id: 'docs.publish.tool',
    channel: 'mcp',
    matcher:
      '(docs|documentation|notion|confluence).*(publish|deploy|write|update|create)|(publish|deploy).*(docs|documentation|notion|confluence)',
    flags: 'i',
    tool: 'docs.publish',
    title: 'Publish documentation or public content',
    description: 'Publish public-facing content with MCP tool {toolName}',
    zone: 'oecd',
    riskLevel: 'medium',
    route: 'generic',
  },
  {
    id: 'deploy.prod.tool',
    channel: 'mcp',
    matcher:
      '(deploy|kubernetes|kubectl|helm|terraform|vercel|netlify|cloudflare|aws|gcloud|azure|az)',
    flags: 'i',
    tool: 'deploy.prod',
    title: 'Mutate deployed infrastructure',
    description: 'Apply infrastructure changes with MCP tool {toolName}',
    zone: 'oecd',
    riskLevel: 'high',
    route: 'generic',
  },
  {
    id: 'erp.read.tool',
    channel: 'mcp',
    matcher:
      '(erp|sap|netsuite|invoice|procurement).*(read|get|list|query|search)|(read|get|list|query|search).*(erp|sap|netsuite|invoice|procurement)',
    flags: 'i',
    tool: 'erp.read',
    title: 'Read finance or procurement context',
    description: 'Read finance or procurement context with MCP tool {toolName}',
    zone: 'eea',
    riskLevel: 'low',
    route: 'generic',
  },
  {
    id: 'payment.execute.tool',
    channel: 'mcp',
    matcher:
      '(payment|stripe|billing).*(charge|capture|pay|invoice)|(charge|capture|pay|invoice).*(payment|stripe|billing)',
    flags: 'i',
    tool: 'payment.execute',
    title: 'Execute a payment or capture funds',
    description: 'Execute a payment or capture funds with MCP tool {toolName}',
    zone: 'oecd',
    riskLevel: 'high',
    route: 'generic',
  },
  {
    id: 'support.refund.tool',
    channel: 'mcp',
    matcher: '(refund|credit)',
    flags: 'i',
    tool: 'support.refund',
    title: 'Issue a refund or service credit',
    description: 'Issue a refund or credit with MCP tool {toolName}',
    zone: 'domestic',
    riskLevel: 'medium',
    route: 'generic',
  },
] as const;

export const openClawPolicyGatewayRules: MandateOsPolicyGatewayRule[] = [
  {
    id: 'openclaw.browser.read',
    channel: 'browser',
    matcher:
      '^(status|profiles|tabs|snapshot|screenshot|console|network|pdf|inspect|open|focus|close)$',
    flags: 'i',
    tool: 'browser.read',
    title: 'Inspect browser state',
    description:
      'Inspect browser state with OpenClaw browser action {browserAction}',
    zone: 'oecd',
    riskLevel: 'low',
    route: 'generic',
  },
  {
    id: 'openclaw.browser.mutate',
    channel: 'browser',
    matcher:
      '^(start|stop|navigate|back|forward|reload|click|double-click|type|fill|select|upload|drag|wait|evaluate|state|cookies|storage|action)$',
    flags: 'i',
    tool: 'browser.mutate',
    title: 'Mutate browser state',
    description:
      'Mutate browser state with OpenClaw browser action {browserAction}',
    zone: 'oecd',
    riskLevel: 'medium',
    route: 'enforced.openclaw.browser.mutate',
  },
  {
    id: 'openclaw.agent.spawn',
    channel: 'agent',
    matcher: '^(sessions_spawn|spawn|subagent|run)$',
    flags: 'i',
    tool: 'agent.spawn',
    title: 'Spawn a sub-agent session',
    description: 'Spawn an OpenClaw sub-agent with message: {message}',
    zone: 'domestic',
    riskLevel: 'medium',
    route: 'enforced.openclaw.agent.spawn',
  },
  {
    id: 'openclaw.node.command',
    channel: 'node',
    matcher: '.+',
    tool: 'node.command',
    title: 'Run a node command',
    description: 'Execute a node-host command: {command}',
    zone: 'domestic',
    riskLevel: 'medium',
    route: 'generic',
  },
  {
    id: 'openclaw.session.control',
    channel: 'session',
    matcher: '.+',
    tool: 'session.control',
    title: 'Control an OpenClaw session',
    description: 'Control an OpenClaw session with operation: {operation}',
    zone: 'domestic',
    riskLevel: 'medium',
    route: 'generic',
  },
  {
    id: 'openclaw.shell.exec',
    channel: 'shell',
    matcher: '.+',
    tool: 'shell.exec',
    title: 'Execute a shell command',
    description: 'Execute a shell command through OpenClaw: {command}',
    zone: 'domestic',
    riskLevel: 'medium',
    route: 'enforced.openclaw.exec',
  },
] as const;

export class MandateOsPolicyGateway {
  private readonly defaultMandateId?: string;
  private readonly defaultSource?: string;
  private readonly hostName: string;
  private readonly unmatchedPermission: PolicyGatewayPermission;
  private readonly rules: ResolvedPolicyGatewayRule[];

  constructor(private readonly options: MandateOsPolicyGatewayOptions) {
    this.defaultMandateId = normalizeOptionalText(options.defaultMandateId);
    this.defaultSource = normalizeOptionalText(options.defaultSource);
    this.hostName = normalizeOptionalText(options.hostName) || 'policy-gateway';
    this.unmatchedPermission = normalizePermission(
      options.unmatchedPermission,
      'ask',
    );
    this.rules = options.rules.map(resolvePolicyGatewayRule);
  }

  async evaluateAttempt(
    input: PolicyGatewayAttempt,
  ): Promise<PolicyGatewayEvaluationResult> {
    const subject = input.subject.trim();

    if (!subject) {
      return {
        permission: 'allow',
        decision: 'local_allow',
      };
    }

    const rule = this.findRule(input.channel, subject);

    if (!rule) {
      return this.createUnmatchedResult(
        input.channel,
        `No MandateOS policy rule matched the ${input.channel} subject: ${truncate(
          subject,
          200,
        )}. Add a custom rule or call MandateOS explicitly before continuing.`,
      );
    }

    return this.evaluateMatchedAttempt({
      channel: input.channel,
      rule,
      subject,
      mandateId: input.mandateId,
      source: input.source,
      host: input.host,
      details: input.details,
      context: input.context || {},
    });
  }

  createUnmatchedResult(
    channel: PolicyGatewayChannel,
    agentMessage: string,
  ): PolicyGatewayEvaluationResult {
    const permission = this.unmatchedPermission;
    const unmatchedMessage = `MandateOS could not classify this ${channel} action automatically and unmatched actions are configured to ${permission}.`;

    return {
      permission,
      decision: 'unmatched',
      userMessage: permission === 'allow' ? undefined : unmatchedMessage,
      agentMessage:
        permission === 'allow'
          ? undefined
          : `${agentMessage} This is a MandateOS classification gap, not a sandbox startup failure. Configure a custom rule, call the explicit MandateOS evaluation tool, or change the unmatched permission mode.`,
    };
  }

  private findRule(channel: PolicyGatewayChannel, subject: string) {
    return this.rules.find(
      (rule) => rule.channel === channel && rule.pattern.test(subject),
    );
  }

  private async evaluateMatchedAttempt(input: {
    channel: PolicyGatewayChannel;
    rule: ResolvedPolicyGatewayRule;
    subject: string;
    mandateId?: string;
    source?: string;
    host?: string;
    details?: Record<string, unknown>;
    context: Record<string, unknown>;
  }): Promise<PolicyGatewayEvaluationResult> {
    const mandateId =
      normalizeOptionalText(input.mandateId) || this.defaultMandateId;

    if (!mandateId) {
      return {
        permission: 'deny',
        decision: 'misconfigured',
        ruleId: input.rule.id,
        route: input.rule.route || 'generic',
        userMessage:
          'MandateOS could not evaluate this action because the bridge is missing a mandate id.',
        agentMessage:
          'Blocked by MandateOS bridge misconfiguration: no mandate id is available for policy evaluation. Configure MANDATE_OS_MCP_DEFAULT_MANDATE_ID or pass mandateId explicitly before retrying.',
      };
    }

    const action = createActionScenario(
      input.rule,
      input.subject,
      input.context,
    );
    const evaluation = await this.options.client.evaluateActions({
      mandateId,
      source:
        normalizeOptionalText(input.source) ||
        this.defaultSource ||
        `${input.host || this.hostName}.${input.channel}`,
      details: {
        host: input.host || this.hostName,
        channel: input.channel,
        matchedRuleId: input.rule.id,
        subject: truncate(input.subject, 500),
        ...(input.details || {}),
      },
      actions: [action],
    });
    const receipt = evaluation.data.receipts[0];

    if (!receipt) {
      throw new Error(
        'MandateOS policy gateway did not receive a receipt for the evaluated action.',
      );
    }

    if (receipt.decision === 'allowed') {
      if (input.rule.route && input.rule.route !== 'generic') {
        const recommendedTool = recommendedToolForRoute(input.rule.route);

        return {
          permission: 'deny',
          decision: 'redirect_enforced',
          ruleId: input.rule.id,
          route: input.rule.route,
          action,
          receipt,
          evaluation: evaluation.data,
          recommendedTool,
          userMessage: `MandateOS allowed this action, but the direct ${input.channel} path is intentionally blocked by policy. Use ${recommendedTool} instead.`,
          agentMessage: `MandateOS allowed ${receipt.title} via rule ${input.rule.id}, but the direct ${input.channel} path remains blocked by the enforced route ${input.rule.route}. Use ${recommendedTool} next. This is a MandateOS policy-wrapper block, not a sandbox or plugin startup error. Receipt ${receipt.id}.`,
        };
      }

      return {
        permission: 'allow',
        decision: 'policy_allowed',
        ruleId: input.rule.id,
        route: input.rule.route || 'generic',
        action,
        receipt,
        evaluation: evaluation.data,
      };
    }

    if (receipt.decision === 'approval') {
      return {
        permission: 'ask',
        decision: 'policy_approval',
        ruleId: input.rule.id,
        route: input.rule.route || 'generic',
        action,
        receipt,
        evaluation: evaluation.data,
        userMessage: `MandateOS requires approval before this action can continue. ${formatReceiptReasons(
          receipt,
        )}`,
        agentMessage: `MandateOS returned approval for ${receipt.title} via rule ${input.rule.id}. ${formatReceiptReasons(
          receipt,
        )} This is an approval requirement, not a sandbox or plugin misconfiguration.`,
      };
    }

    return {
      permission: 'deny',
      decision: 'policy_blocked',
      ruleId: input.rule.id,
      route: input.rule.route || 'generic',
      action,
      receipt,
      evaluation: evaluation.data,
      userMessage: `MandateOS blocked this action. ${formatReceiptReasons(
        receipt,
      )}`,
      agentMessage: `MandateOS blocked ${receipt.title} via rule ${input.rule.id}. ${formatReceiptReasons(
        receipt,
      )} This is a policy denial, not a sandbox or plugin startup failure.`,
    };
  }
}

export function parsePolicyGatewayRules(
  input: unknown,
): MandateOsPolicyGatewayRule[] {
  const rulesProperty =
    input && typeof input === 'object' && 'rules' in input
      ? (input as { rules?: unknown }).rules
      : undefined;
  const source = Array.isArray(input)
    ? input
    : Array.isArray(rulesProperty)
      ? rulesProperty
      : null;

  if (!source) {
    throw new Error(
      'MandateOS policy rules must be a JSON array or an object with a rules array.',
    );
  }

  return source.map((entry: unknown, index: number) => {
    const rule =
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : null;

    if (!rule) {
      throw new Error(
        `MandateOS policy rule at index ${index} must be an object.`,
      );
    }

    const id = normalizeOptionalText(rule.id);
    const channel = normalizeOptionalText(rule.channel) as PolicyGatewayChannel;
    const matcher = rule.matcher;
    const flags = normalizeOptionalText(rule.flags) || undefined;
    const tool = normalizeOptionalText(rule.tool) as ToolId;
    const title = normalizeOptionalText(rule.title);
    const description = normalizeOptionalText(rule.description);
    const zone = normalizeOptionalText(rule.zone) as Zone;
    const riskLevel = normalizeOptionalText(rule.riskLevel) as RiskLevel;
    const route = normalizeOptionalText(rule.route) as PolicyGatewayRoute;
    const amountNok = normalizeOptionalNumber(rule.amountNok);
    const termMonths = normalizeOptionalNumber(rule.termMonths);

    if (!id) {
      throw new Error(`MandateOS policy rule at index ${index} is missing id.`);
    }

    if (!isPolicyGatewayChannel(channel)) {
      throw new Error(
        `MandateOS policy rule ${id} has invalid channel ${String(rule.channel)}.`,
      );
    }

    if (typeof matcher !== 'string') {
      throw new Error(
        `MandateOS policy rule ${id} must use a string matcher when loaded from JSON.`,
      );
    }

    if (!title) {
      throw new Error(`MandateOS policy rule ${id} is missing title.`);
    }

    if (!description) {
      throw new Error(`MandateOS policy rule ${id} is missing description.`);
    }

    if (!isToolId(tool)) {
      throw new Error(`MandateOS policy rule ${id} has invalid tool.`);
    }

    if (!isZone(zone)) {
      throw new Error(`MandateOS policy rule ${id} has invalid zone.`);
    }

    if (!isRiskLevel(riskLevel)) {
      throw new Error(`MandateOS policy rule ${id} has invalid riskLevel.`);
    }

    if (route && !isPolicyGatewayRoute(route)) {
      throw new Error(`MandateOS policy rule ${id} has invalid route.`);
    }

    return {
      id,
      channel,
      matcher,
      flags,
      tool,
      title,
      description,
      amountNok: amountNok ?? undefined,
      termMonths: termMonths ?? undefined,
      zone,
      riskLevel,
      route: route || 'generic',
    };
  });
}

export function normalizeMcpToolName(value: string) {
  return value.trim().replace(/^MCP:/i, '').trim();
}

export function isMandateOsToolName(value: string) {
  const normalized = normalizeMcpToolName(value).toLowerCase();

  return (
    normalized.startsWith('mandateos_') ||
    normalized.startsWith('mcp__mandateos__') ||
    normalized.includes('__mandateos_')
  );
}

export function summarizeJson(value: unknown) {
  if (value == null) {
    return '';
  }

  try {
    return truncate(JSON.stringify(value), 220);
  } catch {
    return truncate(String(value), 220);
  }
}

export function isReadOnlyShellCommand(command: string) {
  return readOnlyShellPatterns.some((pattern) => pattern.test(command.trim()));
}

export function isPolicyGatewayChannel(
  value: string,
): value is PolicyGatewayChannel {
  return ['shell', 'mcp', 'browser', 'agent', 'node', 'session'].includes(
    value,
  );
}

export function normalizePermission(
  value: unknown,
  fallback: PolicyGatewayPermission,
): PolicyGatewayPermission {
  return value === 'allow' || value === 'ask' || value === 'deny'
    ? value
    : fallback;
}

export function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return undefined;
}

export function splitCommaSeparatedList(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function truncate(value: string, maxLength: number) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 3)}...`;
}

function formatReceiptReasons(receipt: ReceiptRecord) {
  return receipt.reasons.length > 0
    ? `Reasons: ${receipt.reasons.join(' ')}`
    : 'No detailed reason was returned by MandateOS.';
}

function resolvePolicyGatewayRule(
  rule: MandateOsPolicyGatewayRule,
): ResolvedPolicyGatewayRule {
  return {
    ...rule,
    route: rule.route || 'generic',
    pattern:
      rule.matcher instanceof RegExp
        ? rule.matcher
        : new RegExp(rule.matcher, rule.flags),
  };
}

function createActionScenario(
  rule: ResolvedPolicyGatewayRule,
  subject: string,
  context: Record<string, unknown>,
): ActionScenario {
  const token = createStableToken(`${rule.channel}:${rule.id}:${subject}`);

  return {
    id: truncate(`${rule.channel}.${rule.id}.${token}`, 120),
    title: truncate(fillTemplate(rule.title, context), 160),
    description: truncate(fillTemplate(rule.description, context), 1000),
    tool: rule.tool,
    amountNok: rule.amountNok ?? 0,
    termMonths: rule.termMonths ?? 0,
    zone: rule.zone,
    riskLevel: rule.riskLevel,
    receiptSuffix: token.slice(0, 10),
  };
}

function fillTemplate(
  template: string,
  values: Record<string, unknown>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = values[key];

    return typeof value === 'string'
      ? truncate(value, 220)
      : value == null
        ? ''
        : truncate(String(value), 220);
  });
}

function createStableToken(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
