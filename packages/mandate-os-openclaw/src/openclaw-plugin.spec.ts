import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pluginAssetDir = path.resolve(rootDir, '../assets/plugin');
const tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(
    path.join(os.tmpdir(), 'mandate-os-openclaw-plugin-'),
  );
  tempDirs.push(dir);
  return dir;
}

function loadPlugin(stateDir: string) {
  const pluginDir = path.join(stateDir, 'extensions', 'mandateos');
  cpSync(pluginAssetDir, pluginDir, {
    force: true,
    recursive: true,
  });
  writeFileSync(
    path.join(pluginDir, 'mandateos.runtime.json'),
    JSON.stringify(
      {
        bridgeScriptPath: '/tmp/openclaw-bridge.js',
        baseUrl: 'https://mandate.example',
        defaultSource: 'openclaw.mandateos.plugin',
        unmatchedPermission: 'ask',
        identifier: 'mandateos',
        guardedAgentId: 'mandateos_guarded',
      },
      null,
      2,
    ),
    'utf8',
  );

  const require = createRequire(import.meta.url);
  return require(path.join(pluginDir, 'index.cjs')) as {
    register: (api: Record<string, unknown>) => void;
  };
}

function createApi(stateDir: string) {
  const tools: Array<{
    name: string;
    execute: (...args: unknown[]) => unknown;
  }> = [];
  const handlers = new Map<string, (...args: unknown[]) => unknown>();

  return {
    tools,
    handlers,
    api: {
      runtime: {
        state: {
          resolveStateDir() {
            return stateDir;
          },
        },
      },
      registerTool(
        tool:
          | { name: string; execute: (...args: unknown[]) => unknown }
          | ((toolCtx: Record<string, unknown>) => {
              name: string;
              execute: (...args: unknown[]) => unknown;
            }),
      ) {
        tools.push(
          typeof tool === 'function'
            ? tool({ agentId: 'agt_123', sessionId: 'sess_123' })
            : tool,
        );
      },
      on(eventName: string, handler: (...args: unknown[]) => unknown) {
        handlers.set(eventName, handler);
      },
    },
  };
}

function writeConfiguredOpenClawState(stateDir: string) {
  writeFileSync(
    path.join(stateDir, 'openclaw.json'),
    JSON.stringify(
      {
        plugins: {
          allow: ['mandateos'],
          entries: {
            mandateos: {
              enabled: true,
            },
          },
        },
        mcp: {
          servers: {
            mandateos: {
              command: 'node',
              enabled: true,
            },
          },
        },
        agents: {
          defaults: {
            sandbox: {
              mode: 'all',
            },
          },
          list: [
            {
              id: 'mandateos_guarded',
              sandbox: {
                mode: 'off',
              },
            },
          ],
        },
      },
      null,
      2,
    ),
    'utf8',
  );
}

afterEach(() => {
  delete process.env.OPENCLAW_STATE_DIR;
  delete process.env.CLAWDBOT_STATE_DIR;
  delete process.env.MANDATE_OS_AGENT_TOKEN;

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe('MandateOS OpenClaw plugin', () => {
  it('does not block read-only exec calls when the plugin is enabled', () => {
    const stateDir = makeTempDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const plugin = loadPlugin(stateDir);
    const { api, handlers } = createApi(stateDir);

    plugin.register(api);

    const beforeToolCall = handlers.get('before_tool_call');
    expect(beforeToolCall).toBeTypeOf('function');
    expect(
      beforeToolCall?.({
        toolName: 'exec',
        params: {
          command: 'git diff --stat',
        },
      }),
    ).toBeUndefined();
  });

  it('blocks mutating exec calls with an actionable message and records last denial state', async () => {
    const stateDir = makeTempDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.MANDATE_OS_AGENT_TOKEN = 'token';
    writeConfiguredOpenClawState(stateDir);

    const plugin = loadPlugin(stateDir);
    const { api, handlers, tools } = createApi(stateDir);

    plugin.register(api);

    const beforeToolCall = handlers.get('before_tool_call');
    const blocked = beforeToolCall?.(
      {
        toolName: 'exec',
        params: {
          command: 'git push origin main',
        },
      },
      {},
    ) as {
      block: boolean;
      blockReason: string;
      mandateOsDenial?: Record<string, unknown>;
    };

    expect(blocked).toMatchObject({
      block: true,
    });
    expect(blocked.blockReason).toContain('mandateos_openclaw_exec');
    expect(blocked.blockReason).toContain('Issue type: approval missing.');
    expect(blocked.blockReason).toContain(
      'effective sandbox mode=off (agent-scoped)',
    );
    expect(blocked.mandateOsDenial).toMatchObject({
      category: 'approval_missing',
      code: 'approval_missing',
      wrapperTool: 'mandateos_openclaw_exec',
    });

    const contextTool = tools.find(
      (tool) => tool.name === 'mandateos_openclaw_get_context',
    );
    expect(contextTool).toBeDefined();

    const contextResult = (await contextTool?.execute()) as {
      details: Record<string, unknown>;
    };

    expect(contextResult.details).toMatchObject({
      pluginEnabled: true,
      pluginAllowed: true,
      mcpConfigured: true,
      mcpEnabled: true,
      bridgeConfigured: true,
      runtimeTokenAvailable: true,
      effectiveSandboxMode: 'off',
      sandboxModeScope: 'agent-scoped',
      bridgeUnmatchedPermission: 'ask',
      runtimePluginLoaded: true,
      wrapperRegistrationAttempted: true,
      wrapperToolExposureKnown: true,
      wrapperToolExposureState: 'available',
      wrapperToolsBelievedAvailable: true,
      lastDenial: expect.objectContaining({
        category: 'approval_missing',
        code: 'approval_missing',
        toolName: 'exec',
        wrapperTool: 'mandateos_openclaw_exec',
        source: 'plugin',
      }),
      lastDenialReason: expect.stringContaining('approval missing'),
    });

    const statusStore = JSON.parse(
      readFileSync(
        path.join(stateDir, 'mandateos-openclaw-status.json'),
        'utf8',
      ),
    ) as {
      lastDenial?: {
        toolName?: string;
        reason?: string;
      };
    };

    expect(statusStore.lastDenial?.toolName).toBe('exec');
    expect(statusStore.lastDenial?.reason).toContain(
      'mandateos_openclaw_get_context',
    );
    expect(statusStore.lastDenial).toMatchObject({
      category: 'approval_missing',
      code: 'approval_missing',
    });
  });

  it('classifies missing wrapper exposure in the live tool inventory as an integration problem', () => {
    const stateDir = makeTempDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.MANDATE_OS_AGENT_TOKEN = 'token';
    writeConfiguredOpenClawState(stateDir);

    const plugin = loadPlugin(stateDir);
    const { api, handlers } = createApi(stateDir);

    plugin.register(api);

    const beforeToolCall = handlers.get('before_tool_call');
    const blocked = beforeToolCall?.(
      {
        toolName: 'exec',
        params: {
          command: 'git push origin main',
        },
        availableTools: ['mandateos_openclaw_get_context'],
      },
      {
        availableTools: ['mandateos_openclaw_get_context'],
      },
    ) as {
      block: boolean;
      blockReason: string;
      mandateOsDenial?: Record<string, unknown>;
    };

    expect(blocked).toMatchObject({
      block: true,
    });
    expect(blocked.blockReason).toContain(
      'Issue type: wrapper unavailable / integration misconfigured.',
    );
    expect(blocked.blockReason).toContain('integration/runtime exposure issue');
    expect(blocked.mandateOsDenial).toMatchObject({
      category: 'integration_problem',
      code: 'wrapper_unavailable',
      wrapperTool: 'mandateos_openclaw_exec',
      wrapperToolsMissing: ['mandateos_openclaw_exec'],
    });
  });

  it('classifies missing runtime prerequisites as an install/repair problem', () => {
    const stateDir = makeTempDir();
    process.env.OPENCLAW_STATE_DIR = stateDir;
    writeConfiguredOpenClawState(stateDir);

    const plugin = loadPlugin(stateDir);
    const { api, handlers } = createApi(stateDir);

    plugin.register(api);

    const beforeToolCall = handlers.get('before_tool_call');
    const blocked = beforeToolCall?.(
      {
        toolName: 'exec',
        params: {
          command: 'git push origin main',
        },
      },
      {},
    ) as {
      block: boolean;
      blockReason: string;
      mandateOsDenial?: Record<string, unknown>;
    };

    expect(blocked).toMatchObject({
      block: true,
    });
    expect(blocked.blockReason).toContain(
      'Issue type: install/repair problem.',
    );
    expect(blocked.mandateOsDenial).toMatchObject({
      category: 'misconfigured',
      code: 'install_repair_problem',
      wrapperTool: 'mandateos_openclaw_exec',
    });
  });
});
