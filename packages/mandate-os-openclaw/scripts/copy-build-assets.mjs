import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(rootDir, '..');
const assetsDir = path.resolve(packageDir, 'assets');
const readmePath = path.resolve(packageDir, 'README.md');
const distDir = path.resolve(
  packageDir,
  '../../dist/packages/mandate-os-openclaw',
);
const packageJsonPath = path.resolve(packageDir, 'package.json');
const sdkPackageJsonPath = path.resolve(
  packageDir,
  '../mandate-os-sdk/package.json',
);
const mcpPackageJsonPath = path.resolve(
  packageDir,
  '../mandate-os-mcp/package.json',
);

mkdirSync(distDir, { recursive: true });
rmSync(path.join(distDir, 'bin'), { force: true, recursive: true });

if (existsSync(assetsDir)) {
  cpSync(assetsDir, path.join(distDir, 'assets'), {
    force: true,
    recursive: true,
  });
}

if (existsSync(readmePath)) {
  cpSync(readmePath, path.join(distDir, 'README.md'), {
    force: true,
  });
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const sdkPackageJson = JSON.parse(readFileSync(sdkPackageJsonPath, 'utf8'));
const mcpPackageJson = JSON.parse(readFileSync(mcpPackageJsonPath, 'utf8'));
const version =
  process.env.MANDATE_OS_OPENCLAW_PACKAGE_VERSION?.trim() ||
  packageJson.version;
const sdkVersion =
  process.env.MANDATE_OS_SDK_PACKAGE_VERSION?.trim() || sdkPackageJson.version;
const mcpVersion =
  process.env.MANDATE_OS_MCP_PACKAGE_VERSION?.trim() || mcpPackageJson.version;
const distBins = {
  'mandate-os-openclaw-install': 'openclaw-install.js',
  'mandate-os-openclaw-bridge': 'openclaw-bridge.js',
};

for (const [commandName, entryPoint] of Object.entries(distBins)) {
  writeFileSync(
    path.join(distDir, commandName),
    `#!/usr/bin/env node
import './${entryPoint}';
`,
    {
      encoding: 'utf8',
      mode: 0o755,
    },
  );
}

writeFileSync(
  path.join(distDir, 'package.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version,
      description: packageJson.description,
      author: packageJson.author,
      keywords: packageJson.keywords,
      license: packageJson.license,
      homepage: packageJson.homepage,
      bugs: packageJson.bugs,
      repository: packageJson.repository,
      type: packageJson.type,
      sideEffects: packageJson.sideEffects,
      publishConfig: packageJson.publishConfig,
      main: './index.js',
      module: './index.js',
      types: './index.d.ts',
      bin: {
        'mandate-os-openclaw-install': 'mandate-os-openclaw-install',
        'mandate-os-openclaw-bridge': 'mandate-os-openclaw-bridge',
      },
      exports: packageJson.exports,
      dependencies: {
        '@mandate-os/mcp': mcpVersion,
        '@mandate-os/sdk': sdkVersion,
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);
