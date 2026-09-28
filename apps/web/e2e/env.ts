export const E2E = {
  webPort: 3100,
  apiPort: 4100,
  databaseUrl:
    process.env.E2E_DATABASE_URL ?? 'postgres://sproutly:sproutly@localhost:5432/sproutly_e2e',
  // Redis db 2 keeps E2E data away from dev (0) and API tests (1).
  redisUrl: process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/2',
};
