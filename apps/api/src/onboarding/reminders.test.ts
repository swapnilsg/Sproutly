import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { generateVapidKeys } from '../scripts/vapidKeys.js';
import { createTestContext } from '../test/helpers.js';

const ctx = createTestContext();
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const garden = {
  space_types: ['balcony'],
  sunlight: 'some',
  pack_id: 'herbs',
  plants_owned: true,
  timezone: 'Asia/Kolkata',
};
const subscription = {
  endpoint: 'https://push.example.com/send/abc123',
  keys: { p256dh: 'BOr1gK8x_3vQ', auth: 'tBHItJI5svbpez7KI4CCXg' },
};

/** A signed-in user who has already saved their garden (step 6). */
async function withGarden() {
  const { body } = await ctx.signIn('sam@example.com');
  await request(ctx.app)
    .post('/api/v1/onboarding/setup')
    .set('Authorization', `Bearer ${body.token}`)
    .send(garden)
    .expect(201);
  return body.token as string;
}

function reminders(token: string | null, body: object) {
  const req = request(ctx.app).post('/api/v1/onboarding/reminders');
  if (token) req.set('Authorization', `Bearer ${token}`).set('User-Agent', 'TestBrowser/1.0');
  return req.send(body);
}

const userRow = async () =>
  (
    await ctx.deps.db.query(
      `SELECT to_char(reminder_time, 'HH24:MI') AS reminder_time, timezone, notif_permission,
              notif_prompted_at IS NOT NULL AS prompted, onboarding_step
       FROM users`,
    )
  ).rows[0];

describe('POST /onboarding/reminders', () => {
  it('stores the time, the permission and the push subscription, and completes step 7', async () => {
    const token = await withGarden();
    const res = await reminders(token, {
      reminder_time: '07:30',
      timezone: 'Asia/Kolkata',
      permission: 'granted',
      subscription,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ onboarding_step: 7 });
    expect(await userRow()).toEqual({
      reminder_time: '07:30',
      timezone: 'Asia/Kolkata',
      notif_permission: 'granted',
      prompted: true,
      onboarding_step: 7,
    });
    const subs = await ctx.deps.db.query(
      'SELECT endpoint, p256dh, auth, user_agent FROM push_subscriptions',
    );
    expect(subs.rows).toEqual([
      { ...subscription.keys, endpoint: subscription.endpoint, user_agent: 'TestBrowser/1.0' },
    ]);
  });

  it('re-subscribing the same browser updates its row instead of adding one', async () => {
    const token = await withGarden();
    const body = { reminder_time: '08:00', timezone: 'UTC', permission: 'granted', subscription };
    await reminders(token, body).expect(200);
    await reminders(token, {
      ...body,
      subscription: { ...subscription, keys: { ...subscription.keys, auth: 'bmV3LWF1dGg' } },
    }).expect(200);
    const { rows } = await ctx.deps.db.query('SELECT auth FROM push_subscriptions');
    expect(rows).toEqual([{ auth: 'bmV3LWF1dGg' }]);
  });

  it.each([
    ['denied', 'denied', true],
    ['later', 'not_asked', true],
    ['unsupported', 'unsupported', false],
  ])('records "%s" as %s without a subscription', async (permission, stored, prompted) => {
    const token = await withGarden();
    await reminders(token, { reminder_time: '08:00', timezone: 'UTC', permission }).expect(200);
    expect(await userRow()).toMatchObject({
      notif_permission: stored,
      prompted,
      onboarding_step: 7,
    });
    const { rows } = await ctx.deps.db.query('SELECT count(*)::int AS n FROM push_subscriptions');
    expect(rows[0].n).toBe(0);
  });

  it.each([
    ['a time that is not on the quarter hour', { reminder_time: '08:07' }],
    ['a malformed time', { reminder_time: '8am' }],
    ['"granted" without a subscription', { permission: 'granted', subscription: null }],
    [
      'a non-https endpoint',
      { permission: 'granted', subscription: { ...subscription, endpoint: 'http://x.test/1' } },
    ],
    ['an unknown permission', { permission: 'maybe' }],
  ])('rejects %s with 422', async (_label, change) => {
    const token = await withGarden();
    const res = await reminders(token, {
      reminder_time: '08:00',
      timezone: 'UTC',
      permission: 'later',
      ...change,
    });
    expect(res.status).toBe(422);
    expect((await userRow()).onboarding_step).toBe(6);
  });

  it('falls back to UTC for an unusable timezone', async () => {
    const token = await withGarden();
    await reminders(token, {
      reminder_time: '08:00',
      timezone: 'Etc/Unknown',
      permission: 'later',
    }).expect(200);
    expect((await userRow()).timezone).toBe('UTC');
  });

  it('needs a saved garden first', async () => {
    const { body } = await ctx.signIn('sam@example.com');
    const res = await reminders(body.token, {
      reminder_time: '08:00',
      timezone: 'UTC',
      permission: 'later',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('garden_required');
  });

  it('requires a signed-in user', async () => {
    const res = await reminders(null, {
      reminder_time: '08:00',
      timezone: 'UTC',
      permission: 'later',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/me/onboarding-state', () => {
  it('names the garden’s first plant once the garden is saved', async () => {
    const token = await withGarden();
    const res = await request(ctx.app)
      .get('/api/v1/users/me/onboarding-state')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.first_plant_name).toBe('Basil');
  });
});

describe('GET /notifications/config', () => {
  it('has no public key while push is not configured', async () => {
    const res = await request(ctx.app).get('/api/v1/notifications/config');
    expect(res.body).toEqual({ vapid_public_key: null });
  });

  it('shares the public key once both VAPID keys are set', async () => {
    const keys = generateVapidKeys();
    const app = createApp({
      ...ctx.deps,
      env: {
        ...ctx.deps.env,
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
      },
    });
    const res = await request(app).get('/api/v1/notifications/config');
    expect(res.body).toEqual({ vapid_public_key: keys.publicKey });
  });
});

describe('generateVapidKeys', () => {
  it('makes an uncompressed P-256 public key and a 32-byte private key', () => {
    const { publicKey, privateKey } = generateVapidKeys();
    const point = Buffer.from(publicKey, 'base64url');
    expect(point).toHaveLength(65);
    expect(point[0]).toBe(0x04);
    expect(Buffer.from(privateKey, 'base64url')).toHaveLength(32);
  });
});
