import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HttpError } from '../errors.js';
import { createTestContext, refreshCookie } from '../test/helpers.js';

const ctx = createTestContext();
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const api = () => request(ctx.app);

describe('POST /auth/email/start', () => {
  it('emails a 6-digit code and returns 202', async () => {
    const res = await api().post('/api/v1/auth/email/start').send({ email: ' Sam@Example.com ' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ sent: true });
    expect(ctx.email.lastCode('sam@example.com')).toMatch(/^\d{6}$/);
  });

  it('rejects an invalid email with a field error', async () => {
    const res = await api().post('/api/v1/auth/email/start').send({ email: 'nope' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.fields.email).toBe('Enter a valid email address');
  });

  it('rate-limits to 3 codes per email per 15 minutes', async () => {
    for (let i = 0; i < 3; i++) {
      await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' }).expect(202);
    }
    const res = await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
    expect(res.body.retry_after).toBeGreaterThan(0);
  });

  it('rate-limits to 10 requests per IP per hour', async () => {
    for (let i = 0; i < 10; i++) {
      await api()
        .post('/api/v1/auth/email/start')
        .send({ email: `u${i}@example.com` })
        .expect(202);
    }
    const res = await api().post('/api/v1/auth/email/start').send({ email: 'u10@example.com' });
    expect(res.status).toBe(429);
  });
});

describe('POST /auth/email/verify', () => {
  it('creates a new user on first sign-in and sets a refresh cookie', async () => {
    const res = await ctx.signIn('sam@example.com');
    expect(res.body).toMatchObject({
      is_new_user: true,
      onboarding_step: 1,
      onboarding_done: false,
    });
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user_id).toEqual(expect.any(String));

    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('signs an existing user back in', async () => {
    const first = await ctx.signIn('sam@example.com');
    const second = await ctx.signIn('sam@example.com');
    expect(second.body.is_new_user).toBe(false);
    expect(second.body.user_id).toBe(first.body.user_id);
  });

  it('rejects a wrong code and reports attempts left', async () => {
    await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' });
    const wrong = ctx.email.lastCode('sam@example.com') === '000000' ? '111111' : '000000';
    const res = await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code: wrong });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_code', attempts_left: 4 });
  });

  it('burns the code after 5 wrong attempts', async () => {
    await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' });
    const code = ctx.email.lastCode('sam@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      await api()
        .post('/api/v1/auth/email/verify')
        .send({ email: 'sam@example.com', code: wrong })
        .expect(400);
    }
    const fifth = await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code: wrong });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error).toBe('too_many_attempts');

    // Even the right code no longer works.
    const right = await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code });
    expect(right.status).toBe(400);
    expect(right.body.error).toBe('code_expired');
  });

  it('returns code_expired when no code is pending', async () => {
    const res = await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('code_expired');
  });

  it('only accepts the most recent code', async () => {
    await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' });
    const old = ctx.email.lastCode('sam@example.com');
    await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' });
    const latest = ctx.email.lastCode('sam@example.com');
    if (old !== latest) {
      await api()
        .post('/api/v1/auth/email/verify')
        .send({ email: 'sam@example.com', code: old })
        .expect(400);
    }
    await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code: latest })
      .expect(200);
  });

  it('consumes the code on success', async () => {
    await api().post('/api/v1/auth/email/start').send({ email: 'sam@example.com' });
    const code = ctx.email.lastCode('sam@example.com');
    await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code })
      .expect(200);
    const again = await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code });
    expect(again.body.error).toBe('code_expired');
  });

  it('validates the code format', async () => {
    const res = await api()
      .post('/api/v1/auth/email/verify')
      .send({ email: 'sam@example.com', code: '12ab' });
    expect(res.status).toBe(422);
    expect(res.body.fields.code).toBe('Enter the 6-digit code');
  });
});

describe('POST /auth/google', () => {
  const profile = { sub: 'google-123', email: 'sam@example.com', name: 'Sam' };

  it('creates a user with the Google first name', async () => {
    ctx.verifyGoogle.mockResolvedValue(profile);
    const res = await api().post('/api/v1/auth/google').send({ credential: 'id-token' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ is_new_user: true, onboarding_step: 1 });
    expect(ctx.verifyGoogle).toHaveBeenCalledWith('id-token');

    const { rows } = await ctx.deps.db.query('SELECT name FROM users WHERE id = $1', [
      res.body.user_id,
    ]);
    expect(rows[0].name).toBe('Sam');
  });

  it('links to an existing email account', async () => {
    const emailUser = await ctx.signIn('sam@example.com');
    ctx.verifyGoogle.mockResolvedValue(profile);
    const res = await api().post('/api/v1/auth/google').send({ credential: 'id-token' });
    expect(res.body.is_new_user).toBe(false);
    expect(res.body.user_id).toBe(emailUser.body.user_id);

    const { rows } = await ctx.deps.db.query(
      'SELECT provider FROM auth_identities WHERE user_id = $1 ORDER BY provider',
      [emailUser.body.user_id],
    );
    expect(rows.map((r) => r.provider)).toEqual(['email', 'google']);
  });

  it('finds the user by Google subject even if their Google email changed', async () => {
    ctx.verifyGoogle.mockResolvedValue(profile);
    const first = await api().post('/api/v1/auth/google').send({ credential: 'a' });
    ctx.verifyGoogle.mockResolvedValue({ ...profile, email: 'new@example.com' });
    const second = await api().post('/api/v1/auth/google').send({ credential: 'b' });
    expect(second.body.user_id).toBe(first.body.user_id);
  });

  it('returns 401 for an invalid Google token', async () => {
    ctx.verifyGoogle.mockRejectedValue(new HttpError(401, 'invalid_google_token'));
    const res = await api().post('/api/v1/auth/google').send({ credential: 'bad' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_google_token');
  });

  it('returns 503 when Google is not configured', async () => {
    const verify = ctx.deps.verifyGoogle;
    ctx.deps.verifyGoogle = null;
    try {
      const res = await api().post('/api/v1/auth/google').send({ credential: 'x' });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('google_not_configured');
    } finally {
      ctx.deps.verifyGoogle = verify;
    }
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh cookie and returns a new access token', async () => {
    const signIn = await ctx.signIn('sam@example.com');
    const cookie = refreshCookie(signIn);

    const res = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user_id: signIn.body.user_id, onboarding_step: 1 });
    expect(res.body.token).toEqual(expect.any(String));
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it('returns 401 without a cookie', async () => {
    const res = await api().post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_refresh_token');
  });

  it('tolerates a concurrent reuse inside the grace window', async () => {
    const cookie = refreshCookie(await ctx.signIn('sam@example.com'));
    await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
  });

  it('revokes the whole family when an old token is reused after the grace window', async () => {
    const cookie = refreshCookie(await ctx.signIn('sam@example.com'));
    const rotated = await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    const current = refreshCookie(rotated);

    // Pretend the first token was rotated a minute ago.
    await ctx.deps.db.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '1 minute' WHERE revoked_at IS NOT NULL",
    );
    const reuse = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error).toBe('refresh_token_reused');

    // The legitimate latest token is now dead too.
    const after = await api().post('/api/v1/auth/refresh').set('Cookie', current);
    expect(after.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const cookie = refreshCookie(await ctx.signIn('sam@example.com'));
    await ctx.deps.db.query("UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 second'");
    const res = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('refresh_token_expired');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token, including recently rotated ones', async () => {
    const cookie = refreshCookie(await ctx.signIn('sam@example.com'));
    const rotated = refreshCookie(
      await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200),
    );
    await api().post('/api/v1/auth/logout').set('Cookie', rotated).expect(204);

    await api().post('/api/v1/auth/refresh').set('Cookie', rotated).expect(401);
    // The grace window must not revive a logged-out session.
    await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('succeeds without a cookie', async () => {
    await api().post('/api/v1/auth/logout').expect(204);
  });
});

describe('GET /users/me/onboarding-state', () => {
  it('returns the signed-in user state', async () => {
    const { body } = await ctx.signIn('sam@example.com');
    const res = await api()
      .get('/api/v1/users/me/onboarding-state')
      .set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'sam@example.com',
      onboarding_step: 1,
      onboarding_done: false,
      experience_level: 'beginner',
      space_types: [],
    });
  });

  it('distinguishes missing and invalid tokens', async () => {
    const missing = await api().get('/api/v1/users/me/onboarding-state');
    expect(missing.body.error).toBe('missing_token');
    const invalid = await api()
      .get('/api/v1/users/me/onboarding-state')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(invalid.status).toBe(401);
    expect(invalid.body.error).toBe('invalid_token');
  });
});
