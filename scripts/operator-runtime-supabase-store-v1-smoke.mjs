import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { createSupabaseOperatorRuntimeStore, createOperatorRuntimeStoreFromEnv } from '../src/operator-runtime-store-supabase-v1.js';

const rows = new Map();
let malformed = false;
let unavailable = false;
const reply = (body, status = 200) => new Response(body === null ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const operatorFilter = (url) => {
  const value = new URL(url).searchParams.get('operator_id') || '';
  return value.startsWith('eq.') ? value.slice(3) : value;
};

async function fakeFetch(url, init = {}) {
  if (unavailable) throw new Error('synthetic-network-down');
  if (malformed) return new Response('{broken', { status: 200 });
  assert.equal(init.headers.apikey, 'service-role-test');
  assert.equal(init.headers.authorization, 'Bearer service-role-test');
  const method = String(init.method || 'GET').toUpperCase();
  const key = operatorFilter(url);
  if (method === 'GET') return reply(rows.has(key) ? [structuredClone(rows.get(key))] : []);
  if (method === 'POST') {
    const body = JSON.parse(init.body);
    if (rows.has(body.operator_id)) return reply({ code: '23505' }, 409);
    rows.set(body.operator_id, structuredClone(body));
    return reply([structuredClone(body)], 201);
  }
  if (method === 'PATCH') {
    const raw = new URL(url).searchParams.get('revision') || '';
    const expected = Number(raw.startsWith('eq.') ? raw.slice(3) : raw);
    const current = rows.get(key);
    if (!current || current.revision !== expected) return reply([]);
    const next = { ...structuredClone(current), ...JSON.parse(init.body) };
    rows.set(key, structuredClone(next));
    return reply([next]);
  }
  return reply({ error: 'unsupported' }, 405);
}

function buildRuntime(operatorId = 'operator:test@example.com') {
  const created = createOperatorRuntime({
    operator_id: operatorId,
    portfolio: {
      operator_id: operatorId,
      projects: [{ customer_id: 'synthetic-customer', project_id: 'synthetic-project', scope_key: 'synthetic-customer:synthetic-project', name: 'Synthetic Project', state: 'READY', blocked: false, priority: 20, budget_cost_units: 0, capability_count: 3, mission_count: 0, delivery_count: 0, production_deploy: false }],
      production_deploy: false
    },
    at: '2026-08-30T11:45:00.000Z'
  });
  assert.equal(created.ok, true);
  return created.runtime;
}

const makeStore = () => createSupabaseOperatorRuntimeStore({ supabase_url: 'https://synthetic.supabase.co', service_role_key: 'service-role-test', fetch_impl: fakeFetch, clock: () => '2026-08-30T11:46:00.000Z' });
const runtime = buildRuntime();
const store = makeStore();
assert.equal(await store.load(runtime.operator_id), null);
assert.equal((await store.create(runtime)).ok, true);
assert.equal((await store.create(runtime)).error, 'OPERATOR_RUNTIME_ALREADY_EXISTS');

const next = structuredClone(runtime);
next.revision = 2;
next.selected_project_scope = 'synthetic-customer:synthetic-project';
assert.equal((await store.compareAndSwap(next, 1)).ok, true);
const stale = structuredClone(runtime);
stale.revision = 2;
stale.updated_at = '2026-08-30T11:46:30.000Z';
stale.audit = [...stale.audit, { event: 'STALE_WRITER', actor: stale.operator_id, at: stale.updated_at }];
const staleResult = await store.compareAndSwap(stale, 1);
assert.equal(staleResult.error, 'STORE_REVISION_CONFLICT');
assert.equal(staleResult.actual_revision, 2);
assert.equal((await store.compareAndSwap({ ...structuredClone(next), revision: 7 }, 2)).error, 'STORE_NEXT_REVISION_INVALID');

const other = buildRuntime('operator:other@example.com');
await store.create(other);
assert.equal((await store.load(other.operator_id)).operator_id, other.operator_id);
assert.equal((await store.load(runtime.operator_id)).operator_id, runtime.operator_id);

const restarted = createOperatorRuntimeApiService({ operator_id: runtime.operator_id, store: makeStore(), initial_runtime: runtime });
const recovered = await restarted.handle({ method: 'GET', path: '/snapshot' });
assert.equal(recovered.ok, true);
assert.equal(recovered.runtime.revision, 2);
assert.equal(recovered.runtime.selected_project_scope, 'synthetic-customer:synthetic-project');
assert.ok(recovered.runtime.audit.some((event) => event.event === 'OPERATOR_RUNTIME_CREATED'));

const base = await store.load(runtime.operator_id);
const writerA = structuredClone(base); writerA.revision++;
const writerB = structuredClone(base); writerB.revision++;
assert.equal((await store.compareAndSwap(writerA, base.revision)).ok, true);
assert.equal((await store.compareAndSwap(writerB, base.revision)).error, 'STORE_REVISION_CONFLICT');

malformed = true;
await assert.rejects(() => store.load(runtime.operator_id), /INVALID_RESPONSE/);
malformed = false; unavailable = true;
await assert.rejects(() => store.load(runtime.operator_id), /STORE_UNAVAILABLE/);
unavailable = false;

assert.throws(() => createOperatorRuntimeStoreFromEnv({ RIOSYSTEMS_ENVIRONMENT: 'staging' }), /DURABLE_STORE_REQUIRED/);
assert.throws(() => createOperatorRuntimeStoreFromEnv({ RIOSYSTEMS_ENVIRONMENT: 'staging', RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase', RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL: 'https://synthetic.supabase.co' }), /SERVICE_ROLE_KEY_REQUIRED/);

console.log(JSON.stringify({ ok: true, schema: 'riosystems.operator-runtime-store.supabase.smoke.v1', checks: ['load_create','duplicate_create','cas','stale_revision','operator_isolation','restart_recovery','concurrency','malformed_fail_closed','unavailable_fail_closed','staging_memory_blocked'], production_deploy: false, variable_cost_eur: 0 }, null, 2));
