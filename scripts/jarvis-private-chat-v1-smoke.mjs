import assert from 'node:assert/strict';
import { handleJarvisHttpV1, jarvisHttpManifestV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createGoogleCalendarReadConnectorV1 } from '../src/jarvis/google-calendar-read-v1.js';
import { inferJarvisCalendarWindowV1 } from '../src/jarvis/calendar-window-v1.js';

const store = createMemoryJarvisStoreV1();
const authorize = async () => ({ ok: true, operator_id: 'operator:private@example.invalid', email: 'private@example.invalid' });
const calendar = createGoogleCalendarReadConnectorV1({
  access_token_provider: async () => 'synthetic-google-token',
  fetch_impl: async (url, init) => {
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.authorization, 'Bearer synthetic-google-token');
    assert.match(url, /calendar\/v3\/calendars\/primary\/events/);
    return new Response(JSON.stringify({
      items: [{
        id: 'evt-synthetic-1',
        summary: 'Synthetic private appointment',
        start: { dateTime: '2026-09-08T10:00:00+02:00' },
        end: { dateTime: '2026-09-08T10:30:00+02:00' },
        status: 'confirmed'
      }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
});

const options = { authorize, memory_store: store, connectors: [calendar], display_name: 'Private Operator' };

const page = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis'), {}, {}, options);
assert.equal(page.status, 200);
const html = await page.text();
// /jarvis serves the ACCEPTED orange/amber Command Center, never the legacy blue UI.
assert.match(html, /JARVIS · Command Center/);
assert.match(html, /VISUAL_BASELINE=ACCEPTED/);
assert.match(html, /--amber:#ffab40/);
assert.match(html, /\.jcc\{/);
assert.match(html, /Denken\. Bauen\./);
assert.doesNotMatch(html, /A BRIGHTER YOU/, 'legacy blue UI must not be served at /jarvis');
assert.doesNotMatch(html, /--blue:#8bd2ff/);
assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);

// The legacy blue surface stays reachable, explicitly, at /jarvis/legacy.
const legacy = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis/legacy'), {}, {}, options);
assert.equal(legacy.status, 200);
assert.match(await legacy.text(), /A BRIGHTER YOU/);

const session = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/session'), {}, {}, options);
const sessionBody = await session.json();
assert.equal(session.status, 200);
assert.equal(sessionBody.authenticated, true);
assert.equal(sessionBody.authentication, 'CLOUDFLARE_ACCESS');
assert.equal(sessionBody.credentials_exposed, false);
assert.equal(sessionBody.hamyren_session_shared, false);
assert.equal('owner_id' in sessionBody, false);
assert.equal('email' in sessionBody, false);

const status = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/status'), {}, {}, options);
const statusBody = await status.json();
assert.equal(statusBody.calendar_read_bound, true);
assert.equal(statusBody.calendar_write_enabled, false);
assert.equal(statusBody.hamyren_data_flow, false);

const chat = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'Was steht morgen in meinem Kalender?' })
}), {}, {}, options);
const chatBody = await chat.json();
assert.equal(chat.status, 200);
assert.equal(chatBody.ok, true);
assert.equal(chatBody.action, 'READ_CALENDAR');
assert.equal(chatBody.connector_status, 'COMPLETED');
assert.match(chatBody.answer, /Synthetic private appointment/);
assert.equal(chatBody.external_effect, false);
assert.equal(chatBody.audit_persisted, true);
assert.equal(chatBody.hamyren_data_flow, false);

const inspected = store.inspect();
assert.equal(inspected.audits.length, 1);
assert.equal(inspected.audits[0].event.isolation.hamyren_memory_access, false);
assert.equal(inspected.audits[0].event.isolation.hamyren_memory_write, false);

const window = inferJarvisCalendarWindowV1('morgen', {
  now: '2026-09-07T12:00:00Z',
  timezone: 'Europe/Berlin'
});
assert.equal(window.ok, true);
assert.equal(window.day_offset, 1);
assert.equal(Date.parse(window.time_max) - Date.parse(window.time_min), 24 * 60 * 60 * 1000);

const blocked = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/status'),
  {},
  {},
  { authorize: async () => ({ ok: false, status: 403, error: 'DENIED' }) }
);
assert.equal(blocked.status, 403);

const manifest = jarvisHttpManifestV1();
assert.equal(manifest.calendar_write_enabled, false);
assert.equal(manifest.external_writes_enabled, false);
assert.equal(manifest.hamyren_data_flow, false);

console.log('JARVIS Private Chat & Session V1 smoke: PASS');
