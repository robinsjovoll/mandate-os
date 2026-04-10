import { describe, expect, it } from 'vitest';

import { readMandateOsMcpConfig } from './config';

describe('readMandateOsMcpConfig', () => {
  it('reads required env vars and fills defaults', () => {
    expect(
      readMandateOsMcpConfig({
        MANDATE_OS_BASE_URL: 'http://localhost:4330',
        MANDATE_OS_AGENT_TOKEN: 'agt_example.secret',
      }),
    ).toEqual({
      baseUrl: 'http://localhost:4330',
      bearerToken: 'agt_example.secret',
      defaultMandateId: undefined,
      defaultSource: 'mcp.mandate_os',
      serverName: 'mandate-os-mcp',
      serverVersion: '0.0.0',
      requestTimeoutMs: 20_000,
      maxRetries: 1,
    });
  });

  it('supports optional default mandate env fallbacks', () => {
    expect(
      readMandateOsMcpConfig({
        MANDATE_OS_BASE_URL: 'http://localhost:4330',
        MANDATE_OS_AGENT_TOKEN: 'agt_example.secret',
        MANDATE_OS_MANDATE_ID: 'mdt_123',
        MANDATE_OS_MCP_DEFAULT_SOURCE: 'codex.repo_steward',
      }),
    ).toMatchObject({
      defaultMandateId: 'mdt_123',
      defaultSource: 'codex.repo_steward',
    });
  });

  it('fails fast when required env vars are missing', () => {
    expect(() =>
      readMandateOsMcpConfig({
        MANDATE_OS_AGENT_TOKEN: 'agt_example.secret',
      }),
    ).toThrow('MANDATE_OS_BASE_URL is required.');

    expect(() =>
      readMandateOsMcpConfig({
        MANDATE_OS_BASE_URL: 'http://localhost:4330',
      }),
    ).toThrow('MANDATE_OS_AGENT_TOKEN is required.');
  });
});
