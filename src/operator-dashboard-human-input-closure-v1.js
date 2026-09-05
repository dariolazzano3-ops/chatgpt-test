import { handleOperatorDashboard as handleExistingOperatorDashboard } from './operator-ai/dashboard-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import {
  registerProjectSource,
  upsertProjectFact,
  reviewProjectFact,
  recordProjectHumanDecision,
  recordContentReadiness,
  evaluatePremiumDiscoveryReadiness
} from './project-source-intake-v1.js';
import { createCustomerDeliveryContractV1 } from './customer-delivery-contract-v1.js';
import { createApprovalRecord, evaluateApproval } from './runtime-approvals.js';
import { normalizePremiumAssets } from './web-factory/premium-standard-v1.js';
import gelatoClosure from '../projects/gelato-donatello-website-v1/auto-customer-input-closure-v1.json' with { type: 'json' };
import gelatoConfirmed from '../projects/gelato-donatello-website-v1/confirmed-project-inputs-v1.json' with { type: 'json' };
import gelatoContract from '../projects/gelato-donatello-website-v1/customer-delivery-contract-v1.json' with { type: 'json' };

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const GELATO_SCOPE = gelatoClosure?.project_ref?.scope_key || 'gelato-donatello:gelato-donatello-website-v1';
const INPUT_KEY_BY_QUESTION = Object.freeze({
  CONTACT_DETAILS: 'current_contact_details',
  OPENING_HOURS: 'opening_hours_confirmation',
  LEGAL_CURRENTNESS: 'legal_details',
  TARGET_CUSTOMERS: 'target_customers',
  PRIMARY_CONVERSION: 'primary_conversion_channel',
  FINAL_ASSET_QUALITY_APPROVAL: 'final_asset_quality_approval'
});

function json(body, status = 200, source = null) {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-aurentara-operator-extension', 'dashboard-human-input-closure-v1');
  headers.delete('content-length');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.clone().json(); } catch { return {}; }
}

function catalogForScope(scopeKey = '') {
  const scope = clean(scopeKey, 640);
  if (scope !== GELATO_SCOPE) return null;
  return {
    schema: 'aurentara.project-human-question-catalog.v1',
    project_ref: clone(gelatoClosure.project_ref),
    questions: clone(gelatoClosure.human_questions || []),
    classifications: clone(gelatoClosure.classifications || {}),
    business_understanding: clone(gelatoClosure.business_understanding || {}),
    efficiency: clone(gelatoClosure.efficiency || {}),
    source: 'CANONICAL_PROJECT_FERRARI_AUTO_CUSTOMER_INPUT_CLOSURE_V1'
  };
}

function decisions(state = {}) {
  return Array.isArray(state.human_decisions) ? state.human_decisions : [];
}

function decisionFor(state = {}, questionId = '') {
  return decisions(state).find((item) => item.question_id === questionId && item.status === 'RESOLVED') || null;
}

function humanSource(state = {}) {
  return (state.sources || []).find((item) => item.source_type === 'MANUAL_INPUT' && item.source_role === 'HUMAN_DECISION' && !item.deleted_at) || null;
}

function ensureHumanSource(state = {}, at = null) {
  const existing = humanSource(state);
  if (existing) return { ok: true, state: clone(state), source: clone(existing), changed: false };
  return registerProjectSource(state, {
    source_id: 'project-human-decisions-v1',
    source_type: 'MANUAL_INPUT',
    source_role: 'HUMAN_DECISION',
    locator: `manual://${state.scope_key}/human-decisions-v1`,
    display_name: 'Operator confirmed project inputs',
    ownership_status: 'UNKNOWN',
    ingestion_status: 'HUMAN_DECISION'
  }, { at });
}

function websiteEvidenceSource(state = {}) {
  return (state.sources || []).find((item) => item.source_type === 'OWNED_WEBSITE' && !item.deleted_at)
    || (state.sources || []).find((item) => item.source_type === 'REFERENCE_WEBSITE' && !item.deleted_at)
    || null;
}

function syncCanonicalConfirmedFacts(state = {}, at = null) {
  if (state.scope_key !== gelatoConfirmed?.project_ref?.scope_key) return { ok: true, state: clone(state), fact_ids: [] };
  const source = ensureHumanSource(state, at);
  if (!source.ok) return source;
  let next = source.state;
  const factIds = [];
  for (const [index, input] of (gelatoConfirmed.facts || []).entries()) {
    const added = upsertProjectFact(next, {
      fact_id: `canonical-confirmed-${index + 1}`,
      field_path: input.field_path,
      value: clone(input.value),
      origin: 'MANUAL',
      verification_status: input.verification_status === 'OPERATOR_CONFIRMED' ? 'OPERATOR_CONFIRMED' : 'UNVERIFIED',
      source_refs: [source.source.source_id]
    }, { at });
    if (!added.ok) return added;
    next = added.state;
    factIds.push(added.fact.fact_id);
  }
  return { ok: true, state: next, fact_ids: factIds };
}

function candidateValues(control = {}) {
  return (Array.isArray(control.candidates) ? control.candidates : []).map((item) => (
    item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item
  ));
}

function normalizeControlDecision(control = {}, raw = {}) {
  const type = clean(control.type, 80).toUpperCase();
  if (type === 'CONFIRMATION') {
    if (typeof raw.confirmed !== 'boolean') return { ok: false, error: 'HUMAN_DECISION_CONFIRMATION_REQUIRED', control_id: control.id };
    if (raw.confirmed) return { ok: true, value: clone(control.candidate), used_existing_candidate: true };
    const correction = clean(raw.correction, 4000);
    if (control.requires_correction_when_rejected !== false && !correction) {
      return { ok: false, error: 'HUMAN_DECISION_CORRECTION_REQUIRED', control_id: control.id };
    }
    return { ok: true, value: correction || null, rejected_candidate: true, used_existing_candidate: false };
  }
  if (type === 'SINGLE_CHOICE') {
    const values = candidateValues(control);
    const requested = raw.value;
    if (values.some((value) => JSON.stringify(value) === JSON.stringify(requested))) {
      return { ok: true, value: clone(requested), used_existing_candidate: true };
    }
    const other = clean(raw.other_value, 4000);
    if (control.allow_other === true && other) return { ok: true, value: other, used_existing_candidate: false };
    return { ok: false, error: 'HUMAN_DECISION_SINGLE_CHOICE_REQUIRED', control_id: control.id };
  }
  if (type === 'MULTI_CHOICE') {
    const allowed = candidateValues(control);
    const requested = Array.isArray(raw.values) ? raw.values : [];
    const selected = requested.filter((value) => allowed.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value)));
    const other = clean(raw.other_value, 4000);
    if (other && control.allow_other === true) selected.push(other);
    if (!selected.length) return { ok: false, error: 'HUMAN_DECISION_MULTI_CHOICE_REQUIRED', control_id: control.id };
    return { ok: true, value: clone(control.collapse_single === true && selected.length === 1 ? selected[0] : selected), used_existing_candidate: !other && selected.length === requested.length };
  }
  if (type === 'APPROVAL') {
    if (typeof raw.approved !== 'boolean') return { ok: false, error: 'HUMAN_DECISION_APPROVAL_REQUIRED', control_id: control.id };
    if (control.requires_preview_seen === true && raw.approved === true && raw.preview_seen !== true) {
      return { ok: false, error: 'HUMAN_QUALITY_APPROVAL_PREVIEW_VIEW_REQUIRED', control_id: control.id };
    }
    return { ok: true, value: raw.approved, preview_seen: raw.preview_seen === true, used_existing_candidate: true };
  }
  return { ok: false, error: 'HUMAN_DECISION_CONTROL_TYPE_UNSUPPORTED', control_id: control.id, type };
}

function materializeCandidateFacts(state = {}, control = {}, humanSourceId = '', at = null) {
  if (control.materialize_candidates !== true || !clean(control.field_path, 320)) return { ok: true, state: clone(state) };
  const evidenceSource = websiteEvidenceSource(state);
  let next = clone(state);
  for (const [index, value] of candidateValues(control).entries()) {
    const refs = [...new Set([evidenceSource?.source_id, humanSourceId].filter(Boolean))];
    const added = upsertProjectFact(next, {
      fact_id: `human-candidate-${clean(control.id, 80).toLowerCase()}-${index + 1}`,
      field_path: control.field_path,
      value: clone(value),
      origin: clean(control.candidate_origin, 80).toUpperCase() === 'INFERRED' ? 'INFERRED' : 'EXTRACTED',
      verification_status: 'UNVERIFIED',
      source_refs: refs,
      critical: control.critical === true
    }, { at });
    if (!added.ok) return added;
    next = added.state;
  }
  return { ok: true, state: next };
}

function confirmFact(state = {}, control = {}, normalized = {}, actor = {}, sourceId = '', verification = 'OPERATOR_CONFIRMED', at = null) {
  if (!clean(control.field_path, 320) || normalized.value === null || normalized.value === undefined) {
    return { ok: true, state: clone(state), fact: null };
  }
  const candidates = materializeCandidateFacts(state, control, sourceId, at);
  if (!candidates.ok) return candidates;
  let next = candidates.state;
  const added = upsertProjectFact(next, {
    field_path: control.field_path,
    value: clone(normalized.value),
    origin: 'MANUAL',
    verification_status: 'UNVERIFIED',
    source_refs: [sourceId],
    critical: control.critical === true
  }, { at });
  if (!added.ok) return added;
  next = added.state;
  const reviewed = reviewProjectFact(next, added.fact.fact_id, {
    verification_status: verification,
    verified_by: actor.id,
    at
  }, { at });
  if (!reviewed.ok) return reviewed;
  return { ok: true, state: reviewed.state, fact: reviewed.fact };
}

function aggregateFactValue(question = {}, normalizedById = {}) {
  const field = clean(question.aggregate_field_path, 320);
  if (!field) return null;
  const value = {};
  for (const control of question.controls || []) {
    if (!clean(control.aggregate_key, 160)) continue;
    value[control.aggregate_key] = clone(normalizedById[control.id]?.value ?? null);
  }
  return { field_path: field, value };
}

function assetQualityDecision(state = {}) {
  const item = decisionFor(state, 'FINAL_ASSET_QUALITY_APPROVAL');
  return item?.decision?.normalized?.asset_quality?.value === true;
}

function humanQualityApproval(state = {}) {
  const records = decisions(state).map((item) => item.approval).filter(Boolean);
  return evaluateApproval(records, {
    customer_id: state.customer_id,
    project_id: state.project_id,
    approval_type: 'FINAL_HUMAN_QUALITY_APPROVAL'
  });
}

function decisionSatisfiesInput(state = {}, questionId = '') {
  const item = decisionFor(state, questionId);
  if (!item) return false;
  if (questionId === 'FINAL_ASSET_QUALITY_APPROVAL') return item.decision?.normalized?.asset_quality?.value === true;
  return true;
}

function buildContract(state = {}) {
  const missing = (gelatoContract.required_customer_inputs || []).filter((key) => {
    const questionId = Object.entries(INPUT_KEY_BY_QUESTION).find(([, inputKey]) => inputKey === key)?.[0];
    return questionId ? !decisionSatisfiesInput(state, questionId) : false;
  });
  return createCustomerDeliveryContractV1({
    ...clone(gelatoContract),
    missing_inputs: missing,
    current_status: missing.length ? 'CUSTOMER_INPUT_CLOSURE' : 'CUSTOMER_INPUT_CLOSURE_COMPLETE'
  });
}

function efficiencyProjection(state = {}, catalog = {}) {
  const rows = decisions(state);
  const activeSeconds = rows.reduce((sum, item) => sum + Number(item.decision?.active_operator_seconds || 0), 0);
  const copyPasteAvoided = rows.filter((item) => item.decision?.used_existing_candidates_only === true).length;
  const base = catalog.efficiency || {};
  return {
    questions_originally_possible: Number(base.previous_human_input_slots ?? 8),
    automatically_resolved: Number(base.automatically_resolved_required_inputs ?? 1),
    questions_shown_to_operator: (catalog.questions || []).length,
    operator_touches: rows.length,
    active_operator_minutes: Math.round((activeSeconds / 60) * 100) / 100,
    duplicate_input_avoided: (gelatoConfirmed.facts || []).length + Number(base.automatically_resolved_required_inputs ?? 1),
    copy_paste_avoided: copyPasteAvoided,
    flow: 'SYSTEM_RESEARCH → HUMAN_DECISION → SYSTEM_CONTINUES'
  };
}

export function buildProjectHumanInputClosureProjection(state = {}) {
  const catalog = catalogForScope(state.scope_key);
  if (!catalog) return {
    schema: 'aurentara.project-human-input-closure-projection.v1',
    scope_key: state.scope_key || null,
    supported: false,
    open_input_count: 0,
    open_inputs: [],
    resolved_inputs: [],
    production_deploy: false
  };
  const resolved = new Map(decisions(state).filter((item) => item.status === 'RESOLVED').map((item) => [item.question_id, item]));
  const open = (catalog.questions || []).filter((question) => !resolved.has(question.id));
  const resolvedInputs = (catalog.questions || []).filter((question) => resolved.has(question.id)).map((question) => ({
    id: question.id,
    question: question.question,
    status: 'RESOLVED',
    decision: clone(resolved.get(question.id))
  }));
  const premiumDiscovery = evaluatePremiumDiscoveryReadiness(state, {
    required_inputs: ['business_identity', 'products_services', 'target_customers', 'primary_conversion'],
    legal_required: true
  });
  const assetReadiness = normalizePremiumAssets(state.assets || {});
  const contract = buildContract(state);
  const approval = humanQualityApproval(state);
  return {
    schema: 'aurentara.project-human-input-closure-projection.v1',
    project_id: state.project_id,
    scope_key: state.scope_key,
    supported: true,
    open_input_count: open.length,
    open_inputs: clone(open),
    resolved_input_count: resolvedInputs.length,
    resolved_inputs: resolvedInputs,
    readiness: {
      source_readiness: { status: contract.ok ? contract.contract.source_readiness : 'NOT_ASSESSED', source: 'CUSTOMER_DELIVERY_CONTRACT_V1' },
      fact_readiness: premiumDiscovery.ok ? premiumDiscovery.projection : premiumDiscovery,
      rights_readiness: { status: contract.ok ? contract.contract.rights_readiness : 'NOT_ASSESSED', source: 'CUSTOMER_DELIVERY_CONTRACT_V1' },
      content_readiness: clone((state.readiness_snapshots || []).at(-1) || null),
      visual_readiness: assetReadiness,
      build_readiness: contract.ok ? contract.readiness : contract,
      human_quality_approval: approval
    },
    customer_delivery_contract: contract.ok ? contract.contract : null,
    efficiency: efficiencyProjection(state, catalog),
    ai_auto_confirmation: false,
    project_scoped: true,
    production_deploy: false,
    public_launch: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  };
}

export function applyProjectHumanDecision(state = {}, input = {}, actor = {}, options = {}) {
  const scopeKey = clean(input.scope_key, 640);
  if (!scopeKey || scopeKey !== state.scope_key) return { ok: false, error: 'PROJECT_HUMAN_DECISION_CROSS_SCOPE_REJECTED', production_deploy: false };
  const catalog = catalogForScope(scopeKey);
  if (!catalog) return { ok: false, error: 'PROJECT_HUMAN_DECISION_CATALOG_NOT_FOUND', production_deploy: false };
  const questionId = clean(input.question_id, 200);
  const question = catalog.questions.find((item) => item.id === questionId);
  if (!question) return { ok: false, error: 'PROJECT_HUMAN_DECISION_QUESTION_NOT_FOUND', production_deploy: false };
  const actorType = clean(actor.type, 80).toUpperCase();
  if (!['HUMAN_OPERATOR', 'CUSTOMER'].includes(actorType)) return { ok: false, error: 'PROJECT_HUMAN_DECISION_ACTOR_REQUIRED', production_deploy: false };
  const at = clean(options.at || input.at, 80) || new Date().toISOString();

  const baseline = syncCanonicalConfirmedFacts(state, at);
  if (!baseline.ok) return baseline;
  const source = ensureHumanSource(baseline.state, at);
  if (!source.ok) return source;
  let next = source.state;
  const submitted = input.controls && typeof input.controls === 'object' ? input.controls : {};
  const normalizedById = {};
  const resultingFactIds = [];
  let usedExistingCandidatesOnly = true;

  for (const control of question.controls || []) {
    const normalized = normalizeControlDecision(control, submitted[control.id] || {});
    if (!normalized.ok) return { ...normalized, question_id: questionId, production_deploy: false };
    normalizedById[control.id] = normalized;
    if (normalized.used_existing_candidate !== true) usedExistingCandidatesOnly = false;
    if (clean(control.field_path, 320)) {
      const verification = actorType === 'CUSTOMER' ? 'CUSTOMER_CONFIRMED' : 'OPERATOR_CONFIRMED';
      const confirmed = confirmFact(next, control, normalized, actor, source.source.source_id, verification, at);
      if (!confirmed.ok) return confirmed;
      next = confirmed.state;
      if (confirmed.fact?.fact_id) resultingFactIds.push(confirmed.fact.fact_id);
    }
  }

  const aggregate = aggregateFactValue(question, normalizedById);
  if (aggregate) {
    const verification = actorType === 'CUSTOMER' ? 'CUSTOMER_CONFIRMED' : 'OPERATOR_CONFIRMED';
    const added = upsertProjectFact(next, {
      field_path: aggregate.field_path,
      value: aggregate.value,
      origin: 'MANUAL',
      verification_status: 'UNVERIFIED',
      source_refs: [source.source.source_id],
      critical: true
    }, { at });
    if (!added.ok) return added;
    const reviewed = reviewProjectFact(added.state, added.fact.fact_id, { verification_status: verification, verified_by: actor.id, at }, { at });
    if (!reviewed.ok) return reviewed;
    next = reviewed.state;
    resultingFactIds.push(reviewed.fact.fact_id);
  }

  if (question.effect === 'ASSET_QUALITY') {
    const approved = normalizedById.asset_quality?.value === true;
    next.assets = (next.assets || []).map((asset) => ({
      ...asset,
      quality_state: approved ? 'VERIFIED' : 'NOT_APPROVED',
      quality_verified_by: actor.id,
      quality_verified_at: at
    }));
  }

  let approval = null;
  if (question.effect === 'HUMAN_APPROVAL') {
    const normalized = normalizedById.human_quality;
    const created = createApprovalRecord({
      customer_id: next.customer_id,
      project_id: next.project_id,
      approval_type: 'FINAL_HUMAN_QUALITY_APPROVAL',
      actor_id: actor.id,
      granted: normalized?.value === true,
      metadata: {
        question_id: questionId,
        actor_type: actorType,
        preview_seen: normalized?.preview_seen === true,
        dogfood: true,
        production_deploy: false
      }
    });
    if (!created.ok) return created;
    approval = created.approval;
  }

  const started = input.interaction_started_at ? new Date(input.interaction_started_at) : null;
  const ended = new Date(at);
  const activeSeconds = started && !Number.isNaN(started.getTime()) && !Number.isNaN(ended.getTime())
    ? Math.max(0, Math.min(3600, Math.round((ended.getTime() - started.getTime()) / 1000)))
    : 0;

  const recorded = recordProjectHumanDecision(next, {
    scope_key: next.scope_key,
    question_id: questionId,
    actor_type: actorType,
    actor_id: actor.id,
    decision: {
      submitted: clone(submitted),
      normalized: clone(normalizedById),
      used_existing_candidates_only: usedExistingCandidatesOnly,
      active_operator_seconds: activeSeconds
    },
    approval,
    resulting_fact_ids: resultingFactIds,
    resulting_state_transition: 'HUMAN_DECISION_RECORDED_READINESS_RECALCULATED',
    status: 'RESOLVED'
  }, { at });
  if (!recorded.ok) return recorded;
  next = recorded.state;

  const content = recordContentReadiness(next, {
    will_show_pricing: true,
    will_show_opening_hours: true,
    will_show_address: true,
    will_show_phone: true,
    will_show_email: true,
    legal_required: true,
    requires_assets: true,
    intended_asset_ids: (next.assets || []).map((asset) => asset.asset_id),
    production_locked: true,
    at
  });
  if (!content.ok) return content;
  next = content.state;

  const projection = buildProjectHumanInputClosureProjection(next);
  next.customer_delivery_contract = clone(projection.customer_delivery_contract);
  next.customer_delivery_contract_readiness = clone(projection.readiness.build_readiness);
  next.human_input_readiness = clone(projection.readiness);
  const row = (next.human_decisions || []).find((item) => item.question_id === questionId);
  if (row) row.resulting_state_transition = `OPEN_INPUTS_${projection.open_input_count}_BUILD_${projection.readiness.build_readiness?.ready_for_build === true ? 'READY' : 'BLOCKED'}`;

  return {
    ok: true,
    state: next,
    decision: clone(row || recorded.decision),
    projection: buildProjectHumanInputClosureProjection(next),
    production_deploy: false,
    public_launch: false,
    dns_changed: false,
    billing_changed: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  };
}

async function loadIntake(service, scopeKey = '') {
  if (!service || typeof service.getProjectSourceIntake !== 'function') return { ok: false, status: 503, body: { error: 'PROJECT_SOURCE_INTAKE_RUNTIME_SERVICE_NOT_AVAILABLE' } };
  return service.getProjectSourceIntake({ scope_key: clean(scopeKey, 640) });
}

async function augmentSourcePayload(response, service, scopeKey) {
  if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('application/json')) return response;
  const catalog = catalogForScope(scopeKey);
  if (!catalog) return response;
  const read = await loadIntake(service, scopeKey);
  if (!read.ok) return response;
  let body = {};
  try { body = await response.clone().json(); } catch { return response; }
  const projection = buildProjectHumanInputClosureProjection(read.body.state);
  body.workspace = body.workspace || { sections: {} };
  body.workspace.sections = body.workspace.sections || {};
  body.workspace.sections.open_inputs = clone(projection.open_inputs);
  body.workspace.sections.resolved_inputs = clone(projection.resolved_inputs);
  body.human_input_closure = projection;
  return json(body, 200, response);
}

async function handleDecision(request, service, auth) {
  const body = await readJson(request);
  const scopeKey = clean(body.scope_key, 640);
  const contextScopeKey = clean(body.context_scope_key, 640);
  if (!scopeKey || (contextScopeKey && contextScopeKey !== scopeKey)) {
    return json({ error: 'PROJECT_HUMAN_DECISION_CONTEXT_MISMATCH', production_deploy: false }, 409);
  }
  const read = await loadIntake(service, scopeKey);
  if (!read.ok) return json(read.body, read.status || 400);
  const applied = applyProjectHumanDecision(read.body.state, body, {
    type: 'HUMAN_OPERATOR',
    id: auth.operator_id
  });
  if (!applied.ok) {
    const status = String(applied.error || '').includes('CROSS_SCOPE') || String(applied.error || '').includes('CONTEXT_MISMATCH') ? 409 : 400;
    return json(applied, status);
  }
  const saved = await service.saveProjectSourceIntake({
    state: applied.state,
    expected_revision: read.body.runtime_revision,
    event: 'PROJECT_HUMAN_INPUT_DECISION_SAVED'
  });
  if (!saved.ok) return json(saved.body, saved.status || 409);
  return json({
    ok: true,
    decision: applied.decision,
    human_input_closure: applied.projection,
    runtime_revision: saved.body.runtime_revision,
    project_scoped: true,
    ai_auto_confirmation: false,
    production_deploy: false,
    public_launch: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  }, 200);
}

function uiInjection() {
  return `<style id="aurentara-dashboard-human-input-closure-v1-style">
.human-input-closure-v1{margin-top:14px}.human-input-summary{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.human-input-question{border:1px solid var(--line);border-radius:12px;padding:13px;margin-top:10px;background:#fff}.human-input-question h3{margin:0 0 6px}.human-input-controls{display:grid;gap:10px;margin-top:11px}.human-input-control{border-top:1px solid var(--soft);padding-top:9px}.human-input-control:first-child{border-top:0;padding-top:0}.human-input-options{display:grid;gap:7px;margin-top:7px}.human-input-option{display:flex;gap:8px;align-items:flex-start}.human-input-option input{margin-top:3px}.human-input-other{margin-top:7px;width:100%}.human-input-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.human-input-status{font-size:12px}.human-input-resolved{margin-top:10px;padding-top:9px;border-top:1px solid var(--soft)}@media(max-width:760px){.human-input-question{padding:14px}.human-input-actions .btn{width:100%;min-height:46px}.human-input-control select,.human-input-control input[type=text]{width:100%;min-height:44px}}
</style><script id="aurentara-dashboard-human-input-closure-v1-ui">(()=>{if(window.__aurentaraHumanInputClosureV1)return;window.__aurentaraHumanInputClosureV1=true;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(path,opt={})=>{const r=await fetch('/operator/api/project-source-intake'+path,opt);const type=r.headers.get('content-type')||'';const d=type.includes('json')?await r.json():{};if(!r.ok){const x=new Error(d?.error||('HTTP_'+r.status));x.data=d;throw x}return d};
const candidate=(item)=>item&&typeof item==='object'&&Object.prototype.hasOwnProperty.call(item,'value')?item.value:item;
const label=(item)=>item&&typeof item==='object'?(item.label??item.value):item;
const renderControl=(q,c)=>{const key=e(q.id+'__'+c.id),type=String(c.type||'').toUpperCase(),items=Array.isArray(c.candidates)?c.candidates:[];let body='';
if(type==='CONFIRMATION'){body='<div class="human-input-options"><label class="human-input-option"><input type="radio" name="'+key+'" value="yes"> Ja, aktuell korrekt</label><label class="human-input-option"><input type="radio" name="'+key+'" value="no"> Nein, korrigieren</label></div><input class="human-input-other" type="text" data-human-correction="'+key+'" placeholder="Korrekte Angabe, falls Nein">';}
else if(type==='SINGLE_CHOICE'){body='<div class="human-input-options">'+items.map((x,i)=>'<label class="human-input-option"><input type="radio" name="'+key+'" value="'+i+'"> '+e(label(x))+'</label>').join('')+(c.allow_other?'<label class="human-input-option"><input type="radio" name="'+key+'" value="other"> Andere Angabe</label>':'')+'</div>'+(c.allow_other?'<input class="human-input-other" type="text" data-human-other="'+key+'" placeholder="Andere Angabe">':'');}
else if(type==='MULTI_CHOICE'){body='<div class="human-input-options">'+items.map((x,i)=>'<label class="human-input-option"><input type="checkbox" data-human-multi="'+key+'" value="'+i+'"> '+e(label(x))+'</label>').join('')+'</div>'+(c.allow_other?'<input class="human-input-other" type="text" data-human-other="'+key+'" placeholder="Weitere Angabe">':'');}
else if(type==='APPROVAL'){body='<div class="human-input-options"><label class="human-input-option"><input type="radio" name="'+key+'" value="yes"> Ja</label><label class="human-input-option"><input type="radio" name="'+key+'" value="no"> Nein</label>'+(c.requires_preview_seen?'<label class="human-input-option"><input type="checkbox" data-human-preview="'+key+'"> Ich habe die tatsächliche Vorschau gesehen.</label>':'')+'</div>';}
return '<div class="human-input-control" data-control-id="'+e(c.id)+'"><strong>'+e(c.label||c.id)+'</strong>'+(c.help?'<div class="small">'+e(c.help)+'</div>':'')+body+'</div>'};
const collect=(card,q)=>{const controls={};for(const c of q.controls||[]){const key=q.id+'__'+c.id,type=String(c.type||'').toUpperCase();if(type==='CONFIRMATION'){const picked=card.querySelector('input[name="'+CSS.escape(key)+'"]:checked');controls[c.id]={confirmed:picked?.value==='yes',correction:card.querySelector('[data-human-correction="'+CSS.escape(key)+'"]')?.value?.trim()||''};if(!picked)delete controls[c.id].confirmed;}
else if(type==='SINGLE_CHOICE'){const picked=card.querySelector('input[name="'+CSS.escape(key)+'"]:checked'),v=picked?.value||'',items=Array.isArray(c.candidates)?c.candidates:[];controls[c.id]=v==='other'?{value:null,other_value:card.querySelector('[data-human-other="'+CSS.escape(key)+'"]')?.value?.trim()||''}:v===''?{}:{value:candidate(items[Number(v)])};}
else if(type==='MULTI_CHOICE'){const items=Array.isArray(c.candidates)?c.candidates:[];const vals=[...card.querySelectorAll('[data-human-multi="'+CSS.escape(key)+'"]:checked')].map(x=>candidate(items[Number(x.value)]));controls[c.id]={values:vals,other_value:card.querySelector('[data-human-other="'+CSS.escape(key)+'"]')?.value?.trim()||''};}
else if(type==='APPROVAL'){const picked=card.querySelector('input[name="'+CSS.escape(key)+'"]:checked');controls[c.id]={approved:picked?.value==='yes',preview_seen:card.querySelector('[data-human-preview="'+CSS.escape(key)+'"]')?.checked===true};if(!picked)delete controls[c.id].approved;}}
return controls};
const render=(root,payload)=>{const closure=payload?.human_input_closure||{},items=closure.open_inputs||[],resolved=closure.resolved_inputs||[];let card=root.querySelector('[data-human-input-closure]');if(!card){card=document.createElement('div');card.className='card human-input-closure-v1';card.dataset.humanInputClosure='true';root.prepend(card)}card.__startedAt=new Date().toISOString();card.innerHTML='<div class="eyebrow">Project Knowledge</div><div class="human-input-summary"><h2 style="margin:0">OPEN INPUTS / DECISIONS</h2><span class="badge '+(items.length?'attention':'ready')+'">OPEN INPUTS: '+e(items.length)+'</span></div>'+(items.length?items.map(q=>'<div class="human-input-question" data-human-question="'+e(q.id)+'"><h3>'+e(q.question)+'</h3><div class="small"><b>Warum benötigt:</b> '+e(q.reason||'Human confirmation required')+'</div><div class="human-input-controls">'+(q.controls||[]).map(c=>renderControl(q,c)).join('')+'</div><div class="human-input-actions"><button class="btn primary" data-human-save="'+e(q.id)+'">Confirm / Save</button><span class="human-input-status" data-human-status="'+e(q.id)+'"></span></div></div>').join(''):'<div class="callout good" style="margin-top:12px"><strong>OPEN INPUTS = 0</strong><div class="small">Alle Human Decisions dieses Projekts wurden beantwortet. Bestehende Readiness- und Quality-Gates bleiben weiterhin autoritativ.</div></div>')+(resolved.length?'<div class="human-input-resolved small"><b>RESOLVED: '+e(resolved.length)+'</b> · '+resolved.map(x=>e(x.id)).join(', ')+'</div>':'');for(const q of items){const qcard=card.querySelector('[data-human-question="'+CSS.escape(q.id)+'"]'),button=qcard?.querySelector('[data-human-save="'+CSS.escape(q.id)+'"]'),status=qcard?.querySelector('[data-human-status="'+CSS.escape(q.id)+'"]');if(!button)continue;button.onclick=async()=>{button.disabled=true;if(status)status.textContent='Speichert…';try{await api('/human-decision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope_key:payload.identity.scope_key,context_scope_key:payload.identity.scope_key,question_id:q.id,controls:collect(qcard,q),interaction_started_at:card.__startedAt})});const fresh=await api('?scope_key='+encodeURIComponent(payload.identity.scope_key));render(root,fresh);if(typeof window.__aurentaraProjectSourceIntakeRefresh==='function')void window.__aurentaraProjectSourceIntakeRefresh(payload.identity.scope_key)}catch(err){if(status)status.textContent='⚠️ '+String(err?.data?.error||err.message||err);if(typeof window.setError==='function')window.setError(err)}finally{button.disabled=false}}}};
const hydrate=async(scope)=>{const sourceRoot=document.querySelector('[data-project-source-intake]');if(!sourceRoot||!scope)return;try{const p=await api('?scope_key='+encodeURIComponent(scope));render(sourceRoot,p)}catch(err){if(typeof window.setError==='function')window.setError(err)}};
const old=window.renderProjectDetail;if(typeof old==='function')window.renderProjectDetail=function(d){old(d);const scope=d?.project?.scope_key;if(scope)setTimeout(()=>hydrate(scope),0)};
})();</script>`;
}

function injectUi(source = '') {
  if (source.includes('aurentara-dashboard-human-input-closure-v1-ui')) return source;
  const ui = uiInjection();
  return source.includes('</body>') ? source.replace('</body>', `${ui}</body>`) : `${source}${ui}`;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  const isDecision = url.pathname === '/operator/api/project-source-intake/human-decision' && request.method === 'POST';
  if (isDecision) {
    const auth = await authorizeOperator(request, env, ctx, options);
    if (!auth.ok) return json({ error: auth.error, private_operator_access_required: true, production_deploy: false }, auth.status || 403);
    if (!options.runtime_service) return json({ error: 'OPERATOR_RUNTIME_DURABILITY_NOT_READY', production_deploy: false }, 503);
    return handleDecision(request, options.runtime_service, auth);
  }

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  if (url.pathname === '/operator/api/project-source-intake' && request.method === 'GET' && options.runtime_service) {
    return augmentSourcePayload(response, options.runtime_service, url.searchParams.get('scope_key'));
  }
  const type = response.headers.get('content-type') || '';
  if ((url.pathname === '/operator' || url.pathname === '/operator/') && response.status === 200 && type.includes('text/html')) {
    const source = await response.text();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('x-aurentara-dashboard-human-input-closure-v1', 'enabled');
    return new Response(injectUi(source), { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}

export function dashboardHumanInputClosureManifest() {
  return {
    schema: 'aurentara.dashboard-human-input-closure.v1',
    existing_masterdashboard_extended: true,
    existing_project_detail_reused: true,
    existing_source_intake_reused: true,
    existing_fact_engine_reused: true,
    existing_readiness_reused: true,
    existing_approval_record_reused: true,
    canonical_human_questions_reused: true,
    cross_project_mutation_blocked: true,
    ai_auto_confirmation: false,
    desktop_and_mobile_controls: true,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_change: false,
    paid_overflow: false,
    paid_provider_calls: 0
  };
}
