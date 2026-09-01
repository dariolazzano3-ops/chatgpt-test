import assert from 'node:assert/strict';
import { createGermanyEuOfficialRetrievalBinding } from '../src/customer-product/production-live-bindings-v1.js';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const scriptName = String(process.env.AURENTARA_CUSTOMER_WORKER_SCRIPT || 'chatgpt-test').trim();
const expectedCustomerRef = 'pqmbtfzjcdnihovvppjr';
const expectedOperatorRef = 'pgzayxpqiakuvibhonwh';

assert.match(accountId, /^[a-f0-9]{32}$/i, 'CLOUDFLARE_ACCOUNT_ID_INVALID');
assert.ok(token.length >= 20, 'CLOUDFLARE_API_TOKEN_MISSING');
assert.match(scriptName, /^[a-z0-9][a-z0-9_-]{0,62}$/i, 'CLOUDFLARE_WORKER_SCRIPT_INVALID');

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

const verifyUser = await cloudflareGet('/client/v4/user/tokens/verify');
const verifyAccount = verifyUser.ok ? null : await cloudflareGet(`/client/v4/accounts/${accountId}/tokens/verify`);
assert.ok(verifyUser.ok || verifyAccount?.ok, 'CLOUDFLARE_TOKEN_VERIFICATION_FAILED');

const settings = await cloudflareGet(`/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/settings`);
if (!settings.ok && settings.status !== 404) {
  throw new Error(`CLOUDFLARE_WORKER_SETTINGS_READ_FAILED:${settings.status}`);
}

const result = settings.ok ? settings.body?.result || {} : {};
const bindings = Array.isArray(result.bindings) ? result.bindings : [];
const binding = (name) => bindings.find((item) => String(item?.name || '') === name) || null;
const bindingText = (name) => {
  const item = binding(name);
  if (!item) return null;
  const value = item.text ?? item.value ?? null;
  return typeof value === 'string' ? value : null;
};
const bindingType = (name) => String(binding(name)?.type || '').toLowerCase();

const surfaceOff = bindingText('AURENTARA_CUSTOMER_SURFACE_MODE') === 'off';
const customerRefMatches = bindingText('AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF') === expectedCustomerRef;
const operatorRefMatches = bindingText('AURENTARA_OPERATOR_SUPABASE_PROJECT_REF') === expectedOperatorRef;
const projectRefsSeparated = customerRefMatches && operatorRefMatches && expectedCustomerRef !== expectedOperatorRef;
const distributedRateBindingLive = Boolean(binding('CUSTOMER_RATE_LIMITER')) && bindingType('CUSTOMER_RATE_LIMITER').includes('durable');
const officialRetrievalFlagLive = bindingText('AURENTARA_CUSTOMER_OFFICIAL_RETRIEVAL_ACTIVE') === 'true';
const observabilityFlagLive = bindingText('AURENTARA_CUSTOMER_OBSERVABILITY_ACTIVE') === 'true';
const workerObservabilityEnabled = result?.observability?.enabled === true || result?.observability?.logs?.enabled === true;

let officialSourceFetchVerified = false;
let officialSourceCount = 0;
try {
  const retrieval = createGermanyEuOfficialRetrievalBinding({ provider_active: true });
  const fetched = await retrieval.retrieve({
    query: 'Wie hoch ist der gesetzliche Mindestlohn in Deutschland?',
    jurisdiction: 'DE',
    max_sources: 1
  });
  officialSourceFetchVerified = fetched.ok === true && Array.isArray(fetched.sources) && fetched.sources.length > 0;
  officialSourceCount = officialSourceFetchVerified ? fetched.sources.length : 0;
} catch {
  officialSourceFetchVerified = false;
}

const evidence = {
  schema: 'aurentara.customer.cloudflare-live-gate-evidence.v1',
  observed_at: new Date().toISOString(),
  read_only: true,
  external_write: false,
  production_deploy: false,
  token_verified: true,
  worker_settings_verified: settings.ok,
  worker_present: settings.ok,
  customer_surface_off_live: settings.ok && surfaceOff,
  customer_project_binding_live: settings.ok && customerRefMatches,
  operator_customer_project_separation_live: settings.ok && projectRefsSeparated,
  distributed_rate_binding_live: settings.ok && distributedRateBindingLive,
  official_retrieval_binding_live: settings.ok && officialRetrievalFlagLive,
  official_source_fetch_verified: officialSourceFetchVerified,
  official_source_count: officialSourceCount,
  observability_binding_live: settings.ok && observabilityFlagLive && workerObservabilityEnabled,
  alert_signal_path_verified: false,
  binding_values_returned: false,
  authorization_header_returned: false,
  account_id_returned: false,
  token_returned: false,
  variable_cost_eur: 0,
  real_customer_data: false
};

await import('node:fs/promises').then(({ writeFile }) =>
  writeFile('/tmp/aurentara-cloudflare-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n', 'utf8')
);
console.log(JSON.stringify(evidence, null, 2));
