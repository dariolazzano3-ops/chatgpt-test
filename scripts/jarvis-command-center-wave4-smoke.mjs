import assert from 'node:assert/strict';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import { createJarvisSessionV1 } from '../src/jarvis/session-v1.js';
import {
  createJarvisCommandCenterReadBindingsV1,
  jarvisCommandCenterReadBindingsManifestV1
} from '../src/jarvis/command-center-read-bindings-v1.js';
import { createJarvisCommandCenterTruthSnapshotV1 } from '../src/jarvis/command-center-runtime-truth-v1.js';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';

const NOW = '2026-09-11T12:00:00.000Z';
const sess = await createJarvisSessionV1({ ok: true, email: 'op@example.invalid' });
const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });

function ev(overrides = {}) {
  const e = createJarvisAuditEventV1({
    timestamp: overrides.timestamp,
    owner_ref: sess.owner_ref,
    request: overrides.request,
    action: overrides.action,
    tools_used: overrides.tools_used || [],
    permissions: overrides.permissions || [],
    result: overrides.result || null,
    approval: overrides.approval || null
  });
  if (overrides.request_id !== undefined) e.request_id = overrides.request_id;
  return e;
}

// ── store.readAudit: bounded, owner-scoped, newest-first, malformed rejected ──
const store = createMemoryJarvisStoreV1();
await store.appendAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, event: ev({ timestamp: '2026-09-11T10:00:00.000Z', request: 'Systemstatus', action: 'READ_STATUS', tools_used: ['jarvis.status.read.v1'], result: { status: 'COMPLETED', verified: true }, approval: { required: false }, request_id: 'req-1' }) });
await store.appendAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, event: ev({ timestamp: '2026-09-11T10:05:00.000Z', request: 'Systemstatus erneut', action: 'READ_STATUS', result: { status: 'COMPLETED', verified: true }, request_id: 'req-1' }) });
await store.appendAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, event: ev({ timestamp: '2026-09-11T10:10:00.000Z', request: 'HAMYREN deployen', action: 'DEPLOY', result: { status: 'PENDING' }, approval: { required: true, gate_status: 'AWAITING_APPROVAL' }, request_id: 'req-2' }) });
// malformed: unparseable timestamp + no content
await store.appendAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, event: { timestamp: 'not-a-date', junk: 1 } });
// other owner must not leak
const other = await createJarvisSessionV1({ ok: true, email: 'someone-else@example.invalid' });
await store.appendAudit({ owner_id: other.owner_id, owner_ref: other.owner_ref, event: ev({ timestamp: '2026-09-11T09:00:00.000Z', request: 'fremd', action: 'X', request_id: 'other-1' }) });

const raw = await store.readAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, limit: 10 });
assert.equal(raw.length, 4, 'own events only (incl. the malformed one, filtered at projection)');
assert.ok(Date.parse(raw[0].occurred_at) >= Date.parse(raw[1].occurred_at), 'newest first');
const bounded = await store.readAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, limit: 2 });
assert.equal(bounded.length, 2, 'limit is honoured');
await assert.rejects(() => store.readAudit({ owner_ref: sess.owner_ref }), /SCOPE_REQUIRED/);

// ── read bindings project audit -> REAL activity + DERIVED runs/approvals/evidence ──
const bindings = createJarvisCommandCenterReadBindingsV1({ store, owner_id: sess.owner_id, owner_ref: sess.owner_ref, now: NOW });
const snap = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: NOW });

assert.equal(snap.activity.source.classification, 'REAL');
assert.equal(snap.activity.source.source_id, 'jarvis-audit-reader-v1');
assert.equal(snap.activity.data.items.length, 3, 'malformed audit row (of the 4 persisted) rejected by the projection');
assert.ok(snap.activity.data.items.every((i) => Date.parse(i.at) > 0), 'every activity row has a real persisted timestamp');

assert.equal(snap.runs.source.classification, 'DERIVED');
assert.deepEqual(snap.runs.source.derived_from, ['jarvis-audit-reader-v1']);
assert.equal(snap.runs.data.items.length, 2, 'grouped by request_id');
const byId = Object.fromEntries(snap.runs.data.items.map((r) => [r.id, r]));
assert.equal(byId['req-1'].status, 'COMPLETE');
assert.equal(byId['req-1'].started_at, '2026-09-11T10:00:00.000Z');
assert.equal(byId['req-1'].updated_at, '2026-09-11T10:05:00.000Z');
assert.equal(byId['req-2'].status, 'WAITING_APPROVAL');
assert.ok(snap.runs.data.items.every((r) => r.progress === null), 'progress never fabricated');

assert.equal(snap.approvals.source.classification, 'DERIVED');
assert.equal(snap.approvals.data.items.length, 1);
assert.equal(snap.approvals.data.items[0].state, 'PENDING', 'AWAITING_APPROVAL -> PENDING, not GRANTED');
assert.equal(snap.approvals.data.pending_count, 1);

assert.equal(snap.evidence.source.classification, 'DERIVED');
assert.ok(snap.evidence.data.items.length >= 1);

assert.equal(snap.validation.ok, true, JSON.stringify(snap.validation.violations));

// ── no readAudit -> those domains fail closed to NOT_CONNECTED ──
const noRead = createJarvisCommandCenterReadBindingsV1({ store: { appendAudit() {} }, owner_id: sess.owner_id, owner_ref: sess.owner_ref, now: NOW });
assert.deepEqual(Object.keys(noRead), []);
const closed = await createJarvisCommandCenterTruthSnapshotV1(noRead, { now: NOW });
assert.equal(closed.runs.source.source_state, 'NOT_CONNECTED');
assert.equal(closed.activity.source.source_state, 'NOT_CONNECTED');
assert.equal(closed.runs.data.items.length, 0);

// ── store readAudit throws -> adapter surfaces UNAVAILABLE, no fabricated success ──
const brokenStore = { readAudit: async () => { throw new Error('JARVIS_AUDIT_STORE_READ_FAILED:500'); } };
const brokenBindings = createJarvisCommandCenterReadBindingsV1({ store: brokenStore, owner_id: sess.owner_id, owner_ref: sess.owner_ref, now: NOW });
const brokenSnap = await createJarvisCommandCenterTruthSnapshotV1(brokenBindings, { now: NOW });
assert.equal(brokenSnap.activity.source.source_state, 'UNAVAILABLE');
assert.equal(brokenSnap.runs.source.source_state, 'UNAVAILABLE');
assert.equal(brokenSnap.activity.data.items.length, 0);

// ── end to end through the private worker ──
const res = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/runtime-truth'),
  {},
  {},
  { authorize, memory_store: store, now: NOW }
);
assert.equal(res.status, 200);
const body = await res.json();
assert.equal(body.activity.source.classification, 'REAL');
assert.equal(body.runs.source.classification, 'DERIVED');
assert.equal(body.runs.data.items.length, 2);
assert.ok(body.runs.data.items.every((r) => r.progress === null));
// systems still fail closed (no probe wired)
for (const s of ['JARVIS', 'HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE', 'GIT']) {
  assert.equal(body.systems.data[s], 'UNKNOWN');
}

const man = jarvisCommandCenterReadBindingsManifestV1();
assert.equal(man.fabricates_data, false);
assert.equal(man.progress_ever_synthesised, false);
assert.equal(man.fail_closed_when_unavailable, true);
assert.equal(man.hamyren_data_flow, false);

console.log('JARVIS Command Center Wave 4 (real Runs + Activity) smoke: PASS');
