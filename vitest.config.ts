import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    env: { GW_TEST: '1' },
  },
});
