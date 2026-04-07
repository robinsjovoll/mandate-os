import { describe, expect, it } from 'vitest';

import {
  buildMandateOsCodexMcpEntry,
  upsertCodexHooksFeature,
  upsertCodexMcpServer,
  upsertMandateOsCodexHooks,
} from './codex-setup';

describe('codex setup helpers', () => {
  it('enables codex hooks without removing unrelated feature flags', () => {
    expect(
      upsertCodexHooksFeature({
        features: {
          some_other_flag: true,
        },
      }),
    ).toEqual({
      features: {
        some_other_flag: true,
        codex_hooks: true,
      },
    });
  });

  it('upserts the MandateOS MCP server without removing unrelated servers', () => {
    const nextConfig = upsertCodexMcpServer(
      {
        mcp_servers: {
          filesystem: {
            command: 'node',
            args: ['/tmp/filesystem.js'],
          },
        },
      },
      'mandateos',
      buildMandateOsCodexMcpEntry({
        defaultSource: 'codex.mandateos.project',
        entryScriptPath: '/tmp/mandate-os-mcp/index.js',
      }),
    );

    expect(nextConfig).toEqual({
      mcp_servers: {
        filesystem: {
          command: 'node',
          args: ['/tmp/filesystem.js'],
        },
        mandateos: {
          command: 'node',
          args: ['/tmp/mandate-os-mcp/index.js'],
          env: {
            MANDATE_OS_MCP_DEFAULT_SOURCE: 'codex.mandateos.project',
          },
          env_vars: [
            'MANDATE_OS_BASE_URL',
            'MANDATE_OS_AGENT_TOKEN',
            'MANDATE_OS_MCP_DEFAULT_MANDATE_ID',
          ],
        },
      },
    });
  });

  it('upserts PreToolUse Bash hooks while preserving unrelated Codex hooks', () => {
    const nextHooks = upsertMandateOsCodexHooks(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command:
                    "node '/tmp/mandate-os-mcp/hook-gateway.js' codex pre-tool-bash",
                },
                {
                  type: 'command',
                  command: 'echo keep-me',
                },
              ],
            },
            {
              matcher: 'Edit',
              hooks: [
                {
                  type: 'command',
                  command: 'echo edit-hook',
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: 'echo review-output',
                },
              ],
            },
          ],
        },
      },
      {
        defaultMandateId: 'mdt_123',
        defaultSource: 'codex.mandateos.hooks',
        unmatchedPermission: 'ask',
        rulesFiles: ['/tmp/release.json', '/tmp/docs.json'],
        hookGatewayPath: '/tmp/mandate-os-mcp/hook-gateway.js',
      },
    );

    expect(nextHooks.hooks?.PreToolUse).toEqual([
      {
        matcher: 'Bash',
        hooks: [
          expect.objectContaining({
            type: 'command',
            command: expect.stringContaining('codex pre-tool-bash'),
            statusMessage: 'Checking Bash command',
            timeout: 8,
          }),
          expect.objectContaining({
            type: 'command',
            command: 'echo keep-me',
          }),
        ],
      },
      {
        matcher: 'Edit',
        hooks: [
          expect.objectContaining({
            type: 'command',
            command: 'echo edit-hook',
          }),
        ],
      },
    ]);
    expect(nextHooks.hooks?.PostToolUse).toEqual([
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: 'echo review-output',
          },
        ],
      },
    ]);
  });
});
