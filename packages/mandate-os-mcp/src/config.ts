export type MandateOsMcpConfig = {
  baseUrl: string;
  bearerToken: string;
  defaultMandateId?: string;
  defaultSource?: string;
  serverName: string;
  serverVersion: string;
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
  };
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || '';
}
