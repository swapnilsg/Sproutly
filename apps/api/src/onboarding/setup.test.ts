import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext } from '../test/helpers.js';

const ctx = createTestContext();
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const answers = {
  space_types: ['balcony'],
  sunlight: 'some',
  pack_id: 'herbs',
  first_plant_nickname: 'Basil Brush',
  plants_owned: true,
  location: { raw: 'Bengaluru', city: 'Bengaluru', country_code: 'IN', source: 'ip' },
  timezone: 'Asia/Kolkata',
};

async function signedIn() {
  const { body } = await ctx.signIn('sam@example.com');
  return { token: body.token as string, userId: body.user_id as string };
}

function setup(token: string | null, body: object) {
  const req = request(ctx.app).post('/api/v1/onboarding/setup');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
}

describe('POST /onboarding/setup', () => {
  it('new accounts start at onboarding step 0 (no garden yet)', async () => {
    const { body } = await ctx.signIn('sam@example.com');
    expect(body.onboarding_step).toBe(0);
  });

  it('creates the garden from a pack, with the nickname and the first task', async () => {
    const { token, userId } = await signedIn();
    const res = await setup(token, answers);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      onboarding_step: 6,
      plants: [
        { plant_id: 'basil', name: 'Basil', nickname: 'Basil Brush', owned: true },
        { plant_id: 'mint', nickname: null },
        { plant_id: 'chives', nickname: null },
      ],
      first_task: { type: 'check_soil', plant_id: 'basil' },
    });
    expect(res.body.first_task.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const user = await ctx.deps.db.query(
      `SELECT space_types, sunlight, timezone, city, country_code, location_source, onboarding_step
       FROM users WHERE id = $1`,
      [userId],
    );
    expect(user.rows[0]).toEqual({
      space_types: ['balcony'],
      sunlight: 'some',
      timezone: 'Asia/Kolkata',
      city: 'Bengaluru',
      country_code: 'IN',
      location_source: 'ip',
      onboarding_step: 6,
    });
  });

  it('owned plants: check soil on the first, water the rest, all due today', async () => {
    const { token } = await signedIn();
    await setup(token, answers).expect(201);
    const { rows } = await ctx.deps.db.query(
      `SELECT gp.plant_id, t.type, t.is_first_task, t.due_date
       FROM tasks t JOIN garden_plants gp ON gp.id = t.garden_plant_id
       ORDER BY gp.position`,
    );
    const today = (await ctx.deps.db.query("SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date AS d"))
      .rows[0].d;
    expect(rows).toEqual([
      { plant_id: 'basil', type: 'check_soil', is_first_task: true, due_date: today },
      { plant_id: 'mint', type: 'water', is_first_task: false, due_date: today },
      { plant_id: 'chives', type: 'water', is_first_task: false, due_date: today },
    ]);
  });

  it('plants not owned yet: a "buy" task for each, the first one marked', async () => {
    const { token } = await signedIn();
    const res = await setup(token, { ...answers, plants_owned: false }).expect(201);
    expect(res.body.first_task.type).toBe('buy');
    const { rows } = await ctx.deps.db.query(
      'SELECT type, is_first_task FROM tasks ORDER BY is_first_task DESC',
    );
    expect(rows.map((r) => r.type)).toEqual(['buy', 'buy', 'buy']);
    expect(rows.filter((r) => r.is_first_task)).toHaveLength(1);
  });

  it('accepts hand-picked plants instead of a pack, in the order picked', async () => {
    const { token } = await signedIn();
    const res = await setup(token, {
      ...answers,
      pack_id: null,
      custom_plant_ids: ['pothos', 'aloe-vera'],
      first_plant_nickname: null,
      location: null,
    }).expect(201);
    expect(res.body.plants.map((p: { plant_id: string }) => p.plant_id)).toEqual([
      'pothos',
      'aloe-vera',
    ]);
  });

  it('returns 409 if the user already has a garden, and changes nothing', async () => {
    const { token } = await signedIn();
    await setup(token, answers).expect(201);
    const again = await setup(token, { ...answers, pack_id: 'flowers', sunlight: 'bright' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('garden_exists');

    const { rows } = await ctx.deps.db.query(
      'SELECT (SELECT sunlight FROM users) AS sunlight, (SELECT count(*)::int FROM garden_plants) AS plants',
    );
    expect(rows[0]).toEqual({ sunlight: 'some', plants: 3 });
  });

  it.each([
    ['an unknown plant', { pack_id: null, custom_plant_ids: ['triffid'] }],
    ['both a pack and plants', { custom_plant_ids: ['pothos'] }],
    ['neither a pack nor plants', { pack_id: null }],
    [
      'more than 5 plants',
      {
        pack_id: null,
        custom_plant_ids: ['pothos', 'mint', 'basil', 'chives', 'parsley', 'aloe-vera'],
      },
    ],
    ['the same plant twice', { pack_id: null, custom_plant_ids: ['mint', 'mint'] }],
    ['an unknown timezone', { timezone: 'Mars/Olympus_Mons' }],
    ['a nickname over 32 characters', { first_plant_nickname: 'x'.repeat(33) }],
    ['an unsupported space', { space_types: ['garden_bed'] }],
  ])('rejects %s with 422', async (_label, change) => {
    const { token } = await signedIn();
    const res = await setup(token, { ...answers, ...change });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
    const { rows } = await ctx.deps.db.query('SELECT count(*)::int AS n FROM gardens');
    expect(rows[0].n).toBe(0);
  });

  it('requires a signed-in user', async () => {
    const res = await setup(null, answers);
    expect(res.status).toBe(401);
  });
});
