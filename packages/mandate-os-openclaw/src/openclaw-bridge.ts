#!/usr/bin/env node

import { stdin as input, stdout as output } from 'node:process';

import {
  createMandateOsOpenClawGateway,
  evaluateOpenClawPolicy,
  readMandateOsOpenClawBridgeConfig,
} from './openclaw-policy.js';
import type { PolicyGatewayAttempt } from '@mandate-os/sdk';

async function readStdin() {
  let combined = '';

  for await (const chunk of input) {
    combined += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  }

  return combined.trim();
}

async function main() {
  const command = process.argv[2];

  if (command !== 'evaluate') {
    throw new Error(`Unsupported OpenClaw bridge command: ${String(command)}`);
  }

  const raw = await readStdin();
  const payload = (raw ? JSON.parse(raw) : {}) as PolicyGatewayAttempt;
  const config = readMandateOsOpenClawBridgeConfig();
  const gateway = createMandateOsOpenClawGateway(config);
  const result = await evaluateOpenClawPolicy(gateway, payload);

  output.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  output.write(
    `${JSON.stringify(
      {
        permission: 'deny',
        decision: 'misconfigured',
        userMessage: message,
        agentMessage: message,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(1);
});
