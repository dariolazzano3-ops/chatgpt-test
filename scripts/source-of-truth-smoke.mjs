import assert from 'node:assert/strict';
import { buildSourceOfTruth, validateSourceOfTruth, resolveAndValidateSourceOfTruth, sourceOfTruthManifest } from '../src/source-of-truth.js';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { buildTaskExecutionContract } from '../src/orchestration-state.js';
import { runMissionPipeline } from '../src/mission-pipeline.js';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const built = buildSourceOfTruth({
  canonical_branch: 'factory-control',
  baseline_branch: 'factory-control',
  project_head: SHA_A,
  expected_parent_sha: SHA_A
});
assert.equal(built.ok, true);
assert.equal(built.context.bound, true);
assert.equal(built.context.enforcement, 'strict');
assert.equal(built.context.expected_parent_sha, SHA_A);

const invalid = buildSourceOfTruth({ project_head: 'abc123' });
assert.equal(invalid.ok, false);
assert.equal(invalid.error, 'INVALID_REVISION_SHA');

const current = validateSourceOfTruth(built.context, { project_head: SHA_A });
assert.equal(current.ok, true);
assert.equal(current.status, 'CURRENT');
assert.equal(current.execution_allowed, true);

const stale = validateSourceOfTruth(built.context, { project_head: SHA_B });
assert.equal(stale.ok, false);
assert.equal(stale.code, 'STALE_PROJECT_HEAD');
assert.equal(stale.execution_allowed, false);
assert.equal(stale.severity, 'critical');

const resolverFailure = await resolveAndValidateSourceOfTruth(built.context, {
  resolve_project_head: async () => { throw new Error('mock source control unavailable'); }
});
assert.equal(resolverFailure.ok, false);
assert.equal(resolverFailure.code, 'PROJECT_HEAD_RESOLUTION_FAILED');
assert.equal(resolverFailure.retryable, true);

const input = {
  prompt: 'Erstelle eine Website für das Projekt.',
  project: 'revision-guard-smoke',
  canonical_branch: 'factory-control',
  baseline_branch: 'factory-control',
  project_head: SHA_A,
  expected_parent_sha: SHA_A
};
const compiled = compileMissionPackage(input);
assert.equal(compiled.ok, true);
assert.equal(compiled.package.mission.source_of_truth.expected_parent_sha, SHA_A);
assert.equal(compiled.package.mission.mission_revision, SHA_A);
assert.equal(compiled.package.safeguards.stale_revision_execution_blocked, true);
const task = compiled.package.mission.tasks[0];
const contract = buildTaskExecutionContract(compiled.package.mission, task.task_id);
assert.equal(contract.ok, true);
assert.equal(contract.expected_parent_sha, SHA_A);
assert.equal(contract.safeguards.stale_revision_execution_blocked, true);
assert.equal(contract.safeguards.production_deploy, false);

const compiledOtherRevision = compileMissionPackage({ ...input, project_head: SHA_B, expected_parent_sha: SHA_B });
assert.equal(compiledOtherRevision.ok, true);
assert.notEqual(compiledOtherRevision.package.mission.mission_id, compiled.package.mission.mission_id);

let dispatchCalls = 0;
const blocked = await runMissionPipeline(input, {
  resolve_project_head: async () => SHA_B,
  dispatch_web: async () => { dispatchCalls += 1; return { job_id: 'must-not-run' }; }
});
assert.equal(blocked.ok, false);
assert.equal(blocked.stage, 'source_of_truth');
assert.equal(blocked.error, 'STALE_PROJECT_HEAD');
assert.equal(blocked.source_of_truth.execution_allowed, false);
assert.equal(blocked.production_deploy, false);
assert.equal(dispatchCalls, 0);

const waiting = await runMissionPipeline(input, { resolve_project_head: async () => SHA_A });
assert.equal(waiting.ok, true);
assert.equal(waiting.stage, 'waiting_for_approval');
assert.equal(waiting.source_of_truth.status, 'CURRENT');
assert.equal(waiting.production_deploy, false);

const legacy = await runMissionPipeline({ prompt: 'Erstelle eine Website.', project: 'legacy-smoke' });
assert.equal(legacy.ok, true);
assert.equal(legacy.source_of_truth.status, 'UNBOUND');
assert.equal(legacy.production_deploy, false);

const manifest = sourceOfTruthManifest();
assert.equal(manifest.stale_project_head_blocks_execution, true);
assert.equal(manifest.resolver_is_explicitly_injected, true);
assert.equal(manifest.production_deploy, false);
console.log('source-of-truth-smoke: ok');
