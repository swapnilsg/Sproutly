import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings. The default parses them into a Date at
// local midnight, which shifts the day for anyone whose server clock isn't in the user's timezone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/** Runs `fn` in a transaction on one pooled client, rolling back on any error. */
export async function inTransaction<T>(
  db: pg.Pool,
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
