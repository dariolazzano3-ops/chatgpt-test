-- LUNARA V2: isolated EU staging D1 schema. No production customers.
CREATE TABLE IF NOT EXISTS lunara_orders (
  order_id TEXT PRIMARY KEY NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('story_pdf', 'story_audio')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_payment', 'paid', 'dispatching', 'dispatched', 'manual_review')),
  stripe_session_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'))
);
CREATE INDEX IF NOT EXISTS idx_lunara_orders_status ON lunara_orders(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_lunara_orders_expiry ON lunara_orders(expires_at);
-- A default expiry alone does NOT delete rows. Deletion/retention must be implemented and audited before real data.

-- Production cost guard. A single order_id can be claimed once, before Make AI generation.
-- These records are sandbox only until Stripe signed payment->D1 reconciliation is proven.
CREATE TABLE IF NOT EXISTS lunara_pdf_jobs (
  order_id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('reserved','uploading','stored','failed')),
  object_key TEXT NOT NULL UNIQUE,
  upload_token_hash TEXT UNIQUE,
  upload_expires_at INTEGER,
  source_doc_id TEXT,
  pdf_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stored_at TEXT,
  CHECK(length(order_id) BETWEEN 20 AND 100)
);
CREATE INDEX IF NOT EXISTS idx_lunara_pdf_jobs_status ON lunara_pdf_jobs(status,updated_at);
CREATE INDEX IF NOT EXISTS idx_lunara_pdf_jobs_expiration ON lunara_pdf_jobs(upload_expires_at) WHERE status='reserved';

CREATE TABLE IF NOT EXISTS lunara_production_claims (
  order_id TEXT PRIMARY KEY NOT NULL REFERENCES lunara_pdf_jobs(order_id),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Make action: POST /v1/claim/<order_id> with X-Lunara-Upload-Token before AI.
-- A second claim returns 409; PUT /v1/upload/<order_id> is forbidden without a claim.
-- Token expires, stores only SHA-256 in D1, and is revoked after first upload.
-- NOTE: R2 lifecycle expires sandbox/ objects after 30 days; D1 rows need separate cleanup.

-- Private owner-only reading preview for original Lunara stories (not customer delivery).
CREATE TABLE IF NOT EXISTS lunara_story_previews (
  story_id TEXT PRIMARY KEY NOT NULL,
  child_name TEXT NOT NULL,
  story_title TEXT NOT NULL,
  story_text TEXT NOT NULL,
  source TEXT NOT NULL,
  qa_pass INTEGER NOT NULL DEFAULT 0 CHECK(qa_pass IN (0,1)),
  is_synthetic INTEGER NOT NULL DEFAULT 1 CHECK(is_synthetic IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at INTEGER NOT NULL DEFAULT (unixepoch()+30*86400),
  CHECK(length(story_id) BETWEEN 8 AND 100)
);
CREATE TABLE IF NOT EXISTS lunara_story_import_tokens (
  story_id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Preview route only allows the user-supplied original sample ID "original-mia".
-- Not a customer-facing download or a live delivery entitlement.
-- An external Make ingestion workflow has NOT been activated or verified.
