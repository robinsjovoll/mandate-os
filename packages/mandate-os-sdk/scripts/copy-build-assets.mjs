import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, '..');
const distDir = resolve(packageDir, '../../dist/packages/mandate-os-sdk');
const packageJsonPath = resolve(packageDir, 'package.json');

await mkdir(distDir, { recursive: true });
await cp(resolve(packageDir, 'README.md'), resolve(distDir, 'README.md'));

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const version =
  process.env.MANDATE_OS_SDK_PACKAGE_VERSION?.trim() || packageJson.version;

await writeFile(
  resolve(distDir, 'package.json'),
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
      exports: packageJson.exports,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
