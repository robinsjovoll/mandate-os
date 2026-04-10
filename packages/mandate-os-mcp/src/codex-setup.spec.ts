import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildMandateOsCodexMcpEntry,
  installMandateOsIntoCodex,
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

  it('uses a package-based Codex MCP command when installed from npm exec cache', () => {
    const nextConfig = upsertCodexMcpServer(
      {
        mcp_servers: {},
      },
      'mandateos',
      buildMandateOsCodexMcpEntry({
        defaultSource: 'codex.mandateos.project',
        entryScriptPath:
          '/Users/example/.npm/_npx/1234/node_modules/@mandate-os/mcp/index.js',
      }),
    );

    expect(nextConfig.mcp_servers?.mandateos).toEqual({
      command: 'npx',
      args: [
        '--yes',
        '--prefer-offline',
        '--package',
        '@mandate-os/mcp@latest',
        'mandate-os-mcp',
      ],
      env: {
        MANDATE_OS_MCP_DEFAULT_SOURCE: 'codex.mandateos.project',
      },
      env_vars: [
        'MANDATE_OS_BASE_URL',
        'MANDATE_OS_AGENT_TOKEN',
        'MANDATE_OS_MCP_DEFAULT_MANDATE_ID',
      ],
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

  it('replaces older MandateOS Codex hook commands even when the hook gateway path changes', () => {
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
                    "node '/tmp/old-mandate-os-mcp/hook-gateway.js' codex pre-tool-bash",
                },
              ],
            },
          ],
        },
      },
      {
        defaultMandateId: 'mdt_new',
        defaultSource: 'codex.mandateos.hooks',
        unmatchedPermission: 'ask',
        rulesFiles: ['/tmp/local-workspace.json'],
        hookGatewayPath: '/tmp/new-mandate-os-mcp/hook-gateway.js',
      },
    );

    expect(nextHooks.hooks?.PreToolUse).toEqual([
      {
        matcher: 'Bash',
        hooks: [
          expect.objectContaining({
            type: 'command',
            command: expect.stringContaining(
              "/tmp/new-mandate-os-mcp/hook-gateway.js' codex pre-tool-bash",
            ),
          }),
        ],
      },
    ]);
  });

  it('uses a package-based Codex hook command when installed from npm exec cache', () => {
    const nextHooks = upsertMandateOsCodexHooks(
      {
        hooks: {},
      },
      {
        defaultSource: 'codex.mandateos.hooks',
        unmatchedPermission: 'ask',
        rulesFiles: ['/tmp/local-workspace.json'],
        hookGatewayPath:
          '/Users/example/.npm/_npx/1234/node_modules/@mandate-os/mcp/hook-gateway.js',
      },
    );

    expect(nextHooks.hooks?.PreToolUse).toEqual([
      {
        matcher: 'Bash',
        hooks: [
          expect.objectContaining({
            type: 'command',
            command: expect.stringContaining(
              "'npx' '--yes' '--prefer-offline' '--package' '@mandate-os/mcp@latest' 'mandate-os-hook-gateway'",
            ),
            statusMessage: 'Checking Bash command',
            timeout: 8,
          }),
        ],
      },
    ]);
  });

  it('returns portable rule bundle references in install output while writing hooks with runtime-safe refs', () => {
    const workspacePath = mkdtempSync(
      path.join(tmpdir(), 'mandate-os-codex-install-'),
    );
    const codexConfigPath = path.join(workspacePath, '.codex', 'config.toml');
    const transientRulePath =
      '/Users/example/.npm/_npx/1234/node_modules/@mandate-os/mcp/rules/starter-bundles/local-workspace.json';

    const result = installMandateOsIntoCodex({
      workspacePath,
      codexConfigPath,
      rulesFiles: [transientRulePath],
      installProjectMcp: false,
    });

    expect(result.rulesFiles).toEqual([transientRulePath]);
    expect(result.displayRulesFiles).toEqual([
      'package:rules/starter-bundles/local-workspace.json',
    ]);

    const hooksConfig = JSON.parse(readFileSync(result.hooksPath, 'utf8')) as {
      hooks?: {
        PreToolUse?: Array<{
          hooks?: Array<{
            command?: string;
          }>;
        }>;
      };
    };
    const command =
      hooksConfig.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command || '';

    expect(command).toContain(
      "MANDATE_OS_HOST_GATEWAY_RULES_FILES='package:rules/starter-bundles/local-workspace.json'",
    );
  });
});
