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
