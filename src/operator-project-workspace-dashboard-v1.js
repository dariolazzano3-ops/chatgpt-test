import { handleOperatorDashboard as handleExistingOperatorDashboard } from './operator-provider-preflight-seal-v1.js';
import { authorizeOperator } from './operator-dashboard-http-v1.js';
import {
  AURENTARA_WEBSITE_SCOPE,
  createAurentaraPublicWebsitePortfolioEntry,
  buildOperatorProjectWorkspace,
  classifyOperatorProjectChange,
  workspaceDecisionResult,
  enhanceOperatorDashboardShell,
  renderOperatorProjectWorkspaceShell,
  operatorProjectWorkspaceManifest
} from './operator-project-workspace-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const workspaceAudit = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function workspaceHtml(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://*.pages.dev; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    }
  });
}

function auditFor(operatorId) {
  if (!workspaceAudit.has(operatorId)) workspaceAudit.set(operatorId, []);
  return workspaceAudit.get(operatorId);
}

function recordWorkspaceAudit(operatorId, event = {}) {
  const item = {
    event: clean(event.event, 160),
    actor: operatorId,
    source: 'operator_project_workspace_v1',
    scope_key: AURENTARA_WEBSITE_SCOPE,
    iteration_label: clean(event.iteration_label, 160) || null,
    branch: clean(event.branch, 240) || 'factory/operator-project-workspace-v1',
    git_sha: clean(event.git_sha, 80) || null,
    preview_url: clean(event.preview_url, 1200) || null,
    qa_status: clean(event.qa_status, 80) || null,
    status: clean(event.status, 120) || null,
    decision: clean(event.decision, 80) || null,
    at: new Date().toISOString()
  };
  auditFor(operatorId).push(item);
  return item;
}

async function authorize(request, env, ctx, options) {
  const auth = await authorizeOperator(request, env, ctx, options);
  return auth.ok ? auth : null;
}

async function currentRuntimeProject(service) {
  if (!service || typeof service.handle !== 'function') return null;
  const response = await service.handle({ method: 'GET', path: '/projects' });
  if (!response.ok) return null;
  return (response.body?.items || []).find((item) => item.scope_key === AURENTARA_WEBSITE_SCOPE) || null;
}

async function ensureRuntimeProject(service) {
  const existing = await currentRuntimeProject(service);
  if (existing) return { ok: true, project: existing, created: false };
  if (!service || typeof service.handle !== 'function') return { ok: false, error: 'OPERATOR_RUNTIME_SERVICE_REQUIRED' };
  const snapshot = await service.handle({ method: 'GET', path: '/snapshot' });
  const revision = Number(snapshot.runtime?.revision);
  if (!snapshot.ok || !Number.isInteger(revision)) return { ok: false, error: 'OPERATOR_RUNTIME_REVISION_NOT_AVAILABLE' };
  const entry = createAurentaraPublicWebsitePortfolioEntry();
  const result = await service.handle({
    method: 'POST',
    path: '/commands',
    body: {
      type: 'CREATE_PROJECT',
      expected_revision: revision,
      customer_id: entry.customer_id,
      project_id: entry.project_id,
      scope_key: entry.scope_key,
      business_name: entry.name,
      industry: entry.industry,
      country: entry.country,
      language: entry.language,
      mission_context: 'AURENTARA SYSTEMS Public Website V1 private release-candidate iteration workspace.',
      allowed_environments: ['staging'],
      data_policy: { synthetic_only: true, real_customer_data: false },
      budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
      production_authorized: false,
      production_deploy: false
    }
  });
  if (!result.ok) return { ok: false, error: result.body?.error || 'PROJECT_RUNTIME_REGISTRATION_FAILED', status: result.status || 400 };
  return { ok: true, project: result.body?.command?.project || entry, created: result.body?.command?.idempotent_existing !== true };
}

function previewUrl(env = {}) {
  const configured = clean(env.RIOSYSTEMS_AURENTARA_WEBSITE_PREVIEW_URL, 1200);
  return /^https:\/\/[^\s]+\.pages\.dev(?:\/.*)?$/i.test(configured) ? configured : null;
}

async function workspaceSnapshot(service, operatorId, env) {
  const runtimeProject = await currentRuntimeProject(service);
  const project = runtimeProject || createAurentaraPublicWebsitePortfolioEntry();
  const snapshot = buildOperatorProjectWorkspace({
    project,
    ui_audit: auditFor(operatorId),
    preview_url: previewUrl(env),
    preview_status: previewUrl(env) ? 'AVAILABLE' : 'NOT_AVAILABLE'
  });
  return {
    ...snapshot,
    runtime_registration: runtimeProject ? 'REGISTERED_AUTHORITATIVE_RUNTIME' : 'REPOSITORY_PROJECT_PENDING_RUNTIME_REGISTRATION',
    runtime_registration_occurs_on: 'EXPLICIT_PREFLIGHT_ACTION',
    duplicate_project_state: false
  };
}

async function handleWorkspaceApi(request, env, ctx, options = {}) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/operator\/api\/project-workspace\/([^/]+)(?:\/(classify|decision))?$/);
  if (!match) return null;
  const auth = await authorize(request, env, ctx, options);
  if (!auth) return handleExistingOperatorDashboard(request, env, ctx, options);
  let scope = '';
  try { scope = decodeURIComponent(match[1]); } catch { return json({ error: 'INVALID_PROJECT_SCOPE_ENCODING', production_deploy: false }, 400); }
  if (scope !== AURENTARA_WEBSITE_SCOPE) return json({ error: 'PROJECT_WORKSPACE_NOT_SUPPORTED', scope_key: scope, production_deploy: false }, 404);
  const service = options.runtime_service;
  const action = match[2] || null;

  if (request.method === 'GET' && !action) return json(await workspaceSnapshot(service, auth.operator_id, env));
  let body = {};
  try { body = await request.clone().json(); } catch { body = {}; }

  if (request.method === 'POST' && action === 'classify') {
    const classified = classifyOperatorProjectChange(body);
    if (!classified.ok) return json(classified, 400);
    recordWorkspaceAudit(auth.operator_id, { event: 'WORKSPACE_CHANGE_CLASSIFIED', iteration_label: 'Change Request', status: classified.allowed ? 'PREFLIGHT_READY' : 'BLOCKED', qa_status: 'NOT_VERIFIED' });
    return json({ ...classified, scope_key: scope, runtime_registration: (await currentRuntimeProject(service)) ? 'REGISTERED_AUTHORITATIVE_RUNTIME' : 'PENDING_UNTIL_PREFLIGHT' }, 200);
  }

  if (request.method === 'POST' && action === 'decision') {
    const result = workspaceDecisionResult(body.decision);
    if (!result.ok) return json(result, 400);
    recordWorkspaceAudit(auth.operator_id, {
      event: result.status === 'ITERATION_ACCEPTED' ? 'WORKSPACE_ITERATION_ACCEPTED' : result.status === 'CHANGES_REQUESTED' ? 'WORKSPACE_CHANGES_REQUESTED' : 'WORKSPACE_RETURN_TO_ACCEPTED_REQUESTED',
      iteration_label: result.status === 'ITERATION_ACCEPTED' ? 'Accepted Workspace Iteration' : result.status === 'CHANGES_REQUESTED' ? 'Requested Changes' : 'Return to V1 RC',
      decision: result.decision,
      status: result.status,
      qa_status: 'NOT_VERIFIED',
      preview_url: previewUrl(env)
    });
    return json(result);
  }
  return json({ error: 'PROJECT_WORKSPACE_ROUTE_NOT_FOUND', production_deploy: false }, 404);
}

async function maybeEnsureWebsiteForPreflight(request, options = {}) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/operator/api/mission-preflight') return { ok: true, touched: false };
  let body = {};
  try { body = await request.clone().json(); } catch { return { ok: true, touched: false }; }
  if (body.scope_key !== AURENTARA_WEBSITE_SCOPE) return { ok: true, touched: false };
  const ensured = await ensureRuntimeProject(options.runtime_service);
  return ensured.ok ? { ok: true, touched: ensured.created } : ensured;
}

async function decorateProjectsResponse(response, env) {
  if (!response || response.status !== 200) return response;
  try {
    const body = await response.clone().json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.some((item) => item.scope_key === AURENTARA_WEBSITE_SCOPE)) {
      const entry = createAurentaraPublicWebsitePortfolioEntry();
      items.unshift({
        ...entry,
        rank: 1,
        mission_status: 'PRIVATE_RELEASE_CANDIDATE',
        progress_percent: 100,
        current_cost_eur: 0,
        open_approval_count: 0,
        blocker_count: 0,
        reality: 'REPOSITORY_ACCEPTED_RC',
        filter_tags: ['active', 'staging', 'workspace'],
        preview_status: previewUrl(env) ? 'AVAILABLE' : 'NOT_AVAILABLE',
        runtime_registration: 'PENDING_UNTIL_PREFLIGHT'
      });
    }
    return json({ ...body, items, project_workspace_v1: true, production_deploy: false });
  } catch {
    return response;
  }
}

export async function handleOperatorDashboard(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/operator/api/project-workspace/')) {
    const handled = await handleWorkspaceApi(request, env, ctx, options);
    if (handled) return handled;
  }

  if (url.pathname.startsWith('/operator/workspace/')) {
    const auth = await authorize(request, env, ctx, options);
    if (!auth) return handleExistingOperatorDashboard(new Request(new URL('/operator', request.url), { method: 'GET', headers: request.headers }), env, ctx, options);
    let scope = '';
    try { scope = decodeURIComponent(url.pathname.slice('/operator/workspace/'.length)); } catch { return json({ error: 'INVALID_PROJECT_SCOPE_ENCODING', production_deploy: false }, 400); }
    if (scope !== AURENTARA_WEBSITE_SCOPE) return json({ error: 'PROJECT_WORKSPACE_NOT_SUPPORTED', production_deploy: false }, 404);
    return workspaceHtml(renderOperatorProjectWorkspaceShell({ scope_key: scope }));
  }

  const ensure = await maybeEnsureWebsiteForPreflight(request, options);
  if (!ensure.ok) return json({ error: ensure.error, runtime_registration_failed: true, production_deploy: false }, ensure.status || 409);

  const response = await handleExistingOperatorDashboard(request, env, ctx, options);
  if (!response) return null;

  if (request.method === 'GET' && url.pathname === '/operator/api/projects') return decorateProjectsResponse(response, env);

  const type = response.headers.get('content-type') || '';
  if (!(url.pathname === '/operator' || url.pathname === '/operator/') || response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = enhanceOperatorDashboardShell(source);
  const headers = new Headers(response.headers);
  headers.set('x-aurentara-project-workspace-v1', 'enabled');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorProjectWorkspaceDashboardManifest() {
  return {
    schema: 'riosystems.operator-project-workspace-dashboard.v1',
    outer_wrapper_over_existing_operator_chain: true,
    authoritative_runtime_registration_command: 'CREATE_PROJECT',
    runtime_registration_side_effect_timing: 'EXPLICIT_PREFLIGHT_ONLY',
    repository_projection_before_runtime_registration: true,
    existing_mission_preflight_reused: true,
    existing_operator_approval_reused: true,
    existing_execution_layer_reused: true,
    preview_provider: 'cloudflare_pages_factory_preview',
    preview_env_binding_optional: 'RIOSYSTEMS_AURENTARA_WEBSITE_PREVIEW_URL',
    workspace_manifest: operatorProjectWorkspaceManifest(),
    production_deploy: false,
    dns_change: false,
    indexing: false,
    billing: false,
    real_customer_data: false,
    paid_provider_calls: 0,
    additional_variable_cost_eur: 0
  };
}
