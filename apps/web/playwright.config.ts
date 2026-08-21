import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.WEB_PORT ?? '3000';
const webUrl = process.env.WEB_URL ?? `http://localhost:${webPort}`;
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Set to run against something already deployed — staging after a release, say.
 * The local servers are then neither started nor wanted.
 *
 * The full journeys work against a deployment provided MAILPIT_URL is also set:
 * they collect the verification code from the inbox instead of relying on
 * E2E_EXPOSE_OTP, which no deployed environment should ever have on.
 */
const deployedTarget = process.env.E2E_BASE_URL;

const localServers = [
  {
    command: 'npx tsx src/main.ts',
    cwd: path.join(__dirname, '../api'),
    url: `${apiBase}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_EXPOSE_OTP: '1',
      MAILER_DRIVER: 'memory',
      BCRYPT_ROUNDS: '4',
      // Journeys replay the auth endpoints far more often than a real client.
      AUTH_RATE_LIMIT: '10000',
    },
  },
  {
    command: 'pnpm dev',
    url: webUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
];

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: deployedTarget ?? webUrl,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(deployedTarget ? {} : { webServer: localServers }),
});
