import { getPack, getPlant, MAX_CUSTOM_PLANTS } from '@sproutly/catalogue';
import type pg from 'pg';
import { z } from 'zod';
import { inTransaction } from '../db.js';
import { HttpError } from '../errors.js';
import { isTimeZone, todayIn } from '../time.js';

/** The answers from onboarding steps 2–5, sent once after sign-in. */
export const setupBody = z
  .object({
    space_types: z
      .array(z.enum(['balcony', 'indoors', 'unknown']))
      .min(1)
      .max(3),
    sunlight: z.enum(['bright', 'some', 'shade', 'unknown']),
    pack_id: z
      .string()
      .refine((id) => Boolean(getPack(id)), 'Unknown starter pack')
      .nullish(),
    custom_plant_ids: z
      .array(z.string().refine((id) => Boolean(getPlant(id)), 'Unknown plant'))
      .max(MAX_CUSTOM_PLANTS, `Choose up to ${MAX_CUSTOM_PLANTS} plants`)
      .refine((ids) => new Set(ids).size === ids.length, 'Each plant only once')
      .nullish(),
    first_plant_nickname: z.string().trim().max(32).nullish(),
    plants_owned: z.boolean(),
    location: z
      .object({
        raw: z.string().trim().min(1).max(80),
        city: z.string().trim().max(80).nullable(),
        country_code: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .nullable(),
        source: z.enum(['ip', 'user']),
      })
      .nullish(),
    // An unusable timezone must never block onboarding: fall back to UTC.
    timezone: z
      .string()
      .max(64)
      .transform((tz) => (isTimeZone(tz) ? tz : 'UTC')),
  })
  .refine((b) => Boolean(b.pack_id) !== Boolean(b.custom_plant_ids?.length), {
    message: 'Choose a starter pack or 1–5 plants',
    path: ['pack_id'],
  });

export type SetupBody = z.infer<typeof setupBody>;

type TaskType = 'water' | 'check_soil' | 'buy';

/**
 * Saves the onboarding answers and creates the garden, its plants and the first tasks in one
 * transaction. Throws 409 `garden_exists` if the user already has a garden (v1: one per user).
 */
export function setupGarden(db: pg.Pool, userId: string, body: SetupBody) {
  const plantIds = body.pack_id ? getPack(body.pack_id)!.plantIds : body.custom_plant_ids!;
  const nickname = body.first_plant_nickname?.trim() || null;

  return inTransaction(db, async (c) => {
    // Lock the user row: a deleted account gets a clean 404, and concurrent setups queue up.
    const user = await c.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (user.rowCount === 0) throw new HttpError(404, 'user_not_found');

    const garden = await c.query<{ id: string }>(
      `INSERT INTO gardens (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING RETURNING id`,
      [userId],
    );
    if (!garden.rows[0]) throw new HttpError(409, 'garden_exists');
    const gardenId = garden.rows[0].id;

    const updated = await c.query<{ onboarding_step: number }>(
      `UPDATE users SET
         space_types = $2, sunlight = $3, timezone = $4,
         location_raw = $5, city = $6, country_code = $7, location_source = $8,
         onboarding_step = GREATEST(onboarding_step, 6), updated_at = NOW()
       WHERE id = $1
       RETURNING onboarding_step`,
      [
        userId,
        body.space_types,
        body.sunlight,
        body.timezone,
        body.location?.raw ?? null,
        body.location?.city ?? null,
        body.location?.country_code ?? null,
        body.location?.source ?? null,
      ],
    );

    const plants = await c.query<{ id: string; plant_id: string; position: number }>(
      `INSERT INTO garden_plants (garden_id, plant_id, nickname, owned, position)
       SELECT $1, plant_id, CASE WHEN position = 0 THEN $3 END, $4, position
       FROM unnest($2::text[]) WITH ORDINALITY AS p(plant_id, ord),
            LATERAL (SELECT (ord - 1)::int AS position) pos
       RETURNING id, plant_id, position`,
      [gardenId, plantIds, nickname, body.plants_owned],
    );
    const ordered = [...plants.rows].sort((a, b) => a.position - b.position);

    // Today in the user's timezone, so "today" tasks are due on their today.
    const today = todayIn(body.timezone);
    // Owned: check the first plant's soil now (the first win), water the rest today.
    // Not owned yet: pick each plant up first; watering starts once it's home.
    const tasks = ordered.map((gp, i) => ({
      garden_plant_id: gp.id,
      type: (body.plants_owned ? (i === 0 ? 'check_soil' : 'water') : 'buy') as TaskType,
      is_first_task: i === 0,
    }));
    const inserted = await c.query<{
      id: string;
      garden_plant_id: string;
      type: TaskType;
      due_date: string;
      is_first_task: boolean;
    }>(
      `INSERT INTO tasks (garden_plant_id, type, due_date, is_first_task)
       SELECT t.garden_plant_id, t.type, $2::date, t.is_first_task
       FROM jsonb_to_recordset($1::jsonb) AS t(garden_plant_id uuid, type text, is_first_task boolean)
       RETURNING id, garden_plant_id, type, due_date, is_first_task`,
      [JSON.stringify(tasks), today],
    );
    const first = inserted.rows.find((t) => t.is_first_task)!;

    return {
      garden_id: gardenId,
      onboarding_step: updated.rows[0]!.onboarding_step,
      plants: ordered.map((gp) => {
        const plant = getPlant(gp.plant_id)!;
        return {
          id: gp.id,
          plant_id: gp.plant_id,
          name: plant.name,
          emoji: plant.emoji,
          nickname: gp.position === 0 ? nickname : null,
          owned: body.plants_owned,
        };
      }),
      first_task: {
        id: first.id,
        type: first.type,
        due_date: first.due_date,
        plant_id: ordered[0]!.plant_id,
      },
    };
  });
}
