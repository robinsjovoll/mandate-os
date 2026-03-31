#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const PACKAGE_ORDER = [
  {
    project: '@mandate-os/sdk',
    versionEnv: 'MANDATE_OS_SDK_PACKAGE_VERSION',
    packageJsonPath: path.join(
      workspaceRoot,
      'packages/mandate-os-sdk/package.json',
    ),
    distDir: path.join(workspaceRoot, 'dist/packages/mandate-os-sdk'),
    dependencies: [],
  },
  {
    project: '@mandate-os/mcp',
    versionEnv: 'MANDATE_OS_MCP_PACKAGE_VERSION',
    packageJsonPath: path.join(
      workspaceRoot,
      'packages/mandate-os-mcp/package.json',
    ),
    distDir: path.join(workspaceRoot, 'dist/packages/mandate-os-mcp'),
    dependencies: ['@mandate-os/sdk'],
  },
  {
    project: '@mandate-os/openclaw',
    versionEnv: 'MANDATE_OS_OPENCLAW_PACKAGE_VERSION',
    packageJsonPath: path.join(
      workspaceRoot,
      'packages/mandate-os-openclaw/package.json',
    ),
    distDir: path.join(workspaceRoot, 'dist/packages/mandate-os-openclaw'),
    dependencies: ['@mandate-os/sdk', '@mandate-os/mcp'],
  },
];

const PACKAGE_BY_PROJECT = new Map(
  PACKAGE_ORDER.map((entry) => [entry.project, entry]),
);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const affectedProjects = await resolveAffectedProjects(options);
  const initialReleaseProjects = affectedProjects.filter((project) =>
    PACKAGE_BY_PROJECT.has(project),
  );

  if (initialReleaseProjects.length === 0) {
    console.log('No MandateOS packages are affected. Nothing to release.');
    return;
  }

  const sourceVersions = new Map();
  const publishedVersions = new Map();

  for (const entry of PACKAGE_ORDER) {
    const sourceVersion = await readSourceVersion(entry.packageJsonPath);
    sourceVersions.set(entry.project, sourceVersion);
    publishedVersions.set(
      entry.project,
      await readPublishedVersion(entry.project),
    );
  }

  const releaseProjects = expandReleaseProjects(
    initialReleaseProjects,
    publishedVersions,
  );
  const plannedVersions = new Map();

  for (const entry of PACKAGE_ORDER) {
    const sourceVersion = sourceVersions.get(entry.project);
    const publishedVersion = publishedVersions.get(entry.project);

    if (!sourceVersion) {
      throw new Error(`Missing source version for ${entry.project}.`);
    }

    plannedVersions.set(
      entry.project,
      releaseProjects.has(entry.project)
        ? nextReleaseVersion(sourceVersion, publishedVersion)
        : publishedVersion || normalizeInitialVersion(sourceVersion),
    );
  }

  console.log('MandateOS npm release plan:');
  for (const entry of PACKAGE_ORDER) {
    const publishedVersion = publishedVersions.get(entry.project);
    const plannedVersion = plannedVersions.get(entry.project);
    const marker = releaseProjects.has(entry.project) ? 'release' : 'keep';
    console.log(
      `- ${entry.project}: ${publishedVersion || 'unpublished'} -> ${plannedVersion} [${marker}]`,
    );
  }

  const buildEnv = {
    ...process.env,
  };

  for (const entry of PACKAGE_ORDER) {
    const plannedVersion = plannedVersions.get(entry.project);

    if (!plannedVersion) {
      throw new Error(`Missing planned version for ${entry.project}.`);
    }

    buildEnv[entry.versionEnv] = plannedVersion;
  }

  for (const entry of PACKAGE_ORDER) {
    if (!releaseProjects.has(entry.project)) {
      continue;
    }

    console.log(`Building ${entry.project}...`);
    await runCommand(
      'pnpm',
      ['exec', 'nx', 'run', `${entry.project}:build`],
      buildEnv,
      workspaceRoot,
    );
  }

  const packDir = await mkdtemp(
    path.join(os.tmpdir(), 'mandate-os-package-release-'),
  );

  for (const entry of PACKAGE_ORDER) {
    if (!releaseProjects.has(entry.project)) {
      continue;
    }

    console.log(`Packing ${entry.project}...`);
    await runCommand(
      'npm',
      ['pack', '--json', '--pack-destination', packDir],
      buildEnv,
      entry.distDir,
    );
  }

  if (!options.publish) {
    console.log(`Dry run complete. Packed release candidates into ${packDir}.`);
    return;
  }

  for (const entry of PACKAGE_ORDER) {
    if (!releaseProjects.has(entry.project)) {
      continue;
    }

    console.log(`Publishing ${entry.project}...`);
    const publishArgs = ['publish', '--access', 'public'];

    if (options.tag) {
      publishArgs.push('--tag', options.tag);
    }

    await runCommand('npm', publishArgs, buildEnv, entry.distDir);
  }
}

function parseArgs(argv) {
  const options = {
    publish: false,
    tag: '',
    base: '',
    head: '',
    files: '',
    uncommitted: false,
    untracked: false,
  };

  const args = [...argv];

  while (args.length > 0) {
    const token = args.shift();

    if (!token) {
      break;
    }

    switch (token) {
      case '--publish':
        options.publish = true;
        break;
      case '--dry-run':
        options.publish = false;
        break;
      case '--tag':
        options.tag = readRequiredValue(args, token);
        break;
      case '--base':
        options.base = readRequiredValue(args, token);
        break;
      case '--head':
        options.head = readRequiredValue(args, token);
        break;
      case '--files':
        options.files = readRequiredValue(args, token);
        break;
      case '--uncommitted':
        options.uncommitted = true;
        break;
      case '--untracked':
        options.untracked = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  const hasAffectedSelector = Boolean(
    options.files ||
      options.uncommitted ||
      options.untracked ||
      (options.base && options.head) ||
      options.base,
  );

  if (!hasAffectedSelector) {
    throw new Error(
      'Pass --base/--head, --files, --uncommitted, or --untracked so Nx can resolve affected packages.',
    );
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/releases/publish-mandate-os-packages.mjs [options]

Options:
  --publish         Publish the affected MandateOS packages to npm.
  --dry-run         Build and pack the affected packages without publishing.
  --tag <tag>       Optional npm dist-tag to publish under.
  --base <sha>      Base SHA for Nx affected calculation.
  --head <sha>      Head SHA for Nx affected calculation.
  --files <list>    Comma-separated files for Nx affected calculation.
  --uncommitted     Use uncommitted changes for Nx affected calculation.
  --untracked       Use untracked changes for Nx affected calculation.
`);
}

function readRequiredValue(args, flag) {
  const value = args.shift();

  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

async function resolveAffectedProjects(options) {
  const args = [
    'exec',
    'nx',
    'show',
    'projects',
    '--affected',
    '--json',
    '--projects',
    PACKAGE_ORDER.map((entry) => entry.project).join(','),
  ];

  if (options.base) {
    args.push('--base', options.base);
  }

  if (options.head) {
    args.push('--head', options.head);
  }

  if (options.files) {
    args.push('--files', options.files);
  }

  if (options.uncommitted) {
    args.push('--uncommitted');
  }

  if (options.untracked) {
    args.push('--untracked');
  }

  const { stdout } = await runCommand('pnpm', args, process.env, workspaceRoot);
  const trimmed = stdout.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [];
}

async function readSourceVersion(packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  return packageJson.version;
}

async function readPublishedVersion(packageName) {
  try {
    const { stdout } = await runCommand(
      'npm',
      ['view', packageName, 'version', '--json'],
      process.env,
      workspaceRoot,
    );
    const trimmed = stdout.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.at(-1) || null : parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('E404') ||
      message.includes('404 Not Found') ||
      message.includes('is not in this registry')
    ) {
      return null;
    }

    throw error;
  }
}

function expandReleaseProjects(initialProjects, publishedVersions) {
  const releaseProjects = new Set(initialProjects);
  let changed = true;

  while (changed) {
    changed = false;

    for (const project of Array.from(releaseProjects)) {
      const entry = PACKAGE_BY_PROJECT.get(project);

      if (!entry) {
        continue;
      }

      for (const dependency of entry.dependencies) {
        if (
          !publishedVersions.get(dependency) &&
          !releaseProjects.has(dependency)
        ) {
          releaseProjects.add(dependency);
          changed = true;
        }
      }
    }
  }

  return releaseProjects;
}

function nextReleaseVersion(sourceVersion, publishedVersion) {
  if (!publishedVersion) {
    return normalizeInitialVersion(sourceVersion);
  }

  if (compareSemver(sourceVersion, publishedVersion) > 0) {
    return sourceVersion;
  }

  return incrementPatchVersion(publishedVersion);
}

function normalizeInitialVersion(version) {
  return version === '0.0.0' ? '0.1.0' : version;
}

function incrementPatchVersion(version) {
  const parsed = parseSemver(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());

  if (!match) {
    throw new Error(
      `Unsupported version format "${version}". Expected plain x.y.z semver.`,
    );
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

async function runCommand(command, args, env, cwd) {
  try {
    return await execFileAsync(command, args, {
      cwd,
      env,
      maxBuffer: 1024 * 1024 * 20,
    });
  } catch (error) {
    throw new Error(formatExecError(command, args, error));
  }
}

function formatExecError(command, args, error) {
  if (!error || typeof error !== 'object') {
    return `${command} ${args.join(' ')} failed.`;
  }

  const stdout =
    'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
  const stderr =
    'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';
  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : `${command} ${args.join(' ')} failed.`;

  return [message, stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
