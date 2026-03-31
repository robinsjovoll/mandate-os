import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const externalBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

export default defineConfig({
  resolve: {
    alias: {
      '@mandate-os/sdk': path.resolve(
        rootDir,
        '../mandate-os-sdk/src/index.ts',
      ),
    },
  },
  build: {
    outDir: path.resolve(rootDir, '../../dist/packages/mandate-os-mcp'),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: {
        index: path.resolve(rootDir, 'src/index.ts'),
        'hook-gateway': path.resolve(rootDir, 'src/hook-gateway.ts'),
        'cursor-install': path.resolve(rootDir, 'src/cursor-install.ts'),
        'claude-install': path.resolve(rootDir, 'src/claude-install.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: (id) =>
        id.startsWith('node:') || externalBuiltins.has(id) || id === 'fsevents',
    },
  },
});
