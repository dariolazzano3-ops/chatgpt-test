const API_ORIGIN = 'https://api.cloudflare.com';
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function validAccountId(value) {
  return /^[a-f0-9]{32}$/i.test(clean(value, 64));
}

function getRequest(path) {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/client/v4/')) throw new Error('CLOUDFLARE_ACCESS_API_PATH_REJECTED');
  return { method: 'GET', url: url.toString() };
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

function targetApp(app = {}, expectedWorkerName = 'riosystems-staging', expectedHostname = '') {
  if (clean(app.type, 80).toLowerCase() !== 'self_hosted') return false;
  const hostname = safeHostname(app.domain);
  if (!hostname) return false;
  const explicit = clean(expectedHostname, 500).toLowerCase();
  if (explicit) return hostname === explicit;
  const worker = clean(expectedWorkerName, 120).toLowerCase();
  return Boolean(worker) && hostname.startsWith(`${worker}.`) && hostname.endsWith('.workers.dev');
}

function includeRuleKeys(rule = {}) {
  return rule && typeof rule === 'object' && !Array.isArray(rule) ? Object.keys(rule).map((key) => key.toLowerCase()) : [];
}

function broadAllow(policy = {}) {
  if (clean(policy.decision, 80).toLowerCase() !== 'allow') return false;
  const include = Array.isArray(policy.include) ? policy.include : [];
  if (!include.length) return true;
  return include.some((rule) => includeRuleKeys(rule).some((key) => ['everyone', 'login_method'].includes(key)));
}

function restrictiveAllow(policy = {}) {
  if (clean(policy.decision, 80).toLowerCase() !== 'allow') return false;
  const include = Array.isArray(policy.include) ? policy.include : [];
  return include.length > 0 && !broadAllow(policy);
}

function sanitizeError(result = {}) {
  if (result.status === 401) return 'AUTHENTICATION_FAILED';
  if (result.status === 403) return 'ACCESS_READ_PERMISSION_MISSING';
  if (result.status === 404) return 'ACCESS_API_NOT_FOUND';
  return result.error || `HTTP_${result.status || 0}`;
}

async function fetchJson(fetchImpl, spec, token, timeoutMs) {
  if (!spec || spec.method !== 'GET') return { ok: false, status: 0, error: 'NON_GET_REJECTED' };
  const url = new URL(spec.url);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/client/v4/')) return { ok: false, status: 0, error: 'CLOUDFLARE_ACCESS_REQUEST_REJECTED' };
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
    return { ok: false, status: 0, error: clean(error?.message || error, 200) };
  } finally {
    clearTimeout(timer);
  }
}

export function buildCloudflareAccessReadonlyPlan(input = {}) {
  const accountId = clean(input.account_id, 64);
  if (!validAccountId(accountId)) return { ok: false, error: 'CLOUDFLARE_ACCOUNT_ID_INVALID', production_deploy: false };
  const expectedWorkerName = clean(input.expected_worker_name || 'riosystems-staging', 120);
  const expectedHostname = clean(input.expected_hostname, 500).toLowerCase();
  if (!expectedWorkerName && !expectedHostname) return { ok: false, error: 'ACCESS_TARGET_REQUIRED', production_deploy: false };
  return {
    ok: true,
    schema: 'riosystems.cloudflare-access-readonly-plan.v1',
    state: 'READ_ONLY_ACCESS_PLAN_READY',
    token_ref: clean(input.token_ref || 'secret:CLOUDFLARE_API_TOKEN', 160),
    account_id: accountId,
    expected_worker_name: expectedWorkerName,
    expected_hostname: expectedHostname || null,
    applications_request: getRequest(`/client/v4/accounts/${accountId}/access/apps?per_page=100`),
    read_only: true,
    external_write: false,
    production_deploy: false
  };
}

export async function runCloudflareAccessReadonlyVerification(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (plan.state !== 'READ_ONLY_ACCESS_PLAN_READY' || plan.read_only !== true || plan.external_write !== false) return { ok: false, error: 'CLOUDFLARE_ACCESS_READONLY_PLAN_REQUIRED', production_deploy: false };
  if (typeof runtime.fetch_impl !== 'function' || typeof runtime.resolve_secret !== 'function') return { ok: false, error: 'CLOUDFLARE_ACCESS_RUNTIME_REQUIRED', production_deploy: false };
  const token = clean(await runtime.resolve_secret(plan.token_ref), 1200);
  if (!token) return { ok: false, error: 'CLOUDFLARE_SECRET_RESOLUTION_FAILED', production_deploy: false };
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 8000, 1000), 15000);

  const appsResult = await fetchJson(runtime.fetch_impl, plan.applications_request, token, timeoutMs);
  if (!appsResult.ok) {
    return {
      ok: false,
      schema: 'riosystems.cloudflare-access-readonly-result.v1',
      stage: 'ACCESS_APPLICATION_LIST_FAILED',
      error: sanitizeError(appsResult),
      access_application_verified: false,
      restrictive_policy_verified: false,
      secrets_returned: false,
      resource_names_returned: false,
      external_side_effect_performed: false,
      production_deploy: false
    };
  }

  const apps = Array.isArray(appsResult.body?.result) ? appsResult.body.result : [];
  const matches = apps.filter((app) => targetApp(app, plan.expected_worker_name, plan.expected_hostname));
  if (matches.length !== 1) {
    return {
      ok: false,
      schema: 'riosystems.cloudflare-access-readonly-result.v1',
      stage: matches.length ? 'ACCESS_APPLICATION_AMBIGUOUS' : 'ACCESS_APPLICATION_NOT_FOUND',
      matching_application_count: matches.length,
      access_application_verified: false,
      restrictive_policy_verified: false,
      secrets_returned: false,
      resource_names_returned: false,
      external_side_effect_performed: false,
      production_deploy: false
    };
  }

  const appId = clean(matches[0]?.id, 80);
  if (!/^[0-9a-f-]{16,36}$/i.test(appId)) return { ok: false, error: 'ACCESS_APPLICATION_ID_INVALID', production_deploy: false };
  const policiesRequest = getRequest(`/client/v4/accounts/${plan.account_id}/access/apps/${appId}/policies?per_page=100`);
  const policiesResult = await fetchJson(runtime.fetch_impl, policiesRequest, token, timeoutMs);
  if (!policiesResult.ok) {
    return {
      ok: false,
      schema: 'riosystems.cloudflare-access-readonly-result.v1',
      stage: 'ACCESS_POLICY_LIST_FAILED',
      error: sanitizeError(policiesResult),
      access_application_verified: true,
      restrictive_policy_verified: false,
      secrets_returned: false,
      resource_names_returned: false,
      external_side_effect_performed: false,
      production_deploy: false
    };
  }

  const policies = Array.isArray(policiesResult.body?.result) ? policiesResult.body.result : [];
  const bypassCount = policies.filter((policy) => clean(policy.decision, 80).toLowerCase() === 'bypass').length;
  const broadAllowCount = policies.filter(broadAllow).length;
  const restrictiveAllowCount = policies.filter(restrictiveAllow).length;
  if (bypassCount || broadAllowCount || restrictiveAllowCount < 1) {
    return {
      ok: false,
      schema: 'riosystems.cloudflare-access-readonly-result.v1',
      stage: bypassCount ? 'ACCESS_BYPASS_POLICY_REJECTED' : broadAllowCount ? 'ACCESS_BROAD_ALLOW_POLICY_REJECTED' : 'ACCESS_RESTRICTIVE_ALLOW_POLICY_MISSING',
      access_application_verified: true,
      restrictive_policy_verified: false,
      policy_count: policies.length,
      restrictive_allow_policy_count: restrictiveAllowCount,
      broad_allow_policy_count: broadAllowCount,
      bypass_policy_count: bypassCount,
      secrets_returned: false,
      resource_names_returned: false,
      external_side_effect_performed: false,
      production_deploy: false
    };
  }

  return {
    ok: true,
    schema: 'riosystems.cloudflare-access-readonly-result.v1',
    stage: 'PRIVATE_ACCESS_VERIFIED',
    access_application_verified: true,
    restrictive_policy_verified: true,
    matching_application_count: 1,
    policy_count: policies.length,
    restrictive_allow_policy_count: restrictiveAllowCount,
    broad_allow_policy_count: 0,
    bypass_policy_count: 0,
    secrets_returned: false,
    resource_names_returned: false,
    external_side_effect_performed: false,
    production_deploy: false
  };
}

export function cloudflareAccessReadonlyVerifierManifest() {
  return {
    schema: 'riosystems.cloudflare-access-readonly-verifier.v1',
    api_origin: API_ORIGIN,
    methods: ['GET'],
    application_endpoint: 'accounts/:account_id/access/apps',
    policy_endpoint: 'accounts/:account_id/access/apps/:app_id/policies',
    expected_worker_name: 'riosystems-staging',
    required_application_type: 'self_hosted',
    broad_include_selectors_rejected: ['everyone', 'login_method'],
    bypass_policy_rejected: true,
    restrictive_allow_required: true,
    external_write: false,
    production_deploy: false
  };
}
