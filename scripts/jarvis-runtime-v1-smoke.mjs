import assert from 'node:assert/strict';
import { createGoogleCalendarReadConnectorV1, jarvisGoogleCalendarReadManifestV1 } from '../src/jarvis/google-calendar-read-v1.js';
import { createSupabaseJarvisUserMemoryStoreV1, jarvisUserMemoryStoreManifestV1 } from '../src/jarvis/memory-store-supabase-user-v1.js';
import { handleJarvisRuntimeRequestV1, jarvisRuntimeManifestV1 } from '../src/jarvis/runtime-v1.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const ownerRef = 'operator:test';
const rows = [];
const audits = [];

async function memoryFetch(url, init = {}) {
  assert.equal(init.headers.apikey, 'publishable-test');
  assert.equal(init.headers.authorization, 'Bearer user-jwt-test');
  assert.equal(init.headers['accept-profile'], 'jarvis_private');
  const parsed = new URL(url);
  const table = parsed.pathname.split('/').pop();
  const method = String(init.method || 'GET').toUpperCase();

  if (table === 'personal_memory_v1' && method === 'GET') return new Response(JSON.stringify(rows), { status: 200 });
  if (table === 'personal_memory_v1' && method === 'POST') {
    const row = JSON.parse(init.body);
    const index = rows.findIndex((item) => item.owner_id === row.owner_id && item.memory_id === row.memory_id);
    if (index >= 0) rows[index] = row; else rows.push(row);
    return new Response(JSON.stringify([row]), { status: 201 });
  }
  if (table === 'audit_events_v1' && method === 'POST') {
    const row = { ...JSON.parse(init.body), event_id: '22222222-2222-4222-8222-222222222222' };
    audits.push(row);
    return new Response(JSON.stringify([row]), { status: 201 });
  }
  return new Response(JSON.stringify({ error: 'unsupported' }), { status: 405 });
}

async function calendarFetch(url, init = {}) {
  assert.match(url, /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/primary\/events\?/);
  assert.equal(init.method, 'GET');
  assert.equal(init.headers.authorization, 'Bearer google-oauth-test');
  return new Response(JSON.stringify({
    items: [
      {
        id: 'evt-1',
        summary: 'Synthetic appointment',
        start: { dateTime: '2026-09-07T10:00:00+02:00' },
        end: { dateTime: '2026-09-07T10:30:00+02:00' },
        status: 'confirmed'
      }
    ]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const memoryStore = createSupabaseJarvisUserMemoryStoreV1({
  supabase_url: 'https://synthetic.supabase.co',
  publishable_key: 'publishable-test',
  access_token_provider: async () => 'user-jwt-test',
  fetch_impl: memoryFetch
});

const calendar = createGoogleCalendarReadConnectorV1({
  access_token_provider: async () => 'google-oauth-test',
  fetch_impl: calendarFetch
});

const runtime = await handleJarvisRuntimeRequestV1({
  owner_id: ownerId,
  owner_ref: ownerRef,
  request_id: 'req-calendar-1',
  message: 'Was steht heute in meinem Kalender?',
  now: '2026-09-07T08:00:00+02:00',
  granted_permissions: ['CALENDAR_READ'],
  connector_payload: {
    calendar_id: 'primary',
    time_min: '2026-09-07T00:00:00+02:00',
    time_max: '2026-09-08T00:00:00+02:00',
    max_results: 25
  }
}, {
  memory_store: memoryStore,
  connectors: [calendar]
});

assert.equal(runtime.ok, true);
assert.equal(runtime.core.intent.action, 'READ_CALENDAR');
assert.equal(runtime.connector_execution.status, 'COMPLETED');
assert.equal(runtime.connector_execution.external_effect, false);
assert.equal(runtime.connector_execution.result.count, 1);
assert.equal(runtime.connector_execution.result.events[0].summary, 'Synthetic appointment');
assert.equal(audits.length, 1);
assert.equal(audits[0].isolation.hamyren_memory_access, false);
assert.equal(audits[0].isolation.hamyren_memory_write, false);

await assert.rejects(
  async () => calendar.handler({
    capability: 'calendar.write',
    payload: {
      time_min: '2026-09-07T00:00:00+02:00',
      time_max: '2026-09-08T00:00:00+02:00'
    }
  }),
  /READ_ONLY/
);

const calManifest = jarvisGoogleCalendarReadManifestV1();
assert.deepEqual(calManifest.write_capabilities, []);
assert.equal(calManifest.external_writes, false);

const memoryManifest = jarvisUserMemoryStoreManifestV1();
assert.equal(memoryManifest.auth_mode, 'authenticated_user_rls');
assert.equal(memoryManifest.service_role_required, false);
assert.equal(memoryManifest.hamyren_tables_referenced, false);

const runtimeManifest = jarvisRuntimeManifestV1();
assert.deepEqual(runtimeManifest.connector_execution_supported, ['calendar.read']);
assert.equal(runtimeManifest.write_connectors_enabled, false);

console.log('JARVIS Runtime V1 smoke: PASS');
