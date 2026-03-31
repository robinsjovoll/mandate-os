import type {
  ApiErrorIssue,
  ApiErrorPayload,
  ApiSuccessPayload,
  EnforcedExecutionInput,
  EnforcedExecutionResult,
  ExecutionGrantIssueInput,
  ExecutionGrantRecord,
  GitHubIssueLabelExecutionInput,
  GitHubIssueLabelExecutionResult,
  GitHubPullRequestDraftExecutionInput,
  GitHubPullRequestDraftExecutionResult,
  MandateRecord,
  RuntimeActionEvaluationInput,
  RuntimeSimulationBatch,
  SignatureVerificationResult,
} from './contracts.js';
import {
  getEnforcedExecutionCapability,
  type EnforcedExecutionKind,
} from './enforced-capabilities.js';
import type { MandateDraft } from './mandates.js';

type FetchLike = typeof fetch;

type MutationOptions = {
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type MandateOsAgentClientOptions = {
  baseUrl: string;
  bearerToken: string;
  fetchImpl?: FetchLike;
  defaultSource?: string;
};

export type MandateOsClientResponse<T> = ApiSuccessPayload<T> & {
  headers: {
    idempotencyKey: string | null;
    idempotencyStatus: string | null;
    originRequestId: string | null;
  };
};

export class MandateOsAgentClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly issues?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = 'MandateOsAgentClientError';
  }
}

export class MandateOsAgentClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly bearerToken: string;
  private readonly defaultSource?: string;

  constructor(options: MandateOsAgentClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl || fetch;
    this.bearerToken = options.bearerToken;
    this.defaultSource = options.defaultSource?.trim() || undefined;
  }

  async issueMandate(
    draft: MandateDraft,
    options?: MutationOptions,
  ): Promise<MandateOsClientResponse<MandateRecord>> {
    return this.request<MandateRecord>('/api/v1/mandates', {
      method: 'POST',
      body: JSON.stringify(draft),
      idempotencyKey: options?.idempotencyKey,
      signal: options?.signal,
    });
  }

  async evaluateActions(
    input: RuntimeActionEvaluationInput,
    options?: MutationOptions,
  ): Promise<MandateOsClientResponse<RuntimeSimulationBatch>> {
    const payload: RuntimeActionEvaluationInput = {
      ...input,
      source: input.source || this.defaultSource,
    };

    return this.request<RuntimeSimulationBatch>(
      '/api/v1/runtime/evaluate-actions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey: options?.idempotencyKey,
        signal: options?.signal,
      },
    );
  }

  async issueExecutionGrant(
    input: ExecutionGrantIssueInput,
    options?: MutationOptions,
  ): Promise<MandateOsClientResponse<ExecutionGrantRecord>> {
    return this.request<ExecutionGrantRecord>(
      '/api/v1/runtime/execution-grants',
      {
        method: 'POST',
        body: JSON.stringify(input),
        idempotencyKey: options?.idempotencyKey,
        signal: options?.signal,
      },
    );
  }

  async executeEnforcedAction<K extends EnforcedExecutionKind>(
    kind: K,
    input: EnforcedExecutionInput<K>,
    options?: MutationOptions,
  ): Promise<MandateOsClientResponse<EnforcedExecutionResult<K>>> {
    const capability = getEnforcedExecutionCapability(kind);

    return this.request<EnforcedExecutionResult<K>>(capability.executePath, {
      method: 'POST',
      body: JSON.stringify(input),
      idempotencyKey: options?.idempotencyKey,
      signal: options?.signal,
    });
  }

  async executeGitHubIssueLabel(
    input: GitHubIssueLabelExecutionInput,
    options?: MutationOptions,
  ): Promise<MandateOsClientResponse<GitHubIssueLabelExecutionResult>> {
    return this.executeEnforcedAction('github.issue.label', input, options);
  }

  async executeGitHubPullRequestDraft(
    input: GitHubPullRequestDraftExecutionInput,
    options?: MutationOptions,
  ): Promise<MandateOsClientResponse<GitHubPullRequestDraftExecutionResult>> {
    return this.executeEnforcedAction(
      'github.pull_request.draft',
      input,
      options,
    );
  }

  async verifyMandate(
    mandateId: string,
    signal?: AbortSignal,
  ): Promise<MandateOsClientResponse<SignatureVerificationResult>> {
    return this.request<SignatureVerificationResult>(
      `/api/v1/mandates/${encodeURIComponent(mandateId)}/verify`,
      {
        method: 'GET',
        signal,
      },
    );
  }

  async verifyReceipt(
    receiptId: string,
    signal?: AbortSignal,
  ): Promise<MandateOsClientResponse<SignatureVerificationResult>> {
    return this.request<SignatureVerificationResult>(
      `/api/v1/receipts/${encodeURIComponent(receiptId)}/verify`,
      {
        method: 'GET',
        signal,
      },
    );
  }

  async verifyExecutionGrant(
    grantId: string,
    signal?: AbortSignal,
  ): Promise<MandateOsClientResponse<SignatureVerificationResult>> {
    return this.request<SignatureVerificationResult>(
      `/api/v1/execution-grants/${encodeURIComponent(grantId)}/verify`,
      {
        method: 'GET',
        signal,
      },
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit & {
      idempotencyKey?: string;
    },
  ): Promise<MandateOsClientResponse<T>> {
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);

    headers.set('accept', 'application/json');
    headers.set('authorization', `Bearer ${this.bearerToken}`);

    if (init.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
      !headers.has('idempotency-key')
    ) {
      headers.set(
        'idempotency-key',
        init.idempotencyKey || createIdempotencyKey(),
      );
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      method,
      headers,
    });
    const payload = (await response.json().catch(() => null)) as
      | (ApiSuccessPayload<T> & ApiErrorPayload)
      | null;

    if (!response.ok || !payload?.meta || payload.data === undefined) {
      throw new MandateOsAgentClientError(
        payload?.error?.issues?.[0]?.message ||
          payload?.error?.message ||
          'MandateOS request failed.',
        response.status,
        payload?.error?.code,
        payload?.meta?.requestId,
        payload?.error?.issues,
      );
    }

    return {
      data: payload.data,
      meta: payload.meta,
      headers: {
        idempotencyKey: response.headers.get('x-idempotency-key'),
        idempotencyStatus: response.headers.get('x-idempotency-status'),
        originRequestId: response.headers.get(
          'x-idempotency-origin-request-id',
        ),
      },
    };
  }
}

function createIdempotencyKey() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `agent_${crypto.randomUUID()}`;
  }

  return `agent_${Date.now().toString(36)}`;
}
