-- FollowClean Smart Scan V2 pilot ledger. NOT applied automatically and NOT connected
-- to paid execution. Apply manually to the existing D1 (binding FC_APIFY_BUDGET_DB)
-- only after review. Stores fingerprints and run keys, never account names or lists.
-- Micro-USD: 200000 = $0.20 hard total per scope, across ALL runs and parallel jobs.
CREATE TABLE IF NOT EXISTS fc_apify_v2_runs (
  run_key TEXT PRIMARY KEY NOT NULL CHECK(length(run_key) = 64),
  scope TEXT NOT NULL CHECK(length(scope) BETWEEN 3 AND 64),
  kind TEXT NOT NULL CHECK(kind IN ('legacy','following','checker')),
  cap_usd_micros INTEGER NOT NULL CHECK(cap_usd_micros > 0 AND cap_usd_micros <= 50000),
  actual_usd_micros INTEGER CHECK(actual_usd_micros IS NULL OR actual_usd_micros >= 0),
  state TEXT NOT NULL DEFAULT 'reserved'
    CHECK(state IN ('reserved','submitted','settled','failed')),
  provider_run_id TEXT CHECK(provider_run_id IS NULL OR length(provider_run_id) <= 40),
  created_ts INTEGER NOT NULL,
  updated_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fc_apify_v2_runs_scope ON fc_apify_v2_runs(scope);
-- Atomic global cap: a single INSERT either fits under the total or aborts.
-- Every row counts with MAX(cap, actual): failed runs and unused reserve are never released.
CREATE TRIGGER IF NOT EXISTS tr_fc_apify_v2_total
BEFORE INSERT ON fc_apify_v2_runs
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT SUM(MAX(cap_usd_micros, COALESCE(actual_usd_micros,0)))
    FROM fc_apify_v2_runs WHERE scope = NEW.scope
  ),0) + NEW.cap_usd_micros > 200000
  THEN RAISE(ABORT,'followclean_v2_total_budget_exceeded') END;
END;
-- New rows always start as an unbilled reservation. Only the documented legacy row may
-- arrive settled. Prevents pre-settled or pre-priced rows from being injected.
CREATE TRIGGER IF NOT EXISTS tr_fc_apify_v2_insert_shape
BEFORE INSERT ON fc_apify_v2_runs
WHEN NEW.kind <> 'legacy'
BEGIN
  SELECT CASE WHEN NEW.state <> 'reserved' OR NEW.actual_usd_micros IS NOT NULL
      OR NEW.provider_run_id IS NOT NULL
    THEN RAISE(ABORT,'followclean_v2_insert_must_be_reservation') END;
END;
-- UPDATE protection. Identity and reserved cap are immutable, states follow one explicit
-- graph, and reported cost can only stay or rise. NOTE: an UPDATE that records a provider
-- overrun is deliberately NOT blocked. The money is already spent at the provider; the
-- ledger must record it truthfully, and the INSERT trigger then refuses every further run.
--   reserved  -> submitted | failed
--   submitted -> submitted (cost update) | settled | failed
--   settled, failed: terminal
CREATE TRIGGER IF NOT EXISTS tr_fc_apify_v2_update
BEFORE UPDATE ON fc_apify_v2_runs
BEGIN
  SELECT CASE
    WHEN NEW.run_key <> OLD.run_key OR NEW.scope <> OLD.scope OR NEW.kind <> OLD.kind
      OR NEW.cap_usd_micros <> OLD.cap_usd_micros OR NEW.created_ts <> OLD.created_ts
      THEN RAISE(ABORT,'followclean_v2_immutable_field')
    WHEN OLD.state IN ('settled','failed')
      THEN RAISE(ABORT,'followclean_v2_terminal_state')
    WHEN NOT ((OLD.state = 'reserved' AND NEW.state IN ('submitted','failed'))
      OR (OLD.state = 'submitted' AND NEW.state IN ('submitted','settled','failed')))
      THEN RAISE(ABORT,'followclean_v2_invalid_transition')
    WHEN OLD.actual_usd_micros IS NOT NULL AND
      (NEW.actual_usd_micros IS NULL OR NEW.actual_usd_micros < OLD.actual_usd_micros)
      THEN RAISE(ABORT,'followclean_v2_cost_regression')
    WHEN NEW.state = 'settled' AND NEW.actual_usd_micros IS NULL
      THEN RAISE(ABORT,'followclean_v2_settle_requires_cost')
    WHEN NEW.state = 'submitted' AND NEW.provider_run_id IS NULL
      THEN RAISE(ABORT,'followclean_v2_submit_requires_run_id')
    WHEN OLD.provider_run_id IS NOT NULL AND
      (NEW.provider_run_id IS NULL OR NEW.provider_run_id <> OLD.provider_run_id)
      THEN RAISE(ABORT,'followclean_v2_run_id_immutable')
    WHEN NEW.updated_ts < OLD.updated_ts
      THEN RAISE(ABORT,'followclean_v2_clock_regression')
  END;
END;
CREATE TRIGGER IF NOT EXISTS tr_fc_apify_v2_no_delete
BEFORE DELETE ON fc_apify_v2_runs
BEGIN SELECT RAISE(ABORT,'followclean_v2_ledger_append_only'); END;
-- Already incurred inside the 0.20 USD test order: LanceAPI run 3qcGw5hkmwWfO1Ua5 on
-- 2026-11-13 (reported usageTotalUsd 0.032, reserved 0.05). Counted at the reserved 0.05.
INSERT OR IGNORE INTO fc_apify_v2_runs
  (run_key, scope, kind, cap_usd_micros, actual_usd_micros, state, provider_run_id, created_ts, updated_ts)
VALUES ('0000000000000000000000000000000000000000000000000000000000000001',
  'pilot-ysrrioo-v1', 'legacy', 50000, 32000, 'settled', '3qcGw5hkmwWfO1Ua5', 1794528000000, 1794528000000);
