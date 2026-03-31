import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, '..');
const distDir = resolve(packageDir, '../../dist/packages/mandate-os-mcp');
const sdkPackageJsonPath = resolve(
  packageDir,
  '../mandate-os-sdk/package.json',
);

await mkdir(distDir, { recursive: true });
await cp(resolve(packageDir, 'README.md'), resolve(distDir, 'README.md'));
await cp(resolve(packageDir, 'rules'), resolve(distDir, 'rules'), {
  recursive: true,
  force: true,
  errorOnExist: false,
});

const packageJsonPath = resolve(packageDir, 'package.json');
const distPackageJsonPath = resolve(distDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const sdkPackageJson = JSON.parse(await readFile(sdkPackageJsonPath, 'utf8'));
const version =
  process.env.MANDATE_OS_MCP_PACKAGE_VERSION?.trim() || packageJson.version;
const sdkVersion =
  process.env.MANDATE_OS_SDK_PACKAGE_VERSION?.trim() || sdkPackageJson.version;

await writeFile(
  distPackageJsonPath,
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
      bin: packageJson.bin,
      exports: packageJson.exports,
      dependencies: {
        ...packageJson.dependencies,
        '@mandate-os/sdk': sdkVersion,
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);
