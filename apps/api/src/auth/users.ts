import type pg from 'pg';

export interface SessionUser {
  id: string;
  onboarding_step: number;
  onboarding_done: boolean;
}

// Signing up completes onboarding step 1.
const NEW_USER_STEP = 1;

async function inTransaction<T>(db: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
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

async function upsertByEmail(c: pg.PoolClient, email: string, name?: string) {
  const inserted = await c.query<SessionUser>(
    `INSERT INTO users (email, name, onboarding_step) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, onboarding_step, onboarding_done`,
    [email, name ?? null, NEW_USER_STEP],
  );
  if (inserted.rows[0]) return { user: inserted.rows[0], isNew: true };

  const existing = await c.query<SessionUser>(
    `UPDATE users SET name = COALESCE(name, $2), updated_at = NOW() WHERE email = $1
     RETURNING id, onboarding_step, onboarding_done`,
    [email, name ?? null],
  );
  return { user: existing.rows[0]!, isNew: false };
}

async function linkIdentity(c: pg.PoolClient, userId: string, provider: string, subject: string) {
  await c.query(
    `INSERT INTO auth_identities (user_id, provider, provider_subject) VALUES ($1, $2, $3)
     ON CONFLICT (provider, provider_subject) DO NOTHING`,
    [userId, provider, subject],
  );
}

/** Email-code sign-in: the email has just been verified. */
export function signInWithEmail(db: pg.Pool, email: string) {
  return inTransaction(db, async (c) => {
    const result = await upsertByEmail(c, email);
    await linkIdentity(c, result.user.id, 'email', email);
    return result;
  });
}

/** Google sign-in: match on Google subject first, then link by verified email. */
export function signInWithGoogle(
  db: pg.Pool,
  profile: { sub: string; email: string; name?: string },
) {
  return inTransaction(db, async (c) => {
    const linked = await c.query<SessionUser>(
      `SELECT u.id, u.onboarding_step, u.onboarding_done
       FROM auth_identities i JOIN users u ON u.id = i.user_id
       WHERE i.provider = 'google' AND i.provider_subject = $1`,
      [profile.sub],
    );
    if (linked.rows[0]) return { user: linked.rows[0], isNew: false };

    const result = await upsertByEmail(c, profile.email, profile.name);
    await linkIdentity(c, result.user.id, 'google', profile.sub);
    return result;
  });
}

export async function getSessionUser(db: pg.Pool, userId: string): Promise<SessionUser | null> {
  const { rows } = await db.query<SessionUser>(
    'SELECT id, onboarding_step, onboarding_done FROM users WHERE id = $1',
    [userId],
  );
  return rows[0] ?? null;
}
