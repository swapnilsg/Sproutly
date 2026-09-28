import { Redis } from 'ioredis';
import pg from 'pg';
import { ConsoleEmailSender, ResendEmailSender, type EmailSender } from './email.js';
import type { Env } from './env.js';
import { createGoogleVerifier, type GoogleVerifier } from './auth/google.js';

export interface Deps {
  env: Env;
  db: pg.Pool;
  redis: Redis;
  email: EmailSender;
  /** null when GOOGLE_CLIENT_ID is not configured. */
  verifyGoogle: GoogleVerifier | null;
}

export function createDeps(env: Env): Deps {
  const db = new pg.Pool({ connectionString: env.DATABASE_URL });
  const redis = new Redis(env.REDIS_URL);
  return {
    env,
    db,
    redis,
    email: env.EMAIL_API_KEY
      ? new ResendEmailSender(env.EMAIL_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmailSender(redis),
    verifyGoogle: env.GOOGLE_CLIENT_ID ? createGoogleVerifier(env.GOOGLE_CLIENT_ID) : null,
  };
}

export async function closeDeps(deps: Deps): Promise<void> {
  await Promise.all([deps.db.end(), deps.redis.quit()]);
}
