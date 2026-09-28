import { execSync } from 'node:child_process';
import pg from 'pg';
import { E2E } from './env';

/** Fresh E2E database with all migrations applied. */
export default async function globalSetup() {
  const url = new URL(E2E.databaseUrl);
  const dbName = url.pathname.slice(1);
  const admin = new pg.Client({
    connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString(),
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execSync('pnpm --filter @sproutly/api migrate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E.databaseUrl },
  });
}
