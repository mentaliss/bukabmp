ALTER TABLE users ADD COLUMN first_activated_at INTEGER;
ALTER TABLE users ADD COLUMN last_activated_at INTEGER;
ALTER TABLE users ADD COLUMN activation_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_first_activated
  ON users(first_activated_at);
