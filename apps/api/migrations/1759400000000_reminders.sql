-- Up Migration

-- One row per browser that allowed notifications; the endpoint identifies the browser.
CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions (user_id);

-- When the user was last asked about notifications (the dashboard asks again after 7 days).
ALTER TABLE users ADD COLUMN notif_prompted_at TIMESTAMPTZ;
ALTER TABLE users DROP CONSTRAINT users_notif_permission_check;
ALTER TABLE users ADD CONSTRAINT users_notif_permission_check
  CHECK (notif_permission IN ('not_asked', 'granted', 'denied', 'unsupported'));

-- Down Migration

UPDATE users SET notif_permission = 'not_asked' WHERE notif_permission = 'unsupported';
ALTER TABLE users DROP CONSTRAINT users_notif_permission_check;
ALTER TABLE users ADD CONSTRAINT users_notif_permission_check
  CHECK (notif_permission IN ('not_asked', 'granted', 'denied'));
ALTER TABLE users DROP COLUMN notif_prompted_at;
DROP TABLE push_subscriptions;
