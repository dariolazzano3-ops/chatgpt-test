import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { transitionMissionTask, resumeMission, buildTaskExecutionContract } from '../src/orchestration-state.js';
import { acquireMissionLease, renewMissionLease, releaseMissionLease, validateMissionLease, missionRecoveryKey, stateConcurrencyManifest } from '../src/state-concurrency.js';
import { missionSupervisorManifest } from '../src/mission-supervisor.js';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const BASE_NOW = Date.now();
const compiled = compileMissionPackage({
  prompt: 'Erstelle eine Website für das Projekt.',
  project: 'state-cas-smoke',
  canonical_branch: 'factory-control',
  baseline_branch: 'factory-control',
  project_head: SHA_A,
  expected_parent_sha: SHA_A
});
assert.equal(compiled.ok, true);
let mission = compiled.package.mission;
assert.equal(mission.schema_version, 3);
assert.equal(mission.revision, 1);
assert.equal(mission.execution_lease, null);

const task = mission.tasks.find((item) => item.state === 'READY');
assert.ok(task);
const staleStart = transitionMissionTask(mission, task.task_id, 'start', { expected_revision: 0 });
assert.equal(staleStart.ok, false);
assert.equal(staleStart.error, 'MISSION_REVISION_CONFLICT');
assert.equal(staleStart.retryable, true);

const started = transitionMissionTask(mission, task.task_id, 'start', { expected_revision: 1 });
assert.equal(started.ok, true);
mission = started.mission;
assert.equal(mission.revision, 2);
const runningTask = mission.tasks.find((item) => item.task_id === task.task_id);
assert.equal(runningTask.state, 'RUNNING');
assert.ok(runningTask.recovery_key?.startsWith('recovery-'));
assert.equal(runningTask.recovery_key, missionRecoveryKey(mission, runningTask));

const lease = acquireMissionLease(mission, 'worker-a', { expected_revision: 2, ttl_ms: 10000, now_ms: BASE_NOW });
assert.equal(lease.ok, true);
mission = lease.mission;
assert.equal(mission.revision, 3);
const blockedLease = acquireMissionLease(mission, 'worker-b', { expected_revision: 3, ttl_ms: 10000, now_ms: BASE_NOW + 1000 });
assert.equal(blockedLease.ok, false);
assert.equal(blockedLease.code, 'MISSION_LEASE_HELD');
assert.equal(blockedLease.retryable, true);
assert.equal(validateMissionLease(mission, lease.lease.lease_id, 'worker-a', { now_ms: BASE_NOW + 1000 }).ok, true);

const renewal = renewMissionLease(mission, lease.lease.lease_id, 'worker-a', { expected_revision: 3, ttl_ms: 20000, now_ms: BASE_NOW + 2000 });
assert.equal(renewal.ok, true);
mission = renewal.mission;
assert.equal(mission.revision, 4);

const resumeWhileLeased = resumeMission(mission, { expected_revision: 4, observed_project_head: SHA_A });
assert.equal(resumeWhileLeased.ok, false);
assert.equal(resumeWhileLeased.error, 'MISSION_LEASE_HELD');

const staleResume = resumeMission({ ...mission, execution_lease: null }, { expected_revision: 4, observed_project_head: SHA_B });
assert.equal(staleResume.ok, false);
assert.equal(staleResume.error, 'STALE_PROJECT_HEAD');

const released = releaseMissionLease(mission, lease.lease.lease_id, 'worker-a', { expected_revision: 4, now_ms: BASE_NOW + 3000 });
assert.equal(released.ok, true);
mission = released.mission;
assert.equal(mission.revision, 5);
assert.equal(mission.execution_lease, null);

const resumed = resumeMission(mission, { expected_revision: 5, observed_project_head: SHA_A });
assert.equal(resumed.ok, true);
mission = resumed.mission;
assert.equal(mission.revision, 6);
assert.equal(mission.tasks.find((item) => item.task_id === task.task_id).state, 'READY');
assert.equal(mission.tasks.find((item) => item.task_id === task.task_id).last_error.code, 'INTERRUPTED_EXECUTION');

const contract = buildTaskExecutionContract(mission, task.task_id);
assert.equal(contract.ok, true);
assert.equal(contract.contract_version, 3);
assert.equal(contract.state_revision, 6);
assert.ok(contract.recovery_key.startsWith('recovery-'));
assert.equal(contract.safeguards.production_deploy, false);
assert.equal(contract.safeguards.optimistic_concurrency_control, true);

const concurrency = stateConcurrencyManifest();
assert.equal(concurrency.optimistic_cas, true);
assert.equal(concurrency.bounded_execution_leases, true);
assert.equal(concurrency.production_deploy, false);
const supervisor = missionSupervisorManifest();
assert.equal(supervisor.version, '4.9');
assert.equal(supervisor.engine_revision, 'max-state-cas-1');
assert.equal(supervisor.compare_and_swap_persistence, true);
assert.equal(supervisor.production_deploy, false);
console.log('state-concurrency-smoke: ok');
