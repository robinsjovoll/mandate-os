import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type MandateOsRuntimeBinary =
  | 'mandate-os-mcp'
  | 'mandate-os-hook-gateway';

export type MandateOsNodeRuntimeCommand = {
  command: string;
  args: string[];
  shellWords: string[];
};

const MANDATE_OS_MCP_PACKAGE_SPEC = '@mandate-os/mcp@latest';
const MANDATE_OS_PACKAGE_FILE_PREFIX = 'package:';
const TRANSIENT_NPM_EXEC_MARKER = `${path.sep}_npx${path.sep}`;
const MANDATE_OS_PACKAGE_ROOT_MARKER = `${path.sep}node_modules${path.sep}@mandate-os${path.sep}mcp${path.sep}`;

export function createMandateOsNodeRuntimeCommand(input: {
  scriptPath: string;
  binaryName: MandateOsRuntimeBinary;
}): MandateOsNodeRuntimeCommand {
  if (isTransientNpmExecPath(input.scriptPath)) {
    const shellWords = [
      'npx',
      '--yes',
      '--prefer-offline',
      '--package',
      MANDATE_OS_MCP_PACKAGE_SPEC,
      input.binaryName,
    ];

    return {
      command: shellWords[0],
      args: shellWords.slice(1),
      shellWords,
    };
  }

  return {
    command: 'node',
    args: [input.scriptPath],
    shellWords: ['node', input.scriptPath],
  };
}

export function isMandateOsHookGatewayInvocation(
  command: string,
  hookGatewayPath: string,
) {
  return (
    command.includes(hookGatewayPath) ||
    command.includes('hook-gateway.js') ||
    command.includes('mandate-os-hook-gateway')
  );
}

export function toMandateOsRuntimeFileReference(filePath: string) {
  const normalizedPath = path.resolve(filePath);

  if (!normalizedPath.includes(TRANSIENT_NPM_EXEC_MARKER)) {
    return normalizedPath;
  }

  const packageRootMarkerIndex = normalizedPath.lastIndexOf(
    MANDATE_OS_PACKAGE_ROOT_MARKER,
  );

  if (packageRootMarkerIndex === -1) {
    return normalizedPath;
  }

  const relativePath = normalizedPath
    .slice(packageRootMarkerIndex + MANDATE_OS_PACKAGE_ROOT_MARKER.length)
    .split(path.sep)
    .join('/');

  return `${MANDATE_OS_PACKAGE_FILE_PREFIX}${relativePath}`;
}

export function resolveMandateOsRuntimeFileReference(fileReference: string) {
  if (!fileReference.startsWith(MANDATE_OS_PACKAGE_FILE_PREFIX)) {
    return fileReference;
  }

  const relativePath = fileReference.slice(MANDATE_OS_PACKAGE_FILE_PREFIX.length);
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, relativePath),
    path.resolve(currentDir, '../', relativePath),
  ];

  return (
    candidatePaths.find((candidatePath) => existsSync(candidatePath)) ||
    candidatePaths[0]
  );
}

function isTransientNpmExecPath(filePath: string) {
  return path.resolve(filePath).includes(TRANSIENT_NPM_EXEC_MARKER);
}
