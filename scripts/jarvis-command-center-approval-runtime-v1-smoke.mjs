import assert from 'node:assert/strict';
import {
  evaluateJarvisApprovalDecisionV1,
  jarvisCommandCenterApprovalRuntimeManifestV1,
  JARVIS_APPROVAL_DECISIONS
} from '../src/jarvis/command-center-approval-runtime-v1.js';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisAuditEventV1 } from '../src/jarvis/audit-v1.js';
import { createJarvisSessionV1 } from '../src/jarvis/session-v1.js';

const OWNER = 'jarvis:operator:op@example.invalid';
const RUN = '22222222-3333-4444-8555-666666666666';
const APPROVALS = [{ approval_id: `${RUN}:approval`, run_id: RUN, scope_key: OWNER, approval_type: 'DEPLOY_STAGING', capability: 'cloudflare.deploy', state: 'PENDING', requested_at: '2026-09-12T00:00:00.000Z' }];

// ── pure evaluation ──
{
  const r = evaluateJarvisApprovalDecisionV1({ approvals: APPROVALS, approval_id: `${RUN}:approval`, run_id: RUN, decision: 'approve', owner_ref: OWNER, now: '2026-09-12T01:00:00.000Z' });
  assert.equal(r.ok, true);
  assert.equal(r.decision, 'approve');
  assert.equal(r.run_id, RUN);
  assert.equal(r.gate_status, 'APPROVED_BY_OPERATOR');
  assert.equal(r.execution_authorized, false, 'approving does not authorize execution');
  assert.equal(r.external_effect, false);
  assert.equal(r.executed, false);
  assert.equal(r.action_gate_bypassed, false);
  assert.equal(r.worker_self_accepted, false);
  assert.equal(r.audit_event.action, 'APPROVAL_DECISION');
  assert.equal(r.audit_event.approval.actor_type, 'OPERATOR');
  assert.equal(r.audit_event.approval.explicit, true);
  assert.equal(r.audit_event.result.external_effect, false);
  assert.equal(r.audit_event.request_id, RUN, 'decision groups with the correlated run');
}

// ── correlation mismatch: cannot decide against the wrong run ──
{
  const r = evaluateJarvisApprovalDecisionV1({ approvals: APPROVALS, approval_id: `${RUN}:approval`, run_id: 'ffffffff-0000-4000-8000-000000000000', decision: 'approve', owner_ref: OWNER });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'JARVIS_APPROVAL_RUN_CORRELATION_MISMATCH');
}

// ── unknown / already-decided / bad decision / no owner ──
assert.equal(evaluateJarvisApprovalDecisionV1({ approvals: APPROVALS, approval_id: 'nope', decision: 'approve', owner_ref: OWNER }).error, 'JARVIS_APPROVAL_NOT_FOUND');
assert.equal(evaluateJarvisApprovalDecisionV1({ approvals: [{ ...APPROVALS[0], state: 'GRANTED' }], approval_id: `${RUN}:approval`, decision: 'approve', owner_ref: OWNER }).error, 'JARVIS_APPROVAL_ALREADY_DECIDED');
assert.equal(evaluateJarvisApprovalDecisionV1({ approvals: APPROVALS, approval_id: `${RUN}:approval`, decision: 'yolo', owner_ref: OWNER }).error, 'JARVIS_APPROVAL_DECISION_INVALID');
assert.equal(evaluateJarvisApprovalDecisionV1({ approvals: APPROVALS, approval_id: `${RUN}:approval`, decision: 'approve' }).error, 'JARVIS_APPROVAL_OWNER_REQUIRED');
assert.deepEqual(JARVIS_APPROVAL_DECISIONS, ['approve', 'reject', 'defer']);

// ── end-to-end through the private worker ──
const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const sess = await createJarvisSessionV1({ ok: true, email: 'op@example.invalid' });

function decide(store, bodyObj) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/approvals/decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bodyObj) }),
    {}, {}, { authorize, memory_store: store }
  );
}

// seed a real approval-gated run into the audit log
async function seedGatedRun(store) {
  const e = createJarvisAuditEventV1({
    timestamp: '2026-09-12T00:00:00.000Z', owner_ref: sess.owner_ref, request: 'Staging-Deploy', action: 'DEPLOY_STAGING',
    permissions: ['cloudflare.deploy'], result: { status: 'PENDING' },
    approval: { required: true, gate_status: 'AWAITING_APPROVAL', reason: 'Live-Umgebung.', risk: 'mittel' }
  });
  e.request_id = RUN;
  await store.appendAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, event: e });
}

// approve records a decision, does not execute, no external effect
{
  const store = createMemoryJarvisStoreV1();
  await seedGatedRun(store);
  const res = await decide(store, { approval_id: `${RUN}:approval`, run_id: RUN, decision: 'approve' });
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.ok, true);
  assert.equal(b.executed, false);
  assert.equal(b.external_effect, false);
  assert.equal(b.action_gate_bypassed, false);
  assert.equal(b.gate_status, 'APPROVED_BY_OPERATOR');

  // the decision is now a persisted audit event grouped with the run
  const rows = await store.readAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, limit: 10 });
  const decisionRow = rows.find((r) => r.action === 'APPROVAL_DECISION');
  assert.ok(decisionRow, 'decision persisted');
  assert.equal(decisionRow.request_id, RUN);
  assert.equal(decisionRow.result.external_effect, false);

  // deciding again -> the projection now shows a non-PENDING approval state? the
  // projection derives approval state from the latest gate; a second decide is
  // still safe (records another decision) but never executes.
  const again = await decide(store, { approval_id: `${RUN}:approval`, run_id: RUN, decision: 'approve' });
  const b2 = await again.json();
  assert.equal(b2.external_effect ?? false, false);
}

// wrong run id -> 409, nothing recorded
{
  const store = createMemoryJarvisStoreV1();
  await seedGatedRun(store);
  const res = await decide(store, { approval_id: `${RUN}:approval`, run_id: 'ffffffff-1111-4111-8111-111111111111', decision: 'approve' });
  assert.equal(res.status, 409);
  const b = await res.json();
  assert.equal(b.error, 'JARVIS_APPROVAL_RUN_CORRELATION_MISMATCH');
  const rows = await store.readAudit({ owner_id: sess.owner_id, owner_ref: sess.owner_ref, limit: 10 });
  assert.equal(rows.filter((r) => r.action === 'APPROVAL_DECISION').length, 0);
}

// no store -> fail closed 503
{
  const res = await handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/approvals/decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approval_id: 'x', decision: 'approve' }) }),
    { JARVIS_ENVIRONMENT: 'staging' }, {}, { authorize }
  );
  assert.equal(res.status, 503);
}

const man = jarvisCommandCenterApprovalRuntimeManifestV1();
assert.equal(man.projected_approval_can_self_approve, false);
assert.equal(man.requires_run_correlation, true);
assert.equal(man.approving_bypasses_action_gate, false);
assert.equal(man.external_effect_on_decision, false);
assert.equal(man.worker_output_counts_as_acceptance, false);
assert.equal(man.fail_closed_without_store, true);

console.log('JARVIS Command Center approval runtime path V1 smoke: PASS');
