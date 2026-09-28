import { test as base, expect, type Page } from '@playwright/test';
import { Redis } from 'ioredis';
import { E2E } from './env';

/**
 * Stand-in for https://accounts.google.com/gsi/client: renders a button that
 * hands a fake credential to the registered callback.
 */
const FAKE_GIS = `
window.google = { accounts: { id: {
  initialize(cfg) { window.__gisCallback = cfg.callback; },
  renderButton(el) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Continue with Google';
    b.onclick = () => window.__gisCallback({ credential: 'fake-google-credential' });
    el.appendChild(b);
  },
  prompt() {},
  cancel() {},
} } };`;

export const test = base.extend<{ redis: Redis; page: Page }>({
  redis: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const redis = new Redis(E2E.redisUrl);
      await redis.flushdb(); // clears rate limits, codes and the dev outbox between tests
      await use(redis);
      await redis.quit();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    await page.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }),
    );
    await use(page);
  },
});

export { expect };

/** Reads the latest sign-in code the dev email sender stored for `email`. */
export async function latestCode(redis: Redis, email: string): Promise<string> {
  let raw: string | null = null;
  await expect
    .poll(async () => (raw = await redis.get(`dev:outbox:${email}`)), { timeout: 5000 })
    .not.toBeNull();
  const code = JSON.parse(raw!).text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code in email to ${email}`);
  return code;
}

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
