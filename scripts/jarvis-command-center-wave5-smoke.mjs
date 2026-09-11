import assert from 'node:assert/strict';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import { createJarvisSessionV1 } from '../src/jarvis/session-v1.js';
import {
  createJarvisCommandCenterReadBindingsV1,
  jarvisCommandCenterReadBindingsManifestV1
} from '../src/jarvis/command-center-read-bindings-v1.js';
import { createJarvisCommandCenterTruthSnapshotV1 } from '../src/jarvis/command-center-runtime-truth-v1.js';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';

const NOW = '2026-09-11T13:00:00.000Z';
const sess = await createJarvisSessionV1({ ok: true, email: 'op@example.invalid' });
const store = createMemoryJarvisStoreV1();

function seed(o) {
  const e = createJarvisAuditEventV1({
    timestamp: o.timestamp, owner_ref: sess.owner_ref, request: o.request, action: o.action,
    tools_used: o.tools_used || [], permissions: o.permissions || [],
    result: o.result || null, approval: o.approval || null
  });
  e.request_id = o.request_id;
  return store.appendAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, event: e });
}

// R1: completed by worker self-report only (verified:true, NO independent acceptance ref)
await seed({ timestamp: '2026-09-11T12:00:00.000Z', request: 'Repo-Diff zusammenfassen', action: 'ANALYZE', tools_used: ['claude_code.analyze'],
  result: { status: 'COMPLETED', verified: true, commit_sha: 'a3f9e21bb1' }, approval: { required: false }, request_id: 'r-1' });
// R2: deploy needs approval, gate awaiting, reason + risk carried
await seed({ timestamp: '2026-09-11T12:10:00.000Z', request: 'Staging-Deploy', action: 'DEPLOY_STAGING', permissions: ['cloudflare.deploy'],
  result: { status: 'PENDING' },
  approval: { required: true, gate_status: 'AWAITING_APPROVAL', reason: 'Berührt eine Live-Umgebung.', risk: 'mittel' }, request_id: 'r-2' });
// R3: independently accepted (acceptance_ref present)
await seed({ timestamp: '2026-09-11T12:20:00.000Z', request: 'Merge-Vorbereitung prüfen', action: 'REVIEW', tools_used: ['claude_code.analyze'],
  result: { status: 'COMPLETED', verified: true, acceptance_ref: 'bridge:accept:88' }, approval: { required: false }, request_id: 'r-3' });

const bindings = createJarvisCommandCenterReadBindingsV1({ store, owner_id: sess.owner_id, owner_ref: sess.owner_ref, now: NOW });
const snap = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: NOW });

// ── Approvals: canonical gate state only, no fabricated grant ──
assert.equal(snap.approvals.source.classification, 'DERIVED');
assert.equal(snap.approvals.data.items.length, 1);
const ap = snap.approvals.data.items[0];
assert.equal(ap.state, 'PENDING', 'AWAITING_APPROVAL gate -> PENDING');
assert.equal(ap.run_id, 'r-2');
assert.equal(ap.approval_type, 'DEPLOY_STAGING');
assert.equal(ap.capability, 'cloudflare.deploy');
assert.equal(snap.approvals.data.pending_count, 1);

// ── Evidence: worker self-report is NOT independent acceptance ──
assert.equal(snap.evidence.source.classification, 'DERIVED');
const evById = Object.fromEntries(snap.evidence.data.items.map((e) => [e.run_ref, e]));
// r-1: worker verified, git commit, but no independent acceptance
const e1 = evById['r-1'];
assert.ok(e1, 'r-1 has evidence');
assert.equal(e1.kind, 'GIT_COMMIT');
assert.equal(e1.worker_verified, true);
assert.equal(e1.independent_acceptance, false, 'worker verified != independent acceptance');
assert.equal(e1.status, 'COMPLETED');
// r-3: independent acceptance ref present
const e3 = evById['r-3'];
assert.equal(e3.independent_acceptance, true);
assert.equal(e3.acceptance_ref, 'bridge:accept:88');
// no evidence status is ever the string "ACCEPTED" fabricated from verified
assert.ok(snap.evidence.data.items.every((e) => e.status !== 'ACCEPTED' || e.independent_acceptance === true));

// ── Runs still fail-closed on progress, link evidence ──
const runById = Object.fromEntries(snap.runs.data.items.map((r) => [r.id, r]));
assert.equal(runById['r-1'].status, 'COMPLETE');
assert.equal(runById['r-1'].progress, null);
assert.ok(runById['r-1'].evidence_ref, 'run carries an evidence_ref');
assert.equal(runById['r-2'].status, 'WAITING_APPROVAL');
assert.equal(runById['r-2'].approval_state, 'PENDING');

// ── Fail closed when the store cannot read ──
const broken = createJarvisCommandCenterReadBindingsV1({ store: { readAudit: async () => { throw new Error('down'); } }, owner_id: sess.owner_id, owner_ref: sess.owner_ref, now: NOW });
const bsnap = await createJarvisCommandCenterTruthSnapshotV1(broken, { now: NOW });
assert.equal(bsnap.approvals.source.source_state, 'UNAVAILABLE');
assert.equal(bsnap.evidence.source.source_state, 'UNAVAILABLE');
assert.equal(bsnap.approvals.data.items.length, 0);
assert.equal(bsnap.evidence.data.items.length, 0);

// ── absent readAudit -> not connected ──
const none = createJarvisCommandCenterReadBindingsV1({ store: {}, owner_id: sess.owner_id, owner_ref: sess.owner_ref, now: NOW });
const nsnap = await createJarvisCommandCenterTruthSnapshotV1(none, { now: NOW });
assert.equal(nsnap.approvals.source.source_state, 'NOT_CONNECTED');
assert.equal(nsnap.evidence.source.source_state, 'NOT_CONNECTED');

// ── manifest invariants ──
const man = jarvisCommandCenterReadBindingsManifestV1();
assert.equal(man.worker_self_acceptance_treated_as_independent, false);
assert.equal(man.approval_state_from_canonical_gate_only, true);

// ── frontend: served CC carries the honest evidence/approval wiring markers ──
const html = renderJarvisCommandCenterV1({ base_path: '/jarvis' });
for (const marker of ['keine unabhängige Abnahme', 'Risiko unklassifiziert', 'Keine Evidence verknüpft', 'Freigaben-Quelle nicht verbunden']) {
  assert.ok(html.includes(marker), `frontend evidence/approval marker missing: ${JSON.stringify(marker)}`);
}
assert.ok(!html.includes('12 von 12 Prüfungen bestanden'), 'fabricated evidence check string must be gone');

console.log('JARVIS Command Center Wave 5 (real Approvals + Evidence) smoke: PASS');
