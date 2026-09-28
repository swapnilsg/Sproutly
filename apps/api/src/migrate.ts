import path from 'node:path';
import { runner } from 'node-pg-migrate';

export const migrationsDir = path.resolve(import.meta.dirname, '../migrations');

export async function migrate(
  databaseUrl: string,
  direction: 'up' | 'down' = 'up',
  count?: number,
) {
  await runner({
    databaseUrl,
    dir: migrationsDir,
    direction,
    count: count ?? (direction === 'up' ? Infinity : 1),
    migrationsTable: 'pgmigrations',
    log: () => {},
  });
}

// CLI: `pnpm migrate` / `pnpm migrate:down`
if (process.argv[1] === import.meta.filename) {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file — rely on the real environment
  }
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  await migrate(url, direction);
  console.log(`Migrations ${direction} complete`);
}
