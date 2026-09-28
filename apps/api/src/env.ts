import { z } from 'zod';

// Blank values in .env files mean "not set".
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  OTP_SECRET: z.string().min(32, 'OTP_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: optional,
  EMAIL_API_KEY: optional,
  EMAIL_FROM: z.string().default('Sproutly <hello@sproutly.app>'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }
  return result.data;
}
