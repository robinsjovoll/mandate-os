#!/usr/bin/env node

import {
  installMandateOsIntoOpenClaw,
  type OpenClawSandboxMode,
  repairMandateOsOpenClawInstall,
  runMandateOsOpenClawDoctor,
  readMandateOsOpenClawStatus,
} from './openclaw-setup.js';

function requireBaseUrl(env: NodeJS.ProcessEnv) {
  const baseUrl = env.MANDATE_OS_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      'MANDATE_OS_BASE_URL must be set before installing MandateOS into OpenClaw.',
    );
  }

  return baseUrl;
}

function resolveWorkspacePath(env: NodeJS.ProcessEnv) {
  return (
    env.MANDATE_OS_OPENCLAW_WORKSPACE_PATH?.trim() ||
    env.INIT_CWD?.trim() ||
    process.cwd()
  );
}

function resolveSandboxMode(
  argv: string[],
  env: NodeJS.ProcessEnv,
): OpenClawSandboxMode | undefined {
  const args = argv.slice(3);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--no-sandbox') {
      return 'off';
    }

    if (arg === '--sandbox-mode' || arg === '--sandbox') {
      const value = args[index + 1];
      if (value === 'all' || value === 'off') {
        return value;
      }
      throw new Error(
        `Invalid sandbox mode: ${String(value)}. Use "all" or "off".`,
      );
    }

    if (arg.startsWith('--sandbox-mode=')) {
      const value = arg.slice('--sandbox-mode='.length);
      if (value === 'all' || value === 'off') {
        return value;
      }
      throw new Error(
        `Invalid sandbox mode: ${String(value)}. Use "all" or "off".`,
      );
    }
  }

  const envValue = env.MANDATE_OS_OPENCLAW_SANDBOX_MODE?.trim();
  if (!envValue) {
    return undefined;
  }
  if (envValue === 'all' || envValue === 'off') {
    return envValue;
  }
  throw new Error(
    `Invalid MANDATE_OS_OPENCLAW_SANDBOX_MODE: ${envValue}. Use "all" or "off".`,
  );
}

async function main() {
  const command = process.argv[2] || 'status';
  const workspacePath = resolveWorkspacePath(process.env);
  const sandboxMode = resolveSandboxMode(process.argv, process.env);

  if (command === 'install') {
    const result = installMandateOsIntoOpenClaw({
      workspacePath,
      baseUrl: requireBaseUrl(process.env),
      defaultMandateId:
        process.env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID?.trim() ||
        process.env.MANDATE_OS_DEFAULT_MANDATE_ID?.trim() ||
        undefined,
      sandboxMode,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'repair' || command === 'clean-install') {
    const result = repairMandateOsOpenClawInstall({
      workspacePath,
      baseUrl: requireBaseUrl(process.env),
      defaultMandateId:
        process.env.MANDATE_OS_MCP_DEFAULT_MANDATE_ID?.trim() ||
        process.env.MANDATE_OS_DEFAULT_MANDATE_ID?.trim() ||
        undefined,
      sandboxMode,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'status') {
    const result = readMandateOsOpenClawStatus({
      workspacePath,
      baseUrl:
        process.env.MANDATE_OS_BASE_URL?.trim() || 'http://status-only.invalid',
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'doctor' || command === 'self-test') {
    const result = await runMandateOsOpenClawDoctor({
      workspacePath,
      baseUrl:
        process.env.MANDATE_OS_BASE_URL?.trim() || 'http://status-only.invalid',
    });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.overall === 'broken' ? 1 : 0;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
