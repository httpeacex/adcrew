import { randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/server',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100/login',
    env: { KADR_DB_PATH: `.data/e2e-${randomUUID()}.sqlite`, KADR_DEMO_MODE: '1', KADR_SECURE_COOKIE: '0' },
  },
});
