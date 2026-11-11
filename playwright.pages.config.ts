import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  outputDir: './test-results/pages',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  use: { baseURL: process.env.PAGES_TEST_URL || 'http://127.0.0.1:4173/adcrew/', trace: 'retain-on-failure', channel: process.env.PAGES_BROWSER_CHANNEL },
  webServer: process.env.PAGES_TEST_URL ? undefined : {
    command: 'npm run preview:pages',
    url: 'http://127.0.0.1:4173/adcrew/',
    reuseExistingServer: !process.env.CI,
  },
});
