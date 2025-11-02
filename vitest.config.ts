import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [resolve(rootDir, 'tests/setup/global.ts')],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      reporter: ['text', 'lcov'],
      reportsDirectory: resolve(rootDir, 'coverage'),
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@': rootDir
    }
  }
});
