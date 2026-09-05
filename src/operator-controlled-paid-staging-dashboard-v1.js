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
import { canonicalProviderExecutorDescriptor, executeCanonicalProviderRoute } from './execution-adapters.js';

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
  if (
    text.includes('historical_connected_staging_evidence')
    || text.includes('historical_staging_execution_evidence')
    || text.includes('historical_read_and_staging')
    || text.includes('historical_staging_inference_evidence')
    || text.includes('live_staging_verified')
    || text.includes('staging_deploy_verified')
    || text.includes('staging_write_verified')
    || text.includes('staging_analytics_verified')
    || text.includes('live_read_and_staging')
  ) return 'CONNECTED_STAGING';
  if (text.includes('historical_read_only_connection_evidence') || text.includes('live_read_verified') || text.includes('historical_read_evidence')) return 'READ_ONLY_VERIFIED';
  return 'NOT_CONNECTED';
}

function providerProjection(options = {}) {
  const currentRuntimeVerifiedProviderIds = Array.isArray(options.current_runtime_verified_provider_ids)
    ? options.current_runtime_verified_provider_ids
    : [];
  const inventory = providerActivationInventory({ current_runtime_verified_provider_ids: currentRuntimeVerifiedProviderIds });
  const matrix = providerActivationMatrix();
  const matrixById = new Map((matrix.providers || []).map((row) => [row.id, row]));
  return (inventory.providers || []).map((provider) => {
    const evidence = matrixById.get(provider.id) || null;
    const connection = evidence ? matrixConnection(evidence) : 'NOT_CONNECTED';
    const currentRuntimeVerified = provider.runtime_truth?.current_runtime_verified === true;
    const verification = currentRuntimeVerified
      ? 'CURRENT_RUNTIME_VERIFIED'
      : connection === 'CONNECTED_STAGING'
        ? 'HISTORICAL_VERIFIED_STAGING'
        : connection === 'READ_ONLY_VERIFIED'
          ? 'HISTORICAL_VERIFIED_READ_ONLY'
          : 'NOT_VERIFIED';
    return {
      id: provider.id,
      connection_state: connection,
      verification,
      current_runtime_verified: currentRuntimeVerified,
      runtime_eligible: provider.runtime_eligible !== false,
      active_runtime: provider.runtime_eligible !== false && currentRuntimeVerified,
      capabilities: clone(provider.capabilities || []),
      restrictions: clone(provider.restrictions || []),
      runtime_truth: clone(provider.runtime_truth || null),
      evidence: evidence ? clone(evidence) : null
    };
  });
}

const LEGACY_CAPABILITY_TO_EXECUTION = Object.freeze({
  web_presence: 'web.build',
  business_crm: 'business.crm.write',
  automation_followup: 'automation.run',
  ai_assistance: 'ai.generate',
  analytics: 'business.analytics'
});

function normalizeLegacyProviderRoute(providerId, sourceCapability, role = 'primary') {
  const rawProviderId = clean(providerId, 160);
  const capability = LEGACY_CAPABILITY_TO_EXECUTION[clean(sourceCapability, 120)] || null;
  if (!rawProviderId || !capability) return null;
  if (sourceCapability === 'web_presence' && ['riosystems-native-web+cloudflare-pages-free','riosystems-native-web-local-artifact'].includes(rawProviderId)) {
    return { provider_id: 'riosystems-native-web', source_provider_id: rawProviderId, capability: 'web.build', source_capability: 'web_presence', role };
  }
  return { provider_id: rawProviderId, source_provider_id: rawProviderId, capability, source_capability: clean(sourceCapability, 120), role };
}

function providerRouteRequestsFromReview(review = {}) {
  const routes = [];
  const seen = new Set();
  for (const task of review.plan?.selected_capabilities || []) {
    for (const [role, value] of [['primary', task?.provider?.primary], ['fallback', task?.provider?.fallback]]) {
      const route = normalizeLegacyProviderRoute(value, task?.capability, role);
      if (!route) continue;
      const key = `${route.provider_id}:${route.capability}`;
      if (seen.has(key)) continue;
      seen.add(key);
      routes.push(route);
    }
  }
  return routes;
}

function resolveProviderRoutes(project = {}, review = {}, options = {}) {
  const byId = new Map(providerProjection(options).map((provider) => [provider.id, provider]));
  const requested = providerRouteRequestsFromReview(review);
  const currentRuntimeVerified = new Set(Array.isArray(options.current_runtime_verified_provider_ids) ? options.current_runtime_verified_provider_ids : []);
  const providerExecutors = options.provider_executors && typeof options.provider_executors === 'object' ? options.provider_executors : {};
  const genericExecutorAvailable = typeof options.live_staging_executor === 'function';
  const requestedOutcomes = new Set(Array.isArray(options.requested_outcomes) ? options.requested_outcomes.map((value) => clean(value, 120)).filter(Boolean) : []);

  const routes = requested.map((request) => {
    const descriptor = canonicalProviderExecutorDescriptor(request.provider_id);
    const provider = byId.get(request.provider_id) || null;
    const internalNative = request.provider_id === 'riosystems-native-web';
    const runtimeVerified = internalNative
      ? currentRuntimeVerified.has(request.provider_id) || typeof providerExecutors[request.provider_id] === 'function' || genericExecutorAvailable
      : provider?.current_runtime_verified === true;
    const providerPolicy = internalNative
      ? { ok: runtimeVerified, reason: runtimeVerified ? 'INTERNAL_EXECUTOR_CURRENTLY_AVAILABLE' : 'INTERNAL_EXECUTOR_NOT_CURRENTLY_VERIFIED' }
      : controlledPaidProviderEligibility(project, provider || { id: request.provider_id });
    const executorAvailable = typeof providerExecutors[request.provider_id] === 'function' || genericExecutorAvailable;
    const capabilityAccepted = Boolean(descriptor?.accepted_capabilities?.includes(request.capability));
    const eligible = providerPolicy.ok === true && runtimeVerified && executorAvailable && capabilityAccepted && Boolean(descriptor);
    return {
      ...request,
      executor_id: descriptor?.executor_id || null,
      controlled_paid_staging_eligible: eligible,
      connection_state: internalNative ? (runtimeVerified ? 'INTERNAL_RUNTIME_READY' : 'NOT_VERIFIED') : (provider?.connection_state || 'NOT_CONNECTED'),
      verification: internalNative ? (runtimeVerified ? 'CURRENT_RUNTIME_VERIFIED' : 'NOT_VERIFIED') : (provider?.verification || 'NOT_VERIFIED'),
      current_runtime_verified: runtimeVerified,
      executor_available: executorAvailable,
      restrictions: clone(provider?.restrictions || []),
      reason: !descriptor ? 'PROVIDER_EXECUTOR_NOT_AVAILABLE'
        : !capabilityAccepted ? 'PROVIDER_CAPABILITY_NOT_ACCEPTED'
          : !executorAvailable ? 'PROVIDER_EXECUTOR_NOT_CONFIGURED'
            : providerPolicy.reason || providerPolicy.error || (eligible ? 'EXECUTION_READY' : 'NOT_ELIGIBLE')
    };
  });

  const eligibleRoutes = routes.filter((route) => route.controlled_paid_staging_eligible === true);
  const executionRoutes = requestedOutcomes.size
    ? eligibleRoutes.filter((route) => requestedOutcomes.has(route.source_capability))
    : eligibleRoutes.filter((route) => route.role === 'primary');

  return {
    routes,
    eligible_routes: eligibleRoutes,
    execution_routes: executionRoutes,
    target_capabilities: [...requestedOutcomes],
    paid_provider_truth_enforced_server_side: true,
    provider_capability_binding_enforced: true,
    actual_executor_availability_required: true
  };
}

function safeMissionInput(body = {}, project = {}) {
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
    budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
    approval_policy: { external_writes_require_approval: true, production_requires_explicit_approval: true },
    data_policy: { synthetic_only: true, real_customer_data: false },
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
    execution_mode: 'CONTROLLED_PAID_STAGING',
    data_mode: 'controlled-prelaunch',
    production_locked: true,
    external_write_locked: true,
    public_deploy: false,
    automatic_budget_increase: false
  };
}

async function controlledPreflight(service, runtime, project, body = {}, options = {}) {
  const input = safeMissionInput(body, project);
  if (!input.mission_text) return { status: 400, body: { error: 'MISSION_TEXT_REQUIRED', production_deploy: false } };
  const review = buildReview(input);
  if (!review.ok) return { status: 400, body: review };
  const cost = serverCostPreflight(input, review);
  const projectedCost = money(cost.recommended_cost_ceiling_eur || cost.high_estimate_eur || cost.estimated_cost_eur || 0);
  const budgetGate = evaluateControlledPaidStagingBudget(project, projectedCost);
  const providers = resolveProviderRoutes(project, review, { ...options, requested_outcomes: input.requested_outcomes });
  const binding = approvalBinding(project, review, cost, providers);
  if (!budgetGate.ok) {
    return { status: 409, body: { schema: 'aurentara.controlled-paid-staging.mission-preflight.v1', status: 'PROJECT_BUDGET_REAPPROVAL_REQUIRED', project_policy: controlledPaidStagingSnapshot(project), cost_preflight: cost, budget_gate: budgetGate, provider_routes: providers, approval_binding: binding, execution_started: false, production_deploy: false } };
  }
  const recorded = await service.recordMissionPlan({ scope_key: project.scope_key, review, safe_input: input, expected_revision: runtime.revision, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
  if (!recorded.ok) return { status: recorded.status || 409, body: recorded.body || { error: 'MISSION_PLAN_RECORD_FAILED', production_deploy: false } };
  const plan = recorded.body?.plan || recorded.body;
  return {
    status: 201,
    body: {
      schema: 'aurentara.controlled-paid-staging.mission-preflight.v1', status: 'APPROVAL_REQUIRED', execution_mode: 'CONTROLLED_PAID_STAGING',
      plan_token: plan.plan_token, confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
      runtime_revision: recorded.runtime?.revision ?? recorded.body?.runtime_revision ?? runtime.revision + 1,
      ...clone(review), project_policy: controlledPaidStagingSnapshot(project), cost_preflight: cost, budget_gate: budgetGate,
      provider_routes: providers, approval_binding: binding, execution_started: false, production_deploy: false
    }
  };
}

async function defaultLiveStagingExecutor(contract = {}, options = {}) {
  const routes = Array.isArray(contract.provider_routes) ? contract.provider_routes : [];
  if (routes.length !== 1) {
    return { ok: false, error: routes.length ? 'CONTROLLED_PAID_STAGING_PROVIDER_ROUTE_AMBIGUOUS' : 'CONTROLLED_PAID_STAGING_PROVIDER_ROUTE_REQUIRED', status: 'FAILED', qa: { passed: false }, variable_cost_eur: 0, production_deploy: false };
  }
  const route = routes[0];
  const descriptor = canonicalProviderExecutorDescriptor(route.provider_id);
  if (!descriptor) return { ok: false, error: 'PROVIDER_EXECUTOR_NOT_AVAILABLE', status: 'FAILED', qa: { passed: false }, variable_cost_eur: 0, production_deploy: false };

  const providerExecutors = options.provider_executors && typeof options.provider_executors === 'object' ? { ...options.provider_executors } : {};
  if (typeof options.live_staging_executor === 'function' && typeof providerExecutors[route.provider_id] !== 'function') {
    providerExecutors[route.provider_id] = async ({ envelope }) => options.live_staging_executor({ ...contract, canonical_provider_envelope: envelope });
  }
  const verified = new Set(Array.isArray(options.current_runtime_verified_provider_ids) ? options.current_runtime_verified_provider_ids : []);
  if (route.provider_id === 'riosystems-native-web' && typeof providerExecutors[route.provider_id] === 'function') verified.add(route.provider_id);

  const envelope = {
    ok: true,
    envelope_version: 1,
    mission_id: contract.mission_id,
    task_id: clean(route.source_capability || route.capability, 160) || 'legacy-controlled-paid-staging-task',
    execution_id: clean(contract.execution_id, 220) || clean(contract.idempotency_key, 220) || null,
    provider_execution_version: 'riosystems.provider-execution.v1',
    capability: route.capability,
    factory: route.capability.startsWith('web.') ? 'web' : route.capability.startsWith('automation.') ? 'automation' : route.capability.startsWith('ai.') ? 'ai' : 'business',
    provider_route: { provider_id: route.provider_id, capability: route.capability },
    executor_id: descriptor.executor_id,
    environment: 'staging',
    write_policy: 'NO_EXTERNAL_WRITES',
    production_policy: 'PRODUCTION_DISABLED',
    execution: { production_deploy: false, external_writes: false, canonical_execution_contract: true }
  };
  const executed = await executeCanonicalProviderRoute(envelope, {
    current_runtime_verified_provider_ids: [...verified],
    executors: providerExecutors
  });
  if (!executed.ok || executed.status !== 'COMPLETED') {
    return { ok: false, error: executed.error || executed.result?.error?.code || 'PROVIDER_EXECUTION_FAILED', status: 'FAILED', qa: { passed: false }, provider_truth: executed.provider_truth || null, variable_cost_eur: money(executed.raw_result?.actual_cost_eur || executed.raw_result?.variable_cost_eur || 0), production_deploy: false };
  }
  return {
    ok: true,
    status: 'LIVE_PROVIDER_VERIFIED',
    qa: { passed: true },
    planned_provider: executed.provider_truth.planned_provider,
    dispatched_provider: executed.provider_truth.dispatched_provider,
    actual_provider: executed.provider_truth.actual_provider,
    executor_id: executed.provider_truth.executor_id,
    provider_truth: executed.provider_truth,
    delivery: executed.raw_result,
    synthetic_only: false,
    real_customer_data: false,
    external_customer_writes: false,
    public_deploy: false,
    dns_change: false,
    billing: false,
    checkout: false,
    public_indexing: false,
    paid_overflow: false,
    variable_cost_eur: money(executed.raw_result?.actual_cost_eur || executed.raw_result?.variable_cost_eur || 0),
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
  if (clean(body.confirmation_text, 200) !== CONTROLLED_PAID_STAGING_CONFIRMATION) return { status: 400, body: { error: 'CONTROLLED_PAID_STAGING_CONFIRMATION_REQUIRED', required_confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION, production_deploy: false } };
  if (body.production_authorized === true || body.external_customer_writes === true || body.public_deploy === true || body.dns_change === true || body.billing === true || body.checkout === true || body.public_indexing === true || body.real_customer_data === true) return { status: 400, body: { error: 'CONTROLLED_PAID_STAGING_SAFETY_GATE_REJECTED', production_deploy: false } };
  const input = plan.safe_input || {}; const review = plan.review || {}; const cost = serverCostPreflight(input, review);
  const projectedCost = money(cost.recommended_cost_ceiling_eur || cost.high_estimate_eur || cost.estimated_cost_eur || 0);
  const budgetGate = evaluateControlledPaidStagingBudget(project, projectedCost);
  if (!budgetGate.ok) return { status: 409, body: { error: 'PROJECT_BUDGET_EXCEEDED', budget_gate: budgetGate, production_deploy: false } };
  const providers = resolveProviderRoutes(project, review, { ...options, requested_outcomes: input.requested_outcomes }); const eligible = providers.execution_routes;
  if (!eligible.length) return { status: 409, body: { error: 'NO_CONTROLLED_PAID_STAGING_TARGET_PROVIDER_ROUTE_ELIGIBLE', provider_routes: providers, production_deploy: false } };
  if (body.readiness_only === true) return { status: 200, body: { schema: 'aurentara.controlled-paid-staging.execution-readiness.v1', status: 'EXECUTION_READY', project_policy: controlledPaidStagingSnapshot(project), cost_preflight: cost, budget_gate: budgetGate, provider_routes: providers, approval_binding: approvalBinding(project, review, cost, providers), execution_started: false, paid_provider_calls: 0, actual_cost_eur: 0, production_deploy: false } };
  const executor = (contract) => defaultLiveStagingExecutor(contract, options);
  const result = await service.runLiveStaging({ plan_token: token, expected_revision: runtime.revision, confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION, idempotency_key: `dashboard:${project.project_id}:${plan.mission_id}`, environment: 'staging', variable_cost_ceiling_eur: projectedCost, provider_routes: eligible, provider_eligibility_pass: true, project_scope_pass: true, production_authorized: false, synthetic_only: false, paid_overflow: false, external_customer_writes: false, public_deploy: false, dns_change: false, billing: false, checkout: false, public_indexing: false, real_customer_data: false }, { executor });
  const latest = await service.handle({ method: 'GET', path: '/snapshot' });
  const run = (latest.runtime?.live_staging_runs || []).find((item) => item.plan_token === token) || null;
  const latestProject = (latest.runtime?.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === project.scope_key) || project;
  return { status: result.status || (result.ok ? 201 : 400), body: { ...(result.body || {}), project_policy: controlledPaidStagingSnapshot(latestProject), variable_cost_eur: money(run?.variable_cost_eur || result.body?.variable_cost_eur || 0), production_deploy: false } };
}

async function runtimeContext(service) { const snapshot = await service.handle({ method: 'GET', path: '/snapshot' }); return snapshot.ok ? { runtime: snapshot.runtime, snapshot: snapshot.body } : null; }
function findProject(runtime = {}, scopeKey = '') { return (runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey) || null; }
function controlledPath(pathname = '') { return pathname === '/operator/api/mission-preflight' || pathname === '/operator/api/mission-plan-decision' || pathname === '/operator/api/mission-approve' || pathname.startsWith('/operator/api/project-detail/') || pathname.startsWith('/operator/api/project-workspace/'); }
function uxScript() { return `<script id="aurentara-controlled-paid-staging-v1-ui">(()=>{const eur=v=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));const old=window.renderProjectDetail;if(typeof old!=='function')return;window.renderProjectDetail=function(d){old(d);const p=d?.project||{};const s=d?.controlled_paid_staging||p?.controlled_paid_staging_snapshot;if(!s?.active)return;const root=document.getElementById('project-detail');if(!root||root.querySelector('[data-controlled-paid-staging]'))return;const card=document.createElement('div');card.className='card human-section';card.dataset.controlledPaidStaging='true';card.innerHTML='<h2>CONTROLLED PAID STAGING</h2><div class="human-grid"><div class="human-kv"><b>Project Budget</b><span>'+eur(s.project_budget_ceiling_eur)+'</span></div><div class="human-kv"><b>Spent</b><span>'+eur(s.current_spend_eur)+'</span></div><div class="human-kv"><b>Reserved</b><span>'+eur(s.reserved_eur)+'</span></div><div class="human-kv"><b>Remaining</b><span>'+eur(s.remaining_budget_eur)+'</span></div><div class="human-kv"><b>Paid Provider Calls</b><span>Allowed within budget</span></div><div class="human-kv"><b>Production</b><span>Locked</span></div><div class="human-kv"><b>External Writes</b><span>Locked</span></div></div>';root.prepend(card)};})();</script>`; }

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!controlledPath(url.pathname) && !(url.pathname === '/operator' || url.pathname === '/operator/')) return handleExistingDashboard(request, env, ctx, options);
  if (url.pathname === '/operator' || url.pathname === '/operator/') {
    const response = await handleExistingDashboard(request, env, ctx, options);
    if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response;
    const source = await response.text(); const body = source.includes('</body>') ? source.replace('</body>', `${uxScript()}</body>`) : `${source}${uxScript()}`;
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  const auth = await authorizeOperator(request, env, ctx, options); if (!auth.ok) return handleExistingDashboard(request, env, ctx, options);
  const service = options.runtime_service; if (!service) return handleExistingDashboard(request, env, ctx, options);
  const context = await runtimeContext(service); if (!context) return handleExistingDashboard(request, env, ctx, options); const runtime = context.runtime;
  if ((url.pathname.startsWith('/operator/api/project-detail/') || url.pathname.startsWith('/operator/api/project-workspace/')) && request.method === 'GET') {
    const response = await handleExistingDashboard(request, env, ctx, options); if (!response || response.status !== 200 || !(response.headers.get('content-type') || '').includes('application/json')) return response;
    let payload = null; try { payload = await response.clone().json(); } catch { return response; }
    const prefix = url.pathname.startsWith('/operator/api/project-detail/') ? '/operator/api/project-detail/' : '/operator/api/project-workspace/';
    let scopeKey = ''; try { scopeKey = decodeURIComponent(url.pathname.slice(prefix.length)); } catch { return response; }
    const project = findProject(runtime, scopeKey); const policy = project ? controlledPaidStagingSnapshot(project) : null; if (!policy?.active) return response;
    return json({ ...payload, controlled_paid_staging: policy }, 200, response);
  }
  let body = {}; if (['POST','PUT','PATCH'].includes(request.method)) { try { body = await request.clone().json(); } catch { body = {}; } }
  const scopeKey = clean(body.scope_key, 300) || runtime.selected_project_scope; const project = findProject(runtime, scopeKey); const policy = project ? controlledPaidStagingSnapshot(project) : null;
  if (!policy?.active) return handleExistingDashboard(request, env, ctx, options);
  if (url.pathname === '/operator/api/mission-preflight' && request.method === 'POST') { const result = await controlledPreflight(service, runtime, project, body, options); return json(result.body, result.status); }
  if ((url.pathname === '/operator/api/mission-plan-decision' || url.pathname === '/operator/api/mission-approve') && request.method === 'POST') { const normalized = url.pathname.endsWith('/mission-approve') ? { ...body, decision: 'approve' } : body; const result = await controlledDecision(service, runtime, project, normalized, request, env, ctx, options); return json(result.body, result.status); }
  return handleExistingDashboard(request, env, ctx, options);
}

export function operatorControlledPaidStagingDashboardManifest() {
  return { schema: 'aurentara.controlled-paid-staging-dashboard.v1', wraps_existing_dashboard: true, same_runtime_service: true, legacy_mission_compiler_kept_zero_cost_synthetic_for_planning_only: true, server_side_project_execution_policy_resolution: true, server_side_cost_preflight: true, server_side_provider_eligibility: true, durable_plan_contract_reused: true, live_staging_runtime_reused: true, provider_routes_drive_actual_executor: true, planned_dispatched_actual_truth_required: true, safe_default_fallback_unchanged: true, production_deploy: false, public_deploy: false, external_customer_writes: false };
}
