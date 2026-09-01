import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const scriptName = String(process.env.AURENTARA_CUSTOMER_WORKER_SCRIPT || 'aurentara-customer-runtime').trim();
const githubEnv = String(process.env.GITHUB_ENV || '').trim();

assert.match(accountId, /^[a-f0-9]{32}$/i, 'CLOUDFLARE_ACCOUNT_ID_INVALID');
assert.ok(token.length >= 20, 'CLOUDFLARE_API_TOKEN_MISSING');
assert.match(scriptName, /^[a-z0-9][a-z0-9_-]{0,62}$/i, 'CLOUDFLARE_WORKER_SCRIPT_INVALID');
assert.ok(githubEnv, 'GITHUB_ENV_REQUIRED');

function apiUrl(path) {
  const url = new URL(path, 'https://api.cloudflare.com');
  assert.equal(url.origin, 'https://api.cloudflare.com');
  return url;
}

async function cfJson(path) {
  const response = await fetch(apiUrl(path), {
    method: 'GET',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(15000)
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return {
    ok: response.ok && body?.success !== false,
    status: response.status,
    body
  };
}

async function cfText(path) {
  const response = await fetch(apiUrl(path), {
    method: 'GET',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*'
    },
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

function deploymentsFrom(body) {
  const result = body?.result;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.deployments)) return result.deployments;
  return [];
}

function domainEntriesFrom(body) {
  const result = body?.result;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.domains)) return result.domains;
  return [];
}

async function probeClosedCustomerRoute(baseUrl, routeSource) {
  const url = new URL('/customer/api/manifest', baseUrl);
  assert.equal(url.protocol, 'https:');
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AURENTARA-Deployment-Truth-Canary/1.0'
    },
    signal: AbortSignal.timeout(15000)
  });
  let body = null;
  try { body = await response.json(); } catch {}
  const exactClosed = response.status === 404
    && body?.error === 'CUSTOMER_SURFACE_NOT_ACTIVATED'
    && body?.mode === 'off'
    && body?.public_active === false;
  return {
    routeSource,
    baseUrl,
    status: response.status,
    exactClosed
  };
}

const deploymentsResponse = await cfJson(`/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/deployments`);
assert.equal(deploymentsResponse.ok, true, `CLOUDFLARE_DEPLOYMENTS_READ_FAILED:${deploymentsResponse.status}`);
const deployments = deploymentsFrom(deploymentsResponse.body);
assert.ok(deployments.length > 0, 'CLOUDFLARE_ACTIVE_DEPLOYMENT_NOT_FOUND');
const activeDeployment = deployments[0];
const activeDeploymentId = String(activeDeployment?.id || activeDeployment?.deployment_id || '').trim();
assert.ok(activeDeploymentId, 'CLOUDFLARE_ACTIVE_DEPLOYMENT_ID_MISSING');
const activeVersions = Array.isArray(activeDeployment?.versions) ? activeDeployment.versions : [];
const activeVersionIds = activeVersions
  .map((entry) => String(entry?.version_id || entry?.id || '').trim())
  .filter(Boolean);

const contentResponse = await cfText(`/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/content/v2`);
assert.equal(contentResponse.ok, true, `CLOUDFLARE_DEPLOYED_SCRIPT_CONTENT_READ_FAILED:${contentResponse.status}`);
assert.ok(contentResponse.text.length > 0, 'CLOUDFLARE_DEPLOYED_SCRIPT_CONTENT_EMPTY');

const contentMarkers = {
  launch_shield_off_marker: contentResponse.text.includes('CUSTOMER_SURFACE_NOT_ACTIVATED'),
  observability_channel_marker: contentResponse.text.includes('aurentara.customer.observability'),
  customer_completed_marker: contentResponse.text.includes('customer.request.completed'),
  observability_activation_marker: contentResponse.text.includes('AURENTARA_CUSTOMER_OBSERVABILITY_ACTIVE')
};
assert.equal(contentMarkers.launch_shield_off_marker, true, 'DEPLOYED_WORKER_LAUNCH_SHIELD_MARKER_MISSING');
assert.equal(contentMarkers.observability_channel_marker, true, 'DEPLOYED_WORKER_OBSERVABILITY_CHANNEL_MARKER_MISSING');
assert.equal(contentMarkers.customer_completed_marker, true, 'DEPLOYED_WORKER_CUSTOMER_EVENT_MARKER_MISSING');
assert.equal(contentMarkers.observability_activation_marker, true, 'DEPLOYED_WORKER_OBSERVABILITY_ACTIVATION_MARKER_MISSING');

const accountSubdomainResponse = await cfJson(`/client/v4/accounts/${accountId}/workers/subdomain`);
assert.equal(accountSubdomainResponse.ok, true, `CLOUDFLARE_ACCOUNT_SUBDOMAIN_READ_FAILED:${accountSubdomainResponse.status}`);
const accountSubdomain = String(accountSubdomainResponse.body?.result?.subdomain || '').trim();

const serviceSubdomainResponse = await cfJson(`/client/v4/accounts/${accountId}/workers/scripts/${encodeURIComponent(scriptName)}/subdomain`);
assert.equal(serviceSubdomainResponse.ok, true, `CLOUDFLARE_SERVICE_SUBDOMAIN_READ_FAILED:${serviceSubdomainResponse.status}`);
const workersDevEnabled = serviceSubdomainResponse.body?.result?.enabled === true;

const domainsResponse = await cfJson(`/client/v4/accounts/${accountId}/workers/domains`);
assert.equal(domainsResponse.ok, true, `CLOUDFLARE_CUSTOM_DOMAINS_READ_FAILED:${domainsResponse.status}`);
const domainEntries = domainEntriesFrom(domainsResponse.body);

const candidates = [];
if (workersDevEnabled && /^[a-z0-9-]+$/i.test(accountSubdomain)) {
  candidates.push({
    source: 'workers_dev',
    baseUrl: `https://${scriptName}.${accountSubdomain}.workers.dev`
  });
}
for (const entry of domainEntries) {
  const service = String(entry?.service || entry?.script || '').trim();
  const hostname = String(entry?.hostname || '').trim();
  if (service !== scriptName || !hostname || !/^[a-z0-9.-]+$/i.test(hostname)) continue;
  const baseUrl = `https://${hostname}`;
  if (!candidates.some((candidate) => candidate.baseUrl === baseUrl)) {
    candidates.push({ source: 'custom_domain', baseUrl });
  }
}
assert.ok(candidates.length > 0, 'CLOUDFLARE_SERVING_ROUTE_NOT_FOUND');

const probeResults = [];
let verifiedRoute = null;
for (const candidate of candidates) {
  try {
    const result = await probeClosedCustomerRoute(candidate.baseUrl, candidate.source);
    probeResults.push(result);
    if (result.exactClosed) {
      verifiedRoute = result;
      break;
    }
  } catch {
    probeResults.push({ routeSource: candidate.source, baseUrl: candidate.baseUrl, status: 0, exactClosed: false });
  }
}

const sanitizedProbeStatuses = probeResults.reduce((acc, item) => {
  const key = String(item.status || 0);
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const evidence = {
  schema: 'aurentara.customer.cloudflare-deployment-truth.v1',
  observed_at: new Date().toISOString(),
  status: verifiedRoute ? 'PASS' : 'FAIL',
  active_deployment_present: true,
  active_deployment_id_present: true,
  active_version_count: activeVersions.length,
  active_version_ids_present: activeVersionIds.length,
  deployed_content_checked: true,
  deployed_content_markers: contentMarkers,
  serving_route_candidate_count: candidates.length,
  serving_route_source: verifiedRoute?.routeSource || null,
  probe_status_counts: sanitizedProbeStatuses,
  exact_closed_customer_route_verified: Boolean(verifiedRoute),
  customer_surface_remained_off: Boolean(verifiedRoute),
  deployment_id_returned: false,
  version_ids_returned: false,
  hostname_returned: false,
  deployed_script_content_returned: false,
  account_id_returned: false,
  token_returned: false,
  real_customer_data: false,
  customer_content_transmitted: false,
  paid_provider_calls: false,
  external_write: false,
  production_deploy: false,
  variable_cost_eur: 0
};
console.log(JSON.stringify(evidence, null, 2));

assert.ok(verifiedRoute, 'CLOUDFLARE_CONFIRMED_SERVING_ROUTE_DID_NOT_RETURN_CLOSED_CUSTOMER_RESPONSE');
console.log(`::add-mask::${verifiedRoute.baseUrl}`);
await appendFile(githubEnv, `AURENTARA_LIVE_PROBE_BASE_URL=${verifiedRoute.baseUrl}\n`, { encoding: 'utf8' });
