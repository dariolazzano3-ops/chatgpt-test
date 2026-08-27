const SUPPORTED = new Set(['http_request', 'webhook']);
const BLOCKED = new Set(['email', 'crm_write', 'database_write']);
const METHODS = new Set(['GET', 'POST']);
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key']);

const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);

function isPrivateHost(hostname = '') {
  const host = hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  return false;
}

function normalizeHeaders(headers = {}) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [clean(key, 100), clean(value, 2000)]).filter(([key]) => key));
}

export function validateExternalAction(action = {}, policy = {}) {
  const errors = [];
  const type = clean(action.type, 100).toLowerCase();
  if (BLOCKED.has(type)) errors.push('EXTERNAL_ACTION_TYPE_NOT_ENABLED');
  else if (!SUPPORTED.has(type)) errors.push('UNSUPPORTED_EXTERNAL_ACTION_TYPE');

  let url = null;
  try { url = new URL(clean(action.url, 2000)); } catch { errors.push('EXTERNAL_ACTION_URL_INVALID'); }
  if (url && url.protocol !== 'https:') errors.push('EXTERNAL_ACTION_HTTPS_REQUIRED');
  if (url && isPrivateHost(url.hostname)) errors.push('EXTERNAL_ACTION_PRIVATE_HOST_BLOCKED');

  const allowHosts = Array.isArray(policy.allowed_hosts) ? policy.allowed_hosts.map((v) => clean(v, 255).toLowerCase()).filter(Boolean) : [];
  if (!allowHosts.length) errors.push('EXTERNAL_ACTION_ALLOWLIST_REQUIRED');
  if (url && allowHosts.length && !allowHosts.includes(url.hostname.toLowerCase())) errors.push('EXTERNAL_ACTION_HOST_NOT_ALLOWED');

  const method = clean(action.method || (type === 'webhook' ? 'POST' : 'GET'), 20).toUpperCase();
  if (!METHODS.has(method)) errors.push('EXTERNAL_ACTION_METHOD_NOT_ALLOWED');

  const headers = normalizeHeaders(action.headers);
  if (Object.keys(headers).some((key) => SENSITIVE_HEADERS.has(key.toLowerCase()))) errors.push('EXTERNAL_ACTION_INLINE_SECRET_HEADER_BLOCKED');

  const body = action.body == null ? '' : typeof action.body === 'string' ? action.body : JSON.stringify(action.body);
  const maxBodyBytes = Number.isInteger(policy.max_body_bytes) ? Math.min(Math.max(policy.max_body_bytes, 0), 32768) : 8192;
  if (Buffer.byteLength(body, 'utf8') > maxBodyBytes) errors.push('EXTERNAL_ACTION_BODY_TOO_LARGE');

  if (policy.authorized !== true) errors.push('EXTERNAL_ACTION_APPROVAL_REQUIRED');
  if (policy.production_deploy === true) errors.push('PRODUCTION_SIDE_EFFECT_REJECTED');

  return {
    ok: errors.length === 0,
    errors,
    action: errors.length ? null : { type, url: url.href, method, headers, body },
    limits: { max_body_bytes: maxBodyBytes, timeout_ms: Math.min(Math.max(Number(policy.timeout_ms) || 5000, 100), 10000) },
    supervised: true,
    automatic_execution: false,
    production_deploy: false,
  };
}

export async function executeExternalAction(action = {}, policy = {}, transport) {
  const validation = validateExternalAction(action, policy);
  if (!validation.ok) return { ok: false, status: 'BLOCKED', errors: validation.errors, production_deploy: false };
  if (typeof transport !== 'function') return { ok: false, status: 'BLOCKED', errors: ['EXTERNAL_ACTION_TRANSPORT_REQUIRED'], production_deploy: false };

  const started = Date.now();
  try {
    const result = await transport({ ...validation.action, timeout_ms: validation.limits.timeout_ms });
    const statusCode = Number(result?.status_code || result?.status || 0);
    return {
      ok: statusCode >= 200 && statusCode < 400,
      status: statusCode >= 200 && statusCode < 400 ? 'COMPLETED' : 'FAILED',
      status_code: statusCode || null,
      duration_ms: Math.max(0, Date.now() - started),
      external_side_effect: true,
      supervised: true,
      automatic_execution: false,
      production_deploy: false,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'FAILED',
      error: clean(error?.message || error, 300),
      duration_ms: Math.max(0, Date.now() - started),
      external_side_effect: true,
      supervised: true,
      automatic_execution: false,
      production_deploy: false,
    };
  }
}

export function externalActionManifest() {
  return {
    version: '4.3',
    mode: 'supervised',
    enabled_types: [...SUPPORTED],
    blocked_types: [...BLOCKED],
    https_only: true,
    allowlist_required: true,
    inline_secrets_allowed: false,
    automatic_execution: false,
    production_deploy: false,
  };
}
