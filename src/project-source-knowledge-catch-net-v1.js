const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];
const CONFIRMED = new Set(['OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED']);
const IGNORED = new Set(['REJECTED', 'OUTDATED']);
const optionalNumber = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);

export const PROJECT_KNOWLEDGE_CATCH_NET_THRESHOLDS = Object.freeze({
  extraction_confidence: 0.80,
  category_confidence: 0.75
});

function sourceMap(state = {}) {
  return new Map(arr(state.sources).filter((source) => !source.deleted_at).map((source) => [source.source_id, source]));
}

function provenanceFlags(state = {}, fact = {}) {
  const sources = sourceMap(state);
  const flags = new Set();
  for (const item of arr(fact.provenance)) {
    const categoryConfidence = optionalNumber(item?.category_confidence);
    if (categoryConfidence !== null && categoryConfidence < PROJECT_KNOWLEDGE_CATCH_NET_THRESHOLDS.category_confidence) {
      flags.add('CATEGORY_UNCERTAIN');
    }
    if (item?.category_mismatch === true) flags.add('CATEGORY_MISMATCH');
    if (item?.review_required === true) flags.add('EXTRACTION_REVIEW_REQUIRED');
    const sourceId = clean(item?.source_id, 240);
    if (!sourceId) continue;
    const source = sources.get(sourceId);
    if (!source) {
      flags.add('SOURCE_MISSING');
      continue;
    }
    const extractedHash = clean(item?.source_content_hash, 240);
    const currentHash = clean(source.content_hash, 240);
    if (extractedHash && currentHash && extractedHash !== currentHash) flags.add('STALE_SOURCE_EVIDENCE');
  }
  return flags;
}

export function evaluateProjectFactCatchNet(state = {}, fact = {}) {
  const status = clean(fact.verification_status, 80).toUpperCase();
  const confirmed = CONFIRMED.has(status);
  const ignored = IGNORED.has(status);
  const flags = provenanceFlags(state, fact);
  const path = clean(fact.field_path, 320).toLowerCase();
  const confidence = optionalNumber(fact.confidence);

  if (status === 'SOURCE_CONFLICT') flags.add('SOURCE_CONFLICT');
  if (/^(question|questions|open_question|open_questions|missing|unknown)(\.|$)/.test(path)) flags.add('OPEN_QUESTION');
  if (/^(other|misc|unknown)(\.|$)/.test(path)) flags.add('UNCATEGORIZED');
  if (clean(fact.origin, 80).toUpperCase() === 'EXTRACTED'
      && confidence !== null
      && confidence < PROJECT_KNOWLEDGE_CATCH_NET_THRESHOLDS.extraction_confidence) {
    flags.add('LOW_CONFIDENCE');
  }
  for (const ref of arr(fact.source_refs)) {
    if (!sourceMap(state).has(ref)) flags.add('SOURCE_MISSING');
  }

  const reviewFlags = [...flags];
  const blocking = !ignored && !confirmed && reviewFlags.length > 0;
  return {
    fact_id: fact.fact_id || null,
    field_path: fact.field_path || null,
    verification_status: status || null,
    confidence,
    flags: reviewFlags,
    blocking,
    resolved_by_human: confirmed,
    ignored
  };
}

export function buildProjectKnowledgeCatchNet(state = {}) {
  const facts = arr(state.facts).filter((fact) => !IGNORED.has(clean(fact.verification_status, 80).toUpperCase()));
  const evaluations = facts.map((fact) => evaluateProjectFactCatchNet(state, fact));
  const unresolved = evaluations.filter((item) => item.blocking);
  const counts = {
    source_conflicts: unresolved.filter((item) => item.flags.includes('SOURCE_CONFLICT')).length,
    low_confidence: unresolved.filter((item) => item.flags.includes('LOW_CONFIDENCE')).length,
    category_uncertain: unresolved.filter((item) => item.flags.includes('CATEGORY_UNCERTAIN') || item.flags.includes('CATEGORY_MISMATCH')).length,
    open_questions: unresolved.filter((item) => item.flags.includes('OPEN_QUESTION')).length,
    uncategorized: unresolved.filter((item) => item.flags.includes('UNCATEGORIZED')).length,
    stale_or_missing_source: unresolved.filter((item) => item.flags.includes('STALE_SOURCE_EVIDENCE') || item.flags.includes('SOURCE_MISSING')).length,
    explicit_review_required: unresolved.filter((item) => item.flags.includes('EXTRACTION_REVIEW_REQUIRED')).length
  };
  const flaggedIds = new Set(unresolved.map((item) => item.fact_id).filter(Boolean));
  return {
    schema: 'aurentara.project-knowledge-catch-net.v1',
    status: unresolved.length ? 'REVIEW_REQUIRED' : 'CLEAR',
    clear: unresolved.length === 0,
    total_fact_count: facts.length,
    safe_candidate_count: Math.max(0, facts.length - flaggedIds.size),
    unresolved_count: unresolved.length,
    unresolved_fact_ids: [...flaggedIds],
    counts,
    items: evaluations.filter((item) => item.flags.length > 0),
    human_confirmation_clears_non_conflict_flags: true,
    production_deploy: false,
    external_writes: false
  };
}

export function projectKnowledgeCatchNetManifest() {
  return {
    schema: 'aurentara.project-knowledge-catch-net.v1',
    catches: [
      'SOURCE_CONFLICT',
      'LOW_CONFIDENCE',
      'CATEGORY_UNCERTAIN',
      'CATEGORY_MISMATCH',
      'OPEN_QUESTION',
      'UNCATEGORIZED',
      'STALE_SOURCE_EVIDENCE',
      'SOURCE_MISSING',
      'EXTRACTION_REVIEW_REQUIRED'
    ],
    automatic_fact_approval: false,
    human_override_requires_explicit_confirmation: true,
    production_deploy: false,
    external_writes: false
  };
}
