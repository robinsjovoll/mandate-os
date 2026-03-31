export const toolIds = [
  'repo.read',
  'issue.label',
  'pr.draft',
  'docs.publish',
  'erp.read',
  'quote.request',
  'contract.draft',
  'payment.execute',
  'deploy.prod',
  'support.refund',
  'shell.exec',
  'browser.read',
  'browser.mutate',
  'agent.spawn',
  'node.command',
  'session.control',
] as const;

export const regionIds = ['eea', 'oecd', 'global'] as const;
export const decisions = ['allowed', 'approval', 'blocked'] as const;
export const riskLevels = ['low', 'medium', 'high'] as const;
export const zones = ['domestic', 'eea', 'oecd', 'restricted'] as const;

export type ToolId = (typeof toolIds)[number];
export type RegionId = (typeof regionIds)[number];
export type Decision = (typeof decisions)[number];
export type RiskLevel = (typeof riskLevels)[number];
export type Zone = (typeof zones)[number];

export function isToolId(value: string): value is ToolId {
  return toolIds.includes(value as ToolId);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return riskLevels.includes(value as RiskLevel);
}

export function isZone(value: string): value is Zone {
  return zones.includes(value as Zone);
}

export type MandateDraft = {
  presetId: string;
  owner: string;
  agentName: string;
  purpose: string;
  monthlyCapNok: number;
  approvalTermMonths: number;
  allowedRegion: RegionId;
  allowedTools: ToolId[];
};

export type ActionScenario = {
  id: string;
  title: string;
  description: string;
  tool: ToolId;
  amountNok: number;
  termMonths: number;
  zone: Zone;
  riskLevel: RiskLevel;
  receiptSuffix: string;
};
