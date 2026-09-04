import { OPERATOR_AI_CONTEXT_SCHEMA } from './contracts-v1.js';
import { classifyOperatorAiFreshness, projectEvidenceRecord } from './evidence-v1.js';

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const sha = (value) => /^[a-f0-9]{40}$/i.test(clean(value, 80)) ? clean(value, 80).toLowerCase() : null;

function stateOrUnknown(value, code, unknowns) {
  if (value == null) { unknowns.push(code); return { status: 'UNKNOWN' }; }
  return clone(value);
}

export function buildOperatorAiContextSnapshot(input = {}, options = {}) {
  const unknowns = [];
  const conflicts = Array.isArray(input.conflicts) ? clone(input.conflicts) : [];
  const canonical = clone(input.canonical_source || {});
  canonical.canonical_branch = clean(canonical.canonical_branch || canonical.branch, 160) || 'factory-control';
  canonical.canonical_head = sha(canonical.canonical_head || canonical.head_sha || canonical.repository_head_sha);
  canonical.tree_sha = sha(canonical.tree_sha);
  canonical.verified_at = clean(canonical.verified_at || canonical.observed_at, 100) || null;
  canonical.verification = canonical.canonical_head ? 'VERIFIED' : 'UNKNOWN';
  if (!canonical.canonical_head) unknowns.push('CANONICAL_HEAD_UNKNOWN');

  const freshness = classifyOperatorAiFreshness({ observed_at: canonical.verified_at }, { now: options.now, max_age_ms: options.canonical_max_age_ms ?? 15 * 60 * 1000 });
  if (freshness.freshness === 'STALE') conflicts.push({ code: 'CANONICAL_EVIDENCE_STALE', severity: 'P0' });

  const evidence = (Array.isArray(input.recent_evidence) ? input.recent_evidence : []).map((item) => projectEvidenceRecord(item, { now: options.now }));
  return {
    schema: OPERATOR_AI_CONTEXT_SCHEMA,
    snapshot_id: clean(input.snapshot_id, 220) || `operator-ai-snapshot:${Date.now()}`,
    created_at: clean(input.created_at, 100) || new Date(options.now || Date.now()).toISOString(),
    project_ref: clean(input.project_ref || input.project_state?.scope_key, 500) || null,
    operator_runtime_revision: Number.isInteger(Number(input.operator_runtime_revision)) ? Number(input.operator_runtime_revision) : null,
    canonical_source: canonical,
    project_state: stateOrUnknown(input.project_state, 'PROJECT_STATE_UNKNOWN', unknowns),
    project_context: stateOrUnknown(input.project_context, 'PROJECT_CONTEXT_UNKNOWN', unknowns),
    mission_state: stateOrUnknown(input.mission_state, 'MISSION_STATE_UNKNOWN', unknowns),
    quality_state: stateOrUnknown(input.quality_state, 'QUALITY_STATE_UNKNOWN', unknowns),
    provider_state: stateOrUnknown(input.provider_state, 'PROVIDER_STATE_UNKNOWN', unknowns),
    cost_state: stateOrUnknown(input.cost_state, 'COST_STATE_UNKNOWN', unknowns),
    approval_state: stateOrUnknown(input.approval_state, 'APPROVAL_STATE_UNKNOWN', unknowns),
    release_state: stateOrUnknown(input.release_state, 'RELEASE_STATE_UNKNOWN', unknowns),
    delivery_state: stateOrUnknown(input.delivery_state, 'DELIVERY_STATE_UNKNOWN', unknowns),
    recent_evidence: evidence,
    unknowns: [...new Set([...(Array.isArray(input.unknowns) ? input.unknowns : []), ...unknowns])],
    conflicts,
    freshness: { canonical: freshness.freshness, canonical_observed_at: freshness.observed_at, canonical_age_ms: freshness.age_ms },
    truth_hierarchy: ['CURRENT_GIT_CANONICAL','PROJECT_SOURCE_INTAKE_AND_MISSION_CONTEXT','PROJECT_OPERATING_LAYER_AND_COMMAND_CENTER','MISSION_RUNTIME_AND_DELIVERY','PREMIUM_AND_QA','PROVIDER_COST_APPROVAL_RELEASE','OBSERVABILITY_AND_EVIDENCE','CONVERSATION_CONTEXT'],
    conversation_can_override_authoritative_state: false,
    production_deploy: false
  };
}

export function operatorAiContextSnapshotManifest() {
  return { schema: OPERATOR_AI_CONTEXT_SCHEMA, source_of_truth_first: true, stale_canonical_blocks_execution: true, conversation_lowest_truth_priority: true, production_deploy: false };
}
