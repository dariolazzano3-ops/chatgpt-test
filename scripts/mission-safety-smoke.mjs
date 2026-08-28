import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { resumeMission } from '../src/orchestration-state.js';
import { validateMissionPersistence, missionPersistenceGuardManifest } from '../src/mission-persistence-guard.js';
import { commitJsonFilesAtomically, githubAtomicCommitManifest } from '../src/github-atomic-json-commit.js';
import { runMissionPipeline, missionPipelineManifest } from '../src/mission-pipeline.js';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const compiled = compileMissionPackage({ prompt: 'Baue eine Website.', project: 'safety-smoke', canonical_branch: 'factory-control', baseline_branch: 'factory-control', project_head: SHA_A, expected_parent_sha: SHA_A });
assert.equal(compiled.ok, true);
const boundMission = compiled.package.mission;
const missingObservedHead = resumeMission(boundMission, { expected_revision: boundMission.revision });
assert.equal(missingObservedHead.ok, false);
assert.equal(missingObservedHead.error, 'CURRENT_PROJECT_HEAD_REQUIRED');
const staleHead = resumeMission(boundMission, { expected_revision: boundMission.revision, observed_project_head: SHA_B });
assert.equal(staleHead.ok, false);
assert.equal(staleHead.error, 'STALE_PROJECT_HEAD');

const nextMission = { ...boundMission, revision: boundMission.revision + 1 };
const validPersistence = validateMissionPersistence(boundMission, nextMission, { expected_revision: boundMission.revision, new_revision: nextMission.revision });
assert.equal(validPersistence.ok, true);
const stalePersistence = validateMissionPersistence({ ...boundMission, revision: 7 }, nextMission, { expected_revision: boundMission.revision, new_revision: nextMission.revision });
assert.equal(stalePersistence.ok, false);
assert.equal(stalePersistence.code, 'MISSION_PERSIST_CONFLICT');
const wrongMission = validateMissionPersistence(boundMission, { ...nextMission, mission_id: 'mission-other' }, { expected_revision: boundMission.revision, new_revision: nextMission.revision });
assert.equal(wrongMission.ok, false);
assert.equal(wrongMission.code, 'PERSIST_MISSION_ID_MISMATCH');

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
const calls = [];
const queue = [
  response({ object: { sha: SHA_A } }),
  response({ tree: { sha: SHA_B } }),
  response({ sha: 'cccccccccccccccccccccccccccccccccccccccc' }),
  response({ sha: 'dddddddddddddddddddddddddddddddddddddddd' }),
  response({ sha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }),
  response({ sha: 'ffffffffffffffffffffffffffffffffffffffff' }),
  response({ sha: '1111111111111111111111111111111111111111' }),
  response({ object: { sha: '1111111111111111111111111111111111111111' } })
];
const fakeFetch = async (url, options) => {
  calls.push({ url, options });
  const next = queue.shift();
  if (!next) throw new Error('UNEXPECTED_FETCH');
  return next;
};
const atomic = await commitJsonFilesAtomically({
  repository: 'owner/repository',
  branch: 'factory-control',
  token: 'test-token',
  expected_parent_sha: SHA_A,
  message: 'Persist mission package atomically',
  files: [
    { path: 'factory-state/missions/mission-test.json', value: { mission_id: 'mission-test' } },
    { path: 'factory-state/mission-contracts/mission-test.json', value: { contracts: {} } },
    { path: 'factory-state/mission-packages/mission-test.json', value: { atomic: true } }
  ]
}, { fetch_impl: fakeFetch });
assert.equal(atomic.ok, true);
assert.equal(atomic.atomic, true);
assert.equal(atomic.paths.length, 3);
assert.equal(calls.filter((call) => call.options.method === 'PATCH').length, 1);
assert.equal(calls.some((call) => call.url.includes('/contents/')), false);
assert.equal(queue.length, 0);

let conflictCalls = 0;
const conflict = await commitJsonFilesAtomically({
  repository: 'owner/repository', branch: 'factory-control', token: 'test-token', expected_parent_sha: SHA_B, message: 'Conflict',
  files: [{ path: 'factory-state/missions/mission-test.json', value: {} }]
}, { fetch_impl: async () => { conflictCalls += 1; return response({ object: { sha: SHA_A } }); } });
assert.equal(conflict.ok, false);
assert.equal(conflict.code, 'ATOMIC_COMMIT_PARENT_CONFLICT');
assert.equal(conflictCalls, 1);

const supervisionFailure = await runMissionPipeline(
  { prompt: 'Baue eine Website.', project: 'supervision-failure-smoke' },
  {
    activation: { adapter_approvals: { web: { authorized: true } }, production_deploy: false },
    persist: async () => ({ ok: false, code: 'MISSION_PERSIST_CONFLICT' })
  }
);
assert.equal(supervisionFailure.ok, false);
assert.equal(supervisionFailure.stage, 'supervision_failed');
assert.equal(supervisionFailure.error, 'MISSION_PERSIST_CONFLICT');
assert.equal(supervisionFailure.completed, false);
assert.equal(supervisionFailure.production_deploy, false);

const persistenceManifest = missionPersistenceGuardManifest();
assert.equal(persistenceManifest.stale_writer_rejected, true);
const atomicManifest = githubAtomicCommitManifest();
assert.equal(atomicManifest.single_ref_update, true);
const pipelineManifest = missionPipelineManifest();
assert.equal(pipelineManifest.supervisor_failures_propagated, true);
assert.equal(pipelineManifest.real_provider_execution_implicit, false);
console.log(JSON.stringify({ ok: true, suite: 'mission-safety', atomic_persistence: true, stale_writer_rejected: true, production_deploy: false }, null, 2));
