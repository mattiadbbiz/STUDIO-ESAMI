-- Studio Esami: schema database D1

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ord INTEGER DEFAULT 0,
  UNIQUE (exam_id, code)
);

-- kind: flashcard | chiusa | aperta
-- last_result: so | ripassare | giusta | parziale | sbagliata
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  module_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  item_key TEXT NOT NULL,
  data TEXT NOT NULL,
  box INTEGER DEFAULT 0,
  last_result TEXT,
  attempts INTEGER DEFAULT 0,
  last_seen TEXT,
  UNIQUE (exam_id, item_key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  module_id INTEGER,
  label TEXT,
  kind TEXT,
  total INTEGER,
  score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_modules_exam ON modules (exam_id);
CREATE INDEX IF NOT EXISTS idx_items_module ON items (module_id);
CREATE INDEX IF NOT EXISTS idx_items_exam_kind ON items (exam_id, kind);
CREATE INDEX IF NOT EXISTS idx_sessions_exam ON sessions (exam_id);
