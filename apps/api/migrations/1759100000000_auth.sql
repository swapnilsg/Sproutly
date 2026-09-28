-- Up Migration

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
  name             TEXT,
  location_raw     TEXT,
  city             TEXT,
  country_code     CHAR(2),
  latitude         NUMERIC(9,6),
  longitude        NUMERIC(9,6),
  hardiness_zone   TEXT,
  space_types      TEXT[] NOT NULL DEFAULT '{}',
  experience_level TEXT NOT NULL DEFAULT 'beginner',
  onboarding_step  INT NOT NULL DEFAULT 0 CHECK (onboarding_step BETWEEN 0 AND 7),
  onboarding_done  BOOLEAN NOT NULL DEFAULT FALSE,
  notif_permission TEXT NOT NULL DEFAULT 'not_asked'
                   CHECK (notif_permission IN ('not_asked', 'granted', 'denied')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX users_created_at_idx ON users (created_at);

CREATE TABLE auth_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('email', 'google')),
  provider_subject TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subject)
);
CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   UUID NOT NULL,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id);

-- user_id is nullable: onboarding_started fires before the account exists.
CREATE TABLE onboarding_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id  TEXT NOT NULL,
  event_name  TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX onboarding_events_event_name_idx ON onboarding_events (event_name, occurred_at);

-- Down Migration

DROP TABLE onboarding_events;
DROP TABLE refresh_tokens;
DROP TABLE auth_identities;
DROP TABLE users;
