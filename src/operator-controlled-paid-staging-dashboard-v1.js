import { handleOperatorDashboard as handleExistingDashboard } from './operator-project-workspace-reconciliation-dashboard-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import {
  compileUniversalMission,
  analyzeMissionBusiness,
  selectMissionCapabilities,
  buildCapabilityDependencyPlan,
  missionCostApprovalPreflight
} from './universal-mission-run.js';
import { quickMissionCostEstimate } from './mission-cost-preflight-v1.js';
import {
  CONTROLLED_PAID_STAGING_CONFIRMATION,
  controlledPaidStagingSnapshot,
  controlledPaidProviderEligibility,
  evaluateControlledPaidStagingBudget
} from './operator-controlled-paid-staging-v1.js';
import { providerActivationInventory } from './provider-activation-inventory.js';
import { providerActivationMatrix } from './provider-stack-v1.js';
import { handleFactory } from './factory.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function json(body, status = 200, source = null) {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-aurentara-controlled-paid-staging-v1', 'mission-studio-wired');
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

function activationText(row = {}) {
  return clean(row.activation || row.status || row.state || '', 240).toLowerCase();
}

function matrixConnection(row = {}) {
  const text = activationText(row);
  if (!text) return 'NOT_CONNECTED';
  if (text.includes('live_staging_verified') || text.includes('staging_deploy_verified') || text.includes('staging_write_verified') || text.includes('staging_analytics_verified') || text.includes('live_read_and_staging')) return 'CONNECTED_STAGING';
  if (text.includes('live_read_verified')) return 'READ_ONLY_VERIFIED';
  return 'NOT_CONNECTED';
}

function providerProjection() {
  const inventory = providerActivationInventory();
  const matrix = providerActivationMatrix();
  const matrixById = new Map((matrix.providers || []).map((row) => [row.id, row]));
  return (inventory.providers || []).map((provider) => {
    const evidence = matrixById.get(provider.id) || null;
    const connection = evidence ? matrixConnection(evidence) : 'NOT_CONNECTED';
    const verification = connection === 'CONNECTED_STAGING'
      ? 'VERIFIED_STAGING'
      : connection === 'READ_ONLY_VERIFIED'
        ? 'VERIFIED_READ_ONLY'
        : 'NOT_VERIFIED';
    return {
      id: provider.id,
      connection_state: connection,
      verification,
      runtime_eligible: provider.runtime_eligible !== false,
      active_runtime: provider.runtime_eligible !== false && ['CONNECTED_STAGING', 'READ_ONLY_VERIFIED'].includes(connection),
      capabilities: clone(provider.capabilities || []),
      restrictions: clone(provider.restrictions || []),
      evidence: evidence ? clone(evidence) : null
    };
  });
}

function providerIdsFromReview(review = {}) {
  const ids = [];
  for (const task of review.plan?.selected_capabilities || []) {
    for (const value of [task?.provider?.primary, task?.provider?.fallback]) {
      const id = clean(value, 160);
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function resolveProviderRoutes(project = {}, review = {}) {
  const byId = new Map(providerProjection().map((provider) => [provider.id, provider]));
  const requested = providerIdsFromReview(review);
  const routes = requested.map((id) => {
    const provider = byId.get(id) || { id, connection_state: 'NOT_CONNECTED', verification: 'NOT_VERIFIED', active_runtime: false, runtime_eligible: false, restrictions: [] };
    const eligibility = controlledPaidProviderEligibility(project, provider);
    return {
      provider_id: id,
      controlled_paid_staging_eligible: eligibility.ok === true,
      connection_state: provider.connection_state,
      verification: provider.verification,
      restrictions: clone(provider.restrictions || []),
      reason: eligibility.reason || eligibility.error || 'NOT_ELIGIBLE'
    };
  });
  return {
    routes,
    eligible_routes: routes.filter((route) => route.controlled_paid_staging_eligible === true),
    paid_provider_truth_enforced_server_side: true
  };
}

function safeMissionInput(body = {}, project = {}) {
  const policy = controlledPaidStagingSnapshot(project);
  return {
    customer_id: project.customer_id,
    project_id: project.project_id,
    business_name: project.name,
    industry: clean(body.industry, 160) || project.industry || 'unknown',
    country: clean(body.country, 80) || project.country || 'DE',
    language: clean(body.language, 40) || project.language || 'de',
    mission_text: clean(body.mission_text, 4000),
    business_goals: Array.isArray(body.business_goals) ? body.business_goals.map((value) => clean(value, 300)).filter(Boolean) : [],
    known_constraints: Array.isArray(body.known_constraints) ? body.known_constraints.map((value) => clean(value, 300)).filter(Boolean) : [],
    existing_systems: Array.isArray(body.existing_systems) ? body.existing_systems.map((value) => clean(value, 160)).filter(Boolean) : [],
    requested_outcomes: Array.isArray(body.requested_outcomes) ? body.requested_outcomes.map((value) => clean(value, 300)).filter(Boolean) : [],
    budget_policy: { variable_cost_ceiling_eur: policy.remaining_budget_eur, paid_overflow: false, automatic_budget_increase: false },
    approval_policy: { external_writes_require_approval: true, production_requires_explicit_approval: true },
    data_policy: {
      synthetic_only: false,
      controlled_prelaunch: true,
      operator_approved_company_information_only: true,
      real_customer_data: false
    },
    environment: 'staging',
    production_authorized: false
  };
}

function buildReview(input = {}) {
  const compiled = compileUniversalMission(input);
  if (!compiled.ok) return compiled;
  const analysis = analyzeMissionBusiness(compiled.mission);
  const selection = selectMissionCapabilities(compiled.mission, analysis);
  const plan = buildCapabilityDependencyPlan(compiled.mission, selection);
  const preflight = missionCostApprovalPreflight(compiled.mission, plan);
  return { ok: preflight.ok, mission: compiled.mission, analysis, plan, preflight };
}

function serverCostPreflight(input = {}, review = {}) {
  return quickMissionCostEstimate({
    route: 'BALANCED',
    mission_text: input.mission_text,
    requested_outcomes: input.requested_outcomes,
    known_constraints: input.known_constraints,
    selected_capabilities: review.plan?.selected_capabilities || [],
    plan: review.plan || {},
    mission_type: 'GENERAL',
    external_dependencies_unknown: true
  });
}

function approvalBinding(project = {}, review = {}, cost = {}, providers = {}) {
  const policy = controlledPaidStagingSnapshot(project);
  return {
    schema: 'aurentara.controlled-paid-staging.approval-binding.v1',
    project_id: project.project_id,
    scope_key: project.scope_key,
    mission_id: review.mission?.mission_id || null,
    projected_cost_eur: money(cost.recommended_cost_ceiling_eur || cost.high_estimate_eur || cost.estimated_cost_eur || 0),
    project_budget_ceiling_eur: policy.project_budget_ceiling_eur,
    current_spend_eur: policy.current_spend_eur,
    reserved_eur: policy.reserved_eur,
    remaining_budget_eur: policy.remaining_budget_eur,
    provider_routes: clone(providers.eligible_routes || []),
    environment: 'staging',
    production_locked: true,
    external_write_locked: true,
    public_deploy: false,
    automatic_budget_increase: false
  };
}

async function controlledPreflight(service, runtime, project, body = {}) {
  const input = safeMissionInput(body, project);
  if (!input.mission_text) return { status: 400, body: { error: 'MISSION_TEXT_REQUIRED', production_deploy: false } };
  const review = buildReview(input);
  if (!review.ok) return { status: 400, body: review };
  const cost = serverCostPreflight(input, review);
  const projectedCost = money(cost.recommended_cost_ceiling_eur || cost.high_estimate_eur || cost.estimated_cost_eur || 0);
  const budgetGate = evaluateControlledPaidStagingBudget(project, projectedCost);
  const providers = resolveProviderRoutes(project, review);
  const binding = approvalBinding(project, review, cost, providers);
  if (!budgetGate.ok) {
    return {
      status: 409,
      body: {
        schema: 'aurentara.controlled-paid-staging.mission-preflight.v1',
        status: 'PROJECT_BUDGET_REAPPROVAL_REQUIRED',
        project_policy: controlledPaidStagingSnapshot(project),
        cost_preflight: cost,
        budget_gate: budgetGate,
        provider_routes: providers,
        approval_binding: binding,
        execution_started: false,
        production_deploy: false
      }
    };
  }

  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const recorded = await service.recordMissionPlan({
    scope_key: project.scope_key,
    review,
    safe_input: input,
    expected_revision: runtime.revision,
    created_at: createdAt,
    expires_at: expiresAt
  });
  if (!recorded.ok) return { status: recorded.status || 409, body: recorded.body || { error: 'MISSION_PLAN_RECORD_FAILED', production_deploy: false } };
  const plan = recorded.body?.plan || recorded.body;
  return {
    status: 201,
    body: {
      schema: 'aurentara.controlled-paid-staging.mission-preflight.v1',
      status: 'APPROVAL_REQUIRED',
      execution_mode: 'CONTROLLED_PAID_STAGING',
      plan_token: plan.plan_token,
      confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
      runtime_revision: recorded.runtime?.revision ?? recorded.body?.runtime_revision ?? runtime.revision + 1,
      project_policy: controlledPaidStagingSnapshot(project),
      cost_preflight: cost,
      budget_gate: budgetGate,
      provider_routes: providers,
      approval_binding: binding,
      review: clone(review),
      execution_started: false,
      production_deploy: false
    }
  };
}

async function defaultLiveStagingExecutor(contract = {}, request, env, ctx) {
  const capabilityNames = (contract.selected_capabilities || []).map((item) => clean(item?.capability || item?.id || item, 120));
  if (!capabilityNames.includes('web_presence')) {
    return {
      ok: false,
      error: 'CONTROLLED_PAID_STAGING_EXECUTOR_ONLY_WIRED_FOR_WEB_PRESENCE',
      status: 'FAILED',
      qa: { passed: false },
      variable_cost_eur: 0,
      real_customer_data: false,
      external_customer_writes: false,
      production_deploy: false
    };
  }
  const url = new URL(request.url);
  url.pathname = '/factory/generate/run';
  url.search = '';
  const factoryRequest = new Request(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: clean(contract.mission?.mission_text, 4000),
      project_name: clean(contract.mission?.business_name || 'Gelato Donatello', 160),
      project_slug: clean(contract.project_id, 160),
      limits: {
        max_iterations: 1,
        api_budget_eur: money(contract.variable_cost_ceiling_eur),
        auto_deploy: false,
        require_approval_before_production: true
      }
    })
  });
  const response = await handleFactory(factoryRequest, env, ctx);
  if (!response) return { ok: false, error: 'WEB_FACTORY_EXECUTOR_NOT_AVAILABLE', status: 'FAILED', qa: { passed: false }, variable_cost_eur: 0, production_deploy: false };
  let result = null;
  try { result = await response.json(); } catch { result = null; }
  const ok = response.ok && result?.ok === true && result?.production_deployed !== true;
  return {
    ok,
    error: ok ? null : clean(result?.error || `WEB_FACTORY_HTTP_${response.status}`, 240),
    status: ok ? 'DELIVERED' : 'FAILED',
    qa: { passed: ok },
    delivery: result,
    synthetic_only: false,
    real_customer_data: false,
    external_customer_writes: false,
    public_deploy: false,
    dns_change: false,
    billing: false,
    checkout: false,
    public_indexing: false,
    paid_overflow: false,
    variable_cost_eur: money(result?.variable_cost_eur || 0),
    production_deploy: false
  };
}

async function controlledDecision(service, runtime, project, body = {}, request, env, ctx, options = {}) {
  const token = clean(body.plan_token, 360);
  const plans = await service.listMissionPlans();
  const plan = (plans.body?.items || []).find((item) => item.plan_token === token);
  if (!plan) return { status: 404, body: { error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false } };
  const decision = clean(body.decision || 'approve', 80).toLowerCase();
  if (['reject', 'defer'].includes(decision)) {
    const result = await service.decideMissionPlan({ plan_token: token, decision, expected_revision: runtime.revision });
    return { status: result.status || (result.ok ? 200 : 400), body: result.body };
  }
  if (decision !== 'approve') return { status: 400, body: { error: 'PLAN_DECISION_NOT_SUPPORTED', production_deploy: false } };
  if (clean(body.confirmation_text, 200) !== CONTROLLED_PAID_STAGING_CONFIRMATION) {
    return { status: 400, body: { error: 'CONTROLLED_PAID_STAGING_CONFIRMATION_REQUIRED', required_confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION, production_deploy: false } };
  }
  if (body.production_authorized === true || body.external_customer_writes === true || body.public_deploy === true || body.dns_change === true || body.billing === true || body.checkout === true || body.public_indexing === true || body.real_customer_data === true) {
    return { status: 400, body: { error: 'CONTROLLED_PAID_STAGING_SAFETY_GATE_REJECTED', production_deploy: false } };
  }
  const input = plan.safe_input || {};
  const review = plan.review || {};
  const cost = serverCostPreflight(input, review);
  const projectedCost = money(cost.recommended_cost_ceiling_eur || cost.high_estimate_eur || cost.estimated_cost_eur || 0);
  const budgetGate = evaluateControlledPaidStagingBudget(project, projectedCost);
  if (!budgetGate.ok) return { status: 409, body: { error: 'PROJECT_BUDGET_EXCEEDED', budget_gate: budgetGate, production_deploy: false } };
  const providers = resolveProviderRoutes(project, review);
  const eligible = providers.eligible_routes;
  if (!eligible.length) {
    return { status: 409, body: { error: 'NO_CONTROLLED_PAID_STAGING_PROVIDER_ROUTE_ELIGIBLE', provider_routes: providers, production_deploy: false } };
  }
  if (body.readiness_only === true) {
    return {
      status: 200,
      body: {
        schema: 'aurentara.controlled-paid-staging.execution-readiness.v1',
        status: 'EXECUTION_READY',
        project_policy: controlledPaidStagingSnapshot(project),
        cost_preflight: cost,
        budget_gate: budgetGate,
        provider_routes: providers,
        approval_binding: approvalBinding(project, review, cost, providers),
        execution_started: false,
        paid_provider_calls: 0,
        actual_cost_eur: 0,
        production_deploy: false
      }
    };
  }
  const executor = typeof options.live_staging_executor === 'function'
    ? options.live_staging_executor
    : (contract) => defaultLiveStagingExecutor(contract, request, env, ctx);
  const result = await service.runLiveStaging({
    plan_token: token,
    expected_revision: runtime.revision,
    confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
    idempotency_key: `dashboard:${project.project_id}:${plan.mission_id}`,
    environment: 'staging',
    variable_cost_ceiling_eur: projectedCost,
    provider_routes: eligible,
    provider_eligibility_pass: true,
    project_scope_pass: true,
    production_authorized: false,
    synthetic_only: false,
    paid_overflow: false,
    external_customer_writes: false,
    public_deploy: false,
    dns_change: false,
    billing: false,
    checkout: false,
    public_indexing: false,
    real_customer_data: false
  }, { executor });
  const latest = await service.handle({ method: 'GET', path: '/snapshot' });
  const run = (latest.runtime?.live_staging_runs || []).find((item) => item.plan_token === token) || null;
  return {
    status: result.status || (result.ok ? 201 : 400),
    body: {
      ...(result.body || {}),
      project_policy: run?.project_budget || controlledPaidStagingSnapshot((latest.runtime?.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === project.scope_key) || project),
      variable_cost_eur: money(run?.variable_cost_eur || result.body?.variable_cost_eur || 0),
      production_deploy: false
    }
  };
}

async function runtimeContext(service) {
  const snapshot = await service.handle({ method: 'GET', path: '/snapshot' });
  if (!snapshot.ok) return null;
  return { runtime: snapshot.runtime, snapshot: snapshot.body };
}

function findProject(runtime = {}, scopeKey = '') {
  return (runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey) || null;
}

function controlledPath(pathname = '') {
  return pathname === '/operator/api/mission-preflight'
    || pathname === '/operator/api/mission-plan-decision'
    || pathname === '/operator/api/mission-approve'
    || pathname.startsWith('/operator/api/project-detail/');
}

function uxScript() {
  return `<script id="aurentara-controlled-paid-staging-v1-ui">(()=>{const eur=v=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));const old=window.renderProjectDetail;if(typeof old!=='function')return;window.renderProjectDetail=function(d){old(d);const p=d?.project||{};const s=d?.controlled_paid_staging||p?.controlled_paid_staging_snapshot;if(!s?.active)return;const root=document.getElementById('project-detail');if(!root||root.querySelector('[data-controlled-paid-staging]'))return;const card=document.createElement('div');card.className='card human-section';card.dataset.controlledPaidStaging='true';card.innerHTML='<h2>CONTROLLED PAID STAGING</h2><div class="human-grid"><div class="human-kv"><b>Project Budget</b><span>'+eur(s.project_budget_ceiling_eur)+'</span></div><div class="human-kv"><b>Spent</b><span>'+eur(s.current_spend_eur)+'</span></div><div class="human-kv"><b>Reserved</b><span>'+eur(s.reserved_eur)+'</span></div><div class="human-kv"><b>Remaining</b><span>'+eur(s.remaining_budget_eur)+'</span></div><div class="human-kv"><b>Paid Provider Calls</b><span>Allowed within budget</span></div><div class="human-kv"><b>Production</b><span>Locked</span></div><div class="human-kv"><b>External Writes</b><span>Locked</span></div></div>';root.prepend(card)};})();</script>`;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!controlledPath(url.pathname) && !(url.pathname === '/operator' || url.pathname === '/operator/')) {
    return handleExistingDashboard(request, env, ctx, options);
  }

  if (url.pathname === '/operator' || url.pathname === '/operator/') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
    const source = await response.text();
    const body = source.includes('</body>') ? source.replace('</body>', `${uxScript()}</body>`) : `${source}${uxScript()}`;
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) return handleExistingDashboard(request, env, ctx, options);
  const service = options.runtime_service;
  if (!service) return handleExistingDashboard(request, env, ctx, options);
  const context = await runtimeContext(service);
  if (!context) return handleExistingDashboard(request, env, ctx, options);
  const runtime = context.runtime;

  if (url.pathname.startsWith('/operator/api/project-detail/') && request.method === 'GET') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('application/json')) return response;
    let payload = null;
    try { payload = await response.clone().json(); } catch { return response; }
    let scopeKey = '';
    try { scopeKey = decodeURIComponent(url.pathname.slice('/operator/api/project-detail/'.length)); } catch { return response; }
    const project = findProject(runtime, scopeKey);
    const policy = project ? controlledPaidStagingSnapshot(project) : null;
    if (!policy?.active) return response;
    return json({ ...payload, controlled_paid_staging: policy }, 200, response);
  }

  let body = {};
  if (['POST','PUT','PATCH'].includes(request.method)) {
    try { body = await request.clone().json(); } catch { body = {}; }
  }
  const scopeKey = clean(body.scope_key, 300) || runtime.selected_project_scope;
  const project = findProject(runtime, scopeKey);
  const policy = project ? controlledPaidStagingSnapshot(project) : null;
  if (!policy?.active) return handleExistingDashboard(request, env, ctx, options);

  if (url.pathname === '/operator/api/mission-preflight' && request.method === 'POST') {
    const result = await controlledPreflight(service, runtime, project, body);
    return json(result.body, result.status);
  }
  if ((url.pathname === '/operator/api/mission-plan-decision' || url.pathname === '/operator/api/mission-approve') && request.method === 'POST') {
    const normalized = url.pathname.endsWith('/mission-approve') ? { ...body, decision: 'approve' } : body;
    const result = await controlledDecision(service, runtime, project, normalized, request, env, ctx, options);
    return json(result.body, result.status);
  }
  return handleExistingDashboard(request, env, ctx, options);
}

export function operatorControlledPaidStagingDashboardManifest() {
  return {
    schema: 'aurentara.controlled-paid-staging-dashboard.v1',
    wraps_existing_dashboard: true,
    same_runtime_service: true,
    server_side_project_policy_resolution: true,
    server_side_cost_preflight: true,
    server_side_provider_eligibility: true,
    durable_plan_contract_reused: true,
    live_staging_runtime_reused: true,
    safe_default_fallback_unchanged: true,
    production_deploy: false,
    public_deploy: false,
    external_customer_writes: false
  };
}
