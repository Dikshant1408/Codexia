export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_analyzed TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  loc INTEGER NOT NULL,
  complexity INTEGER NOT NULL,
  hash TEXT NOT NULL,
  last_modified TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  signature TEXT,
  docstring TEXT,
  complexity INTEGER NOT NULL,
  is_exported INTEGER NOT NULL,
  parent_symbol_id TEXT,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);

CREATE TABLE IF NOT EXISTS symbol_references (
  id TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  is_call INTEGER NOT NULL,
  is_import INTEGER NOT NULL,
  snippet TEXT
);

CREATE INDEX IF NOT EXISTS idx_ref_symbol ON symbol_references(symbol_id);
CREATE INDEX IF NOT EXISTS idx_ref_source ON symbol_references(source_file);

CREATE TABLE IF NOT EXISTS file_dependencies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_file TEXT NOT NULL,
  to_file TEXT NOT NULL,
  import_path TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dep_from ON file_dependencies(from_file);
CREATE INDEX IF NOT EXISTS idx_dep_to ON file_dependencies(to_file);

CREATE TABLE IF NOT EXISTS git_commits (
  hash TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  short_hash TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  commit_date TEXT NOT NULL,
  message TEXT NOT NULL,
  files_changed INTEGER NOT NULL,
  insertions INTEGER NOT NULL,
  deletions INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commits_date ON git_commits(commit_date);

CREATE TABLE IF NOT EXISTS git_commit_files (
  id TEXT PRIMARY KEY,
  commit_hash TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL,
  additions INTEGER NOT NULL,
  deletions INTEGER NOT NULL,
  FOREIGN KEY(commit_hash) REFERENCES git_commits(hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commit_files_path ON git_commit_files(file_path);

CREATE TABLE IF NOT EXISTS dead_code_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line INTEGER NOT NULL,
  kind TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  last_modified TEXT NOT NULL,
  is_suppressed INTEGER NOT NULL DEFAULT 0,
  suppression_reason TEXT
);

CREATE TABLE IF NOT EXISTS risk_scores (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  target TEXT NOT NULL,
  file_path TEXT NOT NULL,
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  factors_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key TEXT PRIMARY KEY,
  cache_val TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
