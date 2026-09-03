import { handleOperatorDashboard as handleExistingOperatorDashboard } from './operator-v1-acceptance-dashboard-v1.js';
import {
  compileUniversalMission,
  analyzeMissionBusiness,
  selectMissionCapabilities,
  buildCapabilityDependencyPlan
} from './universal-mission-run.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const upper = (value) => clean(value, 160).toUpperCase() || 'UNKNOWN';
const asArray = (value) => Array.isArray(value) ? value : [];
const FAILURE_STATES = new Set(['FAILED', 'FAILURE', 'ERROR']);
const BLOCKED_STATES = new Set(['BLOCKED', 'BLOCK', 'LOCKED']);
const ACTIVE_STATES = new Set(['ACTIVE', 'RUNNING', 'QUEUED', 'WAITING', 'RETRYING']);
const COMPLETE_STATES = new Set(['COMPLETED', 'DONE', 'SUCCESS', 'DELIVERY_READY', 'SIMULATED_HANDOFF_READY', 'SYNTHETIC_STAGING_COMPLETED']);
const COST_EVIDENCE_STATES = new Set(['VERIFIED_ACTUAL','ESTIMATED','RESERVED','UNKNOWN','NOT_RECONCILED']);
function costEvidenceState(value, kind = 'actual', explicit = null) {
  const normalized = upper(explicit);
  if (COST_EVIDENCE_STATES.has(normalized)) return normalized;
  if (value === null || value === undefined || value === '') return 'UNKNOWN';
  if (kind === 'estimate') return 'ESTIMATED';
  if (kind === 'reserved') return 'RESERVED';
  return 'VERIFIED_ACTUAL';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function atPath(value, path = []) {
  let current = value;
  for (const key of path) current = current?.[key];
  return current;
}

function firstValue(value, paths = []) {
  for (const path of paths) {
    const candidate = atPath(value, path);
    if (candidate !== undefined && candidate !== null && candidate !== '') return candidate;
  }
  return null;
}

function eventTimes(audit = [], missionId = '') {
  const items = asArray(audit).filter((item) => clean(item?.mission_id, 220) === missionId && item?.at);
  if (!items.length) return { created: null, updated: null };
  const sorted = items.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { created: sorted[0]?.at || null, updated: sorted.at(-1)?.at || null };
}

function approvalState(approvals = {}, audit = [], missionId = '') {
  const pending = asArray(approvals?.mission_plans).find((item) => clean(item?.mission_id, 220) === missionId);
  if (pending) return upper(pending.status || 'APPROVAL_REQUIRED');
  const events = asArray(audit).filter((item) => clean(item?.mission_id, 220) === missionId).map((item) => upper(item?.event));
  if (events.some((item) => item.includes('REJECT'))) return 'REJECTED';
  if (events.some((item) => item.includes('APPROV'))) return 'APPROVED';
  return 'NOT_VERIFIED';
}

function missionKindDetail(detail = {}) {
  const kind = clean(detail?.kind, 80);
  const value = detail?.mission || null;
  if (!value) return null;
  if (kind === 'universal_mission') return { kind: 'UNIVERSAL', run: value };
  if (kind === 'live_staging_mission') return { kind: 'LIVE_STAGING', run: value };
  if (kind === 'durable_mission') return { kind: 'DURABLE', run: value };
  return { kind: upper(kind || 'UNKNOWN'), run: value };
}

function projectUniversalMission(detail, approvals, audit) {
  const run = detail.run || {};
  const mission = run.mission || {};
  const missionId = clean(mission.mission_id, 220);
  const times = eventTimes(audit, missionId);
  const execution = run.execution || {};
  const quality = run.quality || {};
  const delivery = run.delivery || {};
  const preflight = run.preflight || execution.preflight || {};
  return {
    mission_id: missionId || null,
    project: mission.business_name || mission.project_id || null,
    project_id: mission.project_id || null,
    mission_type: 'UNIVERSAL',
    status: upper(delivery.final_delivery_status || execution.status || quality.status),
    created: times.created,
    updated: times.updated,
    estimated_cost_eur: preflight.estimated_variable_cost_eur ?? null,
    estimated_cost_state: costEvidenceState(preflight.estimated_variable_cost_eur ?? null, 'estimate', preflight.estimated_cost_state),
    actual_cost_eur: execution.variable_cost_eur ?? null,
    actual_cost_state: costEvidenceState(execution.variable_cost_eur ?? null, 'actual', execution.actual_cost_state),
    approval_state: approvalState(approvals, audit, missionId),
    execution_state: upper(execution.status),
    quality_state: upper(quality.status),
    quality_score: quality.quality_score ?? null,
    delivery_state: upper(delivery.final_delivery_status),
    mission_input: clone(mission),
    compiled_mission: clone(mission),
    plan: clone(run.plan || null),
    selected_capabilities: clone(run.plan?.selected_capabilities || []),
    factories: [...new Set(asArray(run.plan?.selected_capabilities).map((item) => item.factory).filter(Boolean))],
    providers: [...new Set(asArray(run.plan?.selected_capabilities).flatMap((item) => [item.provider?.primary, item.provider?.fallback]).filter(Boolean))],
    approval_requirements: clone(preflight.approval_summary || []),
    execution: clone(execution),
    quality: clone(quality),
    deliverables: clone(delivery.deliverables || []),
    delivery: clone(delivery),
    errors: clone([...(quality.failures || []), ...(execution.errors || [])].filter(Boolean)),
    evidence: clone(delivery.execution_evidence || null),
    reality: 'SYNTHETIC_RUNTIME_EVIDENCE',
    production_deploy: false
  };
}

function projectLiveMission(detail, approvals, audit) {
  const run = detail.run || {};
  const missionId = clean(run.mission_id, 220);
  const times = eventTimes(audit, missionId);
  return {
    mission_id: missionId || null,
    project: run.business_name || run.scope_key || run.project_id || null,
    project_id: run.project_id || null,
    mission_type: 'LIVE_STAGING',
    status: upper(run.status),
    created: run.created_at || run.started_at || times.created,
    updated: run.updated_at || run.completed_at || times.updated,
    estimated_cost_eur: run.estimated_variable_cost_eur ?? null,
    estimated_cost_state: costEvidenceState(run.estimated_variable_cost_eur ?? null, 'estimate', run.estimated_cost_state),
    actual_cost_eur: run.variable_cost_eur ?? null,
    actual_cost_state: costEvidenceState(run.variable_cost_eur ?? null, 'actual', run.actual_cost_state),
    approval_state: approvalState(approvals, audit, missionId),
    execution_state: upper(run.status),
    quality_state: upper(run.quality?.status || run.quality_state),
    quality_score: run.quality?.quality_score ?? run.quality_score ?? null,
    delivery_state: upper(run.delivery?.status || run.delivery_status),
    mission_input: clone(run.mission || null),
    compiled_mission: clone(run.compiled_mission || null),
    plan: clone(run.plan || null),
    selected_capabilities: clone(run.selected_capabilities || run.plan?.selected_capabilities || []),
    factories: clone(run.factories || []),
    providers: clone([run.provider, ...(run.providers || [])].filter(Boolean)),
    approval_requirements: clone(run.approval_requirements || []),
    execution: clone(run.execution || run),
    quality: clone(run.quality || null),
    deliverables: clone(run.deliverables || run.delivery?.deliverables || []),
    delivery: clone(run.delivery || null),
    errors: clone([run.error, ...(run.errors || [])].filter(Boolean)),
    evidence: clone(run.evidence || run.execution_evidence || null),
    reality: 'LIVE_STAGING_EVIDENCE',
    production_deploy: false
  };
}

function projectDurableMission(detail, approvals, audit) {
  const run = detail.run || {};
  const missionId = clean(run.mission_id, 220);
  const times = eventTimes(audit, missionId);
  return {
    mission_id: missionId || null,
    project: run.business_name || run.project_id || run.scope_key || null,
    project_id: run.project_id || null,
    mission_type: 'DURABLE',
    status: upper(run.status || run.final_status || run.delivery_status),
    created: run.created_at || times.created,
    updated: run.updated_at || times.updated,
    estimated_cost_eur: run.estimated_variable_cost_eur ?? null,
    estimated_cost_state: costEvidenceState(run.estimated_variable_cost_eur ?? null, 'estimate', run.estimated_cost_state),
    actual_cost_eur: run.variable_cost_eur ?? run.actual_cost_eur ?? null,
    actual_cost_state: costEvidenceState(run.variable_cost_eur ?? run.actual_cost_eur ?? null, 'actual', run.actual_cost_state),
    approval_state: approvalState(approvals, audit, missionId),
    execution_state: upper(run.execution_state),
    quality_state: upper(run.quality_state || run.quality?.status),
    quality_score: run.quality_score ?? run.quality?.quality_score ?? null,
    delivery_state: upper(run.delivery_state || run.delivery_status),
    mission_input: clone(run.mission || null),
    compiled_mission: clone(run.compiled_mission || null),
    plan: clone(run.plan || null),
    selected_capabilities: clone(run.selected_capabilities || []),
    factories: clone(run.factories || []),
    providers: clone(run.providers || []),
    approval_requirements: clone(run.approval_requirements || []),
    execution: clone(run.execution || null),
    quality: clone(run.quality || null),
    deliverables: clone(run.deliverables || []),
    delivery: clone(run.delivery || null),
    errors: clone([run.error, ...(run.errors || [])].filter(Boolean)),
    evidence: clone(run.evidence || null),
    reality: 'DURABLE_RUNTIME_EVIDENCE',
    production_deploy: false
  };
}

function projectMissions(details = [], approvals = {}, audit = []) {
  return details.map(missionKindDetail).filter(Boolean).map((detail) => {
    if (detail.kind === 'UNIVERSAL') return projectUniversalMission(detail, approvals, audit);
    if (detail.kind === 'LIVE_STAGING') return projectLiveMission(detail, approvals, audit);
    return projectDurableMission(detail, approvals, audit);
  }).sort((a, b) => String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || '')));
}

function projectExecutions(missions = []) {
  const items = [];
  for (const mission of missions) {
    if (mission.mission_type === 'UNIVERSAL') {
      const results = asArray(mission.execution?.results);
      for (const result of results) {
        items.push({
          execution_id: result.execution_id || null,
          task_id: result.task_id || null,
          mission_id: mission.mission_id,
          project_id: mission.project_id,
          factory: result.factory || null,
          provider: result.provider || null,
          state: upper(result.status),
          started: result.started_at || null,
          completed: result.completed_at || null,
          duration_ms: result.duration_ms ?? null,
          retries: asArray(result.retries).length,
          cost_eur: result.variable_cost_eur ?? result.cost_eur ?? null,
          cost_state: (result.variable_cost_eur ?? result.cost_eur) == null
            ? (mission.actual_cost_eur == null ? 'UNKNOWN' : 'NOT_RECONCILED')
            : costEvidenceState(result.variable_cost_eur ?? result.cost_eur, 'actual', result.cost_state),
          mission_actual_cost_eur: mission.actual_cost_eur,
          mission_actual_cost_state: mission.actual_cost_state,
          result: clone(result.output || result.result || null),
          error: clone(result.error || null),
          retry_evidence: clone(result.retries || []),
          quality: clone(mission.quality || null),
          evidence: clone(mission.evidence || null),
          reality: mission.reality,
          production_deploy: false
        });
      }
      continue;
    }
    const execution = mission.execution;
    if (execution || mission.mission_type === 'LIVE_STAGING') {
      items.push({
        execution_id: execution?.execution_id || execution?.id || null,
        task_id: execution?.task_id || null,
        mission_id: mission.mission_id,
        project_id: mission.project_id,
        factory: execution?.factory || null,
        provider: execution?.provider || firstValue(mission, [['providers', 0]]) || null,
        state: upper(execution?.status || mission.execution_state),
        started: execution?.started_at || null,
        completed: execution?.completed_at || null,
        duration_ms: execution?.duration_ms ?? null,
        retries: asArray(execution?.retries).length,
        cost_eur: execution?.variable_cost_eur ?? execution?.cost_eur ?? null,
        cost_state: (execution?.variable_cost_eur ?? execution?.cost_eur) == null
          ? (mission.actual_cost_eur == null ? 'UNKNOWN' : 'NOT_RECONCILED')
          : costEvidenceState(execution?.variable_cost_eur ?? execution?.cost_eur, 'actual', execution?.cost_state),
        mission_actual_cost_eur: mission.actual_cost_eur,
        mission_actual_cost_state: mission.actual_cost_state,
        result: clone(execution?.result || execution?.output || null),
        error: clone(execution?.error || mission.errors?.[0] || null),
        retry_evidence: clone(execution?.retries || []),
        quality: clone(mission.quality || null),
        evidence: clone(mission.evidence || null),
        reality: mission.reality,
        production_deploy: false
      });
    }
  }
  return items.sort((a, b) => String(b.completed || b.started || '').localeCompare(String(a.completed || a.started || '')));
}

function projectQuality(missions = [], executions = []) {
  return missions.map((mission) => {
    const missionExecutions = executions.filter((item) => item.mission_id === mission.mission_id);
    const providerSwitches = missionExecutions.reduce((count, item) => {
      const retries = asArray(item.retry_evidence);
      if (!retries.length || !item.provider) return count;
      const previous = retries.at(-1)?.provider;
      return count + (previous && previous !== item.provider ? 1 : 0);
    }, 0);
    return {
      mission_id: mission.mission_id,
      project_id: mission.project_id,
      output: clone(mission.deliverables || []),
      quality_score: mission.quality_score,
      quality_state: mission.quality_state,
      validation_result: clone(mission.quality?.checks || null),
      failures: clone(mission.quality?.failures || mission.errors || []),
      repair_attempts: mission.quality?.repair_attempts ?? null,
      provider_switches: providerSwitches,
      final_quality_status: mission.quality_state,
      production_deploy: false
    };
  });
}

function capabilityRegistryProjection() {
  const compiled = compileUniversalMission({
    customer_id: 'operator-functional-introspection',
    project_id: 'operator-functional-introspection',
    business_name: 'Operator Functional Introspection',
    industry: 'synthetic',
    country: 'DE',
    language: 'de',
    mission_text: 'growth marketing go-to-market seo website webseite landingpage crm lead kunde pipeline vertrieb automatis workflow follow-up nachfassen ki chatbot assistent analytics messung',
    business_goals: ['introspect_registered_capabilities'],
    budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
    approval_policy: { external_writes_require_approval: true, production_requires_explicit_approval: true },
    data_policy: { synthetic_only: true, real_customer_data: false },
    environment: 'staging',
    production_authorized: false
  });
  if (!compiled.ok) return { source: 'universal_mission_router', status: 'FAILED', items: [] };
  const analysis = analyzeMissionBusiness(compiled.mission);
  const selection = selectMissionCapabilities(compiled.mission, analysis);
  const plan = buildCapabilityDependencyPlan(compiled.mission, selection);
  return {
    source: 'universal_mission_router',
    status: 'REGISTERED',
    items: asArray(plan.selected_capabilities).map((task) => ({
      capability: task.capability,
      factory: task.factory,
      status: 'REGISTERED',
      provider_primary: task.provider?.primary || null,
      provider_fallback: task.provider?.fallback || null,
      provider_status: 'NOT_VERIFIED',
      dependencies: clone(task.dependencies || []),
      requirements: clone(task.approval_requirements || []),
      quality_criteria: clone(task.quality_criteria || []),
      expected_deliverable: task.expected_deliverable || null,
      estimated_variable_cost_eur: task.provider?.estimated_variable_cost_eur ?? null,
      execution_mode: task.provider?.execution_mode || null,
      production_deploy: false
    }))
  };
}

function providerEvidenceRows(matrix = {}, path = [], depth = 0) {
  if (depth > 5 || matrix === null || matrix === undefined) return [];
  if (Array.isArray(matrix)) return matrix.flatMap((item, index) => providerEvidenceRows(item, [...path, String(index)], depth + 1));
  if (typeof matrix !== 'object') return [];
  const keys = Object.keys(matrix);
  const providerish = ['status', 'state', 'health', 'readiness', 'availability', 'credentials_state', 'cost_mode', 'environment', 'capabilities', 'restrictions', 'blockers', 'gate'];
  const rows = [];
  if (keys.some((key) => providerish.includes(key))) {
    rows.push({
      name: clean(matrix.name || matrix.provider || path.at(-1), 200) || 'unknown',
      path: path.join('.'),
      evidence: clone(matrix)
    });
  }
  for (const [key, value] of Object.entries(matrix)) {
    if (value && typeof value === 'object') rows.push(...providerEvidenceRows(value, [...path, key], depth + 1));
  }
  return rows;
}

function providerStateFromEvidence(evidence = {}) {
  const text = [evidence.status, evidence.state, evidence.health, evidence.readiness, evidence.availability, evidence.gate, ...(evidence.restrictions || []), ...(evidence.blockers || [])]
    .filter(Boolean).join(' ').toUpperCase();
  if (!text) return 'NOT_VERIFIED';
  if (text.includes('CREDENTIAL') && (text.includes('REQUIRED') || text.includes('MISSING') || text.includes('GATE'))) return 'CREDENTIAL_REQUIRED';
  if (text.includes('BUDGET') && (text.includes('REQUIRED') || text.includes('GATE') || text.includes('BLOCK'))) return 'BUDGET_GATE';
  if (text.includes('PERMISSION') && (text.includes('REQUIRED') || text.includes('GATE') || text.includes('BLOCK'))) return 'PERMISSION_GATE';
  if (text.includes('UNAVAILABLE') || text.includes('OFFLINE') || text.includes('FAILED')) return 'UNAVAILABLE';
  if (text.includes('PRODUCTION') && (text.includes('DISABLED') || text.includes('LOCKED'))) return 'PRODUCTION_DISABLED';
  if (text.includes('STAGING') && (text.includes('VERIFIED') || text.includes('READY') || text.includes('AVAILABLE'))) return 'STAGING_ONLY';
  if (text.includes('AVAILABLE') || text.includes('VERIFIED') || text.includes('READY') || text.includes('HEALTHY')) return 'AVAILABLE';
  return 'NOT_VERIFIED';
}

function projectProviders(providerOps = {}, capabilities = {}, executions = []) {
  const rows = providerEvidenceRows(providerOps.activation_matrix || {});
  const byName = new Map();
  const upsert = (name, patch = {}) => {
    const key = clean(name, 200);
    if (!key) return;
    const current = byName.get(key) || {
      name: key,
      category: null,
      status: 'NOT_VERIFIED',
      environment: 'NOT_VERIFIED',
      credentials_state: 'NOT_VERIFIED',
      health: 'NOT_VERIFIED',
      cost_mode: 'NOT_VERIFIED',
      last_successful_call: null,
      last_failure: null,
      capabilities: [],
      current_restrictions: ['PRODUCTION_DISABLED'],
      credentials_exposed: false,
      production_deploy: false
    };
    byName.set(key, { ...current, ...patch, capabilities: [...new Set([...(current.capabilities || []), ...(patch.capabilities || [])])], current_restrictions: [...new Set([...(current.current_restrictions || []), ...(patch.current_restrictions || [])])] });
  };

  for (const row of rows) {
    const evidence = row.evidence || {};
    upsert(row.name, {
      category: evidence.category || evidence.kind || null,
      status: providerStateFromEvidence(evidence),
      environment: evidence.environment || 'NOT_VERIFIED',
      credentials_state: evidence.credentials_state || evidence.credentials || 'NOT_VERIFIED',
      health: evidence.health || evidence.health_status || 'NOT_VERIFIED',
      cost_mode: evidence.cost_mode || evidence.cost || 'NOT_VERIFIED',
      capabilities: asArray(evidence.capabilities),
      current_restrictions: [...asArray(evidence.restrictions), ...asArray(evidence.blockers)].map((item) => typeof item === 'string' ? item : JSON.stringify(item))
    });
  }

  for (const capability of asArray(capabilities.items)) {
    for (const provider of [capability.provider_primary, capability.provider_fallback].filter(Boolean)) {
      upsert(provider, {
        category: 'capability_route',
        cost_mode: capability.estimated_variable_cost_eur === 0 ? 'ZERO_COST_STAGING_ROUTE' : 'NOT_VERIFIED',
        capabilities: [capability.capability],
        current_restrictions: capability.requirements || []
      });
    }
  }

  for (const runtime of asArray(providerOps.active_runtime_providers)) {
    upsert(runtime.name, {
      category: 'runtime_route',
      status: runtime.reality === 'SYNTHETIC_ROUTE_ONLY' ? 'STAGING_ONLY' : 'NOT_VERIFIED',
      environment: 'staging',
      cost_mode: runtime.variable_cost_eur === 0 ? 'ZERO_COST_STAGING_ROUTE' : 'NOT_VERIFIED'
    });
  }

  for (const execution of executions) {
    if (!execution.provider) continue;
    if (COMPLETE_STATES.has(execution.state) && execution.completed) upsert(execution.provider, { last_successful_call: execution.completed });
    if (FAILURE_STATES.has(execution.state) && (execution.completed || execution.started)) upsert(execution.provider, { last_failure: execution.completed || execution.started });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function healthAlerts(systemHealth = {}) {
  const signals = systemHealth.signals || {};
  const candidates = [
    ['Core CI', signals.core_ci],
    ['Integrated Regression', signals.integrated_regression_gate],
    ['Dashboard CI', signals.dashboard_ci],
    ['Universal Mission CI', signals.universal_mission_ci],
    ['Factory Readiness', signals.factory_readiness],
    ['Provider Evidence', signals.provider_evidence_freshness],
    ['Runtime Persistence', signals.runtime_persistence],
    ['Staging Availability', signals.staging_availability],
    ['Activation Readiness', signals.activation_readiness],
    ['Production Readiness', signals.production_readiness]
  ];
  return candidates.flatMap(([name, value]) => {
    const state = upper(value?.status || value?.raw);
    if (state === 'HEALTHY') return [];
    if (!value || state === 'UNKNOWN' || state === 'NOT_VERIFIED') return [{ key: `health:${name}`, severity: 'UNKNOWN', what: `${name}: NOT_VERIFIED`, why: value?.label || 'No authoritative evidence was returned for this dimension.', impact: 'Operator cannot claim this dimension is healthy or ready.', next_action: 'Open System Health and inspect the authoritative evidence source.' }];
    const severity = ['FAILED','FAILURE','ERROR'].includes(state) ? 'FAILED' : state === 'BLOCKED' ? 'BLOCKED' : 'ACTION_REQUIRED';
    return [{ key: `health:${name}`, severity, what: `${name}: ${state}`, why: value.label || 'Health state requires attention.', impact: 'This dimension may limit or block operator work.', next_action: 'Open System Health and resolve the reported dependency.' }];
  });
}

function buildAlerts({ missions = [], executions = [], quality = [], approvals = {}, systemHealth = {}, sources = {}, audit = [] } = {}) {
  const alerts = [];
  const push = (item) => alerts.push({ production_deploy: false, ...item });

  for (const [name, source] of Object.entries(sources)) {
    if (source.ok) continue;
    push({ key: `source:${name}`, severity: 'UNKNOWN', what: `${name} data unavailable`, why: source.error || `HTTP ${source.status || 'UNKNOWN'}`, impact: 'The dashboard cannot claim a healthy or complete state for this area.', next_action: `Refresh ${name} and inspect the source API if the error persists.` });
  }

  for (const approval of asArray(approvals.mission_plans)) {
    if (!['APPROVAL_REQUIRED', 'DEFERRED'].includes(upper(approval.status))) continue;
    push({ key: `approval:${approval.plan_token}`, severity: 'ACTION_REQUIRED', what: `Approval required: ${approval.mission_id || approval.business_name || 'Mission plan'}`, why: approval.risk || 'Mission plan requires explicit operator approval.', impact: 'Execution remains paused until an operator decision is recorded.', next_action: 'Open Approvals and approve, reject, or defer using the existing approval control.' });
  }

  for (const mission of missions) {
    if (FAILURE_STATES.has(mission.status)) push({ key: `mission:${mission.mission_id}:failed`, severity: 'FAILED', what: `Mission failed: ${mission.mission_id}`, why: mission.errors?.[0] || 'Mission runtime reports FAILED.', impact: 'Mission delivery is not complete.', next_action: 'Open Missions, inspect execution and quality evidence, then resolve the reported cause.' });
    else if (BLOCKED_STATES.has(mission.status) || BLOCKED_STATES.has(mission.quality_state)) push({ key: `mission:${mission.mission_id}:blocked`, severity: 'BLOCKED', what: `Mission blocked: ${mission.mission_id}`, why: mission.errors?.[0] || `Runtime state ${mission.status}.`, impact: 'Mission cannot progress to a valid delivery.', next_action: 'Open Missions and resolve the blocking approval, provider, quality, or dependency state.' });
  }

  for (const execution of executions) {
    if (FAILURE_STATES.has(execution.state)) push({ key: `execution:${execution.execution_id || execution.task_id || execution.mission_id}:failed`, severity: 'FAILED', what: `Execution failed: ${execution.execution_id || execution.task_id || execution.mission_id}`, why: execution.error || 'Execution runtime reports FAILED.', impact: 'The related capability did not complete successfully.', next_action: 'Open Executions and inspect retry/error evidence. No automatic retry is exposed unless supported by Core.' });
    else if (BLOCKED_STATES.has(execution.state)) push({ key: `execution:${execution.execution_id || execution.task_id || execution.mission_id}:blocked`, severity: 'BLOCKED', what: `Execution blocked: ${execution.execution_id || execution.task_id || execution.mission_id}`, why: execution.error || 'Execution runtime reports BLOCKED.', impact: 'The related mission cannot complete this execution step.', next_action: 'Open Executions and resolve the reported dependency or gate.' });
  }

  for (const item of quality) {
    if (['BLOCK', 'FAILED', 'FAIL'].includes(upper(item.quality_state))) push({ key: `quality:${item.mission_id}`, severity: 'BLOCKED', what: `Quality gate failed: ${item.mission_id}`, why: asArray(item.failures).join(', ') || 'Quality runtime reports a blocking state.', impact: 'Delivery must not be treated as complete.', next_action: 'Open Quality and inspect validation failures before any delivery action.' });
  }

  for (const item of healthAlerts(systemHealth)) push(item);

  for (const [index, event] of asArray(audit).entries()) {
    const text = `${event.event || ''} ${event.type || ''}`.toUpperCase();
    if (!text.includes('BUDGET') || !(text.includes('BLOCK') || text.includes('DENIED') || text.includes('GATE'))) continue;
    push({ key: `budget:${event.at || index}`, severity: 'BLOCKED', what: 'Execution blocked by budget policy', why: event.event || event.type || 'Budget gate event', impact: 'A paid or above-limit action was not allowed to proceed.', next_action: 'Open Costs and review the existing budget/approval policy before changing any limit.' });
  }

  const unique = new Map();
  for (const alert of alerts) if (!unique.has(alert.key)) unique.set(alert.key, alert);
  const rank = { FAILED: 0, BLOCKED: 1, ACTION_REQUIRED: 2, UNKNOWN: 3 };
  return [...unique.values()].sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}

function costSignals(costs = {}, audit = []) {
  const budgetEvents = asArray(audit).filter((event) => /BUDGET/i.test(`${event.event || ''} ${event.type || ''}`) && /(BLOCK|DENIED|GATE)/i.test(`${event.event || ''} ${event.type || ''}`));
  const daily = costs.daily_cost_eur ?? null;
  const monthly = costs.monthly_cost_eur ?? null;
  const variable = costs.variable_cost_eur ?? costs.spent_eur ?? null;
  const normalizedVariableState = upper(costs.variable_cost_state);
  const variableState = normalizedVariableState === 'ESTIMATED_ZERO' ? 'ESTIMATED'
    : COST_EVIDENCE_STATES.has(normalizedVariableState) ? normalizedVariableState
      : costEvidenceState(variable, 'actual');
  return {
    mission_estimates_source: 'mission_preflight',
    mission_actuals_source: 'execution_runtime',
    provider_cost_source: 'operator_cost_center',
    daily_cost_eur: daily,
    monthly_cost_eur: monthly,
    daily_cost_state: costEvidenceState(daily, 'actual', costs.daily_cost_state),
    monthly_cost_state: costEvidenceState(monthly, 'actual', costs.monthly_cost_state),
    variable_cost_eur: variable,
    variable_cost_state: variableState,
    development_ceiling_eur: costs.development_ceiling_eur ?? null,
    remaining_development_budget_eur: costs.remaining_development_budget_eur ?? null,
    mission_variable_budget_ceiling_eur: 0,
    mission_variable_budget_state: 'RESERVED',
    blocked_by_budget_events: clone(budgetEvents),
    paid_execution_authorized: costs.paid_execution_authorized === true,
    production_deploy: false
  };
}

function sourceStatus(source = {}) {
  return { ok: source.ok === true, status: source.status || null, error: source.error || null };
}

export function buildFunctionalCompletionProjection({ source_results = {}, mission_details = [] } = {}) {
  const source = (name) => source_results[name]?.body || {};
  const audit = asArray(source('audit').items);
  const approvals = source('approvals');
  const missions = projectMissions(mission_details, approvals, audit);
  const executions = projectExecutions(missions);
  const quality = projectQuality(missions, executions);
  const capabilities = capabilityRegistryProjection();
  const providers = projectProviders(source('providers'), capabilities, executions);
  const alerts = buildAlerts({ missions, executions, quality, approvals, systemHealth: source('system_health'), sources: Object.fromEntries(Object.entries(source_results).map(([key, value]) => [key, sourceStatus(value)])), audit });
  const critical = alerts.filter((item) => ['FAILED', 'BLOCKED'].includes(item.severity));
  const pendingApprovals = asArray(approvals.mission_plans).filter((item) => ['APPROVAL_REQUIRED', 'DEFERRED'].includes(upper(item.status))).length + Number(approvals.core?.pending_count || 0);
  const failedMissions = missions.filter((item) => FAILURE_STATES.has(item.status)).length;
  const blockedMissions = missions.filter((item) => BLOCKED_STATES.has(item.status) || BLOCKED_STATES.has(item.quality_state)).length;
  const activeMissions = missions.filter((item) => ACTIVE_STATES.has(item.status) || ACTIVE_STATES.has(item.execution_state)).length;
  const sourceUnknown = Object.values(source_results).some((item) => item.ok !== true);
  const overallState = failedMissions || executions.some((item) => FAILURE_STATES.has(item.state)) ? 'FAILED'
    : blockedMissions || critical.length ? 'BLOCKED'
      : pendingApprovals ? 'ACTION_REQUIRED'
        : sourceUnknown ? 'UNKNOWN' : 'NORMAL';

  return {
    schema: 'riosystems.operator-functional-completion.v1',
    source_of_truth: 'existing_operator_runtime_and_core_projections',
    generated_at: new Date().toISOString(),
    summary: {
      operator_state: overallState,
      active_missions: activeMissions,
      pending_approvals: pendingApprovals,
      failed_missions: failedMissions,
      blocked_missions: blockedMissions,
      recent_executions: executions.slice(0, 8),
      variable_cost_eur: source('costs').variable_cost_eur ?? source('costs').spent_eur ?? null,
      variable_cost_state: costSignals(source('costs'), audit).variable_cost_state,
      provider_counts: providers.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}),
      factory_count: asArray(source('factories').items).length,
      deliverable_count: asArray(source('deliveries').universal_missions).length + asArray(source('deliveries').durable_missions).length + asArray(source('deliveries').live_staging_executions).length,
      critical_alerts: critical.length
    },
    source_health: Object.fromEntries(Object.entries(source_results).map(([key, value]) => [key, sourceStatus(value)])),
    projects: clone(source('projects')),
    missions,
    approvals: clone(approvals),
    executions,
    factories: clone(source('factories')),
    capabilities,
    providers,
    costs: clone(source('costs')),
    cost_signals: costSignals(source('costs'), audit),
    quality,
    deliverables: clone(source('deliveries')),
    alerts,
    system_health: clone(source('system_health')),
    activity: clone(source('audit')),
    actions: clone(source('actions')),
    truth_rules: {
      unknown_is_not_zero: true,
      null_timing_is_not_inferred: true,
      cost_evidence_states_explicit: true,
      authoritative_health_signals_only: true,
      unknown_is_not_healthy: true,
      unsupported_actions_exposed: false,
      secrets_exposed: false,
      duplicate_core_engines: false
    },
    safety: {
      production: 'OFF',
      external_writes: 'OFF',
      real_customer_data: 'NONE',
      additional_variable_cost_eur: 0
    },
    production_deploy: false
  };
}

async function internalGet(request, env, ctx, options, path) {
  const url = new URL(request.url);
  url.pathname = `/operator/api${path}`;
  url.search = '';
  const probe = new Request(url.toString(), { method: 'GET', headers: request.headers });
  try {
    const response = await handleExistingOperatorDashboard(probe, env, ctx, options);
    if (!response) return { ok: false, status: 404, error: 'OPERATOR_SOURCE_ROUTE_NOT_FOUND', body: {} };
    const body = await response.clone().json().catch(() => ({}));
    return { ok: response.ok, status: response.status, error: response.ok ? null : (body.error || `HTTP_${response.status}`), body };
  } catch (error) {
    return { ok: false, status: 500, error: clean(error?.message || error, 500) || 'OPERATOR_SOURCE_READ_FAILED', body: {} };
  }
}

function missionIdsFromList(body = {}) {
  return [...new Set([
    ...asArray(body.universal).map((item) => item?.mission_id),
    ...asArray(body.live_staging).map((item) => item?.mission_id),
    ...asArray(body.durable).map((item) => item?.mission_id)
  ].filter(Boolean))];
}

async function functionalResponse(request, env, ctx, options = {}) {
  const authProbe = await internalGet(request, env, ctx, options, '/health');
  if (!authProbe.ok) return json(authProbe.body || { error: authProbe.error, production_deploy: false }, authProbe.status || 503);

  const names = {
    dashboard: '/dashboard',
    projects: '/projects',
    missions: '/missions',
    approvals: '/approvals',
    factories: '/factories',
    providers: '/providers',
    costs: '/costs',
    deliveries: '/deliveries',
    system_health: '/system-health',
    audit: '/audit',
    actions: '/actions'
  };
  const pairs = await Promise.all(Object.entries(names).map(async ([name, path]) => [name, await internalGet(request, env, ctx, options, path)]));
  const sourceResults = Object.fromEntries(pairs);
  const ids = missionIdsFromList(sourceResults.missions?.body || {});
  const missionDetails = (await Promise.all(ids.map(async (missionId) => {
    const result = await internalGet(request, env, ctx, options, `/missions/${encodeURIComponent(missionId)}`);
    return result.ok ? result.body : null;
  }))).filter(Boolean);
  return json(buildFunctionalCompletionProjection({ source_results: sourceResults, mission_details: missionDetails }));
}

const FUNCTIONAL_SCRIPT = String.raw`<script>
(() => {
  if (window.__aurentaraFunctionalV1) return;
  window.__aurentaraFunctionalV1 = true;
  Object.assign(STATUS_MAP, {
    NORMAL:['Normal','ready'], ACTION_REQUIRED:['Action required','attention'], REGISTERED:['Registered','ready'],
    QUEUED:['Queued','neutral'], WAITING:['Waiting','attention'], APPROVED:['Approved','ready'], REJECTED:['Rejected','blocked'],
    CREDENTIAL_REQUIRED:['Credential required','attention'], BUDGET_GATE:['Budget gate','attention'], PERMISSION_GATE:['Permission gate','attention'],
    UNAVAILABLE:['Unavailable','blocked'], STAGING_ONLY:['Staging only','active'], PRODUCTION_DISABLED:['Production disabled','neutral'],
    BLOCK:['Blocked','blocked'], VERIFIED:['Verified','ready']
  });

  const desiredNav = [
    ['hq','Overview'],['projects','Projects'],['missions','Missions'],['mission','Mission Studio'],['approvals','Approvals'],['deliveries','Deliverables'],
    ['executions','Executions'],['factories','Factories'],['capabilities','Capabilities'],['providers','Providers'],
    ['costs','Costs'],['quality','Quality'],['alerts','Blockers / Alerts'],['health','System Health'],['audit','Activity'],['settings','Settings']
  ];
  NAV.splice(0, NAV.length, ...desiredNav);
  const nav = document.querySelector('.nav');
  if (nav) {
    nav.innerHTML = '';
    NAV.forEach(([id,label],i) => { const b=document.createElement('button'); b.textContent=label; b.dataset.goto=id; if((state.section||'hq')===id || (!state.section&&i===0)) b.className='active'; nav.appendChild(b); });
  }
  for (const id of ['missions','executions','capabilities','quality','alerts']) {
    if (document.getElementById(id)) continue;
    const section=document.createElement('section'); section.id=id; section.className='section'; document.querySelector('.main')?.appendChild(section);
  }

  const topActions = document.querySelector('.top .actions');
  if (topActions && !document.getElementById('functional-quick-jump')) {
    const select=document.createElement('select');
    select.id='functional-quick-jump'; select.className='filter-control'; select.setAttribute('aria-label','Quick Jump');
    select.style.maxWidth='260px'; select.innerHTML='<option value="">Quick Jump…</option>';
    topActions.prepend(select);
    select.onchange=()=>{ const [section]=String(select.value||'').split('|'); if(section) go(section); select.value=''; };
  }

  const baseRender = render;
  render = function(id) {
    baseRender(id);
    if (id === 'hq') renderFunctionalOverview();
    if (id === 'missions') renderFunctionalMissions();
    if (id === 'executions') renderFunctionalExecutions();
    if (id === 'capabilities') renderFunctionalCapabilities();
    if (id === 'providers') renderFunctionalProviders();
    if (id === 'costs') renderFunctionalCosts();
    if (id === 'quality') renderFunctionalQuality();
    if (id === 'alerts') renderFunctionalAlerts();
    if (id === 'health') renderFunctionalHealth();
  };

  const f = () => state.data.functional || {};
  const maybeMoney = (value) => value === null || value === undefined ? 'UNKNOWN' : fmtMoney(value);
  const list = (value) => Array.isArray(value) ? value : [];
  const noData = (text) => '<div class="empty">'+esc(text)+'</div>';
  const missionStatusGroup = (m) => {
    const s=String(m.status||'UNKNOWN').toUpperCase(), e=String(m.execution_state||'UNKNOWN').toUpperCase(), a=String(m.approval_state||'UNKNOWN').toUpperCase();
    if (['FAILED','FAILURE','ERROR'].includes(s)||['FAILED','FAILURE','ERROR'].includes(e)) return 'failed';
    if (['BLOCKED','BLOCK','LOCKED'].includes(s)||['BLOCKED','BLOCK','LOCKED'].includes(m.quality_state)) return 'blocked';
    if (a==='APPROVAL_REQUIRED'||a==='DEFERRED') return 'approval_required';
    if (['RUNNING','ACTIVE','QUEUED','WAITING','RETRYING'].includes(e)||['RUNNING','ACTIVE','QUEUED','WAITING','RETRYING'].includes(s)) return 'running';
    if (['COMPLETED','DONE','SUCCESS','DELIVERY_READY','SIMULATED_HANDOFF_READY','SYNTHETIC_STAGING_COMPLETED'].includes(s)) return 'completed';
    return 'pending';
  };

  function renderFunctionalOverview() {
    const root=document.getElementById('hq'); if(!root) return;
    root.querySelector('[data-functional-overview]')?.remove();
    const data=f(), s=data.summary;
    if(!s) return;
    const card=document.createElement('div'); card.className='card'; card.dataset.functionalOverview='true'; card.style.marginBottom='14px';
    const providers=Object.entries(s.provider_counts||{}).map(([k,v])=>esc(k)+': '+esc(v)).join(' · ') || 'UNKNOWN';
    card.innerHTML='<div class="row"><div><div class="eyebrow">Operational truth</div><h2 style="margin:3px 0">Command Center</h2><div class="small">Reale Core-/Runtime-Projektion. UNKNOWN bleibt UNKNOWN.</div></div>'+badge(s.operator_state)+'</div>'+
      '<div class="grid three"><div class="kv"><b>Active Missions</b><span>'+esc(s.active_missions??'UNKNOWN')+'</span></div><div class="kv"><b>Pending Approvals</b><span>'+esc(s.pending_approvals??'UNKNOWN')+'</span></div><div class="kv"><b>Failed / Blocked</b><span>'+esc((s.failed_missions||0)+(s.blocked_missions||0))+'</span></div></div>'+
      '<div class="grid three"><div class="kv"><b>Variable Cost</b><span>'+esc(maybeMoney(s.variable_cost_eur))+'</span></div><div class="kv"><b>Providers</b><span class="small">'+providers+'</span></div><div class="kv"><b>Critical Alerts</b><span>'+esc(s.critical_alerts??'UNKNOWN')+'</span></div></div>'+
      '<div class="row"><div><strong>Recent Executions</strong><div class="small">'+esc(list(s.recent_executions).slice(0,3).map(x=>x.task_id||x.execution_id||x.mission_id).filter(Boolean).join(' · ')||'Keine Runtime-Evidence')+'</div></div><button class="btn" data-goto="executions">Open</button></div>'+
      '<div class="row"><div><strong>Operator Intervention</strong><div class="small">'+esc((data.alerts||[])[0]?.what||'No observed action required in current evidence')+'</div></div><button class="btn" data-goto="alerts">Inspect</button></div>';
    root.prepend(card);
  }

  function renderFunctionalMissions() {
    const root=document.getElementById('missions'); if(!root) return;
    const data=f(), items=list(data.missions), filter=state.functionalMissionFilter||'all';
    const filtered=filter==='all'?items:items.filter(m=>missionStatusGroup(m)===filter);
    root.innerHTML='<div class="card"><div class="row"><div><h2>Missions</h2><div class="small">Mission Input → Plan → Approval → Execution → Quality → Delivery</div></div><select id="functional-mission-filter" class="filter-control" style="max-width:220px">'+
      [['all','All'],['running','Running'],['approval_required','Approval required'],['completed','Completed'],['failed','Failed'],['blocked','Blocked'],['pending','Pending']].map(([v,l])=>'<option value="'+v+'" '+(filter===v?'selected':'')+'>'+l+'</option>').join('')+'</select></div>'+
      (filtered.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Mission</th><th>Project</th><th>Type</th><th>Status</th><th>Cost</th><th>Approval</th><th>Quality</th><th>Delivery</th></tr></thead><tbody>'+filtered.map(m=>'<tr><td><strong class="mono">'+esc(m.mission_id||'UNKNOWN')+'</strong><div class="small">'+esc(fmtDate(m.updated||m.created))+'</div></td><td>'+esc(m.project||m.project_id||'UNKNOWN')+'</td><td>'+esc(m.mission_type)+'</td><td>'+badge(m.status)+'</td><td>'+esc(maybeMoney(m.actual_cost_eur))+'</td><td>'+badge(m.approval_state)+'</td><td>'+badge(m.quality_state)+'<div class="small">Score '+esc(m.quality_score??'UNKNOWN')+'</div></td><td>'+badge(m.delivery_state)+'</td></tr><tr><td colspan="8"><details class="details"><summary>Open mission lifecycle</summary><div class="grid three"><div class="kv"><b>Execution</b><span>'+esc(m.execution_state)+'</span></div><div class="kv"><b>Estimated Cost</b><span>'+esc(maybeMoney(m.estimated_cost_eur))+'</span></div><div class="kv"><b>Reality</b><span>'+esc(m.reality)+'</span></div></div><h3>Plan / Capabilities / Providers</h3><pre>'+esc(JSON.stringify({plan:m.plan,selected_capabilities:m.selected_capabilities,factories:m.factories,providers:m.providers,approval_requirements:m.approval_requirements},null,2))+'</pre><h3>Execution / Quality / Delivery</h3><pre>'+esc(JSON.stringify({execution:m.execution,quality:m.quality,deliverables:m.deliverables,delivery:m.delivery,evidence:m.evidence,errors:m.errors},null,2))+'</pre><h3>Mission Input / Compiled Mission</h3><pre>'+esc(JSON.stringify({mission_input:m.mission_input,compiled_mission:m.compiled_mission},null,2))+'</pre></details></td></tr>').join('')+'</tbody></table></div>':noData('Keine Missionen in diesem Filter.'))+'</div>';
    const selector=document.getElementById('functional-mission-filter'); if(selector) selector.onchange=e=>{state.functionalMissionFilter=e.target.value;renderFunctionalMissions();};
  }

  function renderFunctionalExecutions() {
    const root=document.getElementById('executions'); if(!root) return; const items=list(f().executions);
    root.innerHTML='<div class="card"><h2>Executions</h2><div class="small">Keine erfundenen Execution IDs. Fehlt eine Core-ID, bleibt sie UNKNOWN und der echte Task-Key wird gezeigt.</div>'+
      (items.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Execution / Task</th><th>Mission</th><th>Factory</th><th>Provider</th><th>State</th><th>Retries</th><th>Cost</th></tr></thead><tbody>'+items.map(x=>'<tr><td><strong class="mono">'+esc(x.execution_id||x.task_id||'UNKNOWN')+'</strong><div class="small">'+esc(x.execution_id?'Execution ID':'Task reference')+'</div></td><td class="mono">'+esc(x.mission_id||'UNKNOWN')+'</td><td>'+esc(x.factory||'UNKNOWN')+'</td><td>'+esc(x.provider||'UNKNOWN')+'</td><td>'+badge(x.state)+'</td><td>'+esc(x.retries??'UNKNOWN')+'</td><td>'+esc(maybeMoney(x.cost_eur))+'</td></tr><tr><td colspan="7"><details class="details"><summary>Execution evidence</summary><pre>'+esc(JSON.stringify({started:x.started,completed:x.completed,duration_ms:x.duration_ms,result:x.result,error:x.error,retry_evidence:x.retry_evidence,quality:x.quality,evidence:x.evidence,reality:x.reality},null,2))+'</pre></details></td></tr>').join('')+'</tbody></table></div>':noData('Keine Execution-Evidence vorhanden.'))+'</div>';
  }

  function renderFunctionalCapabilities() {
    const root=document.getElementById('capabilities'); if(!root) return; const reg=f().capabilities||{}, items=list(reg.items);
    root.innerHTML='<div class="card"><div class="row"><div><h2>Capability Registry</h2><div class="small">Source: '+esc(reg.source||'UNKNOWN')+' · dieselbe Universal Mission Router Registry, keine Kopie.</div></div>'+badge(reg.status||'UNKNOWN')+'</div>'+
      (items.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Capability</th><th>Factory</th><th>Status</th><th>Primary Provider</th><th>Fallback</th><th>Requirements</th></tr></thead><tbody>'+items.map(x=>'<tr><td><strong>'+esc(x.capability)+'</strong><div class="small">'+esc(x.expected_deliverable||'')+'</div></td><td>'+esc(x.factory||'UNKNOWN')+'</td><td>'+badge(x.status)+'</td><td>'+esc(x.provider_primary||'UNKNOWN')+'<div>'+badge(x.provider_status)+'</div></td><td>'+esc(x.provider_fallback||'NONE')+'</td><td class="small">'+esc(list(x.requirements).join(', ')||'None for synthetic route')+'</td></tr>').join('')+'</tbody></table></div>':noData('Capability Registry konnte nicht aus dem Core projiziert werden.'))+'</div>';
  }

  function renderFunctionalProviders() {
    const root=document.getElementById('providers'); if(!root) return; root.querySelector('[data-functional-providers]')?.remove(); const items=list(f().providers);
    const card=document.createElement('div'); card.className='card'; card.dataset.functionalProviders='true'; card.style.marginTop='14px';
    card.innerHTML='<h2>Normalized Provider Control</h2><div class="small">Credentials werden nie angezeigt. Fehlende Live-Evidence bleibt NOT VERIFIED.</div>'+
      (items.length?items.map(x=>'<div class="row"><div class="row-main"><strong>'+esc(x.name)+'</strong><div class="small">'+esc(x.category||'provider')+' · '+esc(x.environment||'UNKNOWN')+' · credentials '+esc(x.credentials_state||'NOT_VERIFIED')+' · cost '+esc(x.cost_mode||'NOT_VERIFIED')+'</div><div class="small">Capabilities: '+esc(list(x.capabilities).join(', ')||'not projected')+' · Restrictions: '+esc(list(x.current_restrictions).join(', ')||'none projected')+'</div></div>'+badge(x.status)+'</div>').join(''):noData('Keine Provider-Evidence projiziert.'));
    root.appendChild(card);
  }

  function renderFunctionalCosts() {
    const root=document.getElementById('costs'); if(!root) return; root.querySelector('[data-functional-costs]')?.remove(); const c=f().cost_signals||{};
    const card=document.createElement('div'); card.className='card'; card.dataset.functionalCosts='true'; card.style.marginTop='14px';
    card.innerHTML='<h2>Cost Control Signals</h2><div class="grid three"><div class="kv"><b>Daily Cost</b><span>'+esc(maybeMoney(c.daily_cost_eur))+'</span><div class="small">'+esc(c.daily_cost_state||'UNKNOWN')+'</div></div><div class="kv"><b>Monthly Cost</b><span>'+esc(maybeMoney(c.monthly_cost_eur))+'</span><div class="small">'+esc(c.monthly_cost_state||'UNKNOWN')+'</div></div><div class="kv"><b>Mission Variable Ceiling</b><span>'+esc(maybeMoney(c.mission_variable_budget_ceiling_eur))+'</span></div></div><div class="row"><span>Development ceiling</span><strong>'+esc(maybeMoney(c.development_ceiling_eur))+'</strong></div><div class="row"><span>Remaining development budget</span><strong>'+esc(maybeMoney(c.remaining_development_budget_eur))+'</strong></div><div class="row"><span>Blocked-by-budget events</span><strong>'+esc(list(c.blocked_by_budget_events).length)+'</strong></div><p class="small">Period costs remain UNKNOWN unless Core provides period evidence. No 0 € is invented.</p>';
    root.appendChild(card);
  }

  function renderFunctionalQuality() {
    const root=document.getElementById('quality'); if(!root) return; const items=list(f().quality);
    root.innerHTML='<div class="card"><h2>Quality</h2>'+(items.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Mission</th><th>State</th><th>Score</th><th>Repair Attempts</th><th>Provider Switches</th><th>Validation</th></tr></thead><tbody>'+items.map(x=>'<tr><td class="mono">'+esc(x.mission_id||'UNKNOWN')+'</td><td>'+badge(x.final_quality_status)+'</td><td>'+esc(x.quality_score??'UNKNOWN')+'</td><td>'+esc(x.repair_attempts??'UNKNOWN')+'</td><td>'+esc(x.provider_switches??'UNKNOWN')+'</td><td><details class="details"><summary>Evidence</summary><pre>'+esc(JSON.stringify({validation_result:x.validation_result,failures:x.failures,output:x.output},null,2))+'</pre></details></td></tr>').join('')+'</tbody></table></div>':noData('Keine Quality-Evidence vorhanden.'))+'</div>';
  }

  function renderFunctionalAlerts() {
    const root=document.getElementById('alerts'); if(!root) return; const items=list(f().alerts);
    root.innerHTML='<div class="card"><div class="row"><div><h2>Blockers / Alerts</h2><div class="small">WHAT · WHY · IMPACT · NEXT ACTION</div></div>'+badge(items[0]?.severity||'NORMAL')+'</div>'+
      (items.length?items.map(x=>'<div class="cap" style="margin-bottom:10px"><div class="row"><div><strong>'+esc(x.what)+'</strong><div class="small">WHY: '+esc(x.why)+'</div></div>'+badge(x.severity)+'</div><div class="small"><b>IMPACT:</b> '+esc(x.impact)+'</div><div class="small"><b>NEXT ACTION:</b> '+esc(x.next_action)+'</div></div>').join(''):'<div class="callout good"><strong>NORMAL</strong><div class="small">Keine Blocker oder Action-Required-Evidence in den aktuell verbundenen Quellen.</div></div>')+'</div>';
  }

  function renderFunctionalHealth() {
    const root=document.getElementById('health'); if(!root) return; root.querySelector('[data-functional-health]')?.remove(); const sources=f().source_health||{};
    const card=document.createElement('div'); card.className='card'; card.dataset.functionalHealth='true'; card.style.marginTop='14px';
    card.innerHTML='<h2>Observation Source Integrity</h2>'+Object.entries(sources).map(([name,x])=>'<div class="row"><div><strong>'+esc(name)+'</strong><div class="small">'+esc(x.error||('HTTP '+(x.status??'UNKNOWN')))+'</div></div>'+badge(x.ok?'VERIFIED':'UNKNOWN')+'</div>').join('')+'<p class="small">Eine fehlende Quelle wird niemals als HEALTHY dargestellt.</p>';
    root.appendChild(card);
  }

  function rebuildQuickJump() {
    const select=document.getElementById('functional-quick-jump'); if(!select) return; const data=f();
    const options=[['projects',list(data.projects?.items).map(x=>[x.project_id||x.scope_key,x.name||x.project_id])],['missions',list(data.missions).map(x=>[x.mission_id,x.mission_id])],['executions',list(data.executions).map(x=>[x.execution_id||x.task_id,x.execution_id||x.task_id])]];
    const deliveries=[...list(data.deliverables?.universal_missions),...list(data.deliverables?.durable_missions),...list(data.deliverables?.live_staging_executions)].map(x=>[x.mission_id||x.execution_id||x.reference,x.business_name||x.mission_id||x.execution_id||x.reference]).filter(x=>x[0]);
    options.push(['deliveries',deliveries]);
    select.innerHTML='<option value="">Quick Jump…</option>'+options.flatMap(([section,rows])=>rows.slice(0,100).map(([id,label])=>'<option value="'+esc(section+'|'+id)+'">'+esc(section+': '+label)+'</option>')).join('');
  }

  async function loadFunctional() {
    try {
      state.data.functional = await api('/functional-completion');
      rebuildQuickJump();
      render(state.section || 'hq');
    } catch (error) {
      setError(error);
    }
  }

  const baseRefresh = document.getElementById('refresh')?.onclick;
  if (document.getElementById('refresh')) document.getElementById('refresh').onclick = async () => { if (baseRefresh) await baseRefresh(); await loadFunctional(); };
  void loadFunctional();
})();
</script>`;

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/operator/api/functional-completion') return functionalResponse(request, env, ctx, options);

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;
  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = source.includes('</body>') ? source.replace('</body>', `${FUNCTIONAL_SCRIPT}</body>`) : `${source}${FUNCTIONAL_SCRIPT}`;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function operatorFunctionalCompletionManifest() {
  return {
    schema: 'riosystems.operator-functional-completion-dashboard.v1',
    visible_brand: 'AURENTARA SYSTEMS',
    parent_brand: 'YSRIO GROUP',
    internal_core: 'RIOSYSTEMS',
    endpoint: '/operator/api/functional-completion',
    projection_only: true,
    existing_runtime_reused: true,
    existing_mission_engine_reused: true,
    existing_capability_router_reused: true,
    existing_provider_projection_reused: true,
    existing_cost_engine_reused: true,
    existing_approval_engine_reused: true,
    existing_quality_evidence_reused: true,
    unsupported_retry_cancel_actions_exposed: false,
    unknown_is_not_verified: true,
    secrets_in_frontend: false,
    real_customer_data: false,
    external_writes: false,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
