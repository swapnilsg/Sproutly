import { PACKS, PLANTS } from '@sproutly/catalogue';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL } from '../test/config.js';
import { createTestContext } from '../test/helpers.js';
import { syncCatalogue } from './sync.js';

const ctx = createTestContext();
afterAll(() => ctx.close());

describe('catalogue sync', () => {
  it('matches the bundled catalogue after migrations', async () => {
    const plants = await ctx.deps.db.query('SELECT id FROM plants ORDER BY id');
    expect(plants.rows.map((r) => r.id)).toEqual(PLANTS.map((p) => p.id).sort());

    const packPlants = await ctx.deps.db.query(
      "SELECT plant_id FROM pack_plants WHERE pack_id = 'herbs' ORDER BY position",
    );
    expect(packPlants.rows.map((r) => r.plant_id)).toEqual(
      PACKS.find((p) => p.id === 'herbs')!.plantIds,
    );
  });

  it('is idempotent and removes plants that left the catalogue', async () => {
    await ctx.deps.db.query(
      `INSERT INTO plants (id, name, emoji, light, water_every_days, difficulty, care, tip)
       VALUES ('retired', 'Retired', '🥀', 'shade', 7, 'beginner', '{}', 'Gone.')`,
    );
    await syncCatalogue(TEST_DATABASE_URL);
    await syncCatalogue(TEST_DATABASE_URL);

    const { rows } = await ctx.deps.db.query('SELECT count(*)::int AS n FROM plants');
    expect(rows[0].n).toBe(PLANTS.length);
    const packs = await ctx.deps.db.query('SELECT count(*)::int AS n FROM pack_plants');
    expect(packs.rows[0].n).toBe(PACKS.reduce((n, p) => n + p.plantIds.length, 0));
  });
});

describe('GET /api/v1/geo/guess', () => {
  it('returns the city and country from Cloudflare headers', async () => {
    const res = await request(ctx.app)
      .get('/api/v1/geo/guess')
      .set('cf-ipcity', 'Bengaluru')
      .set('cf-ipcountry', 'IN');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ city: 'Bengaluru', country_code: 'IN' });
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('returns no city without Cloudflare (local dev)', async () => {
    const res = await request(ctx.app).get('/api/v1/geo/guess');
    expect(res.body).toEqual({ city: null });
  });

  it('ignores unknown or junk country codes', async () => {
    const res = await request(ctx.app)
      .get('/api/v1/geo/guess')
      .set('cf-ipcity', 'Somewhere')
      .set('cf-ipcountry', 'XX');
    expect(res.body).toEqual({ city: 'Somewhere', country_code: null });
  });
});
