-- FollowClean standalone tables in existing chatgpt-test-db.
-- D1 budget control is NOT connected to paid execution in V13.
-- Store only irreversible, server-computed fingerprints, never account names.
-- Micro-USD: 200000 = $0.20; day cap $1; month cap $5 (staging).
CREATE TABLE IF NOT EXISTS fc_apify_budget_reservations_v1 (
  reservation_id TEXT PRIMARY KEY NOT NULL,
  owner_fingerprint TEXT NOT NULL CHECK(length(owner_fingerprint) = 64),
  profile_fingerprint TEXT NOT NULL CHECK(length(profile_fingerprint) = 64),
  day_utc TEXT NOT NULL CHECK(length(day_utc) = 10),
  month_utc TEXT NOT NULL CHECK(length(month_utc) = 7),
  cap_usd_micros INTEGER NOT NULL CHECK(cap_usd_micros > 0 AND cap_usd_micros <= 200000),
  state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved', 'submitted', 'settled', 'failed')),
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL,
  UNIQUE(owner_fingerprint, profile_fingerprint, day_utc)
);
CREATE INDEX IF NOT EXISTS idx_fc_apify_budget_v1_day ON fc_apify_budget_reservations_v1(day_utc);
CREATE INDEX IF NOT EXISTS idx_fc_apify_budget_v1_month ON fc_apify_budget_reservations_v1(month_utc);
CREATE TRIGGER IF NOT EXISTS tr_fc_apify_budget_v1_day
BEFORE INSERT ON fc_apify_budget_reservations_v1
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT SUM(cap_usd_micros)
    FROM fc_apify_budget_reservations_v1
    WHERE day_utc = NEW.day_utc
  ),0) + NEW.cap_usd_micros > 1000000
  THEN RAISE(ABORT,'followclean_daily_budget_exceeded') END;
END;
CREATE TRIGGER IF NOT EXISTS tr_fc_apify_budget_v1_month
BEFORE INSERT ON fc_apify_budget_reservations_v1
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT SUM(cap_usd_micros)
    FROM fc_apify_budget_reservations_v1
    WHERE month_utc = NEW.month_utc
  ),0) + NEW.cap_usd_micros > 5000000
  THEN RAISE(ABORT,'followclean_monthly_budget_exceeded') END;
END;
-- Conservatively count failed attempts too: no spending allowance is released unless
-- verified by an authorized administrator. No customer-supplied value grants budget.
