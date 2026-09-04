import { OPERATOR_AI_EVIDENCE, OPERATOR_AI_FRESHNESS } from './contracts-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export function classifyOperatorAiEvidence(input = {}) {
  const status = clean(input.status || input.verification || input.state, 100).toUpperCase();
  const conflicted = input.conflicted === true || status.includes('CONFLICT');
  let evidence = 'UNKNOWN';
  if (conflicted) evidence = 'CONFLICTED';
  else if (input.verified === true || ['VERIFIED','PASS','HEALTHY','CURRENT','RECONCILED','OPERATOR_CONFIRMED','CUSTOMER_CONFIRMED'].includes(status)) evidence = 'VERIFIED';
  else if (input.supported === true || ['SUPPORTED','READY','CONNECTED','DELIVERY_READY','COMPLETED'].includes(status)) evidence = 'SUPPORTED';
  else if (input.inferred === true || status === 'INFERRED') evidence = 'INFERRED';
  return OPERATOR_AI_EVIDENCE.includes(evidence) ? evidence : 'UNKNOWN';
}

export function classifyOperatorAiFreshness(input = {}, options = {}) {
  const observedAt = input.observed_at || input.updated_at || input.verified_at || input.created_at || null;
  if (!observedAt) return { freshness: 'UNKNOWN_FRESHNESS', observed_at: null, age_ms: null };
  const observed = new Date(observedAt).getTime();
  const now = new Date(options.now || Date.now()).getTime();
  if (!Number.isFinite(observed) || !Number.isFinite(now)) return { freshness: 'UNKNOWN_FRESHNESS', observed_at: observedAt, age_ms: null };
  const age = Math.max(0, now - observed);
  const maxAge = Number.isFinite(Number(options.max_age_ms)) ? Number(options.max_age_ms) : 12 * 60 * 60 * 1000;
  const freshness = age <= maxAge ? 'FRESH' : 'STALE';
  return { freshness: OPERATOR_AI_FRESHNESS.includes(freshness) ? freshness : 'UNKNOWN_FRESHNESS', observed_at: observedAt, age_ms: age };
}

export function projectEvidenceRecord(input = {}, options = {}) {
  const fresh = classifyOperatorAiFreshness(input, options);
  return {
    evidence_ref: clean(input.evidence_ref || input.id || input.source || 'runtime_projection', 300),
    source: clean(input.source || input.evidence_ref || 'runtime_projection', 300),
    status: classifyOperatorAiEvidence(input),
    observed_at: fresh.observed_at,
    source_revision: clean(input.source_revision || input.revision || input.head_sha, 100) || null,
    freshness: fresh.freshness,
    data: clone(input.data ?? null)
  };
}

export function operatorAiEvidenceManifest() {
  return { schema: 'aurentara.operator-ai.evidence-projection.v1', projection_only: true, source_intake_states_replaced: false, historical_is_current_by_default: false, production_deploy: false };
}
