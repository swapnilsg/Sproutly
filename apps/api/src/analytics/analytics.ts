import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../auth/middleware.js';
import type { Deps } from '../deps.js';
import { enforceRateLimit } from '../rateLimit.js';
import { parseBody } from '../validate.js';

export const ANALYTICS_QUEUE = 'analytics:queue';
const FLUSH_BATCH = 500;

export const EVENT_NAMES = [
  'onboarding_started',
  'onboarding_step_completed',
  'onboarding_skipped',
  'starter_pack_selected',
  'notification_permission_granted',
  'notification_permission_denied',
  'onboarding_completed',
  'first_task_completed',
] as const;

const eventBody = z.object({
  event_name: z.enum(EVENT_NAMES),
  session_id: z.uuid(),
  properties: z.record(z.string(), z.unknown()).default({}),
});

interface QueuedEvent {
  user_id: string | null;
  session_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  occurred_at: string;
}

export function analyticsRoutes(deps: Deps): Router {
  const router = Router();
  const perIp = { name: 'analytics-ip', limit: 600, windowMs: 60 * 60 * 1000 };

  // Fire-and-forget from the client: queue in Redis, flush to Postgres in batches.
  router.post('/events', optionalAuth(deps.env.JWT_SECRET), async (req, res) => {
    await enforceRateLimit(deps.redis, perIp, req.ip ?? 'unknown');
    const body = parseBody(eventBody, req);
    const event: QueuedEvent = {
      user_id: res.locals.userId ?? null,
      session_id: body.session_id,
      event_name: body.event_name,
      properties: body.properties,
      occurred_at: new Date().toISOString(),
    };
    await deps.redis.rpush(ANALYTICS_QUEUE, JSON.stringify(event));
    res.status(202).json({ received: true });
  });

  return router;
}

/** Moves up to one batch of queued events into onboarding_events. Returns how many were written. */
export async function flushAnalytics(deps: Pick<Deps, 'db' | 'redis'>): Promise<number> {
  const items = await deps.redis.lpop(ANALYTICS_QUEUE, FLUSH_BATCH);
  if (!items?.length) return 0;
  try {
    await deps.db.query(
      `INSERT INTO onboarding_events (user_id, session_id, event_name, properties, occurred_at)
       SELECT e.user_id, e.session_id, e.event_name, e.properties, e.occurred_at
       FROM jsonb_to_recordset($1::jsonb)
         AS e(user_id uuid, session_id text, event_name text, properties jsonb, occurred_at timestamptz)`,
      [`[${items.join(',')}]`],
    );
  } catch (err) {
    // Put the batch back so it is retried on the next tick.
    await deps.redis.lpush(ANALYTICS_QUEUE, ...items.reverse());
    throw err;
  }
  return items.length;
}

export function startAnalyticsFlusher(deps: Pick<Deps, 'db' | 'redis'>, intervalMs = 10_000) {
  const timer = setInterval(() => {
    flushAnalytics(deps).catch((err) => console.error('Analytics flush failed', err));
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
