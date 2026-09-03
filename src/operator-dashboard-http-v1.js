import {
  compileUniversalMission,
  analyzeMissionBusiness,
  selectMissionCapabilities,
  buildCapabilityDependencyPlan,
  missionCostApprovalPreflight
} from './universal-mission-run.js';
import { createOperatorRuntime } from './operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from './operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from './operator-runtime-api-v1.js';
import {
  buildOperatorProjectDetail,
  buildOperatorCostCenter,
  buildFactoryOperations,
  buildProviderOperations,
  buildAuditView
} from './operator-dashboard-projections-v1.js';
import { renderOperatorDashboardShell } from './operator-dashboard-shell-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const runtimeServices = new Map();
const pendingPlans = new Map();
const operatorUiAudit = new Map();
const PLAN_CONFIRMATION_TEXT = 'CONFIRM_SYNTHETIC_STAGING';

export const OPERATOR_STATUS_MAP = Object.freeze({
  DRAFT: ['Draft', 'neutral'],
  COMPILING: ['Mission wird verstanden', 'active'],
  PLAN_READY: ['Plan bereit', 'ready'],
  APPROVAL_REQUIRED: ['Freigabe erforderlich', 'attention'],
  DEFERRED: ['Später prüfen', 'attention'],
  READY: ['Bereit', 'ready'],
  RUNNING: ['Läuft', 'active'],
  ACTIVE: ['Aktiv', 'active'],
  BLOCKED: ['Blockiert', 'blocked'],
  RETRYING: ['Wiederholung', 'attention'],
  QUALITY_REVIEW: ['Qualitätsprüfung', 'active'],
  DELIVERY_READY: ['Delivery bereit', 'ready'],
  SIMULATED_HANDOFF_READY: ['Synthetische Delivery bereit', 'ready'],
  SYNTHETIC_STAGING_COMPLETED: ['Synthetisches Staging abgeschlossen', 'ready'],
  COMPLETED: ['Abgeschlossen', 'ready'],
  READY_FOR_SUPERVISED_SYNTHETIC_STAGING: ['Für kontrolliertes Staging bereit', 'ready'],
  LIVE_STAGING_VERIFIED: ['Staging verifiziert', 'ready'],
  LIVE_PROVIDER_VERIFIED: ['Provider live verifiziert', 'ready'],
  STRATEGY_ENGINE_READY: ['Strategie bereit', 'ready'],
  OPERATOR_ATTENTION_REQUIRED: ['Aufmerksamkeit erforderlich', 'attention'],
  LIVE_STAGING_CONTROL_READY: ['Staging Control bereit', 'ready'],
  CONTROL_PLANE_READY: ['Control Plane bereit', 'ready'],
  VERIFIED_HEALTHY: ['Verifiziert gesund', 'ready'],
  DEGRADED: ['Eingeschränkt', 'attention'],
  FAILED: ['Fehlgeschlagen', 'blocked'],
  CANCELLED: ['Abgebrochen', 'neutral'],
  NOT_READY: ['Nicht bereit', 'neutral'],
  NOT_VERIFIED: ['Nicht verifiziert', 'neutral'],
  UNKNOWN: ['Unbekannt', 'neutral'],
  LOCKED: ['Gesperrt', 'blocked'],
  DISABLED: ['Deaktiviert', 'neutral'],
  PLANNED: ['Geplant', 'neutral'],
  SYNTHETIC: ['Synthetisch', 'active'],
  SYNTHETIC_ROUTE_ONLY: ['Synthetische Route', 'active'],
  PRODUCTION_READY: ['Production bereit', 'attention'],
  PRODUCTION_ACTIVE: ['Production aktiv', 'attention'],
  FREE_VERIFIED: ['Kostenfrei verifiziert', 'ready'],
  ESTIMATED_ZERO: ['0 € geschätzt', 'neutral'],
  NOT_ESTIMATED: ['Nicht geschätzt', 'neutral'],
  PAID_APPROVAL_REQUIRED: ['Paid-Freigabe erforderlich', 'attention']
});

export function operatorDashboardStatusMeta(status) {
  const raw = clean(status, 120).toUpperCase() || 'UNKNOWN';
  const [label, tone] = OPERATOR_STATUS_MAP[raw] || [raw.replaceAll('_', ' '), 'neutral'];
  return { raw, label, tone };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    }
  });
}

async function readBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) return {};
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return {};
  try { return await request.json(); } catch { return {}; }
}

function seededPortfolio(operatorId) {
  return {
    operator_id: operatorId,
    projects: [
      {
        customer_id: 'synthetic-customer-bakery',
        project_id: 'bakery-muller:universal-regression-v1',
        scope_key: 'synthetic-customer-bakery:bakery-muller:universal-regression-v1',
        name: 'Bäckerei Müller', industry: 'bakery', country: 'DE', language: 'de',
        state: 'READY', blocked: false, priority: 10, budget_cost_units: 0,
        capability_count: 5, mission_count: 0, delivery_count: 1, production_deploy: false
      },
      {
        customer_id: 'synthetic-customer-craft',
        project_id: 'handwerk-modernisierung:universal-v1',
        scope_key: 'synthetic-customer-craft:handwerk-modernisierung:universal-v1',
        name: 'Muster Handwerksbetrieb', industry: 'handwerk', country: 'DE', language: 'de',
        state: 'ACTIVE', blocked: false, priority: 20, budget_cost_units: 0,
        capability_count: 5, mission_count: 0, delivery_count: 0, production_deploy: false
      },
      {
        customer_id: 'synthetic-customer-service',
        project_id: 'service-studio:operator-v1',
        scope_key: 'synthetic-customer-service:service-studio:operator-v1',
        name: 'Synthetic Service Studio', industry: 'professional-services', country: 'DE', language: 'de',
        state: 'READY', blocked: false, priority: 30, budget_cost_units: 0,
        capability_count: 3, mission_count: 0, delivery_count: 0, production_deploy: false
      }
    ],
    production_deploy: false
  };
}

function createInitialRuntime(operatorId) {
  const created = createOperatorRuntime({ operator_id: operatorId, portfolio: seededPortfolio(operatorId), at: new Date().toISOString() });
  if (!created.ok) throw new Error(created.error || 'OPERATOR_RUNTIME_INIT_FAILED');
  return created.runtime;
}

function getRuntimeService(operatorId, options = {}) {
  if (options.runtime_service) return options.runtime_service;
  if (!runtimeServices.has(operatorId)) {
    const initial = createInitialRuntime(operatorId);
    const store = createMemoryOperatorRuntimeStore([initial]);
    runtimeServices.set(operatorId, createOperatorRuntimeApiService({ operator_id: operatorId, store }));
  }
  return runtimeServices.get(operatorId);
}

function auditFor(operatorId) {
  if (!operatorUiAudit.has(operatorId)) operatorUiAudit.set(operatorId, []);
  return operatorUiAudit.get(operatorId);
}

function recordUiAudit(operatorId, event = {}) {
  const item = {
    event: clean(event.event, 160) || 'OPERATOR_DASHBOARD_EVENT',
    actor: operatorId,
    source: clean(event.source, 120) || 'operator_dashboard',
    scope_key: clean(event.scope_key, 300) || null,
    mission_id: clean(event.mission_id, 220) || null,
    plan_token: clean(event.plan_token, 320) || null,
    decision: clean(event.decision, 80) || null,
    at: new Date().toISOString()
  };
  auditFor(operatorId).push(item);
  return item;
}

export async function authorizeOperator(request, env = {}, ctx = {}, options = {}) {
  if (typeof options.authorize === 'function') return options.authorize(request, env, ctx);
  const expectedEmail = clean(env.RIOSYSTEMS_OPERATOR_EMAIL, 320).toLowerCase();
  const expectedAud = clean(env.RIOSYSTEMS_ACCESS_AUD, 320);
  if (!expectedEmail || !expectedAud) return { ok: false, status: 503, error: 'OPERATOR_ACCESS_NOT_CONFIGURED' };
  if (!ctx?.access || typeof ctx.access.getIdentity !== 'function') return { ok: false, status: 401, error: 'CLOUDFLARE_ACCESS_REQUIRED' };
  if (clean(ctx.access.aud, 320) !== expectedAud) return { ok: false, status: 403, error: 'CLOUDFLARE_ACCESS_AUDIENCE_MISMATCH' };
  let identity = null;
  try { identity = await ctx.access.getIdentity(); } catch { return { ok: false, status: 401, error: 'CLOUDFLARE_ACCESS_IDENTITY_FAILED' }; }
  const email = clean(identity?.email, 320).toLowerCase();
  if (!email || email !== expectedEmail) return { ok: false, status: 403, error: 'OPERATOR_IDENTITY_NOT_ALLOWED' };
  return { ok: true, operator_id: `operator:${email}`, email };
}

function safeMissionInput(body, project) {
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

function buildPlanReview(safeInput) {
  const compiled = compileUniversalMission(safeInput);
  if (!compiled.ok) return compiled;
  const analysis = analyzeMissionBusiness(compiled.mission);
  const selection = selectMissionCapabilities(compiled.mission, analysis);
  const plan = buildCapabilityDependencyPlan(compiled.mission, selection);
  const preflight = missionCostApprovalPreflight(compiled.mission, plan);
  return { ok: preflight.ok, mission: compiled.mission, analysis, plan, preflight };
}

function purgeExpiredPlans() {
  const now = Date.now();
  for (const [key, value] of pendingPlans.entries()) if (value.expires_at_ms <= now) pendingPlans.delete(key);
}

function pendingForOperator(operatorId) {
  purgeExpiredPlans();
  return [...pendingPlans.values()]
    .filter((item) => item.operator_id === operatorId)
    .map((item) => ({
      plan_token: item.plan_token,
      scope_key: item.scope_key,
      mission_id: item.review.mission.mission_id,
      business_name: item.review.mission.business_name,
      mission_text: item.review.mission.mission_text,
      selected_capabilities: clone(item.review.plan?.selected_capabilities || []),
      rejected_capabilities: clone(item.review.plan?.rejected_capabilities || []),
      providers: [...new Set((item.review.plan?.selected_capabilities || []).flatMap((task) => [task.provider?.primary, task.provider?.fallback]).filter(Boolean))],
      generated_by: 'universal-mission-run-v1',
      estimated_variable_cost_eur: item.review.preflight.estimated_variable_cost_eur,
      risk: 'SYNTHETIC_STAGING_ONLY',
      side_effects: 'NO_REAL_PROVIDER_WRITES',
      confirmation_text: PLAN_CONFIRMATION_TEXT,
      status: item.status || 'APPROVAL_REQUIRED',
      created_at: item.created_at,
      deferred_at: item.deferred_at || null,
      expires_at: item.expires_at,
      production_deploy: false
    }));
}

async function executePendingPlan(service, operatorId, runtime, pending) {
  if (runtime.revision !== pending.expected_revision) {
    pendingPlans.delete(pending.plan_token);
    recordUiAudit(operatorId, {
      event: 'MISSION_PLAN_INVALIDATED_BY_RUNTIME_REVISION',
      scope_key: pending.scope_key,
      mission_id: pending.review.mission.mission_id,
      plan_token: pending.plan_token
    });
    return {
      status: 409,
      body: {
        error: 'PLAN_RUNTIME_REVISION_CONFLICT',
        expected_revision: pending.expected_revision,
        actual_revision: runtime.revision,
        production_deploy: false
      }
    };
  }

  recordUiAudit(operatorId, {
    event: 'MISSION_PLAN_APPROVED',
    scope_key: pending.scope_key,
    mission_id: pending.review.mission.mission_id,
    plan_token: pending.plan_token,
    decision: 'approve'
  });

  const executed = await service.handle({
    method: 'POST',
    path: '/universal-missions',
    body: { ...pending.input, expected_revision: pending.expected_revision }
  });

  if (executed.ok) {
    pendingPlans.delete(pending.plan_token);
    const missionId = clean(executed.body?.mission_id, 220) || pending.review.mission.mission_id;
    recordUiAudit(operatorId, { event: 'SUPERVISED_SYNTHETIC_STAGING_COMPLETED', scope_key: pending.scope_key, mission_id: missionId, source: 'operator_runtime_evidence' });
    if (executed.body?.quality_score === 100) {
      recordUiAudit(operatorId, { event: 'QUALITY_GATE_PASSED', scope_key: pending.scope_key, mission_id: missionId, source: 'universal_mission_quality' });
    }
    if (executed.body?.status === 'SIMULATED_HANDOFF_READY') {
      recordUiAudit(operatorId, { event: 'UNIFIED_DELIVERY_AVAILABLE', scope_key: pending.scope_key, mission_id: missionId, source: 'unified_mission_delivery' });
    }
  }

  return {
    status: executed.status,
    body: { ...executed.body, approved_plan_token: pending.plan_token, production_deploy: false }
  };
}

async function decideMissionPlan(service, operatorId, runtime, body) {
  purgeExpiredPlans();
  const planToken = clean(body.plan_token, 320);
  const decision = clean(body.decision, 80).toLowerCase();
  const pending = pendingPlans.get(planToken);
  if (!pending || pending.operator_id !== operatorId) {
    return { status: 404, body: { error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false } };
  }

  if (decision === 'approve') {
    if (clean(body.confirmation_text, 120) !== PLAN_CONFIRMATION_TEXT) {
      return {
        status: 400,
        body: {
          error: 'PLAN_CONFIRMATION_TEXT_REQUIRED',
          required_confirmation_text: PLAN_CONFIRMATION_TEXT,
          production_deploy: false
        }
      };
    }
    return executePendingPlan(service, operatorId, runtime, pending);
  }

  if (decision === 'reject') {
    pendingPlans.delete(planToken);
    recordUiAudit(operatorId, {
      event: 'MISSION_PLAN_REJECTED',
      scope_key: pending.scope_key,
      mission_id: pending.review.mission.mission_id,
      plan_token: planToken,
      decision
    });
    return {
      status: 200,
      body: {
        schema: 'riosystems.operator-plan-decision.v1',
        status: 'REJECTED',
        plan_token: planToken,
        execution_started: false,
        production_deploy: false
      }
    };
  }

  if (decision === 'defer') {
    pending.status = 'DEFERRED';
    pending.deferred_at = new Date().toISOString();
    recordUiAudit(operatorId, {
      event: 'MISSION_PLAN_DEFERRED',
      scope_key: pending.scope_key,
      mission_id: pending.review.mission.mission_id,
      plan_token: planToken,
      decision
    });
    return {
      status: 200,
      body: {
        schema: 'riosystems.operator-plan-decision.v1',
        status: 'DEFERRED',
        plan_token: planToken,
        execution_started: false,
        production_deploy: false
      }
    };
  }

  return { status: 400, body: { error: 'PLAN_DECISION_NOT_SUPPORTED', production_deploy: false } };
}

function projectTags(detail = {}) {
  const project = detail.project || {};
  const tags = new Set(['synthetic']);
  if (String(project.state || '').toUpperCase() === 'ACTIVE') tags.add('active');
  if (project.blocked || Number(project.blocker_count || 0) > 0) tags.add('blocked');
  if (Number(project.open_approval_count || 0) > 0) tags.add('approval_required');
  if (project.environment === 'staging') tags.add('staging');
  if (['DELIVERY_READY', 'SIMULATED_HANDOFF_READY'].includes(String(project.mission_status || '').toUpperCase())) tags.add('delivery_ready');
  if (String(project.mission_status || '').toUpperCase() === 'COMPLETED') tags.add('completed');
  if (String(project.mission_status || '').toUpperCase() === 'FAILED' || String(project.state || '').toUpperCase() === 'FAILED') tags.add('failed');
  if (project.production_deploy === true) tags.add('production');
  return [...tags];
}

async function customApi(service, operatorId, path, request, body) {
  const snapshotResponse = await service.handle({ method: 'GET', path: '/snapshot' });
  if (!snapshotResponse.ok) return { status: snapshotResponse.status || 500, body: snapshotResponse.body };
  const snapshot = snapshotResponse.body;
  const runtime = snapshotResponse.runtime;
  const pending = pendingForOperator(operatorId);
  const uiAudit = auditFor(operatorId);

  if (path === '/projects' && request.method === 'GET') {
    const base = await service.handle({ method: 'GET', path: '/projects' });
    if (!base.ok) return { status: base.status || 500, body: base.body };
    const items = (base.body?.items || []).map((project) => {
      const detail = buildOperatorProjectDetail({ runtime, scope_key: project.scope_key, pending_plans: pending, ui_audit: uiAudit });
      if (!detail.ok) return project;
      return {
        ...project,
        mission_status: detail.project.mission_status,
        progress_percent: detail.project.progress_percent,
        current_cost_eur: detail.project.current_cost_eur,
        open_approval_count: detail.project.open_approval_count,
        blocker_count: detail.project.blocker_count,
        reality: detail.reality,
        filter_tags: projectTags(detail)
      };
    });
    return { status: 200, body: { ...base.body, schema: 'riosystems.operator-projects-view.v2', items, production_deploy: false } };
  }

  if (path.startsWith('/project-detail/') && request.method === 'GET') {
    let scopeKey = '';
    try { scopeKey = decodeURIComponent(path.slice('/project-detail/'.length)); } catch { return { status: 400, body: { error: 'INVALID_PROJECT_SCOPE_ENCODING', production_deploy: false } }; }
    const detail = buildOperatorProjectDetail({ runtime, scope_key: scopeKey, pending_plans: pending, ui_audit: uiAudit });
    return { status: detail.ok ? 200 : 404, body: detail };
  }

  if (path === '/providers' && request.method === 'GET') {
    return { status: 200, body: buildProviderOperations({ runtime, snapshot }) };
  }

  if (path === '/factories' && request.method === 'GET') {
    return { status: 200, body: buildFactoryOperations({ runtime, snapshot }) };
  }

  if (path === '/costs' && request.method === 'GET') {
    return { status: 200, body: buildOperatorCostCenter({ runtime, snapshot }) };
  }

  if (path === '/audit' && request.method === 'GET') {
    return { status: 200, body: buildAuditView({ runtime, ui_audit: uiAudit }) };
  }

  if (path === '/settings' && request.method === 'GET') {
    return {
      status: 200,
      body: {
        schema: 'riosystems.operator-settings-view.v2',
        default_environment: 'staging',
        data_mode: 'synthetic_only',
        mission_variable_budget_ceiling_eur: 0,
        monthly_operator_budget_eur: null,
        provider_retry_limit: '1 synthetic fallback attempt (UMR V1)',
        automatic_paid_overflow: false,
        production_policy: 'LOCKED',
        approval_policy: 'EXPLICIT_SERVER_SIDE',
        provider_fallback: 'BOUNDED_ZERO_COST_ONLY',
        runtime_store: 'MEMORY_REFERENCE_ADAPTER',
        persistence_note: 'Runtime state and dashboard-only pending approvals are not durable across Worker isolate restarts.',
        secrets_surface: 'NOT_EXPOSED',
        production_deploy: false
      }
    };
  }

  if (path === '/system-health' && request.method === 'GET') {
    const factories = buildFactoryOperations({ runtime, snapshot });
    return {
      status: 200,
      body: {
        schema: 'riosystems.operator-system-health.v2',
        control_plane: operatorDashboardStatusMeta(snapshot.control_plane.readiness.status),
        factory_control_api: { raw: 'VERIFIED_HEALTHY', label: 'Operator Runtime API verified', tone: 'ready' },
        factories: factories.items.map((item) => ({ ...item, ui_status: operatorDashboardStatusMeta(item.status) })),
        providers: buildProviderOperations({ runtime, snapshot }),
        ci: { raw: 'NOT_VERIFIED', label: 'CI status is repository evidence and is not projected into this runtime yet', tone: 'neutral' },
        production: { raw: 'DISABLED', label: 'Production disabled', tone: 'neutral' },
        production_deploy: false
      }
    };
  }

  if (path === '/approvals' && request.method === 'GET') {
    const core = await service.handle({ method: 'GET', path: '/approvals' });
    return {
      status: 200,
      body: {
        schema: 'riosystems.operator-approval-center.v2',
        core: core.body,
        mission_plans: pending,
        production_deploy: false
      }
    };
  }

  if (path === '/mission-preflight' && request.method === 'POST') {
    const scopeKey = clean(body.scope_key, 300);
    const contextScopeKey = clean(body.context_scope_key, 300);
    if (!scopeKey) return { status: 400, body: { error: 'MISSION_PROJECT_SCOPE_REQUIRED', production_deploy: false } };
    if (contextScopeKey && contextScopeKey !== scopeKey) return { status: 409, body: { error: 'MISSION_PROJECT_CONTEXT_MISMATCH', production_deploy: false } };
    const project = (runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey);
    if (!project) return { status: 404, body: { error: 'MISSION_PROJECT_SCOPE_NOT_FOUND', production_deploy: false } };
    const input = safeMissionInput(body, project);
    if (!input.mission_text) return { status: 400, body: { error: 'MISSION_TEXT_REQUIRED', production_deploy: false } };
    const review = buildPlanReview(input);
    if (!review.ok) return { status: 400, body: review };
    const planToken = `plan:${review.mission.mission_id}:r${runtime.revision}`;
    const createdAt = new Date().toISOString();
    const expiresAtMs = Date.now() + 30 * 60 * 1000;
    pendingPlans.set(planToken, {
      plan_token: planToken,
      operator_id: operatorId,
      scope_key: scopeKey,
      expected_revision: runtime.revision,
      input,
      review,
      status: 'APPROVAL_REQUIRED',
      created_at: createdAt,
      expires_at_ms: expiresAtMs,
      expires_at: new Date(expiresAtMs).toISOString()
    });
    recordUiAudit(operatorId, {
      event: 'MISSION_PLAN_CREATED',
      scope_key: scopeKey,
      mission_id: review.mission.mission_id,
      plan_token: planToken
    });
    return {
      status: 201,
      body: {
        schema: 'riosystems.operator-plan-review.v2',
        status: 'APPROVAL_REQUIRED',
        plan_token: planToken,
        confirmation_text: PLAN_CONFIRMATION_TEXT,
        runtime_revision: runtime.revision,
        ...clone(review),
        execution_started: false,
        production_deploy: false
      }
    };
  }

  if (path === '/mission-plan-decision' && request.method === 'POST') {
    return decideMissionPlan(service, operatorId, runtime, body);
  }

  if (path === '/mission-approve' && request.method === 'POST') {
    return decideMissionPlan(service, operatorId, runtime, {
      ...body,
      decision: 'approve',
      confirmation_text: clean(body.confirmation_text, 120) || PLAN_CONFIRMATION_TEXT
    });
  }

  return null;
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!(url.pathname === '/operator' || url.pathname === '/operator/' || url.pathname.startsWith('/operator/api/'))) return null;

  const auth = await authorizeOperator(request, env, ctx, options);
  if (!auth.ok) {
    const body = { error: auth.error, private_operator_access_required: true, production_deploy: false };
    return url.pathname.startsWith('/operator/api/')
      ? json(body, auth.status || 403)
      : html('<!doctype html><meta charset="utf-8"><title>RIOSYSTEMS Private</title><body style="font-family:system-ui;padding:3rem"><h1>RIOSYSTEMS Private Operator Control Plane</h1><p>Private operator authentication is required.</p></body>', auth.status || 403);
  }

  if (url.pathname === '/operator' || url.pathname === '/operator/') {
    return html(renderOperatorDashboardShell(OPERATOR_STATUS_MAP));
  }

  const service = getRuntimeService(auth.operator_id, options);
  const path = url.pathname.slice('/operator/api'.length) || '/dashboard';
  const body = await readBody(request);
  const custom = await customApi(service, auth.operator_id, path, request, body);
  if (custom) return json(custom.body, custom.status);

  const allowedPaths = ['/health', '/snapshot', '/dashboard', '/missions', '/deliveries', '/actions'];
  const pass = allowedPaths.includes(path)
    || /^\/projects\/[^/]+(?:\/select)?$/.test(path)
    || /^\/missions\/[^/]+$/.test(path);
  if (!pass) return json({ error: 'OPERATOR_DASHBOARD_ROUTE_NOT_FOUND', production_deploy: false }, 404);

  const result = await service.handle({
    method: request.method,
    path,
    body,
    expected_revision: body.expected_revision
  });
  return json(result.body, result.status || (result.ok ? 200 : 400));
}

export function operatorDashboardHttpManifest() {
  return {
    schema: 'riosystems.private-operator-dashboard-http.v1',
    route: '/operator',
    auth: 'cloudflare_access_ctx_identity_fail_closed',
    single_operator: true,
    local_dev_access_supported_by_cloudflare_access_dev_identity: true,
    backend: 'riosystems.operator-runtime-api.v1',
    plan_review_uses_existing_universal_mission_compiler: true,
    mission_execution_uses_existing_operator_runtime_api: true,
    project_detail_is_projection_only: true,
    cost_dimensions_are_projection_only: true,
    operator_plan_decisions_are_server_side: true,
    operator_action_audit: true,
    direct_provider_calls: false,
    secrets_in_frontend: false,
    automatic_dispatch: false,
    automatic_paid_overflow: false,
    real_customer_data: false,
    production_deploy: false
  };
}
