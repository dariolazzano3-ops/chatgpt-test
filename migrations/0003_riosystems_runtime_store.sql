-- RIOSYSTEMS runtime store contract.
-- This migration is declared in source control only. Applying it to any D1 database
-- remains an explicit external write and is not authorized by this commit.

CREATE TABLE IF NOT EXISTS riosystems_runtime_store (
  scope_key TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope_key, collection_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_riosystems_runtime_store_scope_collection
  ON riosystems_runtime_store (scope_key, collection_name, record_id);
