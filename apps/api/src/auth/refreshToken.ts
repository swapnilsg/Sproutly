import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { HttpError } from '../errors.js';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * A token rotated within this window may be presented again without being treated as theft.
 * This covers two tabs refreshing at the same moment.
 */
const REUSE_GRACE_MS = 30 * 1000;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

async function insertToken(db: pg.Pool | pg.PoolClient, userId: string, familyId: string) {
  const token = randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, familyId, hash(token), new Date(Date.now() + REFRESH_TOKEN_TTL_MS)],
  );
  return token;
}

/** Starts a new token family (one per sign-in / device). */
export function issueRefreshToken(db: pg.Pool, userId: string): Promise<string> {
  return insertToken(db, userId, randomUUID());
}

/**
 * Exchanges a refresh token for a new one in the same family.
 * If a token that was revoked outside the grace window is presented again, the whole family is revoked.
 */
export async function rotateRefreshToken(
  db: pg.Pool,
  token: string,
): Promise<{ userId: string; token: string }> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{
      id: string;
      user_id: string;
      family_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, family_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hash(token)],
    );
    const row = rows[0];
    if (!row) throw new HttpError(401, 'invalid_refresh_token');

    if (row.revoked_at) {
      // Grace only applies while the family is still alive (not logged out or already revoked).
      const alive = await client.query(
        'SELECT 1 FROM refresh_tokens WHERE family_id = $1 AND revoked_at IS NULL',
        [row.family_id],
      );
      if (alive.rowCount === 0) throw new HttpError(401, 'invalid_refresh_token');
      if (Date.now() - row.revoked_at.getTime() > REUSE_GRACE_MS) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW()
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [row.family_id],
        );
        await client.query('COMMIT');
        throw new HttpError(401, 'refresh_token_reused');
      }
    } else {
      if (row.expires_at.getTime() < Date.now()) throw new HttpError(401, 'refresh_token_expired');
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);
    }

    const next = await insertToken(client, row.user_id, row.family_id);
    await client.query('COMMIT');
    return { userId: row.user_id, token: next };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Revokes every live token in the presented token's family (log out this device). */
export async function revokeRefreshFamily(db: pg.Pool, token: string): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE revoked_at IS NULL
       AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
    [hash(token)],
  );
}
