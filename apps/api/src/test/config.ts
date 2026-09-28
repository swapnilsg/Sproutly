export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://sproutly:sproutly@localhost:5432/sproutly_test';
// Redis db 1 keeps tests away from dev data in db 0.
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
