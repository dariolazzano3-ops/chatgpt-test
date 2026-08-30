import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import {
  createSupabaseOperatorRuntimeStore,
  createOperatorRuntimeStoreFromEnv
} from '../src/operator-runtime-store-supabase-v1.js';

function jsonResponse(body, status = 200) {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function fakePostgrest() {
  const rows = new Map();
  let malformed = false;
  let unavailable = false;

  function keyFrom(url) {
    const filter = new URL(url).searchParams.get('operator_id') || '';
    return filter.startsWith('eq.') ? filter.slice(3) : filter;
  }

  return {
    rows,
    setMalformed(value) { malformed = value; },
    setUnavailable(value) { unavailable = value; },
    async fetch(url, init = {}) {
      if (unavailable) throw new Error('synthetic-network-down');
      if (malformed) return new Response('{nope', { status: 200 });
      assert.equal(init.headers.apikey, 'service-role-test');
      assert.equal(init.headers.authorization, 'Bearer service-role-test');
      const method = String(init.method || 'GET').toUpperCase();
      const key = keyFrom(url);

      if (method === 'GET') {
        const row = rows.get(key);
        return jsonResponse(row ? [structuredClone(row)] : []);
      }

      if (method === 'POST') {
        const body = JSON.parse(init.body);
        if (rows.has(body.operator_id)) return jsonResponse({ code: '23505' }, 409);
        const row = structuredClone(body);
        rows.set(body.operator_id, row);
        return jsonResponse([structuredClone(row)], 201);
      }

      if (method === 'PATCH') {
        const expectedRaw = new URL(url).searchParams.get('revision') || '';
        const expected = Number(expectedRaw.startsWith('eq.') ? expectedRaw.slice(3) : expectedRaw);
        const current = rows.get(key);
        if (!current || current.revision !== expected) return jsonResponse([]);
        const body = JSON.parse(init.body);
        const next = { ...structuredClone(current), ...structuredClone(body) };
        rows.set(key, next);
        return jsonResponse([structuredClone(next)]);
      }

      return jsonResponse({ error: 'unsupported' }, 405);
    }
  };
}

function initialRuntime(operatorId = 'operator:test@example.com') {
  const created = createOperatorRuntime({
    operator_id: operatorId,
    portfolio: {
      operator_id: operatorId,
      projects: [{
        customer_id: 'synthetic-customer-a',
        project_id: 'synthetic-project-a',
        scope_key: 'synthetic-customer-a:synthetic-project-a',
        name: 'Synthetic Project A',
        industry: 'services',
        country: 'DE',
        language: 'de',
        state: 'READY',
        blocked: false,
        production_deploy: false
      }],
      production_deploy: false
    },
    at: '2026-08-30T11:45:00.000Z'
  });
  assert.equal(created.ok, true);
  return created.runtime;
}

const backend = fakePostgrest();
const makeStore = () => createSupabaseOperatorRuntimeStore({
  supabase_url: 'https://synthetic.supabase.co',
  service_role_key: 'service-role-test',
  fetch_impl: backend.fetch,
  clock: () => '2026-08-30T11:46:00.000Z'
});

const storeA = makeStore();
const runtime = initialRuntime();
assert.equal(await storeA.load(runtime.operator_id), null, 'empty durable store must load as null');

const created = await storeA.create(runtime);
assert.equal(created.ok, true, 'initial runtime must persist');
assert.equal(created.runtime.revision, 1);
assert.equal((await storeA.load(runtime.operator_id)).operator_id, runtime.operator_id);

const duplicate = await storeA.create(runtime);
assert.deepEqual(duplicate, { ok: false, error: 'OPERATOR_RUNTIME_ALREADY_EXISTS' }, 'duplicate create must be idempotently classified');

const next = structuredClone(runtime);
next.revision = 2;
next.selected_project_scope = 'synthetic-customer-a:synthetic-project-a';
const saved = await storeA.compareAndSwap(next, 1);
assert.equal(saved.ok, true, 'CAS must save the next revision');
assert.equal(saved.runtime.revision, 2);

const staleCandidate = structuredClone(next);
staleCandidate.revision = 3;
const stale = await storeA.compareAndSwap(staleCandidate, 1);
assert.equal(stale.ok, false, 'stale CAS must fail');
assert.equal(stale.error, 'STORE_REVISION_CONFLICT');
assert.equal(stale.actual_revision, 2);

const invalidNext = await storeA.compareAndSwap({ ...structuredClone(next), revision: 5 }, 2);
assert.equal(invalidNext.ok, false);
assert.equal(invalidNext.error, 'STORE_NEXT_REVISION_INVALID');

const otherRuntime = initialRuntime('operator:other@example.com');
await storeA.create(otherRuntime);
assert.equal((await storeA.load(otherRuntime.operator_id)).operator_id, 'operator:other@example.com');
assert.equal((await storeA.load(runtime.operator_id)).operator_id, 'operator:test@example.com', 'operator isolation must hold');

// Restart acceptance: a new adapter and a new API service must recover the same durable state.
const storeBeforeRestart = makeStore();
const serviceBeforeRestart = createOperatorRuntimeApiService({
  operator_id: runtime.operator_id,
  store: storeBeforeRestart,
  initial_runtime: runtime
});
const before = await serviceBeforeRestart.handle({ method: 'GET', path: '/snapshot' });
assert.equal(before.ok, true);
assert.equal(before.runtime.revision, 2);
assert.equal(before.runtime.selected_project_scope, 'synthetic-customer-a:synthetic-project-a');

const storeAfterRestart = makeStore();
const serviceAfterRestart = createOperatorRuntimeApiService({
  operator_id: runtime.operator_id,
  store: storeAfterRestart,
  initial_runtime: runtime
});
const recovered = await serviceAfterRestart.handle({ method: 'GET', path: '/snapshot' });
assert.equal(recovered.ok, true);
assert.equal(recovered.runtime.revision, 2, 'revision must survive process restart');
assert.equal(recovered.runtime.selected_project_scope, 'synthetic-customer-a:synthetic-project-a', 'selected project must survive process restart');
assert.ok(recovered.runtime.audit.some((event) => event.event === 'OPERATOR_RUNTIME_CREATED'), 'audit must survive process restart');

// Two writers starting from the same revision: exactly one may win.
const base = await storeA.load(runtime.operator_id);
const writer1 = structuredClone(base);
writer1.revision = base.revision + 1;
writer1.updated_at = '2026-08-30T11:47:00.000Z';
writer1.audit = [...writer1.audit, { event: 'WRITER_1', actor: runtime.operator_id, at: writer1.updated_at }];
const writer2 = structuredClone(base);
writer2.revision = base.revision + 1;
writer2.updated_at = '2026-08-30T11:47:01.000Z';
writer2.audit = [...writer2.audit, { event: 'WRITER_2', actor: runtime.operator_id, at: writer2.updated_at }];
const firstWriter = await storeA.compareAndSwap(writer1, base.revision);
const secondWriter = await storeA.compareAndSwap(writer2, base.revision);
assert.equal(firstWriter.ok, true);
assert.equal(secondWriter.ok, false);
assert.equal(secondWriter.error, 'STORE_REVISION_CONFLICT');

backend.setMalformed(true);
await assert.rejects(() => storeA.load(runtime.operator_id), /OPERATOR_RUNTIME_STORE_INVALID_RESPONSE/);
backend.setMalformed(false);
backend.setUnavailable(true);
await assert.rejects(() => storeA.load(runtime.operator_id), /OPERATOR_RUNTIME_STORE_UNAVAILABLE/);
backend.setUnavailable(false);

assert.throws(() => createOperatorRuntimeStoreFromEnv({ RIOSYSTEMS_ENVIRONMENT: 'staging' }), /DURABLE_STORE_REQUIRED/);
assert.throws(() => createOperatorRuntimeStoreFromEnv({
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase',
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL: 'https://synthetic.supabase.co'
}), /SERVICE_ROLE_KEY_REQUIRED/);

console.log(JSON.stringify({
  ok: true,
  schema: 'riosystems.operator-runtime-store.supabase.smoke.v1',
  checks: {
    load_create: 'PASS',
    duplicate_create: 'PASS',
    compare_and_swap: 'PASS',
    stale_revision: 'PASS',
    project_operator_isolation: 'PASS',
    restart_recovery: 'PASS',
    concurrent_writer_guard: 'PASS',
    malformed_response_fail_closed: 'PASS',
    unavailable_store_fail_closed: 'PASS',
    staging_memory_fallback_blocked: 'PASS'
  },
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
