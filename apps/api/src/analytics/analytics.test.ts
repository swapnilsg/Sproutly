import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext } from '../test/helpers.js';
import { flushAnalytics } from './analytics.js';

const ctx = createTestContext();
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

const sessionId = randomUUID();

describe('POST /analytics/events', () => {
  it('queues anonymous events and flushes them to Postgres', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/analytics/events')
      .send({ event_name: 'onboarding_started', session_id: sessionId });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ received: true });

    expect(await flushAnalytics(ctx.deps)).toBe(1);
    const { rows } = await ctx.deps.db.query('SELECT * FROM onboarding_events');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: null,
      session_id: sessionId,
      event_name: 'onboarding_started',
      properties: {},
    });
  });

  it('attaches the user id when a valid token is sent', async () => {
    const { body } = await ctx.signIn('sam@example.com');
    await request(ctx.app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${body.token}`)
      .send({
        event_name: 'onboarding_step_completed',
        session_id: sessionId,
        properties: { step: 1, method: 'email', time_on_step: 4200 },
      })
      .expect(202);

    await flushAnalytics(ctx.deps);
    const { rows } = await ctx.deps.db.query('SELECT user_id, properties FROM onboarding_events');
    expect(rows[0]).toEqual({
      user_id: body.user_id,
      properties: { step: 1, method: 'email', time_on_step: 4200 },
    });
  });

  it('still accepts the event with an invalid token, without a user id', async () => {
    await request(ctx.app)
      .post('/api/v1/analytics/events')
      .set('Authorization', 'Bearer garbage')
      .send({ event_name: 'onboarding_started', session_id: sessionId })
      .expect(202);
    await flushAnalytics(ctx.deps);
    const { rows } = await ctx.deps.db.query('SELECT user_id FROM onboarding_events');
    expect(rows[0].user_id).toBeNull();
  });

  it('rejects unknown event names', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/analytics/events')
      .send({ event_name: 'made_up', session_id: sessionId });
    expect(res.status).toBe(422);
  });

  it('flush is a no-op when the queue is empty', async () => {
    expect(await flushAnalytics(ctx.deps)).toBe(0);
  });
});
