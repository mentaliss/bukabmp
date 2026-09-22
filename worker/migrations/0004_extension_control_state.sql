CREATE TABLE IF NOT EXISTS extension_control_state (
  channel TEXT PRIMARY KEY NOT NULL
    CHECK (channel IN ('github','android','cws','edge')),
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
