import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/tick`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PGLITE_DIR: '.pglite-e2e',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-secret-not-for-production-use-0123456789',
      AUTH_TRUST_HOST: 'true',
      GW_ENABLE_DEV_LOGIN: '1',
      ADMIN_EMAILS: 'admin@gospelwars.test',
      CRON_SECRET: 'e2e-cron-secret',
    },
  },
});
