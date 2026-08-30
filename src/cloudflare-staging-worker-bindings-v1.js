import { buildCloudflareAccessReadonlyPlan, runCloudflareAccessReadonlyVerification } from './cloudflare-access-readonly-verifier-v1.js';

const API_ORIGIN = 'https://api.cloudflare.com';
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export const OPERATOR_STAGING_SECRET_BINDINGS = Object.freeze([
  'RIOSYSTEMS_OPERATOR_EMAIL',
  'RIOSYSTEMS_ACCESS_AUD',
  'RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL',
  'RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY'
]);

function validAccountId(value) {
  return /^[a-f0-9]{32}$/i.test(clean(value, 64));
}

function safeHostname(domain = '') {
  const value = clean(domain, 500);
  if (!value) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function targetApp(app = {}, workerName = 'riosystems-staging') {
  if (clean(app.type, 80).toLowerCase() !== 'self_hosted') return false;
  const hostname = safeHostname(app.domain);
  const worker = clean(workerName, 120).toLowerCase();
  return Boolean(hostname && worker) && hostname.startsWith(`${worker}.`) && hostname.endsWith('.workers.dev');
}

function apiRequest(path, method = 'GET', body = null) {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/client/v4/')) throw new Error('CLOUDFLARE_BINDING_API_PATH_REJECTED');
  return { method, url: url.toString(), body };
}

async function requestJson(fetchImpl, spec, token, timeoutMs) {
  if (!spec || !['GET','PUT'].includes(spec.method)) return { ok: false, status: 0, error: 'CLOUDFLARE_BINDING_METHOD_REJECTED' };
  const url = new URL(spec.url);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/client/v4/')) return { ok: false, status: 0, error: 'CLOUDFLARE_BINDING_REQUEST_REJECTED' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(spec.url, {
      method: spec.method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(spec.method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
      body: spec.method === 'PUT' ? JSON.stringify(spec.body) : undefined,
      redirect: 'error',
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    return { ok: response.ok && body?.success !== false, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, error: clean(error?.message || error, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function bindingNames(result = {}) {
  return new Set((Array.isArray(result.body?.result) ? result.body.result : []).map((item) => clean(item?.name, 160)).filter(Boolean));
}

function sanitizeFailure(code, extras = {}) {
  return {
    ok: false,
    schema: 'riosystems.cloudflare-staging-worker-bindings.v1',
    error: code,
    ...extras,
    secret_values_returned: false,
    access_audience_returned: false,
    production_deploy: false,
    variable_cost_eur: 0
  };
}

export function buildCloudflareStagingWorkerBindingsPlan(input = {}) {
  const accountId = clean(input.account_id, 64);
  const workerName = clean(input.worker_name || 'riosystems-staging', 120);
  const mode = clean(input.mode || 'verify', 20).toLowerCase();
  if (!validAccountId(accountId)) return sanitizeFailure('CLOUDFLARE_ACCOUNT_ID_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/i.test(workerName)) return sanitizeFailure('CLOUDFLARE_WORKER_NAME_INVALID');
  if (!['verify','sync'].includes(mode)) return sanitizeFailure('CLOUDFLARE_BINDING_MODE_INVALID');
  const secretsPath = `/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}/secrets`;
  return {
    ok: true,
    schema: 'riosystems.cloudflare-staging-worker-bindings-plan.v1',
    state: 'STAGING_BINDING_PLAN_READY',
    mode,
    account_id: accountId,
    worker_name: workerName,
    token_ref: 'secret:CLOUDFLARE_API_TOKEN',
    operator_email_ref: 'secret:RIOSYSTEMS_OPERATOR_EMAIL',
    runtime_url_ref: 'secret:RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL',
    runtime_service_role_ref: 'secret:RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY',
    applications_request: apiRequest(`/client/v4/accounts/${accountId}/access/apps?per_page=100`),
    secrets_request: apiRequest(secretsPath),
    secrets_path: secretsPath,
    required_binding_names: [...OPERATOR_STAGING_SECRET_BINDINGS],
    staging_only: true,
    external_write: mode === 'sync',
    production_deploy: false
  };
}

export async function runCloudflareStagingWorkerBindings(plan = {}, runtime = {}) {
  if (plan.state !== 'STAGING_BINDING_PLAN_READY' || plan.production_deploy === true || runtime.production_deploy === true) return sanitizeFailure('STAGING_BINDING_PLAN_REQUIRED');
  if (plan.worker_name !== 'riosystems-staging' || plan.staging_only !== true) return sanitizeFailure('STAGING_WORKER_SCOPE_REJECTED');
  if (typeof runtime.fetch_impl !== 'function' || typeof runtime.resolve_secret !== 'function') return sanitizeFailure('STAGING_BINDING_RUNTIME_REQUIRED');
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 8000, 1000), 15000);
  const token = clean(await runtime.resolve_secret(plan.token_ref), 4000);
  if (!token) return sanitizeFailure('CLOUDFLARE_API_TOKEN_REQUIRED');

  const accessPlan = buildCloudflareAccessReadonlyPlan({ account_id: plan.account_id, expected_worker_name: plan.worker_name, token_ref: plan.token_ref });
  const access = await runCloudflareAccessReadonlyVerification(accessPlan, { fetch_impl: runtime.fetch_impl, resolve_secret: async (ref) => ref === plan.token_ref ? token : null, timeout_ms: timeoutMs, production_deploy: false });
  if (!access.ok) return sanitizeFailure('PRIVATE_ACCESS_PRECONDITION_FAILED', { access_stage: access.stage || access.error || null });

  const appsResult = await requestJson(runtime.fetch_impl, plan.applications_request, token, timeoutMs);
  if (!appsResult.ok) return sanitizeFailure(`ACCESS_APPLICATION_RESOLUTION_FAILED:${appsResult.status || 0}`);
  const apps = Array.isArray(appsResult.body?.result) ? appsResult.body.result : [];
  const matches = apps.filter((app) => targetApp(app, plan.worker_name));
  if (matches.length !== 1) return sanitizeFailure(matches.length ? 'ACCESS_APPLICATION_AMBIGUOUS' : 'ACCESS_APPLICATION_NOT_FOUND');
  const audience = clean(matches[0]?.aud, 500);
  if (!audience) return sanitizeFailure('ACCESS_APPLICATION_AUDIENCE_MISSING');

  const before = await requestJson(runtime.fetch_impl, plan.secrets_request, token, timeoutMs);
  if (!before.ok) return sanitizeFailure(`WORKER_SECRET_BINDINGS_READ_FAILED:${before.status || 0}`);

  if (plan.mode === 'verify') {
    const names = bindingNames(before);
    const missing = plan.required_binding_names.filter((name) => !names.has(name));
    return {
      ok: missing.length === 0,
      schema: 'riosystems.cloudflare-staging-worker-bindings.v1',
      mode: 'verify',
      worker_name: plan.worker_name,
      bindings_verified: missing.length === 0,
      required_binding_count: plan.required_binding_names.length,
      present_binding_count: plan.required_binding_names.length - missing.length,
      missing_binding_names: missing,
      external_write_performed: false,
      secret_values_returned: false,
      access_audience_returned: false,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  if (plan.mode !== 'sync' || plan.external_write !== true) return sanitizeFailure('STAGING_BINDING_SYNC_APPROVAL_REQUIRED');
  if (clean(runtime.confirmation, 120) !== 'DEPLOY_RIOSYSTEMS_STAGING_ZERO_COST') return sanitizeFailure('STAGING_BINDING_EXACT_CONFIRMATION_REQUIRED');

  const operatorEmail = clean(await runtime.resolve_secret(plan.operator_email_ref), 320).toLowerCase();
  const runtimeUrl = clean(await runtime.resolve_secret(plan.runtime_url_ref), 2000).replace(/\/+$/, '');
  const serviceRoleKey = clean(await runtime.resolve_secret(plan.runtime_service_role_ref), 4000);
  if (!operatorEmail || !/^https:\/\/[^/]+\.supabase\.co$/i.test(runtimeUrl) || !serviceRoleKey) return sanitizeFailure('STAGING_BINDING_SOURCE_SECRETS_REQUIRED');

  const desired = {
    RIOSYSTEMS_OPERATOR_EMAIL: operatorEmail,
    RIOSYSTEMS_ACCESS_AUD: audience,
    RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL: runtimeUrl,
    RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey
  };

  for (const name of plan.required_binding_names) {
    const response = await requestJson(runtime.fetch_impl, apiRequest(plan.secrets_path, 'PUT', { name, text: desired[name], type: 'secret_text' }), token, timeoutMs);
    if (!response.ok) return sanitizeFailure(`WORKER_SECRET_BINDING_SYNC_FAILED:${name}:${response.status || 0}`, { failed_binding_name: name });
  }

  const after = await requestJson(runtime.fetch_impl, plan.secrets_request, token, timeoutMs);
  if (!after.ok) return sanitizeFailure(`WORKER_SECRET_BINDINGS_VERIFY_FAILED:${after.status || 0}`);
  const names = bindingNames(after);
  const missing = plan.required_binding_names.filter((name) => !names.has(name));
  if (missing.length) return sanitizeFailure('WORKER_SECRET_BINDINGS_INCOMPLETE_AFTER_SYNC', { missing_binding_names: missing });

  return {
    ok: true,
    schema: 'riosystems.cloudflare-staging-worker-bindings.v1',
    mode: 'sync',
    worker_name: plan.worker_name,
    bindings_synchronized: true,
    bindings_verified: true,
    synchronized_binding_names: [...plan.required_binding_names],
    required_binding_count: plan.required_binding_names.length,
    external_write_performed: true,
    external_write_scope: 'cloudflare_worker_staging_secret_bindings_only',
    secret_values_returned: false,
    access_audience_returned: false,
    production_deploy: false,
    variable_cost_eur: 0
  };
}

export function cloudflareStagingWorkerBindingsManifest() {
  return {
    schema: 'riosystems.cloudflare-staging-worker-bindings.v1',
    worker_name: 'riosystems-staging',
    required_binding_names: [...OPERATOR_STAGING_SECRET_BINDINGS],
    verify_methods: ['GET'],
    sync_methods: ['GET','PUT'],
    access_policy_precondition_required: true,
    exact_sync_confirmation: 'DEPLOY_RIOSYSTEMS_STAGING_ZERO_COST',
    secret_values_returned: false,
    production_deploy: false,
    variable_cost_eur: 0
  };
}