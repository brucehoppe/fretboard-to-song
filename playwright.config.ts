import { defineConfig, devices } from '@playwright/test';

const PORT = 8790;

/**
 * End-to-end tests run in real browsers against the built Cloudflare Worker
 * with a fresh local D1 database (see tests/e2e/serve.mjs). Run `pnpm build` first.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1, // one shared database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: { command: `node tests/e2e/serve.mjs ${PORT}`, url: `http://127.0.0.1:${PORT}/api/practice`, timeout: 120_000, reuseExistingServer: false },
});
