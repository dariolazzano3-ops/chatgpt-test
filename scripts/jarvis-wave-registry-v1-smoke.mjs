import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  getJarvisWaveRegistryEntryV1,
  isJarvisWaveDependencySatisfiedV1,
  jarvisWaveRegistryManifestV1,
  JARVIS_WAVE_REGISTRY_PROGRAM,
  JARVIS_V3_WAVE_REGISTRY_PROGRAM
} from '../src/jarvis/wave-registry-v1.js';
import { proposeJarvisWaveTaskV1, jarvisWaveTaskPlannerManifestV1 } from '../src/jarvis/wave-task-planner-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { handleJarvisProgramApprovalGrantRuntimeV1 } from '../src/jarvis/program-approval-v1.js';
import { handleJarvisProgramTickRuntimeV1, handleJarvisProgramStateRuntimeV1 } from '../src/jarvis/program-controller-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:op@example.invalid';
const PROGRAM = JARVIS_WAVE_REGISTRY_PROGRAM;

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-wave-registry-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', 'main']);
  return dir;
}

// ── 1. Registry: pure, deterministic lookups ──
{
  const wave0 = getJarvisWaveRegistryEntryV1(PROGRAM, 0);
  assert.equal(wave0.wave_index, 0);
  assert.deepEqual(wave0.depends_on, []);

  const wave1 = getJarvisWaveRegistryEntryV1(PROGRAM, 1);
  assert.equal(wave1.wave_index, 1);
  assert.deepEqual(wave1.depends_on, [0]);
  assert.ok(wave1.title.length > 0 && wave1.goal.length > 0);

  const wave2 = getJarvisWaveRegistryEntryV1(PROGRAM, 2);
  assert.equal(wave2.wave_index, 2);
  assert.deepEqual(wave2.depends_on, [1]);
  assert.ok(wave2.title.length > 0 && wave2.goal.length > 0);
  assert.ok(wave2.expected_files.includes('src/jarvis/command-center-v1.js'));
  assert.equal(wave2.required_checks.length, 3);

  const wave3 = getJarvisWaveRegistryEntryV1(PROGRAM, 3);
  assert.equal(wave3.wave_index, 3);
  assert.deepEqual(wave3.depends_on, [2]);
  assert.ok(wave3.title.length > 0 && wave3.goal.length > 0);
  assert.ok(wave3.expected_files.includes('src/jarvis/program-approval-v1.js'));
  assert.equal(wave3.required_checks.length, 4);

  const wave6 = getJarvisWaveRegistryEntryV1(PROGRAM, 6);
  assert.equal(wave6.wave_index, 6);
  assert.deepEqual(wave6.depends_on, [5]);
  assert.ok(wave6.title.length > 0 && wave6.goal.length > 0);
  assert.deepEqual(wave6.expected_files, [
    'src/jarvis/program-loop-v1.js',
    'scripts/jarvis-program-loop-v1-smoke.mjs',
    'src/jarvis/wave-registry-v1.js',
    'scripts/jarvis-wave-registry-v1-smoke.mjs'
  ]);
  assert.equal(wave6.required_checks.length, 2);

  const wave7 = getJarvisWaveRegistryEntryV1(PROGRAM, 7);
  assert.equal(wave7.wave_index, 7);
  assert.deepEqual(wave7.depends_on, [6]);
  assert.equal(wave7.id, 'wave-7-private-program-runner');
  assert.ok(wave7.expected_files.includes('src/jarvis/program-runner-v1.js'));
  assert.equal(wave7.required_checks.length, 4);

  const wave8 = getJarvisWaveRegistryEntryV1(PROGRAM, 8);
  assert.equal(wave8.wave_index, 8);
  assert.deepEqual(wave8.depends_on, [7]);
  assert.equal(wave8.id, 'wave-8-runner-restart-recovery');
  assert.ok(wave8.expected_files.includes('src/jarvis/program-runner-recovery-v1.js'));
  assert.equal(wave8.required_checks.length, 6);

  const wave9 = getJarvisWaveRegistryEntryV1(PROGRAM, 9);
  assert.equal(wave9.wave_index, 9);
  assert.deepEqual(wave9.depends_on, [8]);
  assert.equal(wave9.id, 'wave-9-command-center-autonomy-operations');
  assert.ok(wave9.expected_files.includes('src/jarvis/command-center-ui/jarvis-command-center.jsx'));
  assert.deepEqual(wave9.generated_files, ['src/jarvis/command-center-ui/bundle.built.js']);
  assert.equal(wave9.required_checks.length, 6);

  const wave10 = getJarvisWaveRegistryEntryV1(PROGRAM, 10);
  assert.equal(wave10.wave_index, 10);
  assert.deepEqual(wave10.depends_on, [9]);
  assert.equal(wave10.id, 'wave-10-autonomous-e2e-proof');
  assert.ok(wave10.expected_files.includes('scripts/jarvis-v2-autonomous-e2e-v1.mjs'));
  assert.equal(wave10.required_checks.length, 5);

  const wave11 = getJarvisWaveRegistryEntryV1(PROGRAM, 11);
  assert.equal(wave11.wave_index, 11);
  assert.deepEqual(wave11.depends_on, [10]);
  assert.equal(wave11.id, 'wave-11-failure-matrix-safety-hardening');
  assert.ok(wave11.expected_files.includes('scripts/jarvis-v2-failure-matrix-v1-smoke.mjs'));
  assert.equal(wave11.required_checks.length, 6);

  const wave12 = getJarvisWaveRegistryEntryV1(PROGRAM, 12);
  assert.equal(wave12.wave_index, 12);
  assert.deepEqual(wave12.depends_on, [11]);
  assert.equal(wave12.id, 'wave-12-v2-completion-seal');
  assert.ok(wave12.expected_files.includes('src/jarvis/program-completion-seal-v1.js'));
  assert.equal(wave12.required_checks.length, 7);

  // Historical Waves 4/5 remain audit-defined; unknown future waves are null.
  assert.equal(getJarvisWaveRegistryEntryV1(PROGRAM, 4), null);
  assert.equal(getJarvisWaveRegistryEntryV1(PROGRAM, 5), null, 'Wave 5 is audit-defined; Wave 6 depends on its accepted index');
  assert.equal(getJarvisWaveRegistryEntryV1(PROGRAM, 99), null);
  // Wrong / unknown program -> null.
  assert.equal(getJarvisWaveRegistryEntryV1('SOME_OTHER_PROGRAM', 0), null);
  // Non-integer / negative index -> null, no throw.
  assert.equal(getJarvisWaveRegistryEntryV1(PROGRAM, -1), null);
  assert.equal(getJarvisWaveRegistryEntryV1(PROGRAM, 'x'), null);

  // Same lookup twice is byte-identical (deterministic, no hidden state).
  assert.deepEqual(getJarvisWaveRegistryEntryV1(PROGRAM, 1), getJarvisWaveRegistryEntryV1(PROGRAM, 1));
}

// ── 2. Registry: dependency logic ──
{
  const wave1 = getJarvisWaveRegistryEntryV1(PROGRAM, 1);
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave1, []), false, 'Wave 0 not yet accepted -> Wave 1 not proposable');
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave1, [0]), true);
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave1, [5, 0, 9]), true, 'order/extra entries do not matter');
  assert.equal(isJarvisWaveDependencySatisfiedV1(null, [0]), false);

  const wave0 = getJarvisWaveRegistryEntryV1(PROGRAM, 0);
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave0, []), true, 'no dependencies -> always satisfied');

  // Wave 6 depends on Wave 5 by index only — it is proposable once 5 is in
  // completed_waves, regardless of whether Wave 5 itself has a registry entry.
  const wave6 = getJarvisWaveRegistryEntryV1(PROGRAM, 6);
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave6, []), false, 'Wave 5 not yet accepted -> Wave 6 not proposable');
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave6, [0, 1, 2, 3, 4]), false, 'Wave 5 still missing -> Wave 6 not proposable');
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave6, [5]), true);
  assert.equal(isJarvisWaveDependencySatisfiedV1(wave6, [0, 1, 2, 3, 4, 5]), true);
}

// ── 3. Planner: proposes only when registered AND dependencies satisfied, never fabricates ──
{
  const noDeps = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 0, completedWaves: [] });
  assert.equal(noDeps.source, 'REGISTRY_PROPOSAL');
  assert.equal(noDeps.wave_index, 0);

  const blocked = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 1, completedWaves: [] });
  assert.equal(blocked, null, 'Wave 1 depends on Wave 0 — never proposed early');

  const ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 1, completedWaves: [0] });
  assert.equal(ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(ready.registry_id, 'wave-1-wave-registry-and-planner');
  assert.equal(ready.program, PROGRAM);

  const wave2Blocked = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 2, completedWaves: [0] });
  assert.equal(wave2Blocked, null, 'Wave 2 depends on Wave 1 — never proposed early');

  const wave2Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 2, completedWaves: [0, 1] });
  assert.equal(wave2Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave2Ready.registry_id, 'wave-2-command-center-program-controller');

  const wave3Blocked = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 3, completedWaves: [0, 1] });
  assert.equal(wave3Blocked, null, 'Wave 3 depends on Wave 2 — never proposed early');

  const wave3Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 3, completedWaves: [0, 1, 2] });
  assert.equal(wave3Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave3Ready.registry_id, 'wave-3-program-approval-grant-revoke');

  const unregistered = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 4, completedWaves: [0, 1, 2, 3] });
  assert.equal(unregistered, null, 'Wave 4 has no registry entry — never guessed');

  // Wave 6 is registered/proposable only once Wave 5 is in completed_waves.
  const wave6Blocked = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 6, completedWaves: [0, 1, 2, 3, 4] });
  assert.equal(wave6Blocked, null, 'Wave 6 depends on Wave 5 — never proposed before it is completed');

  const wave6Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 6, completedWaves: [0, 1, 2, 3, 4, 5] });
  assert.equal(wave6Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave6Ready.registry_id, 'wave-6-bounded-autonomous-program-loop');
  assert.equal(wave6Ready.program, PROGRAM);

  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 5, completedWaves: [0, 1, 2, 3, 4, 5, 6] }), null, 'Wave 5 has no registry entry — never guessed');
  const wave7Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 7, completedWaves: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(wave7Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave7Ready.registry_id, 'wave-7-private-program-runner');
  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 7, completedWaves: [0, 1, 2, 3, 4, 5] }), null, 'Wave 7 depends on accepted Wave 6');
  const wave8Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 8, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7] });
  assert.equal(wave8Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave8Ready.registry_id, 'wave-8-runner-restart-recovery');
  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 8, completedWaves: [0, 1, 2, 3, 4, 5, 6] }), null, 'Wave 8 depends on accepted Wave 7');
  const wave9Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 9, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  assert.equal(wave9Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave9Ready.registry_id, 'wave-9-command-center-autonomy-operations');
  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 9, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7] }), null, 'Wave 9 depends on accepted Wave 8');
  const wave10Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 10, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  assert.equal(wave10Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave10Ready.registry_id, 'wave-10-autonomous-e2e-proof');
  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 10, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8] }), null, 'Wave 10 depends on accepted Wave 9');
  const wave11Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 11, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  assert.equal(wave11Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave11Ready.registry_id, 'wave-11-failure-matrix-safety-hardening');
  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 11, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }), null, 'Wave 11 depends on accepted Wave 10');
  const wave12Ready = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 12, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });
  assert.equal(wave12Ready.source, 'REGISTRY_PROPOSAL');
  assert.equal(wave12Ready.registry_id, 'wave-12-v2-completion-seal');
  assert.equal(proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 12, completedWaves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }), null, 'Wave 12 depends on accepted Wave 11');
}

// ── 4. Manifests ──
{
  const regMan = jarvisWaveRegistryManifestV1();
  assert.equal(regMan.fabricates_undefined_waves, false);
  assert.ok(regMan.registered_waves.includes(0) && regMan.registered_waves.includes(1));
  assert.ok(regMan.registered_waves.includes(6), 'Wave 6 is registered');
  assert.ok(regMan.registered_waves.includes(7), 'Wave 7 is registered');
  assert.ok(regMan.registered_waves.includes(8), 'Wave 8 is registered');
  assert.ok(regMan.registered_waves.includes(9), 'Wave 9 is registered');
  assert.ok(regMan.registered_waves.includes(10), 'Wave 10 is registered');
  assert.ok(regMan.registered_waves.includes(11), 'Wave 11 is registered');
  assert.ok(regMan.registered_waves.includes(12), 'Wave 12 is registered');
  assert.ok(!regMan.registered_waves.includes(4) && !regMan.registered_waves.includes(5), 'Historical Waves 4/5 remain audit-defined');

  const planMan = jarvisWaveTaskPlannerManifestV1();
  assert.equal(planMan.operator_supplied_task_precedence, true);
  assert.equal(planMan.fabricates_task_text, false);
}

// ── 5. Program Controller integration: an operator-supplied task ALWAYS wins over the registry, unchanged ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/wave-registry-operator-precedence';
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'OPERATOR OVERRIDE TITLE': { exit_code: 0 }
  }) });
  const grant = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION', 'ACCEPTANCE', 'LOCAL_FEATURE_BRANCH_MANAGEMENT', 'PROGRESS_ADVANCEMENT', 'NEXT_WAVE_CONTINUATION'],
    confirm_scope: true
  }, { memory_store: store });
  assert.equal(grant.ok, true);

  const tickReq = { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch };
  const deps = { memory_store: store, claude_bridge: bridge };

  await handleJarvisProgramTickRuntimeV1(tickReq, deps); // PREPARE_BRANCH
  // Wave 0 IS registered, but an operator task is supplied here — it must
  // win, verbatim, over the registry's own Wave 0 proposal.
  const t2 = await handleJarvisProgramTickRuntimeV1({ ...tickReq, task: { title: 'OPERATOR OVERRIDE TITLE', goal: 'operator goal text' } }, deps);
  assert.equal(t2.performed.action, 'PROPOSE_WAVE_TASK');
  assert.equal(t2.performed.detail.task_source, 'OPERATOR_SUPPLIED');
  assert.equal(t2.performed.detail.mission.intent.title, 'OPERATOR OVERRIDE TITLE', 'the operator-supplied title, never the registry one, was actually dispatched');
}

// ── 6. Full real acceptance run: Wave 0 -> Wave 1 -> Wave 2 -> Wave 3 (each auto-proposed from the registry, no operator task) -> completed_waves == [0,1,2,3], verified_progress_percent == 35 exactly ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/jarvis-masterarchitecture-v2-wave1-acceptance';
  const store = createMemoryJarvisStoreV1();
  const wave0Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 0);
  const wave1Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 1);
  const wave2Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 2);
  const wave3Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 3);
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    [wave0Entry.title]: {
      exit_code: 0,
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch, branch_drift: false,
        files_changed: ['docs/jarvis/v2/JARVIS_MASTERARCHITECTURE_V2_CONTRACT.md'],
        pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 0, results: [] }, at: new Date().toISOString()
      }
    },
    [wave1Entry.title]: {
      exit_code: 0,
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch, branch_drift: false,
        files_changed: ['src/jarvis/wave-registry-v1.js', 'src/jarvis/wave-task-planner-v1.js', 'src/jarvis/program-controller-v1.js'],
        pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 3, results: [] }, at: new Date().toISOString()
      }
    },
    [wave2Entry.title]: {
      exit_code: 0,
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch, branch_drift: false,
        files_changed: ['src/jarvis/command-center-v1.js', 'src/jarvis/http-v1.js'],
        pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 2, results: [] }, at: new Date().toISOString()
      }
    },
    [wave3Entry.title]: {
      exit_code: 0,
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch, branch_drift: false,
        files_changed: ['src/jarvis/program-approval-v1.js', 'src/jarvis/http-v1.js'],
        pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 2, results: [] }, at: new Date().toISOString()
      }
    }
  }) });

  const grant = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION', 'ACCEPTANCE', 'LOCAL_FEATURE_BRANCH_MANAGEMENT', 'PROGRESS_ADVANCEMENT', 'NEXT_WAVE_CONTINUATION'],
    confirm_scope: true
  }, { memory_store: store });
  assert.equal(grant.ok, true);

  const tickReq = { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch };
  const deps = { memory_store: store, claude_bridge: bridge };

  // Wave 0: no operator task supplied anywhere in this run — every proposal
  // below must come from the registry.
  const w0Prepare = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w0Prepare.performed.action, 'PREPARE_BRANCH');

  const w0Propose = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w0Propose.performed.action, 'PROPOSE_WAVE_TASK');
  assert.equal(w0Propose.performed.detail.task_source, 'REGISTRY_PROPOSAL');
  assert.equal(w0Propose.performed.detail.mission.intent.title, wave0Entry.title);

  const w0Resume = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w0Resume.performed.action, 'AUTHORIZE_AND_RESUME');
  assert.equal(w0Resume.performed.detail.claude_execution.state, 'COMPLETE');

  const w0Accept = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w0Accept.performed.action, 'VERIFY_AND_ACCEPT');
  assert.equal(w0Accept.performed.detail.accepted, true);
  assert.equal(w0Accept.verified_progress_percent, 5, 'Wave 0 weight (5%) now genuinely counted');
  assert.equal(w0Accept.current_wave, 1, 'advanced to Wave 1 within the same tick, no separate advance tick needed');

  // Wave 1: still no operator task — this is the exact gap wave-task-planner-v1.js
  // closes; before it existed this tick returned NONE (see the updated
  // program-controller smoke test).
  const w1Propose = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w1Propose.performed.action, 'PROPOSE_WAVE_TASK', 'Wave 1 auto-proposed from the registry — no operator click needed');
  assert.equal(w1Propose.performed.detail.task_source, 'REGISTRY_PROPOSAL');
  assert.equal(w1Propose.performed.detail.mission.intent.title, wave1Entry.title);

  const w1Resume = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w1Resume.performed.action, 'AUTHORIZE_AND_RESUME');
  assert.equal(w1Resume.performed.detail.claude_execution.state, 'COMPLETE');

  const w1Accept = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w1Accept.performed.action, 'VERIFY_AND_ACCEPT');
  assert.equal(w1Accept.performed.detail.accepted, true, 'Wave 1 independently accepted from real bridge-computed verification evidence, never a worker self-report');
  assert.equal(w1Accept.verified_progress_percent, 15, 'Wave 0 (5%) + Wave 1 (10%) == 15% exactly');
  assert.equal(w1Accept.current_wave, 2, 'advanced to Wave 2');
  assert.equal(w1Accept.wave_state, 'PENDING');

  // Wave 2: still no operator task — auto-proposed from the registry exactly
  // like Wave 1 was, now that Wave 1 (its dependency) is accepted.
  const w2Propose = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w2Propose.performed.action, 'PROPOSE_WAVE_TASK', 'Wave 2 auto-proposed from the registry — no operator click needed');
  assert.equal(w2Propose.performed.detail.task_source, 'REGISTRY_PROPOSAL');
  assert.equal(w2Propose.performed.detail.mission.intent.title, wave2Entry.title);

  const w2Resume = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w2Resume.performed.action, 'AUTHORIZE_AND_RESUME');
  assert.equal(w2Resume.performed.detail.claude_execution.state, 'COMPLETE');

  const w2Accept = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w2Accept.performed.action, 'VERIFY_AND_ACCEPT');
  assert.equal(w2Accept.performed.detail.accepted, true, 'Wave 2 independently accepted from real bridge-computed verification evidence, never a worker self-report');
  assert.equal(w2Accept.verified_progress_percent, 25, 'Wave 0 (5%) + Wave 1 (10%) + Wave 2 (10%) == 25% exactly');
  assert.equal(w2Accept.current_wave, 3, 'advanced to Wave 3');
  assert.equal(w2Accept.wave_state, 'PENDING');

  // Wave 3: still no operator task — auto-proposed from the registry exactly
  // like Wave 1/2 were, now that Wave 2 (its dependency) is accepted.
  const w3Propose = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w3Propose.performed.action, 'PROPOSE_WAVE_TASK', 'Wave 3 auto-proposed from the registry — no operator click needed');
  assert.equal(w3Propose.performed.detail.task_source, 'REGISTRY_PROPOSAL');
  assert.equal(w3Propose.performed.detail.mission.intent.title, wave3Entry.title);

  const w3Resume = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w3Resume.performed.action, 'AUTHORIZE_AND_RESUME');
  assert.equal(w3Resume.performed.detail.claude_execution.state, 'COMPLETE');

  const w3Accept = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w3Accept.performed.action, 'VERIFY_AND_ACCEPT');
  assert.equal(w3Accept.performed.detail.accepted, true, 'Wave 3 independently accepted from real bridge-computed verification evidence, never a worker self-report');
  assert.equal(w3Accept.verified_progress_percent, 35, 'Wave 0 (5%) + Wave 1 (10%) + Wave 2 (10%) + Wave 3 (10%) == 35% exactly');
  assert.equal(w3Accept.current_wave, 4, 'advanced to Wave 4');
  assert.equal(w3Accept.wave_state, 'PENDING');

  // Wave 4 is NOT in the registry — the planner must stay silent, never guess.
  const w4Tick = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w4Tick.performed.action, 'NONE', 'Wave 4 has no registry entry — no fabricated task, ever');
  assert.equal(w4Tick.wave_state, 'PENDING');
  assert.equal(w4Tick.verified_progress_percent, 35, 'unchanged — Wave 4 contributes nothing until it is real, reviewed, and accepted');

  // Independent, read-only confirmation via the state endpoint (not just the
  // tick responses above) — this is the acceptance tick the operator checks.
  const finalState = await handleJarvisProgramStateRuntimeV1(tickReq, { memory_store: store });
  assert.equal(finalState.ok, true);
  assert.deepEqual(finalState.completed_waves, [0, 1, 2, 3], 'completed_waves is exactly [0, 1, 2, 3]');
  assert.equal(finalState.verified_progress_percent, 35, 'verified_progress_percent is exactly 35');
  assert.equal(finalState.current_wave, 4);
  assert.equal(finalState.program_approval.granted, true);

  console.log(`WAVE 3 ACCEPTED — completed_waves=${JSON.stringify(finalState.completed_waves)} verified_progress_percent=${finalState.verified_progress_percent}`);
}


// V3.1 human-gate registry: W11 is evidence-registered but never auto-proposed.
{
  const v3w11 = getJarvisWaveRegistryEntryV1(JARVIS_V3_WAVE_REGISTRY_PROGRAM, 11);
  assert.ok(v3w11);
  assert.equal(v3w11.id, 'v3-wave-11-phase-b-authorization-v3-1');
  assert.deepEqual(v3w11.depends_on, [10]);
  assert.equal(v3w11.operator_task_required, true);
  assert.ok(v3w11.expected_files.includes('docs/jarvis/v3/JARVIS_CAPABILITY_EXPANSION_V3_CONTRACT.md'));
  assert.ok(v3w11.expected_files.includes('scripts/jarvis-v3-phase-b-gate-v1-smoke.mjs'));
  assert.equal(v3w11.required_checks.length, 5);
  assert.equal(proposeJarvisWaveTaskV1({
    program: JARVIS_V3_WAVE_REGISTRY_PROGRAM,
    waveIndex: 11,
    completedWaves: [0,1,2,3,4,5,6,7,8,9,10]
  }), null, 'W11 is a real registry surface but must never be auto-proposed');
  for (let i=12;i<=25;i++) {
    assert.equal(getJarvisWaveRegistryEntryV1(JARVIS_V3_WAVE_REGISTRY_PROGRAM, i), null, `V3 post-gate wave ${i} stays unregistered until W11 acceptance`);
  }
  const manifest = jarvisWaveRegistryManifestV1();
  const v3 = manifest.programs[JARVIS_V3_WAVE_REGISTRY_PROGRAM];
  assert.equal(v3.human_gate_wave, 11);
  assert.equal(v3.human_gate_operator_task_required, true);
  assert.equal(v3.first_unregistered_post_gate_wave, 12);
  assert.ok(v3.registered_waves.includes(11));
  assert.ok(!v3.registered_waves.includes(12));
  const planner = jarvisWaveTaskPlannerManifestV1();
  assert.equal(planner.operator_required_registry_entries_auto_proposed, false);
}

console.log('JARVIS Wave Registry V1 smoke: PASS');
