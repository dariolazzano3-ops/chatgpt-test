const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const ALLOWED_HOSTS = new Set(['eu1.make.com','eu2.make.com','us1.make.com','us2.make.com','eu1.make.celonis.com','us1.make.celonis.com']);
const ALLOWED_PATHS = new Set(['/api/v2/ping','/api/v2/scenarios']);

function validateRequest(request = {}) {
  const method = clean(request.method, 12).toUpperCase();
  if (method !== 'GET') return { ok: false, error: 'MAKE_READONLY_METHOD_REJECTED' };
  let url;
  try { url = new URL(clean(request.url, 600)); } catch { return { ok: false, error: 'MAKE_READONLY_URL_INVALID' }; }
  if (url.protocol !== 'https:') return { ok: false, error: 'MAKE_READONLY_HTTPS_REQUIRED' };
  if (!ALLOWED_HOSTS.has(url.hostname)) return { ok: false, error: 'MAKE_READONLY_HOST_REJECTED', host: url.hostname };
  if (!ALLOWED_PATHS.has(url.pathname)) return { ok: false, error: 'MAKE_READONLY_PATH_REJECTED', path: url.pathname };
  if (url.pathname === '/api/v2/ping' && url.search) return { ok: false, error: 'MAKE_PING_QUERY_REJECTED' };
  if (url.pathname === '/api/v2/scenarios') {
    const keys = [...url.searchParams.keys()];
    if (keys.some((key) => key !== 'teamId')) return { ok: false, error: 'MAKE_SCENARIO_QUERY_REJECTED' };
    const teamId = Number(url.searchParams.get('teamId'));
    if (!Number.isSafeInteger(teamId) || teamId <= 0) return { ok: false, error: 'MAKE_TEAM_ID_QUERY_REQUIRED' };
  }
  return { ok: true, method, url };
}

function responseSummary(url, response, body, maxBodyBytes) {
  const bodyBytes = new TextEncoder().encode(body).byteLength;
  const summary = {
    url: url.toString(),
    status: response.status,
    ok: response.ok,
    body_bytes: Math.min(bodyBytes, maxBodyBytes),
    truncated: bodyBytes > maxBodyBytes,
    content_type: clean(response.headers?.get?.('content-type'), 120) || null
  };
  if (url.pathname.endsWith('/ping')) summary.ping = clean(body, 20).toLowerCase() === 'pong' ? 'pong' : 'unexpected';
  else {
    try {
      const parsed = JSON.parse(body.slice(0, maxBodyBytes));
      summary.json_top_level_keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).slice(0, 30) : [];
      const scenarios = Array.isArray(parsed?.scenarios) ? parsed.scenarios : Array.isArray(parsed) ? parsed : null;
      summary.scenario_count_visible = scenarios ? scenarios.length : null;
    } catch {
      summary.json_parseable = false;
    }
  }
  return summary;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export async function runMakeReadOnlyPreflight(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (plan.state !== 'READY_FOR_READ_ONLY_PREFLIGHT') return { ok: false, error: 'MAKE_READONLY_PLAN_NOT_READY', production_deploy: false };
  if (plan.external_write === true) return { ok: false, error: 'MAKE_READONLY_PLAN_DECLARED_WRITE', production_deploy: false };
  if (runtime.read_only_execution_approved !== true) return { ok: false, error: 'MAKE_READONLY_EXECUTION_APPROVAL_REQUIRED', production_deploy: false };
  if (typeof runtime.fetch_impl !== 'function') return { ok: false, error: 'MAKE_FETCH_IMPLEMENTATION_REQUIRED', production_deploy: false };
  if (typeof runtime.resolve_secret !== 'function') return { ok: false, error: 'MAKE_SECRET_RESOLVER_REQUIRED', production_deploy: false };
  if (!plan.auth?.token_ref) return { ok: false, error: 'MAKE_TOKEN_REFERENCE_REQUIRED', production_deploy: false };
  if (!Array.isArray(plan.requests) || plan.requests.length < 1 || plan.requests.length > 3) return { ok: false, error: 'MAKE_READONLY_REQUEST_SET_INVALID', production_deploy: false };

  const validated = [];
  for (const request of plan.requests) {
    const check = validateRequest(request);
    if (!check.ok) return { ...check, production_deploy: false };
    validated.push(check);
  }

  const token = clean(await runtime.resolve_secret(plan.auth.token_ref), 800);
  if (!token) return { ok: false, error: 'MAKE_SECRET_RESOLUTION_FAILED', production_deploy: false };
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 5000, 500), 15000);
  const maxBodyBytes = Math.min(Math.max(Number(runtime.max_response_bytes) || 100000, 1000), 250000);
  const results = [];

  for (const request of validated) {
    let response;
    try {
      response = await fetchWithTimeout(runtime.fetch_impl, request.url, {
        method: 'GET',
        headers: { Authorization: `Token ${token}`, Accept: 'application/json, text/plain;q=0.9' },
        redirect: 'error'
      }, timeoutMs);
    } catch (error) {
      return { ok: false, error: 'MAKE_READONLY_HTTP_FAILED', message: clean(error?.message, 300), results, external_side_effect_performed: false, production_deploy: false };
    }
    const body = await response.text();
    const summary = responseSummary(request.url, response, body, maxBodyBytes);
    results.push(summary);
    if (!response.ok) return { ok: false, error: 'MAKE_READONLY_HTTP_STATUS_ERROR', results, external_side_effect_performed: false, production_deploy: false };
  }

  return {
    ok: true,
    schema: 'riosystems.make-readonly-preflight-result.v1',
    stage: 'MAKE_READONLY_PREFLIGHT_COMPLETE',
    results,
    token_ref: plan.auth.token_ref,
    secrets_returned: false,
    authorization_header_returned: false,
    external_side_effect_performed: false,
    production_deploy: false
  };
}

export function makeReadOnlyRunnerManifest() {
  return {
    schema: 'riosystems.make-readonly-runner.v1',
    methods: ['GET'],
    allowed_paths: [...ALLOWED_PATHS],
    secret_resolver_required: true,
    explicit_read_only_execution_approval_required: true,
    redirects_allowed: false,
    bounded_timeout: true,
    bounded_response_summary: true,
    response_payload_redaction: true,
    external_side_effects: false,
    production_deploy: false
  };
}
