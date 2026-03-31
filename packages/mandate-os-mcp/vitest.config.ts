import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      '@mandate-os/sdk': path.resolve(
        rootDir,
        '../mandate-os-sdk/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
});
