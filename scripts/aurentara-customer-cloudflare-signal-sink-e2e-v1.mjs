import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const scriptName = String(process.env.AURENTARA_CUSTOMER_WORKER_SCRIPT || 'chatgpt-test').trim();
const verifiedBaseUrl = String(process.env.AURENTARA_LIVE_PROBE_BASE_URL || '').trim();
const probeCount = 1000;

assert.match(accountId, /^[a-f0-9]{32}$/i, 'CLOUDFLARE_ACCOUNT_ID_INVALID');
assert.ok(token.length >= 20, 'CLOUDFLARE_API_TOKEN_MISSING');
assert.match(scriptName, /^[a-z0-9][a-z0-9_-]{0,62}$/i, 'CLOUDFLARE_WORKER_SCRIPT_INVALID');
assert.ok(verifiedBaseUrl, 'DEPLOYMENT_TRUTH_VERIFIED_ROUTE_REQUIRED');

const probeBase = new URL(verifiedBaseUrl);
assert.equal(probeBase.protocol, 'https:', 'DEPLOYMENT_TRUTH_ROUTE_MUST_BE_HTTPS');
assert.equal(probeBase.username, '', 'DEPLOYMENT_TRUTH_ROUTE_USERINFO_FORBIDDEN');
assert.equal(probeBase.password, '', 'DEPLOYMENT_TRUTH_ROUTE_USERINFO_FORBIDDEN');
assert.equal(probeBase.search, '', 'DEPLOYMENT_TRUTH_ROUTE_QUERY_FORBIDDEN');
assert.equal(probeBase.hash, '', 'DEPLOYMENT_TRUTH_ROUTE_FRAGMENT_FORBIDDEN');

const probeUrl = new URL('/customer/api/manifest', probeBase);
const wrangler = './node_modules/.bin/wrangler';
await access(wrangler);

let stdout = '';
let stderr = '';
let tailClosed = false;
const tail = spawn(wrangler, ['tail', scriptName, '--format', 'json'], {
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: accountId
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
tail.stdout.setEncoding('utf8');
tail.stderr.setEncoding('utf8');
tail.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > 1000000) stdout = stdout.slice(-1000000); });
tail.stderr.on('data', (chunk) => { stderr += chunk; if (stderr.length > 200000) stderr = stderr.slice(-200000); });
tail.on('close', () => { tailClosed = true; });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const combined = () => `${stdout}\n${stderr}`;
const readyPattern = /tail created|successfully created tail|connected to .*tail|listening for logs|waiting for logs/i;
let tailReady = false;
for (let i = 0; i < 30; i += 1) {
  if (readyPattern.test(combined())) { tailReady = true; break; }
  if (tailClosed) break;
  await sleep(500);
}
assert.equal(tailClosed, false, 'CLOUDFLARE_TAIL_CLOSED_BEFORE_PROBE');
await sleep(1500);

const statusCounts = new Map();
let surfaceRemainedOff = true;
let exactClosedWorkerResponses = 0;
for (let i = 0; i < probeCount; i += 1) {
  const response = await fetch(probeUrl, {
    method: 'GET',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AURENTARA-Observability-Canary/1.0'
    },
    signal: AbortSignal.timeout(10000)
  });
  statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
  let body = null;
  try { body = await response.json(); } catch {}
  if (response.status === 404
      && body?.error === 'CUSTOMER_SURFACE_NOT_ACTIVATED'
      && body?.mode === 'off'
      && body?.public_active === false) {
    exactClosedWorkerResponses += 1;
  }
  if (body?.public_active === true || (response.status >= 200 && response.status < 400)) surfaceRemainedOff = false;
  if ((i + 1) % 50 === 0) await sleep(100);
}
assert.equal(surfaceRemainedOff, true, 'CUSTOMER_SURFACE_UNEXPECTEDLY_ACTIVE');
assert.equal(exactClosedWorkerResponses > 0, true, 'CUSTOMER_WORKER_CLOSED_RESPONSE_NOT_PROVEN');

let signalSeen = false;
let requestEventSeen = false;
for (let i = 0; i < 120; i += 1) {
  const text = combined();
  signalSeen = text.includes('aurentara.customer.observability');
  requestEventSeen = text.includes('customer.request.completed')
    || text.includes('customer.request.failed')
    || text.includes('customer.rate_limited');
  if (signalSeen && requestEventSeen) break;
  if (tailClosed) break;
  await sleep(500);
}

if (!tailClosed) {
  tail.kill('SIGINT');
  await Promise.race([
    new Promise((resolve) => tail.once('close', resolve)),
    sleep(3000)
  ]);
  if (!tailClosed) tail.kill('SIGKILL');
}

const diagnostic = {
  schema: 'aurentara.customer.cloudflare-signal-sink-diagnostic.v1',
  verified_route_from_deployment_truth: true,
  hostname_returned: false,
  probe_request_count: probeCount,
  probe_status_counts: Object.fromEntries([...statusCounts.entries()].sort(([a], [b]) => a - b)),
  exact_closed_worker_response_count: exactClosedWorkerResponses,
  customer_surface_remained_off: surfaceRemainedOff,
  worker_tail_connected: true,
  tail_ready_banner_seen: tailReady,
  observability_channel_seen: signalSeen,
  customer_request_event_seen: requestEventSeen,
  raw_tail_returned: false,
  request_headers_returned: false,
  account_id_returned: false,
  token_returned: false,
  real_customer_data: false,
  variable_cost_eur: 0
};
console.log(JSON.stringify(diagnostic, null, 2));

assert.equal(signalSeen, true, 'CLOUDFLARE_OBSERVABILITY_CHANNEL_NOT_SEEN_IN_LIVE_TAIL');
assert.equal(requestEventSeen, true, 'CLOUDFLARE_CUSTOMER_REQUEST_EVENT_NOT_SEEN_IN_LIVE_TAIL');

console.log(JSON.stringify({
  schema: 'aurentara.customer.cloudflare-signal-sink-e2e.v1',
  observed_at: new Date().toISOString(),
  status: 'PASS',
  verified_route_from_deployment_truth: true,
  worker_tail_connected: true,
  tail_filtering: 'local_only',
  tail_ready_banner_seen: tailReady,
  probe_route_class: 'closed_customer_manifest',
  probe_request_count: probeCount,
  probe_status_counts: diagnostic.probe_status_counts,
  exact_closed_worker_response_count: exactClosedWorkerResponses,
  customer_surface_remained_off: true,
  observability_channel_seen: true,
  customer_request_event_seen: true,
  raw_tail_returned: false,
  request_headers_returned: false,
  hostname_returned: false,
  account_id_returned: false,
  token_returned: false,
  real_customer_data: false,
  customer_content_transmitted: false,
  paid_provider_calls: false,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
