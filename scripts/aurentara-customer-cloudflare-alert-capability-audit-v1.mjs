import assert from 'node:assert/strict';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

assert.match(accountId, /^[a-f0-9]{32}$/i, 'CLOUDFLARE_ACCOUNT_ID_INVALID');
assert.ok(token.length >= 20, 'CLOUDFLARE_API_TOKEN_MISSING');

async function cloudflareGet(path) {
  const url = new URL(path, 'https://api.cloudflare.com');
  assert.equal(url.origin, 'https://api.cloudflare.com');
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { ok: response.ok && body?.success !== false, status: response.status, body };
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  if (typeof value === 'string') {
    if (value.includes('@') || /^https?:\/\//i.test(value) || /^[a-f0-9]{32}$/i.test(value)) return '[redacted]';
    return value.slice(0, 240);
  }
  return value;
}

const verifyUser = await cloudflareGet('/client/v4/user/tokens/verify');
const verifyAccount = verifyUser.ok ? null : await cloudflareGet(`/client/v4/accounts/${accountId}/tokens/verify`);
assert.ok(verifyUser.ok || verifyAccount?.ok, 'CLOUDFLARE_TOKEN_VERIFICATION_FAILED');

const available = await cloudflareGet(`/client/v4/accounts/${accountId}/alerting/v3/available_alerts`);
const eligible = await cloudflareGet(`/client/v4/accounts/${accountId}/alerting/v3/destinations/eligible`);
const policies = await cloudflareGet(`/client/v4/accounts/${accountId}/alerting/v3/policies`);

const rawAlerts = Object.values(available.ok && available.body?.result && typeof available.body.result === 'object' ? available.body.result : {})
  .flatMap((items) => Array.isArray(items) ? items : []);
const alertTypes = rawAlerts.map((item) => ({
  type: String(item?.type || ''),
  display_name: String(item?.display_name || ''),
  description: String(item?.description || '').slice(0, 240),
  filter_options_present: Array.isArray(item?.filter_options) && item.filter_options.length > 0
})).filter((item) => item.type);
const workerAlerts = alertTypes.filter((item) => /worker|script|serverless|usage|error|health|traffic|origin/i.test(`${item.type} ${item.display_name} ${item.description}`));
const workersObservabilityRaw = rawAlerts.find((item) => String(item?.type || '') === 'workers_observability_alert') || null;
const workersObservabilityFilterOptions = sanitize(workersObservabilityRaw?.filter_options || []);
const existingPolicies = Array.isArray(policies.body?.result)
  ? policies.body.result.map((item) => ({
      id_present: Boolean(item?.id),
      name: String(item?.name || '').slice(0, 120),
      alert_type: String(item?.alert_type || ''),
      enabled: item?.enabled !== false,
      mechanisms_present: Boolean(item?.mechanisms && Object.values(item.mechanisms).some((v) => Array.isArray(v) && v.length > 0))
    }))
  : [];
const eligibleDestinations = eligible.ok && eligible.body?.result && typeof eligible.body.result === 'object'
  ? Object.fromEntries(Object.entries(eligible.body.result).map(([key, value]) => [key, {
      eligible: value?.eligible === true,
      ready: value?.ready === true
    }]))
  : {};

const evidence = {
  schema: 'aurentara.customer.cloudflare-alert-capability-evidence.v1',
  observed_at: new Date().toISOString(),
  read_only: true,
  external_write: false,
  production_deploy: false,
  token_verified: true,
  available_alerts_status: available.status,
  available_alerts_readable: available.ok,
  destinations_status: eligible.status,
  destinations_readable: eligible.ok,
  policies_status: policies.status,
  policies_readable: policies.ok,
  alert_type_count: alertTypes.length,
  worker_related_alerts: workerAlerts,
  workers_observability_filter_options: workersObservabilityFilterOptions,
  eligible_destinations: eligibleDestinations,
  existing_policies: existingPolicies,
  email_addresses_returned: false,
  webhook_urls_returned: false,
  account_id_returned: false,
  token_returned: false,
  variable_cost_eur: 0,
  real_customer_data: false
};

await import('node:fs/promises').then(({ writeFile }) => writeFile('/tmp/aurentara-cloudflare-alert-capability.json', JSON.stringify(evidence, null, 2) + '\n'));
console.log(JSON.stringify(evidence, null, 2));
