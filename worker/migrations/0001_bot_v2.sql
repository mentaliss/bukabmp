PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  telegram_user_id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (referred_by) REFERENCES users(telegram_user_id)
);

CREATE TABLE IF NOT EXISTS referrals (
  referral_id TEXT PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL,
  referred_user_id INTEGER NOT NULL UNIQUE,
  attributed_at INTEGER NOT NULL,
  qualified_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('ATTRIBUTED','QUALIFIED','REJECTED')),
  rejection_reason TEXT,
  FOREIGN KEY (referrer_user_id) REFERENCES users(telegram_user_id),
  FOREIGN KEY (referred_user_id) REFERENCES users(telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status
  ON referrals(status);

CREATE TABLE IF NOT EXISTS supporter_state (
  user_id INTEGER PRIMARY KEY,
  supporter_until INTEGER NOT NULL DEFAULT 0,
  referral_entitlement_total INTEGER NOT NULL DEFAULT 0,
  activation_until INTEGER NOT NULL DEFAULT 0,
  activation_bonus_pending_days INTEGER NOT NULL DEFAULT 0,
  wall_mode TEXT NOT NULL DEFAULT 'private'
    CHECK (wall_mode IN ('private','public','anonymous')),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(telegram_user_id)
);

CREATE TABLE IF NOT EXISTS supporter_events (
  event_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('stars','referral','admin','migration')),
  days_delta INTEGER NOT NULL,
  source_ref TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_supporter_events_user
  ON supporter_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS payments (
  payment_event_id TEXT PRIMARY KEY,
  telegram_charge_ref TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  package_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 0),
  processed_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSED','REJECTED','REFUNDED')),
  FOREIGN KEY (user_id) REFERENCES users(telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_user
  ON payments(user_id, processed_at);

CREATE TABLE IF NOT EXISTS referral_rewards (
  reward_event_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  valid_referral_count INTEGER NOT NULL CHECK (valid_referral_count >= 0),
  entitlement_total_days INTEGER NOT NULL CHECK (entitlement_total_days >= 0),
  credited_delta_days INTEGER NOT NULL CHECK (credited_delta_days >= 0),
  source_ref TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user
  ON referral_rewards(user_id, created_at);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);
