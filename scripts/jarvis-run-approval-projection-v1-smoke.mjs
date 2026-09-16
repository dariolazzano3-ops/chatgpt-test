import assert from 'node:assert/strict';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisCommandCenterReadBindingsV1 } from '../src/jarvis/command-center-read-bindings-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:projection@example.invalid';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const store = createMemoryJarvisStoreV1();

async function append(timestamp, event) {
  await store.appendAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, event: { timestamp, request_id: REQUEST_ID, ...event } });
}

await append('2026-09-16T00:00:00.000Z', {
  action: 'IMPLEMENTATION_MISSION', intent: { intent_type: 'IMPLEMENTATION_MISSION_REQUEST' },
  result: { status: 'PREPARED', program: 'JARVIS_CAPABILITY_EXPANSION_V3', wave_index: 5 },
  approval: { required: true, explicit: false, gate_status: 'PREPARE_ONLY' }
});
await append('2026-09-16T00:00:01.000Z', {
  action: 'IMPLEMENTATION_MISSION', intent: { intent_type: 'IMPLEMENTATION_MISSION_RESUME_REQUEST' },
  result: { status: 'FAILED', program: 'JARVIS_CAPABILITY_EXPANSION_V3', wave_index: 5, claude_execution_state: 'FAILED' },
  approval: { required: true, explicit: true, actor_type: 'PROGRAM_CONTROLLER', gate_status: 'APPROVED_VIA_PROGRAM_APPROVAL' }
});
await append('2026-09-16T00:00:02.000Z', {
  action: 'IMPLEMENTATION_MISSION', intent: { intent_type: 'IMPLEMENTATION_MISSION_REQUEST' },
  result: {
    status: 'COMPLETED', program: 'JARVIS_CAPABILITY_EXPANSION_V3', wave_index: 5,
    claude_execution_state: 'TRUSTED_CANDIDATE_RECOVERED', trusted_candidate_recovery: true,
    verification: { branch: 'factory/x', branch_drift: false, files_changed: ['a.js'], syntax_check: { passed: true } }
  },
  approval: { required: false, explicit: false, actor_type: 'SYSTEM', gate_status: 'TRUSTED_CANDIDATE_RECOVERY_EVIDENCE_ONLY' }
});

const bindings = createJarvisCommandCenterReadBindingsV1({ store, owner_id: OWNER_ID, owner_ref: OWNER_REF });
const runs = await bindings.runs();
const run = runs.data.find((item) => item.id === REQUEST_ID);
assert.ok(run, 'recovered request must be projected');
assert.equal(run.status, 'COMPLETE');
assert.equal(run.approval_state, 'GRANTED', 'later non-approval evidence must not erase prior granted approval');
assert.equal(run.acceptance_state, 'ACCEPTANCE_PENDING', 'recovery evidence alone must never grant acceptance');
console.log('JARVIS Run Approval Projection V1 smoke: PASS');
