-- Up Migration

-- Rows are synced from @sproutly/catalogue by `pnpm migrate` (src/catalogue/sync.ts).
CREATE TABLE plants (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  emoji            TEXT NOT NULL,
  light            TEXT NOT NULL CHECK (light IN ('shade', 'partial', 'full_sun')),
  water_every_days INT  NOT NULL CHECK (water_every_days > 0),
  difficulty       TEXT NOT NULL,
  care             JSONB NOT NULL,
  tip              TEXT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE packs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  description TEXT NOT NULL,
  min_light   TEXT NOT NULL CHECK (min_light IN ('shade', 'partial', 'full_sun')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pack_plants (
  pack_id  TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  position INT  NOT NULL,
  PRIMARY KEY (pack_id, plant_id)
);

-- Down Migration

DROP TABLE pack_plants;
DROP TABLE packs;
DROP TABLE plants;
