import assert from 'node:assert/strict';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import {
  createSupabaseJarvisMemoryStoreV1,
  createJarvisMemoryStoreFromEnvV1,
  jarvisSupabaseMemoryStoreManifestV1
} from '../src/jarvis/memory-store-supabase-v1.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const ownerRef = 'operator:test';
const memoryRows = new Map();
const auditRows = [];
let unavailable = false;
let malformed = false;

const reply = (body, status = 200) => new Response(
  body === null ? '' : JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json' } }
);

function keyFor(row) {
  return `${row.owner_id}:${row.memory_id}`;
}

async function fakeFetch(url, init = {}) {
  if (unavailable) throw new Error('synthetic-network-down');
  if (malformed) return new Response('{broken', { status: 200 });

  assert.equal(init.headers.apikey, 'jarvis-service-role-test');
  assert.equal(init.headers.authorization, 'Bearer jarvis-service-role-test');
  assert.equal(init.headers['accept-profile'], 'jarvis_private');
  assert.equal(init.headers['content-profile'], 'jarvis_private');

  const parsed = new URL(url);
  const table = parsed.pathname.split('/').pop();
  const method = String(init.method || 'GET').toUpperCase();

  if (table === 'personal_memory_v1' && method === 'GET') {
    const owner = String(parsed.searchParams.get('owner_id') || '').replace(/^eq\./, '');
    const ref = String(parsed.searchParams.get('owner_ref') || '').replace(/^eq\./, '');
    const rows = [...memoryRows.values()].filter((row) => row.owner_id === owner && row.owner_ref === ref);
    return reply(rows);
  }

  if (table === 'personal_memory_v1' && method === 'POST') {
    const row = JSON.parse(init.body);
    memoryRows.set(keyFor(row), structuredClone(row));
    return reply([structuredClone(row)], 201);
  }

  if (table === 'audit_events_v1' && method === 'POST') {
    const row = JSON.parse(init.body);
    const stored = {
      ...row,
      event_id: '22222222-2222-4222-8222-222222222222',
      occurred_at: row.occurred_at || '2026-09-07T00:40:00.000Z'
    };
    auditRows.push(stored);
    return reply([stored], 201);
  }

  return reply({ error: 'unsupported' }, 405);
}

const store = createSupabaseJarvisMemoryStoreV1({
  supabase_url: 'https://synthetic.supabase.co',
  service_role_key: 'jarvis-service-role-test',
  fetch_impl: fakeFetch,
  clock: () => '2026-09-07T00:40:00.000Z'
});

const entry = {
  owner_ref: ownerRef,
  memory_id: 'jarvis:decisions:connector-boundary',
  category: 'DECISIONS',
  subject: 'Connector boundary',
  value: 'JARVIS connectors carry minimum necessary data only',
  source: { type: 'operator_statement' },
  source_system: 'jarvis',
  confidence: 1,
  status: 'CONFIRMED',
  sensitivity: 'INTERNAL',
  provenance: { system: 'jarvis' },
  valid_from: '2026-09-07T00:40:00.000Z',
  created_at: '2026-09-07T00:40:00.000Z',
  updated_at: '2026-09-07T00:40:00.000Z'
};

const upserted = await store.upsertMemory({ owner_id: ownerId, owner_ref: ownerRef, entry });
assert.equal(upserted.ok, true);
assert.equal(upserted.entry.namespace, 'jarvis.personal');
assert.equal(upserted.entry.owner_ref, ownerRef);

const loaded = await store.loadMemory({ owner_id: ownerId, owner_ref: ownerRef });
assert.equal(loaded.length, 1);
assert.equal(loaded[0].memory_id, entry.memory_id);

await assert.rejects(
  () => store.upsertMemory({
    owner_id: ownerId,
    owner_ref: ownerRef,
    entry: { ...entry, source_system: 'hamyren' }
  }),
  /JARVIS_HAMYREN_MEMORY_IMPORT_BLOCKED/
);

await assert.rejects(
  () => store.upsertMemory({
    owner_id: ownerId,
    owner_ref: 'operator:other',
    entry
  }),
  /JARVIS_MEMORY_OWNER_REF_MISMATCH/
);

const audit = createJarvisAuditEventV1({
  timestamp: '2026-09-07T00:40:00.000Z',
  owner_ref: ownerRef,
  request: 'Synthetic request',
  intent: { intent_type: 'MEMORY_REQUEST' },
  tools_used: ['jarvis.memory.read.v1'],
  permissions: ['JARVIS_MEMORY_READ'],
  action: 'READ_PERSONAL_MEMORY',
  result: { status: 'COMPLETED' },
  approval: { required: false },
  cost: { estimated_eur: 0, actual_eur: 0 },
  memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
});
audit.request_id = 'req-1';

const appended = await store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: audit });
assert.equal(appended.ok, true);
assert.equal(appended.isolation.hamyren_memory_access, false);
assert.equal(auditRows.length, 1);

malformed = true;
await assert.rejects(() => store.loadMemory({ owner_id: ownerId, owner_ref: ownerRef }), /INVALID_RESPONSE/);
malformed = false;

unavailable = true;
await assert.rejects(() => store.loadMemory({ owner_id: ownerId, owner_ref: ownerRef }), /STORE_UNAVAILABLE/);
unavailable = false;

assert.equal(createJarvisMemoryStoreFromEnvV1({}), null);
assert.throws(
  () => createJarvisMemoryStoreFromEnvV1({ JARVIS_PERSONAL_MEMORY_STORE: 'supabase' }),
  /SUPABASE_URL_REQUIRED/
);

const manifest = jarvisSupabaseMemoryStoreManifestV1();
assert.equal(manifest.data_schema, 'jarvis_private');
assert.equal(manifest.hamyren_tables_referenced, false);
assert.equal(manifest.automatic_hamyren_sync, false);
assert.equal(manifest.production_deploy, false);

console.log('JARVIS Supabase Memory Store V1 smoke: PASS');
