import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.WEB_PORT ?? '3000';
const webUrl = process.env.WEB_URL ?? `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: webUrl,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: webUrl,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
