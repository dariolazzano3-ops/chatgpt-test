const API_ORIGIN = 'https://api.cloudflare.com';
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function validAccountId(value) {
  return /^[a-f0-9]{32}$/i.test(clean(value, 64));
}

function request(path) {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new Error('CLOUDFLARE_API_ORIGIN_REJECTED');
  return { method: 'GET', url: url.toString() };
}

export function buildCloudflareReadonlyPreflightPlan(input = {}) {
  const accountId = clean(input.account_id, 64);
  if (!validAccountId(accountId)) return { ok: false, error: 'CLOUDFLARE_ACCOUNT_ID_INVALID', production_deploy: false };
  return {
    ok: true,
    schema: 'riosystems.cloudflare-readonly-preflight-plan.v1',
    state: 'READ_ONLY_PLAN_READY',
    token_ref: clean(input.token_ref || 'secret:CLOUDFLARE_API_TOKEN', 160),
    requests: {
      token_verify: request('/client/v4/user/tokens/verify'),
      workers_scripts: request(`/client/v4/accounts/${accountId}/workers/scripts`),
      d1_databases: request(`/client/v4/accounts/${accountId}/d1/database?per_page=5`),
      workers_ai_models: request(`/client/v4/accounts/${accountId}/ai/models/search?per_page=1`)
    },
    read_only: true,
    external_write: false,
    production_deploy: false
  };
}

function validateRequest(spec) {
  if (!spec || spec.method !== 'GET') return false;
  let url;
  try { url = new URL(spec.url); } catch { return false; }
  return url.origin === API_ORIGIN && url.pathname.startsWith('/client/v4/');
}

async function fetchJson(fetchImpl, spec, token, timeoutMs) {
  if (!validateRequest(spec)) return { ok: false, status: 0, error: 'CLOUDFLARE_READONLY_REQUEST_REJECTED' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(spec.url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    return { ok: response.ok && body?.success !== false, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, error: clean(error?.message, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function capability(result) {
  if (result?.ok) return 'verified';
  if (result?.status === 401) return 'authentication_failed';
  if (result?.status === 403) return 'permission_missing';
  return 'unavailable_or_error';
}

export async function runCloudflareReadonlyPreflight(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (plan.state !== 'READ_ONLY_PLAN_READY' || plan.read_only !== true || plan.external_write !== false) return { ok: false, error: 'CLOUDFLARE_READONLY_PLAN_REQUIRED', production_deploy: false };
  if (typeof runtime.fetch_impl !== 'function' || typeof runtime.resolve_secret !== 'function') return { ok: false, error: 'CLOUDFLARE_RUNTIME_REQUIRED', production_deploy: false };
  const token = clean(await runtime.resolve_secret(plan.token_ref), 1200);
  if (!token) return { ok: false, error: 'CLOUDFLARE_SECRET_RESOLUTION_FAILED', production_deploy: false };
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 8000, 1000), 15000);

  const verify = await fetchJson(runtime.fetch_impl, plan.requests.token_verify, token, timeoutMs);
  if (!verify.ok) {
    return {
      ok: false,
      schema: 'riosystems.cloudflare-readonly-preflight-result.v1',
      stage: 'CLOUDFLARE_AUTHENTICATION_FAILED',
      token_status: capability(verify),
      secrets_returned: false,
      authorization_header_returned: false,
      external_side_effect_performed: false,
      production_deploy: false
    };
  }

  const [workers, d1, ai] = await Promise.all([
    fetchJson(runtime.fetch_impl, plan.requests.workers_scripts, token, timeoutMs),
    fetchJson(runtime.fetch_impl, plan.requests.d1_databases, token, timeoutMs),
    fetchJson(runtime.fetch_impl, plan.requests.workers_ai_models, token, timeoutMs)
  ]);

  return {
    ok: true,
    schema: 'riosystems.cloudflare-readonly-preflight-result.v1',
    stage: 'CLOUDFLARE_READONLY_PREFLIGHT_COMPLETE',
    token_status: 'active',
    capabilities: {
      workers_scripts_read: capability(workers),
      d1_read: capability(d1),
      workers_ai_read: capability(ai)
    },
    resource_presence: {
      worker_scripts_present: workers.ok && Array.isArray(workers.body?.result) ? workers.body.result.length > 0 : null,
      d1_databases_present: d1.ok && Array.isArray(d1.body?.result) ? d1.body.result.length > 0 : null,
      workers_ai_models_visible: ai.ok && Array.isArray(ai.body?.result) ? ai.body.result.length > 0 : null
    },
    resource_names_returned: false,
    account_id_returned: false,
    secrets_returned: false,
    authorization_header_returned: false,
    external_side_effect_performed: false,
    production_deploy: false
  };
}

export function cloudflareReadonlyRunnerManifest() {
  return {
    schema: 'riosystems.cloudflare-readonly-runner.v1',
    api_origin: API_ORIGIN,
    methods: ['GET'],
    token_secret_ref: 'secret:CLOUDFLARE_API_TOKEN',
    account_secret_ref: 'secret:CLOUDFLARE_ACCOUNT_ID',
    external_write: false,
    resource_names_returned: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
