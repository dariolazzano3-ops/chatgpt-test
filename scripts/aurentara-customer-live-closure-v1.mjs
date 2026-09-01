import assert from 'node:assert/strict';

const baseUrl = String(process.env.CUSTOMER_WORKER_URL || 'https://aurentara-customer-runtime.gelato-donatello-dario-a5a5376c.workers.dev').replace(/\/$/, '');
const maxAttempts = Math.max(1, Math.min(Number(process.env.LIVE_CLOSURE_MAX_ATTEMPTS || 8), 12));
const pauseMs = Math.max(100, Math.min(Number(process.env.LIVE_CLOSURE_PAUSE_MS || 750), 3000));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probes = [
  { path: '/customer/api/manifest', expectedStatus: 404, expectedError: 'CUSTOMER_SURFACE_NOT_ACTIVATED', requirePublicFalse: true },
  { path: '/factory/diagnostics', expectedStatus: 404, expectedError: 'AURENTARA_CUSTOMER_RUNTIME_ROUTE_NOT_FOUND', requirePublicFalse: true },
  { path: '/operator', expectedStatus: 404, expectedError: 'AURENTARA_CUSTOMER_RUNTIME_ROUTE_NOT_FOUND', requirePublicFalse: true }
];

async function probe(definition) {
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${definition.path}`, {
        method: 'GET',
        redirect: 'error',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      const type = String(response.headers.get('content-type') || '').toLowerCase();
      let body = null;
      if (type.includes('application/json')) {
        try { body = await response.json(); } catch {}
      }
      last = {
        attempt,
        path: definition.path,
        status: response.status,
        content_type: type.split(';')[0] || null,
        json: body !== null,
        error: typeof body?.error === 'string' ? body.error : null,
        public_active: typeof body?.public_active === 'boolean' ? body.public_active : null
      };
      const match = response.status === definition.expectedStatus
        && body?.error === definition.expectedError
        && (!definition.requirePublicFalse || body?.public_active === false);
      if (match) return { ok: true, ...last };
    } catch (error) {
      last = { attempt, path: definition.path, status: null, content_type: null, json: false, error: 'NETWORK_PROBE_FAILED', public_active: null };
    }
    if (attempt < maxAttempts) await wait(pauseMs);
  }
  return { ok: false, ...last };
}

const results = [];
for (const definition of probes) results.push(await probe(definition));

console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER LIVE CLOSURE V1',
  status: results.every((item) => item.ok) ? 'PASS' : 'FAIL',
  worker: 'aurentara-customer-runtime',
  results,
  public_customer_surface: false,
  operator_route_exposed: false,
  factory_route_exposed: false,
  real_customer_data: false,
  variable_cost_eur: 0
}, null, 2));

assert.ok(results.every((item) => item.ok), 'CUSTOMER_LIVE_CLOSURE_NOT_VERIFIED');
