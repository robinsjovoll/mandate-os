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
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
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
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: MandateOsAgentClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl || fetch;
    this.bearerToken = options.bearerToken;
    this.defaultSource = options.defaultSource?.trim() || undefined;
    this.requestTimeoutMs = normalizePositiveInteger(
      options.requestTimeoutMs,
      20_000,
    );
    this.maxRetries = normalizeNonNegativeInteger(options.maxRetries, 1);
    this.retryDelayMs = normalizeNonNegativeInteger(options.retryDelayMs, 250);
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
    const idempotencyKey =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
        ? init.idempotencyKey || createIdempotencyKey()
        : undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const headers = new Headers(init.headers);
      const requestSignal = createTimedRequestSignal(
        init.signal,
        this.requestTimeoutMs,
      );

      headers.set('accept', 'application/json');
      headers.set('authorization', `Bearer ${this.bearerToken}`);

      if (init.body !== undefined && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }

      if (idempotencyKey && !headers.has('idempotency-key')) {
        headers.set('idempotency-key', idempotencyKey);
      }

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          method,
          headers,
          signal: requestSignal.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | (ApiSuccessPayload<T> & ApiErrorPayload)
          | null;

        if (
          shouldRetryResponse(response.status) &&
          attempt < this.maxRetries
        ) {
          await delay(this.retryDelayMs);
          continue;
        }

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
      } catch (error) {
        if (
          shouldRetryTransportError(error, requestSignal.timedOut, init.signal) &&
          attempt < this.maxRetries
        ) {
          await delay(this.retryDelayMs);
          continue;
        }

        throw normalizeTransportError(
          error,
          requestSignal.timedOut,
          this.requestTimeoutMs,
        );
      } finally {
        requestSignal.cleanup();
      }
    }

    throw new MandateOsAgentClientError(
      'MandateOS request failed after retries were exhausted.',
      0,
      'network_error',
    );
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

function createTimedRequestSignal(
  upstreamSignal: AbortSignal | null | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`MandateOS request timed out after ${timeoutMs} ms.`));
  }, timeoutMs);

  const abortFromUpstream = () => {
    controller.abort(upstreamSignal?.reason);
  };

  if (upstreamSignal?.aborted) {
    abortFromUpstream();
  } else if (upstreamSignal) {
    upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cleanup() {
      clearTimeout(timeoutHandle);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', abortFromUpstream);
      }
    },
  };
}

function shouldRetryResponse(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function shouldRetryTransportError(
  error: unknown,
  timedOut: boolean,
  upstreamSignal?: AbortSignal | null,
) {
  if (upstreamSignal?.aborted) {
    return false;
  }

  if (timedOut) {
    return true;
  }

  if (error instanceof MandateOsAgentClientError) {
    return shouldRetryResponse(error.status);
  }

  return true;
}

function normalizeTransportError(
  error: unknown,
  timedOut: boolean,
  timeoutMs: number,
) {
  if (error instanceof MandateOsAgentClientError) {
    return error;
  }

  if (timedOut) {
    return new MandateOsAgentClientError(
      `MandateOS request timed out after ${timeoutMs} ms.`,
      408,
      'timeout',
    );
  }

  if (error instanceof Error) {
    return new MandateOsAgentClientError(
      error.message || 'MandateOS network request failed.',
      0,
      'network_error',
    );
  }

  return new MandateOsAgentClientError(
    'MandateOS network request failed.',
    0,
    'network_error',
  );
}

function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}
