import type pg from 'pg';
import { z } from 'zod';
import { inTransaction } from '../db.js';
import { HttpError } from '../errors.js';
import { isTimeZone } from '../time.js';

const base64url = z
  .string()
  .regex(/^[A-Za-z0-9_-]+={0,2}$/)
  .max(200);

/** Step 7: when to remind, and what the browser said about notifications. */
export const remindersBody = z
  .object({
    reminder_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, 'Pick a time on the quarter hour'),
    timezone: z
      .string()
      .max(64)
      .transform((tz) => (isTimeZone(tz) ? tz : 'UTC')),
    permission: z.enum(['granted', 'denied', 'later', 'unsupported']),
    subscription: z
      .object({
        endpoint: z
          .url()
          .max(2048)
          .refine((u) => u.startsWith('https://'), 'Push endpoints must use https'),
        keys: z.object({ p256dh: base64url, auth: base64url }),
      })
      .nullish(),
  })
  .refine((b) => b.permission !== 'granted' || Boolean(b.subscription), {
    message: 'A subscription is required when notifications are allowed',
    path: ['subscription'],
  });

export type RemindersBody = z.infer<typeof remindersBody>;

/** Saves step 7 and marks it complete. Requires a saved garden (step 6). */
export function saveReminders(
  db: pg.Pool,
  userId: string,
  body: RemindersBody,
  userAgent: string | undefined,
) {
  return inTransaction(db, async (c) => {
    const user = await c.query<{ has_garden: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM gardens WHERE user_id = u.id) AS has_garden
       FROM users u WHERE u.id = $1 FOR UPDATE`,
      [userId],
    );
    if (!user.rows[0]) throw new HttpError(404, 'user_not_found');
    if (!user.rows[0].has_garden) throw new HttpError(409, 'garden_required');

    const updated = await c.query<{ onboarding_step: number }>(
      `UPDATE users SET
         reminder_time = $2, timezone = $3,
         -- Only a real answer changes the stored permission. "later" and "no push in this
         -- browser" never undo one, and a "denied" here doesn't undo an "allowed" elsewhere
         -- while that browser is still subscribed.
         notif_permission = CASE
           WHEN $4 = 'granted' THEN 'granted'
           WHEN $4 = 'denied' AND NOT EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = $1)
             THEN 'denied'
           WHEN $4 = 'unsupported' AND notif_permission = 'not_asked' THEN 'unsupported'
           ELSE notif_permission
         END,
         notif_prompted_at = CASE WHEN $5 THEN NOW() ELSE notif_prompted_at END,
         onboarding_step = GREATEST(onboarding_step, 7), updated_at = NOW()
       WHERE id = $1
       RETURNING onboarding_step`,
      [
        userId,
        body.reminder_time,
        body.timezone,
        body.permission,
        body.permission !== 'unsupported',
      ],
    );

    if (body.permission === 'granted' && body.subscription) {
      await c.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET
           user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
        [
          userId,
          body.subscription.endpoint,
          body.subscription.keys.p256dh,
          body.subscription.keys.auth,
          userAgent?.slice(0, 300) ?? null,
        ],
      );
    }

    return { onboarding_step: updated.rows[0]!.onboarding_step };
  });
}
