import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const scriptName = String(process.env.AURENTARA_CUSTOMER_WORKER_SCRIPT || 'chatgpt-test').trim();

assert.match(accountId, /^[a-f0-9]{32}$/i, 'CLOUDFLARE_ACCOUNT_ID_INVALID');
assert.ok(token.length >= 20, 'CLOUDFLARE_API_TOKEN_MISSING');
assert.match(scriptName, /^[a-z0-9][a-z0-9_-]{0,62}$/i, 'CLOUDFLARE_WORKER_SCRIPT_INVALID');

async function cfGet(path) {
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

const subdomainResponse = await cfGet(`/client/v4/accounts/${accountId}/workers/subdomain`);
assert.equal(subdomainResponse.ok, true, `CLOUDFLARE_WORKERS_SUBDOMAIN_READ_FAILED:${subdomainResponse.status}`);
const subdomain = String(subdomainResponse.body?.result?.subdomain || '').trim();
assert.match(subdomain, /^[a-z0-9-]+$/i, 'CLOUDFLARE_WORKERS_SUBDOMAIN_INVALID');

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
tail.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > 500000) stdout = stdout.slice(-500000); });
tail.stderr.on('data', (chunk) => { stderr += chunk; if (stderr.length > 200000) stderr = stderr.slice(-200000); });
tail.on('close', () => { tailClosed = true; });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const combined = () => `${stdout}\n${stderr}`;
const readyPattern = /tail created|successfully created tail|connected to .*tail|listening for logs|waiting for logs/i;
let tailReady = false;
for (let i = 0; i < 20; i += 1) {
  if (readyPattern.test(combined())) { tailReady = true; break; }
  if (tailClosed) break;
  await sleep(500);
}
assert.equal(tailClosed, false, 'CLOUDFLARE_TAIL_CLOSED_BEFORE_PROBE');
if (!tailReady) await sleep(1500);

const probeUrl = new URL(`https://${scriptName}.${subdomain}.workers.dev/customer/api/manifest`);
assert.equal(probeUrl.protocol, 'https:');
assert.equal(probeUrl.hostname, `${scriptName}.${subdomain}.workers.dev`);

const probeStatuses = [];
let surfaceRemainedOff = true;
for (let i = 0; i < 3; i += 1) {
  const response = await fetch(probeUrl, {
    method: 'GET',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AURENTARA-Observability-Canary/1.0'
    },
    signal: AbortSignal.timeout(10000)
  });
  probeStatuses.push(response.status);
  let body = null;
  try { body = await response.json(); } catch {}
  if (body?.public_active === true || response.status < 400) surfaceRemainedOff = false;
  await sleep(350);
}
assert.equal(surfaceRemainedOff, true, 'CUSTOMER_SURFACE_UNEXPECTEDLY_ACTIVE');

let signalSeen = false;
let requestEventSeen = false;
for (let i = 0; i < 30; i += 1) {
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

assert.equal(signalSeen, true, 'CLOUDFLARE_OBSERVABILITY_CHANNEL_NOT_SEEN_IN_LIVE_TAIL');
assert.equal(requestEventSeen, true, 'CLOUDFLARE_CUSTOMER_REQUEST_EVENT_NOT_SEEN_IN_LIVE_TAIL');

const evidence = {
  schema: 'aurentara.customer.cloudflare-signal-sink-e2e.v1',
  observed_at: new Date().toISOString(),
  status: 'PASS',
  worker_tail_connected: true,
  tail_ready_banner_seen: tailReady,
  probe_route_class: 'closed_customer_manifest',
  probe_request_count: probeStatuses.length,
  probe_statuses: probeStatuses,
  customer_surface_remained_off: true,
  observability_channel_seen: true,
  customer_request_event_seen: true,
  raw_tail_returned: false,
  request_headers_returned: false,
  account_id_returned: false,
  token_returned: false,
  real_customer_data: false,
  customer_content_transmitted: false,
  paid_provider_calls: false,
  production_deploy: false,
  variable_cost_eur: 0
};
console.log(JSON.stringify(evidence, null, 2));
