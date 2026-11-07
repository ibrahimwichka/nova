CREATE TABLE IF NOT EXISTS game_presence (
  id TEXT PRIMARY KEY NOT NULL,
  sequence INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS game_presence_updated_at ON game_presence (updated_at);
