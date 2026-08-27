import assert from 'node:assert/strict';
import { classifyFailureKind, classifyJobRecovery, buildRecoveryPatch } from './factory-recovery.mjs';

const now = '2026-08-27T20:00:00.000Z';
const staleJob = { job_id: 'aaaaaaaa', status: 'QA_RUNNING', created_at: '2026-08-27T18:00:00.000Z', updated_at: '2026-08-27T18:30:00.000Z', recovery_attempt: 0 };
const failedInfra = { job_id: 'bbbbbbbb', status: 'FAILED', created_at: now, updated_at: now, last_error: 'wrangler pages deploy timeout', failure_stage: 'preview' };
const failedQa = { job_id: 'cccccccc', status: 'FAILED', created_at: now, updated_at: now, last_error: 'visual QA overflow', failure_stage: 'qa' };
const workshop = { job_id: 'dddddddd', status: 'WORKSHOP_REQUIRED', created_at: now, updated_at: now };

assert.equal(classifyFailureKind({ error: failedInfra.last_error, stage: failedInfra.failure_stage }), 'infrastructure');
assert.equal(classifyFailureKind({ error: failedQa.last_error, stage: failedQa.failure_stage }), 'project_quality');

const stale = classifyJobRecovery(staleJob, { now });
assert.equal(stale.state, 'safe_retry');
assert.equal(stale.recoverable, true);
assert.equal(stale.reason, 'STALE_INCOMPLETE_JOB');

const infra = classifyJobRecovery(failedInfra, { now });
assert.equal(infra.state, 'safe_retry');
assert.equal(infra.failure_kind, 'infrastructure');

const qa = classifyJobRecovery(failedQa, { now });
assert.equal(qa.state, 'manual_review');
assert.equal(qa.recoverable, false);

const manual = classifyJobRecovery(workshop, { now });
assert.equal(manual.state, 'manual_review');

const patch = buildRecoveryPatch(failedInfra, { now });
assert.equal(patch.recovery_status, 'resuming');
assert.equal(patch.recovery_attempt, 1);
assert.equal(patch.recovery_from_status, 'FAILED');

console.log(JSON.stringify({ ok: true, stale_recovery: stale.reason, infra_recovery: infra.reason, qa_recovery: qa.reason }, null, 2));
