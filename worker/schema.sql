-- Alert subscriptions. Deliberately minimal: no names, location rounded to ~1 km.
CREATE TABLE IF NOT EXISTS subscriptions (
  token         TEXT PRIMARY KEY,          -- random, used in confirm/unsubscribe/renew links
  email         TEXT NOT NULL,
  proc_id       INTEGER NOT NULL,
  proc_name     TEXT NOT NULL,
  proc_slug     TEXT NOT NULL,
  place_name    TEXT NOT NULL,
  place_slug    TEXT NOT NULL,
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  radius_km     INTEGER NOT NULL,          -- 0 = whole country
  max_days      INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | active
  created_at    INTEGER NOT NULL,          -- unix seconds
  confirmed_at  INTEGER,
  expires_at    INTEGER,                   -- set on confirm: +90 days
  reminded_at   INTEGER,                   -- expiry reminder sent
  last_sent_at  INTEGER,
  last_sent_key TEXT                       -- "locIdx|firstSlot" of the last match we emailed
);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions (status, proc_id);
CREATE INDEX IF NOT EXISTS idx_sub_email ON subscriptions (email);
