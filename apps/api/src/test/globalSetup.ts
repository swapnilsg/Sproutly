import pg from 'pg';
import { migrate } from '../migrate.js';
import { TEST_DATABASE_URL } from './config.js';

/** Recreates the test database from scratch and runs all migrations (up, down, up). */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = new pg.Client({
    connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString(),
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  // Exercise the down migrations too, so they don't rot.
  await migrate(TEST_DATABASE_URL, 'up');
  await migrate(TEST_DATABASE_URL, 'down', Infinity);
  await migrate(TEST_DATABASE_URL, 'up');
}
