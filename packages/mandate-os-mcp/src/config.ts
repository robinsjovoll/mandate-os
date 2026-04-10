export type MandateOsMcpConfig = {
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource?: string;
  serverName: string;
  serverVersion: string;
  requestTimeoutMs: number;
  maxRetries: number;
};

export function readMandateOsMcpConfig(
  env: NodeJS.ProcessEnv = process.env,
): MandateOsMcpConfig {
  const baseUrl = normalizeOptionalText(env.MANDATE_OS_BASE_URL);
  const bearerToken = normalizeOptionalText(env.MANDATE_OS_AGENT_TOKEN);
  const defaultMandateId =
    normalizeOptionalText(env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID) ||
    normalizeOptionalText(env.MANDATE_OS_DEFAULT_MANDATE_ID) ||
    normalizeOptionalText(env.MANDATE_OS_MANDATE_ID);
  const defaultSource =
    normalizeOptionalText(env.MANDATE_OS_MCP_DEFAULT_SOURCE) ||
    normalizeOptionalText(env.MANDATE_OS_DEFAULT_SOURCE) ||
    'mcp.mandate_os';
  const serverName =
    normalizeOptionalText(env.MANDATE_OS_MCP_SERVER_NAME) || 'mandate-os-mcp';
  const serverVersion =
    normalizeOptionalText(env.MANDATE_OS_MCP_SERVER_VERSION) || '0.0.0';
  const requestTimeoutMs = parsePositiveInteger(
    env.MANDATE_OS_REQUEST_TIMEOUT_MS,
    20_000,
  );
  const maxRetries = parseNonNegativeInteger(
    env.MANDATE_OS_REQUEST_MAX_RETRIES,
    1,
  );

  if (!baseUrl) {
    throw new Error('MANDATE_OS_BASE_URL is required.');
  }

  if (!bearerToken) {
    throw new Error('MANDATE_OS_AGENT_TOKEN is required.');
  }

  return {
    baseUrl,
    bearerToken,
    defaultMandateId: defaultMandateId || undefined,
    defaultSource,
    serverName,
    serverVersion,
    requestTimeoutMs,
    maxRetries,
  };
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || '';
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
) {
  const normalized = normalizeOptionalText(value);
  const parsed = Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number,
) {
  const normalized = normalizeOptionalText(value);
  const parsed = Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
