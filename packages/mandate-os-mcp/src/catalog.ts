import type { MandateDraft } from '@mandate-os/sdk';

export const toolCatalog = [
  {
    id: 'repo.read',
    label: 'Repo read',
    hint: 'Inspect issues, pull requests, and docs content',
  },
  {
    id: 'issue.label',
    label: 'Issue label',
    hint: 'Classify and route issue backlog items',
  },
  {
    id: 'pr.draft',
    label: 'Draft PR',
    hint: 'Prepare changes without merging them',
  },
  {
    id: 'docs.publish',
    label: 'Docs publish',
    hint: 'Push content to public-facing documentation',
  },
  {
    id: 'erp.read',
    label: 'ERP read',
    hint: 'Read supplier and invoice context',
  },
  {
    id: 'quote.request',
    label: 'Quote request',
    hint: 'Ask vendors for offers',
  },
  {
    id: 'contract.draft',
    label: 'Contract draft',
    hint: 'Prepare agreement drafts',
  },
  {
    id: 'payment.execute',
    label: 'Payment execute',
    hint: 'Release money',
  },
  {
    id: 'deploy.prod',
    label: 'Prod deploy',
    hint: 'Touch live systems',
  },
  {
    id: 'support.refund',
    label: 'Support refund',
    hint: 'Return money to customers',
  },
  {
    id: 'shell.exec',
    label: 'Shell exec',
    hint: 'Run commands through a guarded shell surface',
  },
  {
    id: 'browser.read',
    label: 'Browser read',
    hint: 'Inspect browser state without mutating it',
  },
  {
    id: 'browser.mutate',
    label: 'Browser mutate',
    hint: 'Drive browser actions that change state',
  },
  {
    id: 'agent.spawn',
    label: 'Agent spawn',
    hint: 'Create sub-agents or delegated runs',
  },
  {
    id: 'node.command',
    label: 'Node command',
    hint: 'Run commands against OpenClaw-connected nodes',
  },
  {
    id: 'session.control',
    label: 'Session control',
    hint: 'Inspect or control existing OpenClaw sessions',
  },
] as const;

export const regionLabels: Record<'eea' | 'oecd' | 'global', string> = {
  eea: 'Internal + trusted systems',
  oecd: 'Internal + trusted + public surfaces',
  global: 'Any connected surface except restricted',
};

export const presets: Array<
  MandateDraft & {
    label: string;
    summary: string;
  }
> = [
  {
    presetId: 'repo-steward',
    label: 'Repo steward',
    summary:
      'Zero-spend pilot for GitHub and docs workflows where public publishing still requires approval.',
    owner: 'Engineering / Docs',
    agentName: 'repo_steward',
    purpose:
      'triage issues, draft pull requests, and escalate before anything public is published',
    monthlyCapNok: 5000,
    approvalTermMonths: 3,
    allowedRegion: 'oecd',
    allowedTools: ['repo.read', 'issue.label', 'pr.draft', 'docs.publish'],
  },
  {
    presetId: 'vendor-bot',
    label: 'Vendor delegate',
    summary:
      'Best for procurement and finance operations with tight regional control.',
    owner: 'CFO / Procurement',
    agentName: 'vendor_bot',
    purpose: 'source suppliers, draft contracts, and release low-risk payments',
    monthlyCapNok: 50000,
    approvalTermMonths: 12,
    allowedRegion: 'eea',
    allowedTools: [
      'erp.read',
      'quote.request',
      'contract.draft',
      'payment.execute',
    ],
  },
  {
    presetId: 'release-guardian',
    label: 'Release guardian',
    summary:
      'Best for code agents that need live safeguards around production work.',
    owner: 'CTO / Platform',
    agentName: 'release_guardian',
    purpose:
      'draft changes, inspect systems, and escalate before risky production work',
    monthlyCapNok: 10000,
    approvalTermMonths: 6,
    allowedRegion: 'global',
    allowedTools: ['erp.read', 'deploy.prod'],
  },
  {
    presetId: 'ops-operator',
    label: 'Ops operator',
    summary:
      'Balanced preset for multi-surface operations without direct payment power.',
    owner: 'COO',
    agentName: 'ops_operator',
    purpose: 'coordinate vendors, service teams, and support workflows',
    monthlyCapNok: 30000,
    approvalTermMonths: 9,
    allowedRegion: 'oecd',
    allowedTools: [
      'erp.read',
      'quote.request',
      'contract.draft',
      'support.refund',
    ],
  },
  {
    presetId: 'openclaw-guardrail',
    label: 'OpenClaw guardrail',
    summary:
      'Best for exploratory OpenClaw agents that need strong local redirects before risky side effects.',
    owner: 'Security / Platform',
    agentName: 'openclaw_guardrail',
    purpose:
      'explore the workspace, inspect browser state, and route risky shell, browser, and sub-agent actions through MandateOS',
    monthlyCapNok: 10000,
    approvalTermMonths: 3,
    allowedRegion: 'global',
    allowedTools: [
      'repo.read',
      'docs.publish',
      'shell.exec',
      'browser.read',
      'browser.mutate',
      'agent.spawn',
      'node.command',
      'session.control',
    ],
  },
];

export const defaultMandate =
  presets.find((preset) => preset.presetId === 'repo-steward') ?? presets[0];

export const zoneLabels: Record<
  'domestic' | 'eea' | 'oecd' | 'restricted',
  string
> = {
  domestic: 'Internal workspace',
  eea: 'Trusted connected system',
  oecd: 'Public surface',
  restricted: 'Restricted surface',
};
