-- LUNARA FACTORY V2 staging database only; no existing database changes.
CREATE TABLE IF NOT EXISTS lunara_orders (
  order_id TEXT PRIMARY KEY NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('story_pdf','story_audio')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_payment','paid','dispatching','dispatched','manual_review')),
  stripe_session_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lunara_orders_status ON lunara_orders(status,updated_at);
