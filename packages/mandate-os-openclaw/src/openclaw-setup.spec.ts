import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installMandateOsIntoOpenClaw,
  repairMandateOsOpenClawInstall,
  readMandateOsOpenClawStatus,
  runMandateOsOpenClawDoctor,
} from './openclaw-setup';

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mandate-os-openclaw-'));
  tempDirs.push(dir);
  return dir;
}

function makeBridgeFixture(rootDir: string) {
  const bridgeDir = path.join(
    rootDir,
    'dist',
    'packages',
    'mandate-os-openclaw',
  );
  const sdkDir = path.join(rootDir, 'dist', 'packages', 'mandate-os-sdk');
  const bridgeScriptPath = path.join(bridgeDir, 'openclaw-bridge.js');
  const mcpEntryScriptPath = path.join(rootDir, 'tmp', 'mcp.js');

  mkdirSync(bridgeDir, { recursive: true });
  mkdirSync(sdkDir, { recursive: true });
  mkdirSync(path.dirname(mcpEntryScriptPath), { recursive: true });
  writeFileSync(bridgeScriptPath, "import './openclaw-policy.js';\n", 'utf8');
  writeFileSync(
    path.join(bridgeDir, 'openclaw-policy.js'),
    'export {};\n',
    'utf8',
  );
  writeFileSync(path.join(sdkDir, 'index.js'), 'export {};\n', 'utf8');
  writeFileSync(
    path.join(sdkDir, 'package.json'),
    JSON.stringify({ name: '@mandate-os/sdk', type: 'module' }),
    'utf8',
  );
  writeFileSync(mcpEntryScriptPath, 'export {};\n', 'utf8');

  return {
    bridgeScriptPath,
    mcpEntryScriptPath,
  };
}

afterEach(() => {
  delete process.env.MANDATE_OS_AGENT_TOKEN;

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe('installMandateOsIntoOpenClaw', () => {
  it('installs plugin and bundle assets and upserts guarded config', () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');

    const result = installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      defaultMandateId: 'mdt_123',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    const config = JSON.parse(readFileSync(result.configPath, 'utf8'));
    const runtimeConfig = JSON.parse(
      readFileSync(
        path.join(result.pluginDir, 'mandateos.runtime.json'),
        'utf8',
      ),
    );

    expect(
      existsSync(path.join(result.pluginDir, 'openclaw.plugin.json')),
    ).toBe(true);
    expect(existsSync(path.join(result.bundleDir, '.mcp.json'))).toBe(true);
    expect(
      existsSync(path.join(result.pluginDir, 'mandateos.runtime.json')),
    ).toBe(true);
    expect(runtimeConfig.bridgeScriptPath).toBe('/tmp/bridge.js');
    expect(config.plugins.entries.mandateos.enabled).toBe(true);
    expect(config.plugins.entries.mandateos.env).toBeUndefined();
    expect(config.mcp.servers.mandateos.args).toEqual(['/tmp/mcp.js']);
    expect(config.agents.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'mandateos_guarded',
          workspace: workspacePath,
          sandbox: expect.objectContaining({
            mode: 'all',
            workspaceAccess: 'rw',
          }),
        }),
      ]),
    );
  });

  it('vendors the OpenClaw bridge runtime for repo-local installs', () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');
    const fixture = makeBridgeFixture(stateDir);

    const result = installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: fixture.bridgeScriptPath,
      mcpEntryScriptPath: fixture.mcpEntryScriptPath,
    });

    const runtimeConfig = JSON.parse(
      readFileSync(
        path.join(result.pluginDir, 'mandateos.runtime.json'),
        'utf8',
      ),
    );

    expect(runtimeConfig.bridgeScriptPath).toBe(
      path.join(result.pluginDir, 'runtime', 'openclaw-bridge.js'),
    );
    expect(
      existsSync(path.join(result.pluginDir, 'runtime', 'openclaw-policy.js')),
    ).toBe(true);
    expect(
      existsSync(
        path.join(
          result.pluginDir,
          'node_modules',
          '@mandate-os',
          'sdk',
          'index.js',
        ),
      ),
    ).toBe(true);
  });

  it('is idempotent and parses existing JSON5-style config files', () => {
    const stateDir = makeTempDir();
    const configPath = path.join(stateDir, 'openclaw.json');
    const workspacePath = path.join(stateDir, 'workspace');

    writeFileSync(
      configPath,
      `{
        plugins: {
          entries: {
            existing: { enabled: true },
          },
        },
      }`,
      'utf8',
    );

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      configPath,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });
    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      configPath,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const guardedAgents = config.agents.list.filter(
      (entry: { id: string }) => entry.id === 'mandateos_guarded',
    );

    expect(config.plugins.entries.existing.enabled).toBe(true);
    expect(guardedAgents).toHaveLength(1);
  });

  it('lets the installer set the guarded agent sandbox mode to off', () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      sandboxMode: 'off',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    const config = JSON.parse(
      readFileSync(path.join(stateDir, 'openclaw.json'), 'utf8'),
    );
    const guardedAgent = config.agents.list.find(
      (entry: { id: string }) => entry.id === 'mandateos_guarded',
    );

    expect(guardedAgent.sandbox.mode).toBe('off');
    expect(guardedAgent.tools.exec).toBeUndefined();
  });

  it('reports installation status from config and filesystem', () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');
    const fixture = makeBridgeFixture(stateDir);

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: fixture.bridgeScriptPath,
      mcpEntryScriptPath: fixture.mcpEntryScriptPath,
    });

    const status = readMandateOsOpenClawStatus({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
    });

    expect(status).toMatchObject({
      hasConfig: true,
      pluginInstalled: true,
      bundleInstalled: true,
      pluginEnabled: true,
      pluginAllowed: true,
      mcpConfigured: true,
      mcpEnabled: true,
      bridgeConfigured: true,
      guardedAgentConfigured: true,
      baseUrlConfigured: true,
      runtimeTokenAvailable: false,
      bridgeScriptConfigured: true,
      bridgeUnmatchedPermission: 'ask',
      effectiveSandboxMode: 'all',
      sandboxModeSource: 'agent',
      sandboxModeScope: 'agent-scoped',
      wrapperToolNames: [
        'mandateos_openclaw_exec',
        'mandateos_openclaw_browser_mutate',
        'mandateos_openclaw_spawn_agent',
      ],
      wrapperToolExposureState: 'unknown',
      wrapperToolsBelievedAvailable: null,
      installHealth: {
        state: 'healthy',
      },
      runtimeAuthorization: {
        state: 'missing_token',
      },
      wrapperExposureVerification: {
        state: 'unverified',
      },
      livePolicyCapability: {
        state: 'missing_runtime_token',
      },
      diagnosticCode: 'install_repair_problem',
    });
  });

  it('preserves a guarded agent sandbox override without mutating global defaults', () => {
    const stateDir = makeTempDir();
    const configPath = path.join(stateDir, 'openclaw.json');
    const workspacePath = path.join(stateDir, 'workspace');

    writeFileSync(
      configPath,
      JSON.stringify(
        {
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
                tools: {
                  exec: {
                    host: 'sandbox',
                  },
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

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      configPath,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const guardedAgent = config.agents.list.find(
      (entry: { id: string }) => entry.id === 'mandateos_guarded',
    );
    const status = readMandateOsOpenClawStatus({
      workspacePath,
      openClawStateDir: stateDir,
      configPath,
      baseUrl: 'https://mandate.example',
    });

    expect(config.agents.defaults.sandbox.mode).toBe('all');
    expect(guardedAgent.sandbox.mode).toBe('off');
    expect(guardedAgent.tools.exec).toBeUndefined();
    expect(status).toMatchObject({
      agentSandboxMode: 'off',
      effectiveSandboxMode: 'off',
      sandboxModeSource: 'agent',
      globalDefaultsSandboxMode: 'all',
    });
  });

  it('repairs an existing install by resetting MandateOS-owned assets and caches', () => {
    const stateDir = makeTempDir();
    const configPath = path.join(stateDir, 'openclaw.json');
    const workspacePath = path.join(stateDir, 'workspace');
    const pluginDir = path.join(stateDir, 'extensions', 'mandateos');
    const bundleDir = path.join(stateDir, 'extensions', 'mandateos-bundle');

    writeFileSync(
      configPath,
      JSON.stringify(
        {
          plugins: {
            allow: ['mandateos'],
            entries: {
              existing: { enabled: true },
              mandateos: { enabled: false },
            },
          },
          mcp: {
            servers: {
              mandateos: {
                command: 'node',
                enabled: false,
              },
            },
          },
          agents: {
            list: [
              {
                id: 'mandateos_guarded',
                sandbox: {
                  mode: 'off',
                },
                tools: {
                  exec: {
                    host: 'sandbox',
                  },
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

    writeFileSync(path.join(stateDir, 'mandateos-openclaw-status.json'), '{}');
    writeFileSync(
      path.join(stateDir, 'mandateos-openclaw-approvals.json'),
      '[]',
    );
    mkdirSync(pluginDir, { recursive: true });
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(path.join(pluginDir, 'stale.txt'), 'stale', 'utf8');
    writeFileSync(path.join(bundleDir, 'stale.txt'), 'stale', 'utf8');

    const result = repairMandateOsOpenClawInstall({
      workspacePath,
      openClawStateDir: stateDir,
      configPath,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    expect(result.cleanedPaths).toEqual(
      expect.arrayContaining([
        pluginDir,
        bundleDir,
        path.join(stateDir, 'mandateos-openclaw-status.json'),
        path.join(stateDir, 'mandateos-openclaw-approvals.json'),
      ]),
    );
    expect(existsSync(path.join(pluginDir, 'stale.txt'))).toBe(false);
    expect(existsSync(path.join(bundleDir, 'stale.txt'))).toBe(false);
    expect(existsSync(path.join(pluginDir, 'openclaw.plugin.json'))).toBe(true);
    expect(existsSync(path.join(bundleDir, '.mcp.json'))).toBe(true);
    expect(config.plugins.entries.existing.enabled).toBe(true);
    expect(config.plugins.entries.mandateos.enabled).toBe(true);
    expect(config.mcp.servers.mandateos.enabled).toBe(true);
    expect(
      config.agents.list.find(
        (entry: { id: string }) => entry.id === 'mandateos_guarded',
      ).sandbox.mode,
    ).toBe('off');
  });

  it('lets repair switch the guarded agent sandbox mode explicitly', () => {
    const stateDir = makeTempDir();
    const configPath = path.join(stateDir, 'openclaw.json');
    const workspacePath = path.join(stateDir, 'workspace');

    writeFileSync(
      configPath,
      JSON.stringify(
        {
          agents: {
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

    repairMandateOsOpenClawInstall({
      workspacePath,
      openClawStateDir: stateDir,
      configPath,
      baseUrl: 'https://mandate.example',
      sandboxMode: 'all',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const guardedAgent = config.agents.list.find(
      (entry: { id: string }) => entry.id === 'mandateos_guarded',
    );

    expect(guardedAgent.sandbox.mode).toBe('all');
    expect(guardedAgent.tools.exec.host).toBe('sandbox');
  });

  it('surfaces the last denial reason from the plugin status store', () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: '/tmp/bridge.js',
      mcpEntryScriptPath: '/tmp/mcp.js',
    });

    writeFileSync(
      path.join(stateDir, 'mandateos-openclaw-status.json'),
      JSON.stringify(
        {
          lastDenial: {
            category: 'approval_missing',
            code: 'approval_missing',
            reason:
              'MandateOS blocked native exec. Try this next: call mandateos_openclaw_exec first.',
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const status = readMandateOsOpenClawStatus({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
    });

    expect(status.lastDenial).toMatchObject({
      category: 'approval_missing',
      code: 'approval_missing',
    });
    expect(status.lastDenialReason).toContain('mandateos_openclaw_exec');
  });

  it('runs doctor smoke tests against the configured bridge runtime', async () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');
    const fixture = makeBridgeFixture(stateDir);

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      defaultMandateId: 'mdt_123',
      bridgeScriptPath: fixture.bridgeScriptPath,
      mcpEntryScriptPath: fixture.mcpEntryScriptPath,
    });

    const payloadDecisions = ['local_allow', 'redirect_enforced'];
    let callIndex = 0;
    const result = await runMandateOsOpenClawDoctor(
      {
        workspacePath,
        openClawStateDir: stateDir,
        baseUrl: 'https://mandate.example',
      },
      {
        env: {
          ...process.env,
          MANDATE_OS_AGENT_TOKEN: 'token',
          MANDATE_OS_BASE_URL: 'https://mandate.example',
          MANDATE_OS_MCP_DEFAULT_MANDATE_ID: 'mdt_123',
        },
        bridgeCommandRunner: ({ bridgeScriptPath }) => ({
          bridgeScriptPath,
          exitCode: 0,
          stdout: JSON.stringify({ decision: payloadDecisions[callIndex++] }),
          stderr: '',
        }),
      },
    );

    expect(result.overall).toBe('healthy');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Local bridge smoke test',
          status: 'pass',
          message: 'Bridge returned local_allow.',
        }),
        expect.objectContaining({
          title: 'Live policy smoke test',
          status: 'pass',
          message: 'Bridge returned redirect_enforced.',
        }),
      ]),
    );
  });

  it('skips the live doctor smoke test when no default mandate is configured', async () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');
    const fixture = makeBridgeFixture(stateDir);

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: fixture.bridgeScriptPath,
      mcpEntryScriptPath: fixture.mcpEntryScriptPath,
    });

    const result = await runMandateOsOpenClawDoctor(
      {
        workspacePath,
        openClawStateDir: stateDir,
        baseUrl: 'https://mandate.example',
      },
      {
        env: {
          ...process.env,
          MANDATE_OS_AGENT_TOKEN: 'token',
          MANDATE_OS_BASE_URL: 'https://mandate.example',
        },
        bridgeCommandRunner: ({ bridgeScriptPath }) => ({
          bridgeScriptPath,
          exitCode: 0,
          stdout: JSON.stringify({ decision: 'local_allow' }),
          stderr: '',
        }),
      },
    );

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Live policy smoke test',
          status: 'skip',
        }),
      ]),
    );
  });

  it('marks misconfigured live policy smoke tests as degraded instead of broken', async () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');
    const fixture = makeBridgeFixture(stateDir);

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      defaultMandateId: 'mdt_123',
      bridgeScriptPath: fixture.bridgeScriptPath,
      mcpEntryScriptPath: fixture.mcpEntryScriptPath,
    });

    let callIndex = 0;
    const decisions = [
      { decision: 'local_allow' },
      {
        decision: 'misconfigured',
        userMessage: 'Principal key_demo is missing the simulate:write scope.',
      },
    ];

    const result = await runMandateOsOpenClawDoctor(
      {
        workspacePath,
        openClawStateDir: stateDir,
        baseUrl: 'https://mandate.example',
      },
      {
        env: {
          ...process.env,
          MANDATE_OS_AGENT_TOKEN: 'token',
          MANDATE_OS_BASE_URL: 'https://mandate.example',
          MANDATE_OS_MCP_DEFAULT_MANDATE_ID: 'mdt_123',
        },
        bridgeCommandRunner: ({ bridgeScriptPath }) => ({
          bridgeScriptPath,
          exitCode: 0,
          stdout: JSON.stringify(decisions[callIndex++]),
          stderr: '',
        }),
      },
    );

    expect(result.overall).toBe('degraded');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Live policy smoke test',
          status: 'warn',
          message: 'Principal key_demo is missing the simulate:write scope.',
        }),
      ]),
    );
  });

  it('surfaces wrapper exposure diagnostics from the plugin status store', () => {
    const stateDir = makeTempDir();
    const workspacePath = path.join(stateDir, 'workspace');
    const fixture = makeBridgeFixture(stateDir);

    installMandateOsIntoOpenClaw({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
      bridgeScriptPath: fixture.bridgeScriptPath,
      mcpEntryScriptPath: fixture.mcpEntryScriptPath,
    });

    process.env.MANDATE_OS_AGENT_TOKEN = 'token';

    writeFileSync(
      path.join(stateDir, 'mandateos-openclaw-status.json'),
      JSON.stringify(
        {
          pluginLoadedAt: '2026-03-27T10:00:00.000Z',
          toolRegistration: {
            attemptedToolNames: [
              'mandateos_openclaw_get_context',
              'mandateos_openclaw_exec',
              'mandateos_openclaw_browser_mutate',
              'mandateos_openclaw_spawn_agent',
            ],
            successfulToolNames: [
              'mandateos_openclaw_get_context',
              'mandateos_openclaw_exec',
              'mandateos_openclaw_browser_mutate',
              'mandateos_openclaw_spawn_agent',
            ],
            sessionRegistrations: [
              {
                toolName: 'mandateos_openclaw_exec',
                sessionId: 'sess_123',
              },
            ],
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const status = readMandateOsOpenClawStatus({
      workspacePath,
      openClawStateDir: stateDir,
      baseUrl: 'https://mandate.example',
    });

    expect(status).toMatchObject({
      runtimePluginLoaded: true,
      pluginLoadedAt: '2026-03-27T10:00:00.000Z',
      wrapperRegistrationAttempted: true,
      wrapperRegisteredToolNames: [
        'mandateos_openclaw_exec',
        'mandateos_openclaw_browser_mutate',
        'mandateos_openclaw_spawn_agent',
      ],
      wrapperSessionRegistrationCount: 1,
      wrapperToolExposureKnown: true,
      wrapperToolsBelievedAvailable: true,
      wrapperToolExposureState: 'available',
      wrapperToolExposureSource: 'session_registration',
      installHealth: {
        state: 'healthy',
      },
      runtimeAuthorization: {
        state: 'ready',
      },
      wrapperExposureVerification: {
        state: 'verified',
      },
      livePolicyCapability: {
        state: 'missing_default_mandate',
      },
      diagnosticCode: 'ok',
    });
    expect(status.wrapperToolExposureNote).toContain(
      'wrapper tools instantiated',
    );
  });
});
