import { MEMORY_CATEGORIES } from './contracts-v1.js';
import { prepareHamyrenPostDeliveryContinuationV1 } from './customer-journey-commercial-routing-v1.js';

const OPS = new Set(['SET', 'UPDATE', 'ADD', 'REPLACE', 'DEPRECATE']);
const NOISE = /(?:^|[._:-])(trace|log|logs|provider_response|raw_execution|raw_output)(?:$|[._:-])/i;
const clone = (v) => structuredClone(v ?? null);
const clean = (v, n = 240) => String(v ?? '').trim().slice(0, n);
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
function part(v, n = 24) { return clean(v, 120).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, n) || 'unknown'; }
function mutationId(t, b, m, task, key) {
  return `memory_delivery_${part(m, 18)}_${part(task, 18)}_${part(key, 24)}_${hash(`${t}|${b}|${m}|${task}|${key}`)}`;
}
function sourceRef(m, task, project, key) {
  return clean(`mission.delivery.v1:${m || 'unknown'}:${task || 'unknown'}:${project || 'none'}:${key || 'unknown'}`);
}
function projectId(m = {}, j = {}) {
  return clean(m.project_id || m.project?.project_id || m.project?.project_slug ||
    (typeof m.project === 'string' ? m.project : '') || j.implementation_brief?.project_id, 160) || null;
}
function validate(change = {}) {
  const operation = clean(change.operation || change.mutation, 40).toUpperCase();
  const fact_key = clean(change.fact_key, 160);
  const category = clean(change.category, 80).toUpperCase();
  const component = clean(change.component_status || change.delivery_status || 'COMPLETED', 40).toUpperCase();
  if (!OPS.has(operation)) return { ok: false, error: 'MEMORY_MUTATION_OPERATION_INVALID' };
  if (!fact_key) return { ok: false, error: 'MEMORY_FACT_KEY_REQUIRED' };
  if (!MEMORY_CATEGORIES.includes(category)) return { ok: false, error: 'MEMORY_CATEGORY_INVALID' };
  if (NOISE.test(fact_key)) return { ok: false, error: 'RAW_EXECUTION_NOISE_NOT_MEMORY' };
  if (clean(change.verification_state, 40).toUpperCase() !== 'VERIFIED') return { ok: false, error: 'DELIVERY_CHANGE_NOT_VERIFIED' };
  if (clean(change.approval_state, 40).toUpperCase() !== 'APPROVED') return { ok: false, error: 'DELIVERY_CHANGE_NOT_APPROVED' };
  if (component !== 'COMPLETED') return { ok: false, error: 'DELIVERY_COMPONENT_NOT_COMPLETED' };
  if (!Object.hasOwn(change, 'value')) return { ok: false, error: 'MEMORY_VALUE_REQUIRED' };
  return { ok: true, operation, fact_key, category };
}
function precondition(change, current) {
  return !!current && ((clean(change.supersedes_memory_id, 200) === current.memory_id) ||
    (Object.hasOwn(change, 'expected_previous_value') && same(change.expected_previous_value, current.value)));
}
async function priorMutation(memory, ctx, businessId, factKey, memoryId) {
  const r = await memory.searchMemory(ctx, businessId, { query: factKey, include_historical: true });
  return r?.ok ? { ok: true, fact: r.facts.find((f) => f.memory_id === memoryId) || null } : r;
}
function review(delivery, change, v, reason, current) {
  return { task_id: delivery.task_id || null, capability: delivery.capability || null,
    mutation_key: clean(change.mutation_key || `${v.operation}:${v.fact_key}`, 160), operation: v.operation,
    fact_key: v.fact_key, reason, current_memory_id: current?.memory_id || null,
    current_value: clone(current?.value), proposed_value: clone(change.value) };
}

export async function applyAurentaraDeliveryToHamyrenMemoryV1(input = {}) {
  const { memory, journey, mission = {}, delivery_report = null } = input;
  const ctx = input.ctx || {};
  const businessId = clean(input.business_id || journey?.business_id, 120);
  if (!memory || !['addConfirmedMemory','searchMemory','getBusinessState','getRelevantContext'].every((k) => typeof memory[k] === 'function'))
    return { ok: false, error: 'EXISTING_HAMYREN_MEMORY_REQUIRED', memory_write_performed: false, production_deploy: false };
  if (journey?.schema_version !== 'hamyren-aurentara.customer-journey.v1')
    return { ok: false, error: 'CUSTOMER_JOURNEY_REQUIRED', memory_write_performed: false, production_deploy: false };
  if (!ctx.tenant_id || clean(ctx.tenant_id, 120) !== clean(journey.tenant_id, 120))
    return { ok: false, error: 'TENANT_SCOPE_MISMATCH', memory_write_performed: false, production_deploy: false };
  if (!businessId || businessId !== clean(journey.business_id, 120))
    return { ok: false, error: 'BUSINESS_SCOPE_MISMATCH', memory_write_performed: false, production_deploy: false };

  const c = prepareHamyrenPostDeliveryContinuationV1({ journey, mission, delivery_report });
  if (!c?.ok) return { ok: false, error: c?.error || 'VALID_MISSION_DELIVERY_REQUIRED', memory_write_performed: false, production_deploy: false };
  const before = await memory.getBusinessState(ctx, businessId);
  if (!before?.ok) return { ...before, memory_write_performed: false, production_deploy: false };
  const current = new Map(before.snapshot.current_facts.map((f) => [f.fact_key, f]));
  const missionId = clean(c.delivery_reference?.mission_id || mission.mission_id, 160);
  const project = projectId(mission, journey);
  const applied = [], deduplicated = [], rejected = [], review_required = [];

  for (const delivery of c.business_state_update_candidate?.implemented || []) {
    const changes = Array.isArray(delivery.evidence?.business_state_changes) ? delivery.evidence.business_state_changes : [];
    for (const change of changes) {
      const v = validate(change);
      if (!v.ok) { rejected.push({ task_id: delivery.task_id || null, mutation_key: clean(change.mutation_key || change.fact_key, 160) || null, error: v.error }); continue; }
      const key = clean(change.mutation_key || `${v.operation}:${v.fact_key}`, 160);
      const id = mutationId(ctx.tenant_id, businessId, missionId, delivery.task_id, key);
      const ref = sourceRef(missionId, delivery.task_id, project, key);
      const oldMutation = await priorMutation(memory, ctx, businessId, v.fact_key, id);
      if (!oldMutation?.ok) return { ...oldMutation, memory_write_performed: applied.length > 0, production_deploy: false };
      if (oldMutation.fact) {
        if (oldMutation.fact.source_reference === ref && same(oldMutation.fact.value, change.value)) {
          deduplicated.push({ task_id: delivery.task_id || null, mutation_key: key, fact_key: v.fact_key, memory_id: id, reason: 'IDEMPOTENT_REPLAY' });
          current.set(v.fact_key, oldMutation.fact);
        } else rejected.push({ task_id: delivery.task_id || null, mutation_key: key, fact_key: v.fact_key, error: 'IDEMPOTENCY_KEY_COLLISION' });
        continue;
      }
      const old = current.get(v.fact_key) || null;
      if (old && same(old.value, change.value)) { deduplicated.push({ task_id: delivery.task_id || null, mutation_key: key, fact_key: v.fact_key, memory_id: old.memory_id, reason: 'ALREADY_CURRENT' }); continue; }
      if (v.operation === 'ADD' && old) { review_required.push(review(delivery, change, v, 'ADD_CONFLICTS_WITH_CURRENT_FACT', old)); continue; }
      const replacing = old && ['SET','UPDATE','REPLACE','DEPRECATE'].includes(v.operation);
      if (replacing && !precondition(change, old)) { review_required.push(review(delivery, change, v, 'UPDATE_REQUIRES_REVIEW', old)); continue; }
      if (!old && ['UPDATE','REPLACE','DEPRECATE'].includes(v.operation)) { review_required.push(review(delivery, change, v, 'CURRENT_FACT_REQUIRED', null)); continue; }
      const created = await memory.addConfirmedMemory(ctx, businessId, { memory_id: id, fact_key: v.fact_key,
        subject: clean(change.subject || v.fact_key), value: clone(change.value), category: v.category,
        source_type: 'structured_business_input', source_reference: ref, confidence: 1,
        sensitivity: clean(change.sensitivity || 'normal', 40), created_by: 'aurentara_delivery_memory_feedback_v1',
        confirmation_mechanism: 'trusted_structured_input', supersedes: replacing ? old.memory_id : null,
        previous_status: replacing ? old.status : null, valid_from: clean(change.valid_from, 80) || undefined });
      if (!created?.ok) { rejected.push({ task_id: delivery.task_id || null, mutation_key: key, fact_key: v.fact_key, error: created?.error || 'MEMORY_WRITE_FAILED' }); continue; }
      current.set(v.fact_key, created.fact);
      applied.push({ task_id: delivery.task_id || null, capability: delivery.capability || null, mutation_key: key,
        operation: v.operation, fact_key: v.fact_key, memory_id: created.fact.memory_id,
        supersedes: created.fact.supersedes, source_reference: created.fact.source_reference });
    }
  }

  const targets = clone(c.business_state_update_candidate?.monitoring_targets || []);
  const criteria = clone(c.business_state_update_candidate?.success_criteria || []);
  let monitoring = null;
  const accepted = applied.length > 0 || deduplicated.some((x) => ['IDEMPOTENT_REPLAY','ALREADY_CURRENT'].includes(x.reason));
  if (accepted && (targets.length || criteria.length)) {
    const factKey = `implementation_monitoring:${missionId || 'unknown'}`;
    const key = factKey, id = mutationId(ctx.tenant_id, businessId, missionId, 'monitoring', key);
    const ref = sourceRef(missionId, 'monitoring', project, key);
    const value = { mission_id: missionId || null, project_id: project, monitoring_targets: targets, success_criteria: criteria,
      measurement_state: 'PENDING_MEASUREMENT', delivery_status: c.delivery_reference?.mission_status || null,
      completion_class: c.delivery_reference?.completion_class || null, performance_outcome: null };
    const prior = await priorMutation(memory, ctx, businessId, factKey, id);
    if (!prior?.ok) return { ...prior, memory_write_performed: applied.length > 0, production_deploy: false };
    if (prior.fact && same(prior.fact.value, value)) {
      monitoring = { memory_id: id, deduplicated: true, measurement_state: 'PENDING_MEASUREMENT' };
      deduplicated.push({ task_id: 'monitoring', mutation_key: key, fact_key: factKey, memory_id: id, reason: 'IDEMPOTENT_REPLAY' });
    } else if (prior.fact) review_required.push({ task_id: 'monitoring', mutation_key: key, operation: 'SET', fact_key: factKey,
      reason: 'MONITORING_TARGET_CONFLICT_REQUIRES_REVIEW', current_memory_id: prior.fact.memory_id,
      current_value: clone(prior.fact.value), proposed_value: value });
    else {
      const created = await memory.addConfirmedMemory(ctx, businessId, { memory_id: id, fact_key: factKey,
        subject: `Implementation monitoring targets for ${missionId || 'delivery'}`, value, category: 'GOAL_RELATED',
        source_type: 'structured_business_input', source_reference: ref, confidence: 1,
        created_by: 'aurentara_delivery_memory_feedback_v1', confirmation_mechanism: 'trusted_structured_input' });
      if (created?.ok) { monitoring = { memory_id: id, deduplicated: false, measurement_state: 'PENDING_MEASUREMENT' };
        applied.push({ task_id: 'monitoring', capability: 'monitoring', mutation_key: key, operation: 'ADD', fact_key: factKey,
          memory_id: id, supersedes: null, source_reference: ref }); }
      else rejected.push({ task_id: 'monitoring', mutation_key: key, fact_key: factKey, error: created?.error || 'MONITORING_MEMORY_WRITE_FAILED' });
    }
  }

  const after = await memory.getBusinessState(ctx, businessId);
  if (!after?.ok) return { ...after, memory_write_performed: applied.length > 0, production_deploy: false };
  const q = [journey.customer_goal, ...applied.filter((x) => x.task_id !== 'monitoring').map((x) => x.fact_key),
    ...targets.map((x) => typeof x === 'string' ? x : JSON.stringify(x))].filter(Boolean).join(' ');
  const hc = await memory.getRelevantContext(ctx, businessId, { query: q, max_facts: 20, max_goals: 5, max_decisions: 5 });
  if (!hc?.ok) return { ...hc, memory_write_performed: applied.length > 0, production_deploy: false };
  return { ok: true, schema_version: 'hamyren.aurentara.delivery-memory-feedback.v1', tenant_id: ctx.tenant_id, business_id: businessId,
    delivery_reference: { delivery_version: 'mission.delivery.v1', delivery_ref: `mission.delivery.v1:${missionId || 'unknown'}`,
      mission_id: missionId || null, orchestration_id: c.delivery_reference?.orchestration_id || null, project_id: project,
      mission_status: c.delivery_reference?.mission_status || null, completion_class: c.delivery_reference?.completion_class || null },
    memory_write_performed: applied.length > 0, applied, deduplicated, rejected, review_required,
    monitoring: { targets, success_criteria: criteria, memory: monitoring, performance_outcome_recorded: false },
    business_state: after.snapshot, hamyren_context: hc.context, current_state: c.current_state, new_mission_triggered: false,
    safeguards: { execution_authorized: false, provider_usage_authorized: false, external_writes_authorized: false,
      production_deploy: false, commercial_action_authorized: false, credentials_authorized: false } };
}

export function aurentaraDeliveryMemoryFeedbackManifestV1() {
  return { version: 'hamyren.aurentara.delivery-memory-feedback.v1', source_delivery: 'mission.delivery.v1',
    target_memory: 'existing_hamyren_business_memory', accepted_operations: [...OPS], verification_required: true,
    approval_required: true, component_completion_required: true,
    idempotency: 'stable_existing_memory_id_from_tenant_business_mission_task_mutation',
    provenance: 'mission_delivery_project_mutation_source_reference', raw_execution_logs_persisted: false,
    automatic_execution_authorization: false, automatic_new_mission: false, production_deploy: false };
}
