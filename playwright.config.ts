import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end tests against a running store (production build).
 *   E2E_BASE_URL         default http://localhost:3000
 *   E2E_ADMIN_EMAIL      an owner account
 *   E2E_ADMIN_PASSWORD   its password
 *   PW_CHROMIUM_PATH     optional: use an already installed Chromium
 * The tests change data (orders, a test category, a price they put back), so run them on a test copy of the store.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'off',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
