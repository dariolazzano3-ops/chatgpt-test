import assert from 'node:assert/strict';
import { evaluateJarvisProgramRunnerRecoveryV1, jarvisProgramRunnerRecoveryManifestV1 } from '../src/jarvis/program-runner-recovery-v1.js';

const scope = { program: 'JARVIS_MASTERARCHITECTURE_V2', repo_dir: '/repo', target_branch: 'factory/jarvis-masterarchitecture-v2' };
const safeState = {
  ok: true, current_wave: 8, verified_progress_percent: 71,
  program_approval: { granted: true }, wave_state: 'PENDING',
  next_action: { action: 'PROPOSE_WAVE_TASK' }, branch_truth: { working_tree_clean: true }
};
const row = (status, cycle, at) => ({
  action: 'PROGRAM_RUNNER_CYCLE', occurred_at: at,
  result: { status, cycle_id: cycle, program: scope.program, repo_dir: scope.repo_dir, target_branch: scope.target_branch }
});

{
  const recovery = evaluateJarvisProgramRunnerRecoveryV1({ audit: [], ...scope, controller_state: safeState });
  assert.equal(recovery.ok, true);
  assert.equal(recovery.resume_allowed, true);
  assert.equal(recovery.status, 'READY');
}

{
  const audit = [row('STARTED', 'cycle-1', '2026-09-15T01:00:00Z')];
  const recovery = evaluateJarvisProgramRunnerRecoveryV1({ audit, ...scope, controller_state: safeState });
  assert.equal(recovery.resume_allowed, true, 'interrupted cycle is not blindly replayed; fresh controller state decides');
  assert.equal(recovery.status, 'RECOVERABLE_INTERRUPTION');
  assert.equal(recovery.interrupted_cycle, 'cycle-1');
  assert.equal(recovery.reason, 'INTERRUPTED_CYCLE_REDERIVED_FROM_CONTROLLER');
}

{
  const audit = [
    row('STARTED', 'cycle-1', '2026-09-15T01:00:00Z'),
    row('FINISHED', 'cycle-1', '2026-09-15T01:00:10Z')
  ];
  const recovery = evaluateJarvisProgramRunnerRecoveryV1({ audit, ...scope, controller_state: safeState });
  assert.equal(recovery.status, 'READY');
  assert.equal(recovery.interrupted_cycle, null);
}

{
  const noApproval = evaluateJarvisProgramRunnerRecoveryV1({ audit: [], ...scope, controller_state: { ...safeState, program_approval: { granted: false } } });
  assert.equal(noApproval.resume_allowed, false);
  assert.equal(noApproval.reason, 'PROGRAM_APPROVAL_REQUIRED');

  const dirty = evaluateJarvisProgramRunnerRecoveryV1({
    audit: [], ...scope,
    controller_state: { ...safeState, branch_truth: { working_tree_clean: false }, next_action: { action: 'PROPOSE_WAVE_TASK' } }
  });
  assert.equal(dirty.resume_allowed, false);
  assert.equal(dirty.reason, 'ACCEPTED_WORK_AWAITS_PUBLICATION');

  const complete = evaluateJarvisProgramRunnerRecoveryV1({ audit: [], ...scope, controller_state: { ...safeState, verified_progress_percent: 100 } });
  assert.equal(complete.resume_allowed, false);
  assert.equal(complete.reason, 'PROGRAM_COMPLETE');
}

const man = jarvisProgramRunnerRecoveryManifestV1();
assert.equal(man.mutable_recovery_table, false);
assert.equal(man.interrupted_cycle_replayed_blindly, false);
assert.equal(man.controller_state_rederived_after_restart, true);
assert.equal(man.production_deploy, false);
assert.equal(man.hamyren_data_flow, false);

console.log('JARVIS Program Runner Recovery V1 smoke: PASS');
