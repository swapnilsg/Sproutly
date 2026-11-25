import { PACKS, PLANTS } from '@sproutly/catalogue';
import pg from 'pg';

/**
 * Upserts the bundled catalogue into Postgres so the database always matches what the web app shows.
 * Idempotent; plants and packs removed from the package are removed here too.
 */
export async function syncCatalogue(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO plants (id, name, emoji, light, water_every_days, difficulty, care, tip)
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS p(
         id text, name text, emoji text, light text, water_every_days int,
         difficulty text, care jsonb, tip text)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, emoji = EXCLUDED.emoji, light = EXCLUDED.light,
         water_every_days = EXCLUDED.water_every_days, difficulty = EXCLUDED.difficulty,
         care = EXCLUDED.care, tip = EXCLUDED.tip, updated_at = NOW()`,
      [
        JSON.stringify(
          PLANTS.map((p) => ({
            id: p.id,
            name: p.name,
            emoji: p.emoji,
            light: p.light,
            water_every_days: p.waterEveryDays,
            difficulty: p.difficulty,
            care: p.care,
            tip: p.tip,
          })),
        ),
      ],
    );
    await client.query(
      `INSERT INTO packs (id, name, emoji, description, min_light)
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS p(
         id text, name text, emoji text, description text, min_light text)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, emoji = EXCLUDED.emoji, description = EXCLUDED.description,
         min_light = EXCLUDED.min_light, updated_at = NOW()`,
      [
        JSON.stringify(
          PACKS.map((p) => ({
            id: p.id,
            name: p.name,
            emoji: p.emoji,
            description: p.description,
            min_light: p.minLight,
          })),
        ),
      ],
    );
    await client.query('DELETE FROM pack_plants');
    await client.query(
      `INSERT INTO pack_plants (pack_id, plant_id, position)
       SELECT * FROM jsonb_to_recordset($1::jsonb) AS pp(pack_id text, plant_id text, position int)`,
      [
        JSON.stringify(
          PACKS.flatMap((pack) =>
            pack.plantIds.map((plantId, position) => ({
              pack_id: pack.id,
              plant_id: plantId,
              position,
            })),
          ),
        ),
      ],
    );
    await client.query('DELETE FROM packs WHERE NOT (id = ANY($1::text[]))', [
      PACKS.map((p) => p.id),
    ]);
    await client.query('DELETE FROM plants WHERE NOT (id = ANY($1::text[]))', [
      PLANTS.map((p) => p.id),
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}
