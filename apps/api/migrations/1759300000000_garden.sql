-- Up Migration

ALTER TABLE users
  ADD COLUMN sunlight TEXT CHECK (sunlight IN ('bright', 'some', 'shade', 'unknown')),
  ADD COLUMN timezone TEXT,
  ADD COLUMN location_source TEXT CHECK (location_source IN ('ip', 'user')),
  ADD COLUMN reminder_time TIME NOT NULL DEFAULT '08:00',
  ADD CONSTRAINT users_space_types_check
    CHECK (space_types <@ ARRAY['balcony', 'indoors', 'unknown']::text[]);

-- One garden per user in v1.
CREATE TABLE gardens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'My Garden',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE garden_plants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id  UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  plant_id   TEXT NOT NULL REFERENCES plants(id),
  nickname   TEXT CHECK (char_length(nickname) <= 32),
  owned      BOOLEAN NOT NULL,
  position   INT NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (garden_id, position)
);

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_plant_id UUID NOT NULL REFERENCES garden_plants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('water', 'check_soil', 'buy')),
  due_date        DATE NOT NULL,
  is_first_task   BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tasks_plant_due_idx ON tasks (garden_plant_id, due_date);

-- Down Migration

DROP TABLE tasks;
DROP TABLE garden_plants;
DROP TABLE gardens;
ALTER TABLE users
  DROP CONSTRAINT users_space_types_check,
  DROP COLUMN reminder_time,
  DROP COLUMN location_source,
  DROP COLUMN timezone,
  DROP COLUMN sunlight;
