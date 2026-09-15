import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { handleJarvisProgramApprovalGrantRuntimeV1 } from '../src/jarvis/program-approval-v1.js';
import { handleJarvisProgramTickRuntimeV1, handleJarvisProgramStateRuntimeV1, JARVIS_AUTONOMY_PAUSED_ENV_VAR } from '../src/jarvis/program-controller-v1.js';
import { createJarvisProgramRunnerV1 } from '../src/jarvis/program-runner-v1.js';
import { getJarvisWaveRegistryEntryV1, JARVIS_WAVE_REGISTRY_PROGRAM } from '../src/jarvis/wave-registry-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:e2e@example.invalid';
const PROGRAM = JARVIS_WAVE_REGISTRY_PROGRAM;
const git = (dir, args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-v2-e2e-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'e2e@example.invalid']);
  git(dir, ['config', 'user.name', 'JARVIS E2E']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e\n');
  git(dir, ['add', '.']); git(dir, ['commit', '-q', '-m', 'init']); git(dir, ['branch', '-m', 'main']);
  return dir;
}
const repo = makeRepo();
const branch = 'factory/jarvis-v2-e2e-proof';
const store = createMemoryJarvisStoreV1();
const wave0 = getJarvisWaveRegistryEntryV1(PROGRAM, 0);
const wave1 = getJarvisWaveRegistryEntryV1(PROGRAM, 1);
const verification = (file) => ({
  schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch,
  branch_drift: false, files_changed: [file], pre_existing_dirty_files: [],
  syntax_check: { passed: true, checked: 1, results: [{ file, passed: true }] },
  at: new Date().toISOString()
});
const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
  [wave0.title]: { exit_code: 0, verification: verification(wave0.expected_files[0]) },
  [wave1.title]: { exit_code: 0, verification: verification(wave1.expected_files[0]) }
}) });
const grant = await handleJarvisProgramApprovalGrantRuntimeV1({
  owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch,
  scope: ['LOCAL_FEATURE_BRANCH_MANAGEMENT', 'CLAUDE_REPO_BOUND_EXECUTION', 'INDEPENDENT_VERIFICATION', 'ACCEPTANCE', 'PROGRESS_ADVANCEMENT', 'NEXT_WAVE_CONTINUATION'],
  confirm_scope: true
}, { memory_store: store });
assert.equal(grant.ok, true);
const controller = {
  state: (request) => handleJarvisProgramStateRuntimeV1(request, { memory_store: store }),
  tick: (request) => handleJarvisProgramTickRuntimeV1(request, { memory_store: store, claude_bridge: bridge })
};
const timers = [];
const runner = createJarvisProgramRunnerV1({
  enabled: true, require_recovery: false, owner_id: OWNER_ID, owner_ref: OWNER_REF,
  program: PROGRAM, repo_dir: repo, target_branch: branch, max_ticks: 7
}, {
  controller, memory_store: store,
  set_timeout: (fn) => { timers.push(fn); return { unref() {} }; }, clear_timeout: () => {}
});
const started = await runner.start({ confirm_run: true });
assert.equal(started.ok, true);
assert.equal(runner.state().active, true);
const cycle = await runner.run_once();
assert.equal(cycle.ok, true, JSON.stringify(cycle));
assert.equal(cycle.stop_reason, 'MAX_TICKS_REACHED');
const after = await controller.state({ owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch });
assert.equal(after.current_wave, 2);
assert.deepEqual(after.completed_waves, [0, 1]);
assert.equal(after.verified_progress_percent, 15);
const previousPause = process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR];
try {
  process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = 'true';
  const pausedCycle = await runner.run_once();
  assert.equal(pausedCycle.ok, true);
  assert.equal(pausedCycle.stop_reason, 'AUTONOMY_PAUSED');
  assert.equal(runner.state().active, false);
} finally {
  if (previousPause === undefined) delete process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR];
  else process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = previousPause;
}
const recoveredRunner = createJarvisProgramRunnerV1({
  enabled: true, require_recovery: true, owner_id: OWNER_ID, owner_ref: OWNER_REF,
  program: PROGRAM, repo_dir: repo, target_branch: branch, max_ticks: 1
}, { controller, memory_store: store, set_timeout: () => ({ unref() {} }), clear_timeout: () => {} });
const recovery = await recoveredRunner.recover();
assert.equal(recovery.ok, true);
assert.equal(recovery.resume_allowed, true);
assert.equal(recovery.current_wave, 2);
assert.equal(recovery.verified_progress_percent, 15);
const audit = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 200 });
assert.ok(audit.some((row) => row.action === 'PROGRAM_RUNNER_CYCLE' && row.result?.status === 'STARTED'));
assert.ok(audit.some((row) => row.action === 'PROGRAM_RUNNER_CYCLE' && row.result?.status === 'FINISHED'));
assert.ok(audit.some((row) => row.result?.wave_index === 0 && row.result?.independent_acceptance === true));
assert.ok(audit.some((row) => row.result?.wave_index === 1 && row.result?.independent_acceptance === true));
console.log('JARVIS V2 Autonomous E2E V1: PASS — runner -> controller -> bridge -> acceptance -> progress -> next wave -> pause -> recovery');
