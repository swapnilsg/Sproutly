import { Redis } from 'ioredis';
import pg from 'pg';
import request from 'supertest';
import { vi } from 'vitest';
import { createApp } from '../app.js';
import type { GoogleVerifier } from '../auth/google.js';
import { REFRESH_COOKIE } from '../auth/routes.js';
import type { Deps } from '../deps.js';
import type { EmailMessage, EmailSender } from '../email.js';
import { loadEnv } from '../env.js';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './config.js';

export class RecordingEmailSender implements EmailSender {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
  /** The 6-digit code in the latest email to `to`. */
  lastCode(to: string): string {
    const msg = this.sent.filter((m) => m.to === to).at(-1);
    const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`No code emailed to ${to}`);
    return code;
  }
}

export function createTestContext() {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: TEST_REDIS_URL,
    JWT_SECRET: 'test-jwt-secret-test-jwt-secret-000',
    OTP_SECRET: 'test-otp-secret-test-otp-secret-000',
    GOOGLE_CLIENT_ID: 'test-client-id',
  });
  const email = new RecordingEmailSender();
  const verifyGoogle = vi.fn<GoogleVerifier>();
  const deps: Deps = {
    env,
    db: new pg.Pool({ connectionString: env.DATABASE_URL }),
    redis: new Redis(env.REDIS_URL),
    email,
    verifyGoogle,
  };
  const app = createApp(deps);

  return {
    deps,
    app,
    email,
    verifyGoogle,
    async reset() {
      email.sent = [];
      verifyGoogle.mockReset();
      await deps.db.query(
        'TRUNCATE users, auth_identities, refresh_tokens, onboarding_events CASCADE',
      );
      await deps.redis.flushdb();
    },
    async close() {
      await Promise.all([deps.db.end(), deps.redis.quit()]);
    },
    /** Runs the full email-code sign-in and returns the response. */
    async signIn(address: string) {
      await request(app).post('/api/v1/auth/email/start').send({ email: address }).expect(202);
      return request(app)
        .post('/api/v1/auth/email/verify')
        .send({ email: address, code: email.lastCode(address) })
        .expect(200);
    },
  };
}

/** Extracts the refresh cookie value from a supertest response. */
export function refreshCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('No refresh cookie set');
  return cookie.split(';')[0]!;
}
