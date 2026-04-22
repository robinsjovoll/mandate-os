import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildMandateOsClaudeMcpEntry,
  upsertClaudeLocalMcpServer,
  upsertMandateOsClaudeHooks,
} from './claude-setup';

describe('claude setup helpers', () => {
  it('upserts the MandateOS MCP server into the local Claude project config', () => {
    const nextConfig = upsertClaudeLocalMcpServer(
      {
        projects: {
          '/tmp/other-project': {
            mcpServers: {
              filesystem: {
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem'],
              },
            },
          },
        },
      },
      '/tmp/project',
      'mandateos',
      buildMandateOsClaudeMcpEntry({
        baseUrl: 'http://localhost:4330',
        bearerToken: 'agt_example.secret',
        defaultMandateId: 'mdt_123',
        defaultSource: 'claude.mandateos.local',
        entryScriptPath: '/tmp/mandate-os-mcp/index.js',
      }),
    );

    expect(nextConfig).toEqual({
      projects: {
        '/tmp/other-project': {
          mcpServers: {
            filesystem: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        },
        '/tmp/project': {
          allowedTools: [],
          mcpContextUris: [],
          mcpServers: {
            mandateos: {
              type: 'stdio',
              command: 'node',
              args: ['/tmp/mandate-os-mcp/index.js'],
              env: {
                MANDATE_OS_BASE_URL: 'http://localhost:4330',
                MANDATE_OS_AGENT_TOKEN: 'agt_example.secret',
                MANDATE_OS_MCP_DEFAULT_MANDATE_ID: 'mdt_123',
                MANDATE_OS_MCP_DEFAULT_SOURCE: 'claude.mandateos.local',
              },
            },
          },
          enabledMcpjsonServers: [],
          disabledMcpjsonServers: [],
          projectOnboardingSeenCount: 0,
          hasClaudeMdExternalIncludesApproved: false,
          hasClaudeMdExternalIncludesWarningShown: false,
        },
      },
    });
  });

  it('uses a package-based Claude MCP command when installed from npm exec cache', () => {
    const nextConfig = upsertClaudeLocalMcpServer(
      {
        projects: {},
      },
      '/tmp/project',
      'mandateos',
      buildMandateOsClaudeMcpEntry({
        baseUrl: 'http://localhost:4330',
        bearerToken: 'agt_example.secret',
        defaultSource: 'claude.mandateos.local',
        entryScriptPath:
          '/Users/example/.npm/_npx/1234/node_modules/@mandate-os/mcp/index.js',
      }),
    );

    expect(nextConfig.projects?.['/tmp/project']?.mcpServers?.mandateos).toEqual(
      {
        type: 'stdio',
        command: 'npx',
        args: [
          '--yes',
          '--prefer-offline',
          '--package',
          '@mandate-os/mcp@latest',
          'mandate-os-mcp',
        ],
        env: {
          MANDATE_OS_BASE_URL: 'http://localhost:4330',
          MANDATE_OS_AGENT_TOKEN: 'agt_example.secret',
          MANDATE_OS_MCP_DEFAULT_SOURCE: 'claude.mandateos.local',
        },
      },
    );
  });

  it('upserts PreToolUse hooks while preserving unrelated Claude hooks', () => {
    const nextSettings = upsertMandateOsClaudeHooks(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command:
                    "node '/tmp/mandate-os-mcp/hook-gateway.js' claude pre-tool-bash",
                },
                {
                  type: 'command',
                  command: 'echo keep-me',
                },
              ],
            },
            {
              matcher: 'Write',
              hooks: [
                {
                  type: 'command',
                  command: 'echo write-hook',
                },
              ],
            },
          ],
        },
      },
      {
        baseUrl: 'http://localhost:4330',
        bearerToken: 'agt_example.secret',
        defaultMandateId: 'mdt_123',
        defaultSource: 'claude.mandateos.hooks',
        unmatchedPermission: 'ask',
        rulesFiles: ['/tmp/release.json', '/tmp/docs.json'],
        hookGatewayPath: '/tmp/mandate-os-mcp/hook-gateway.js',
      },
    );

    const preToolUse = nextSettings.hooks?.PreToolUse;
    expect(preToolUse).toHaveLength(3);
    expect(preToolUse?.[0]).toEqual(
      expect.objectContaining({
        matcher: 'mcp__.*',
      }),
    );
    expect(preToolUse?.[1]).toEqual(
      expect.objectContaining({
        matcher: 'Bash',
        hooks: [
          expect.objectContaining({
            command: expect.stringContaining('claude pre-tool-bash'),
          }),
          expect.objectContaining({
            command: 'echo keep-me',
          }),
        ],
      }),
    );
    expect(preToolUse?.[2]).toEqual(
      expect.objectContaining({
        matcher: 'Write',
      }),
    );
  });

  it('uses the expected default Claude config location in examples', () => {
    expect(path.join(os.homedir(), '.claude.json')).toMatch(/\.claude\.json$/);
  });
});
