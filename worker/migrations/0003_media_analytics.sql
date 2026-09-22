-- BMP Terbuka v1.1.0 media + compact analytics.
-- Additive only: no activation/payment/supporter tables are changed.

CREATE TABLE IF NOT EXISTS telemetry_actor (
  actor_hash TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_actor_last_seen
  ON telemetry_actor(last_seen);

CREATE TABLE IF NOT EXISTS telemetry_daily (
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  channel TEXT NOT NULL,
  extension_version TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, metric, channel, extension_version)
);

CREATE TABLE IF NOT EXISTS telemetry_daily_actor (
  date TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  extension_version TEXT NOT NULL,
  opened INTEGER NOT NULL DEFAULT 0,
  job_started INTEGER NOT NULL DEFAULT 0,
  ad_seen INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, actor_hash, channel, extension_version)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_daily_actor_actor
  ON telemetry_daily_actor(actor_hash, date);

CREATE TABLE IF NOT EXISTS community_daily (
  date TEXT PRIMARY KEY,
  subscribers INTEGER,
  members INTEGER,
  captured_at INTEGER NOT NULL
);
