-- FollowClean Premium V1 + free-scan rate limit. Additive, apply to followclean-db only
-- (binding FC_APIFY_BUDGET_DB after the V18 binding switch). Stores no names, no e-mail,
-- no card data: only Stripe TEST session/event ids, a random client claim id and amounts.
CREATE TABLE IF NOT EXISTS fc_premium_orders_v1 (
  session_id TEXT PRIMARY KEY NOT NULL CHECK(session_id LIKE 'cs_test_%' AND length(session_id) <= 255),
  event_id TEXT NOT NULL UNIQUE CHECK(event_id LIKE 'evt_%' AND length(event_id) <= 255),
  claim_ref TEXT NOT NULL CHECK(length(claim_ref) = 35 AND substr(claim_ref,1,3) = 'fc_'),
  amount_total INTEGER CHECK(amount_total IS NULL OR amount_total >= 0),
  currency TEXT CHECK(currency IS NULL OR length(currency) <= 8),
  livemode INTEGER NOT NULL DEFAULT 0 CHECK(livemode = 0),
  created_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fc_premium_orders_v1_ref ON fc_premium_orders_v1(claim_ref);
CREATE TRIGGER IF NOT EXISTS tr_fc_premium_orders_v1_no_update
BEFORE UPDATE ON fc_premium_orders_v1 BEGIN SELECT RAISE(ABORT, 'fc_premium_orders_v1 is append-only'); END;
-- Rate limit buckets hold a truncated salted hash (IP) or the scanned name, one row per hour window.
CREATE TABLE IF NOT EXISTS fc_rate_limit_v1 (
  bucket TEXT NOT NULL CHECK(length(bucket) BETWEEN 3 AND 80),
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL CHECK(hits >= 1),
  PRIMARY KEY (bucket, window_start)
);
