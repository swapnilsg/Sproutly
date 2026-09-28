import { defineConfig, devices } from '@playwright/test';
import { E2E } from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/globalSetup.ts',
  // Tests share one database and Redis db.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${E2E.webPort}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @sproutly/api exec tsx src/index.ts',
      url: `http://localhost:${E2E.apiPort}/api/v1/health`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: String(E2E.apiPort),
        WEB_ORIGIN: `http://localhost:${E2E.webPort}`,
        DATABASE_URL: E2E.databaseUrl,
        REDIS_URL: E2E.redisUrl,
        JWT_SECRET: 'e2e-jwt-secret-e2e-jwt-secret-000000',
        OTP_SECRET: 'e2e-otp-secret-e2e-otp-secret-000000',
        // Configured so the Google route is live; the browser-side GIS script is stubbed.
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        EMAIL_API_KEY: '',
      },
    },
    {
      command: 'pnpm exec vite',
      url: `http://localhost:${E2E.webPort}`,
      reuseExistingServer: false,
      env: {
        WEB_PORT: String(E2E.webPort),
        API_PORT: String(E2E.apiPort),
        VITE_GOOGLE_CLIENT_ID: 'e2e-google-client-id',
      },
    },
  ],
});
