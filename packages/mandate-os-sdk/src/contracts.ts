import type {
  ActionScenario,
  Decision,
  MandateDraft,
  ToolId,
  Zone,
} from './mandates.js';
import type { EnforcedExecutionKind } from './enforced-capabilities.js';

export type SignatureEnvelope = {
  algorithm: 'hmac-sha256';
  keyId: string;
  payloadHash: string;
  signature: string;
  signedAt: string;
};

export type AuditActorType = 'human' | 'service' | 'agent' | 'system';

export type AuditActor = {
  type: AuditActorType;
  id: string;
  displayName: string;
};

export type AuditMetadata = {
  requestId: string;
  source: string;
  actor: AuditActor;
  workspaceId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type MandateStatus = 'active' | 'revoked';
export type ExecutionGrantKind = EnforcedExecutionKind;
export type ExecutionGrantStatus =
  | 'active'
  | 'consumed'
  | 'expired'
  | 'revoked';

export type GitHubIssueLabelExecutionPayload = {
  owner: string;
  repo: string;
  issueNumber: number;
  labels: string[];
};

export type GitHubPullRequestDraftExecutionPayload = {
  owner: string;
  repo: string;
  pullRequestNumber: number;
};

export type EnforcedExecutionPayloadByKind = {
  'github.issue.label': GitHubIssueLabelExecutionPayload;
  'github.pull_request.draft': GitHubPullRequestDraftExecutionPayload;
};

export type ExecutionGrantRecord = {
  id: string;
  workspaceId: string;
  receiptId: string;
  mandateId: string;
  kind: ExecutionGrantKind;
  payloadHash: string;
  payloadPreview: Record<string, unknown>;
  status: ExecutionGrantStatus;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedRequestId: string | null;
  revokedAt: string | null;
  audit: AuditMetadata;
  signature: SignatureEnvelope;
};

export type GitHubIssueLabelExecutionGrantInput = {
  receiptId: string;
  kind: 'github.issue.label';
  payload: GitHubIssueLabelExecutionPayload;
  expiresInSeconds?: number;
};

export type GitHubPullRequestDraftExecutionGrantInput = {
  receiptId: string;
  kind: 'github.pull_request.draft';
  payload: GitHubPullRequestDraftExecutionPayload;
  expiresInSeconds?: number;
};

export type ExecutionGrantIssueInput = {
  [K in ExecutionGrantKind]: {
    receiptId: string;
    kind: K;
    payload: EnforcedExecutionPayloadByKind[K];
    expiresInSeconds?: number;
  };
}[ExecutionGrantKind];

export type GitHubIssueLabelExecutionInput = {
  grantId: string;
  payload: GitHubIssueLabelExecutionPayload;
};

export type GitHubPullRequestDraftExecutionInput = {
  grantId: string;
  payload: GitHubPullRequestDraftExecutionPayload;
};

export type EnforcedExecutionInput<K extends ExecutionGrantKind> = {
  grantId: string;
  payload: EnforcedExecutionPayloadByKind[K];
};

export type GitHubIssueLabelExecutionResult = {
  grantId: string;
  receiptId: string;
  mandateId: string;
  executedAt: string;
  owner: string;
  repo: string;
  issueNumber: number;
  labels: string[];
};

export type GitHubPullRequestDraftExecutionResult = {
  grantId: string;
  receiptId: string;
  mandateId: string;
  executedAt: string;
  owner: string;
  repo: string;
  pullRequestNumber: number;
  isDraft: true;
  wasAlreadyDraft: boolean;
  url: string | null;
};

export type EnforcedExecutionResultByKind = {
  'github.issue.label': GitHubIssueLabelExecutionResult;
  'github.pull_request.draft': GitHubPullRequestDraftExecutionResult;
};

export type EnforcedExecutionResult<K extends ExecutionGrantKind> =
  EnforcedExecutionResultByKind[K];

export type MandateRecord = MandateDraft & {
  id: string;
  workspaceId: string;
  version: number;
  status: MandateStatus;
  issuedAt: string;
  updatedAt: string;
  policyText: string;
  fingerprint: string;
  signature: SignatureEnvelope;
  audit: AuditMetadata;
};

export type MandateSummary = Pick<
  MandateRecord,
  | 'id'
  | 'workspaceId'
  | 'version'
  | 'status'
  | 'issuedAt'
  | 'updatedAt'
  | 'owner'
  | 'agentName'
  | 'purpose'
  | 'monthlyCapNok'
  | 'allowedRegion'
  | 'fingerprint'
>;

export type ReceiptRecord = {
  id: string;
  batchId: string;
  receiptType: 'simulation';
  workspaceId: string;
  mandateId: string;
  mandateVersion: number;
  createdAt: string;
  scenarioId: string;
  title: string;
  description: string;
  tool: ToolId;
  amountNok: number;
  termMonths: number;
  zone: Zone;
  decision: Decision;
  reasons: string[];
  signature: SignatureEnvelope;
  audit: AuditMetadata;
};

export type RuntimeSimulationBatch = {
  batchId: string;
  generatedAt: string;
  mandate: MandateSummary;
  receipts: ReceiptRecord[];
  audit: AuditMetadata;
};

export type RuntimeActionEvaluationInput = {
  mandateId: string;
  actions: ActionScenario[];
  source?: string | null;
  details?: Record<string, unknown> | null;
};

export type SignatureVerificationResult = {
  resourceType: 'mandate' | 'receipt' | 'execution_grant';
  resourceId: string;
  keyId: string;
  algorithm: 'hmac-sha256';
  valid: boolean;
  verifiedAt: string;
};

export type ApiErrorIssue = {
  path: string;
  message: string;
};

export type ApiResponseMeta = {
  requestId: string;
};

export type ApiSuccessPayload<T> = {
  data: T;
  meta: ApiResponseMeta;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    issues?: ApiErrorIssue[];
  };
  meta?: ApiResponseMeta;
};
