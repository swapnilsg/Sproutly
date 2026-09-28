import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestContext } from './test/helpers.js';

const ctx = createTestContext();
afterAll(() => ctx.close());

describe('app', () => {
  it('GET /api/v1/health returns ok', async () => {
    const res = await request(ctx.app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(ctx.app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/email/start')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_json' });
  });
});
