import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  getJarvisWaveRegistryEntryV1,
  isJarvisWaveDependencySatisfiedV1,
  jarvisWaveRegistryManifestV1,
  JARVIS_WAVE_REGISTRY_PROGRAM
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

  // Unregistered wave (3, still undefined) -> null, never invented.
  assert.equal(getJarvisWaveRegistryEntryV1(PROGRAM, 3), null);
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

  const unregistered = proposeJarvisWaveTaskV1({ program: PROGRAM, waveIndex: 3, completedWaves: [0, 1, 2] });
  assert.equal(unregistered, null, 'Wave 3 has no registry entry — never guessed');
}

// ── 4. Manifests ──
{
  const regMan = jarvisWaveRegistryManifestV1();
  assert.equal(regMan.fabricates_undefined_waves, false);
  assert.ok(regMan.registered_waves.includes(0) && regMan.registered_waves.includes(1));

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

// ── 6. Full real acceptance run: Wave 0 -> Wave 1 -> Wave 2 (each auto-proposed from the registry, no operator task) -> completed_waves == [0,1,2], verified_progress_percent == 25 exactly ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/jarvis-masterarchitecture-v2-wave1-acceptance';
  const store = createMemoryJarvisStoreV1();
  const wave0Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 0);
  const wave1Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 1);
  const wave2Entry = getJarvisWaveRegistryEntryV1(PROGRAM, 2);
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

  // Wave 3 is NOT in the registry — the planner must stay silent, never guess.
  const w3Tick = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(w3Tick.performed.action, 'NONE', 'Wave 3 has no registry entry — no fabricated task, ever');
  assert.equal(w3Tick.wave_state, 'PENDING');
  assert.equal(w3Tick.verified_progress_percent, 25, 'unchanged — Wave 3 contributes nothing until it is real, reviewed, and accepted');

  // Independent, read-only confirmation via the state endpoint (not just the
  // tick responses above) — this is the acceptance tick the operator checks.
  const finalState = await handleJarvisProgramStateRuntimeV1(tickReq, { memory_store: store });
  assert.equal(finalState.ok, true);
  assert.deepEqual(finalState.completed_waves, [0, 1, 2], 'completed_waves is exactly [0, 1, 2]');
  assert.equal(finalState.verified_progress_percent, 25, 'verified_progress_percent is exactly 25');
  assert.equal(finalState.current_wave, 3);
  assert.equal(finalState.program_approval.granted, true);

  console.log(`WAVE 2 ACCEPTED — completed_waves=${JSON.stringify(finalState.completed_waves)} verified_progress_percent=${finalState.verified_progress_percent}`);
}

console.log('JARVIS Wave Registry V1 smoke: PASS');
