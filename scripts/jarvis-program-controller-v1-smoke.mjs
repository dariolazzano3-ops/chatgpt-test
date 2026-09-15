import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { handleJarvisProgramApprovalGrantRuntimeV1 } from '../src/jarvis/program-approval-v1.js';
import {
  deriveJarvisProgramWaveStateV1,
  deriveJarvisMechanicalRepairTaskV1,
  handleJarvisProgramTickRuntimeV1,
  handleJarvisProgramStateRuntimeV1,
  jarvisProgramControllerManifestV1,
  JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS,
  JARVIS_AUTONOMY_PAUSED_ENV_VAR
} from '../src/jarvis/program-controller-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:op@example.invalid';
const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-program-controller-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', 'main']);
  return dir;
}

// "Prepared" means genuinely checked out on the target branch, not merely
// "safe to check out" — these two fixtures mirror that distinction exactly
// as evaluateJarvisBranchTruthV1 would report it.
const ON_TARGET = { current_branch: 'feature/x', target_branch: 'feature/x', safe_to_prepare: true, working_tree_clean: true, target_branch_protected: false };
const ON_TARGET_DIRTY = { current_branch: 'feature/x', target_branch: 'feature/x', safe_to_prepare: false, working_tree_clean: false, target_branch_protected: false };
const OFF_TARGET_CLEAN = { current_branch: 'main', target_branch: 'feature/x', safe_to_prepare: true, working_tree_clean: true, target_branch_protected: false };
const OFF_TARGET_DIRTY = { current_branch: 'main', target_branch: 'feature/x', safe_to_prepare: false, working_tree_clean: false, target_branch_protected: false };

// ── 1. Pure state derivation: branch not prepared yet ──
{
  const r = deriveJarvisProgramWaveStateV1({ waveRuns: [], branchTruth: OFF_TARGET_CLEAN, dispatchCovered: true, acceptCovered: true });
  assert.equal(r.state, 'PREPARING');
  assert.equal(r.next_action.action, 'PREPARE_BRANCH');
}
// ── 2. Pure state derivation: dirty tree -> BLOCKED_OPERATOR ──
{
  const r = deriveJarvisProgramWaveStateV1({ waveRuns: [], branchTruth: OFF_TARGET_DIRTY, dispatchCovered: true, acceptCovered: true });
  assert.equal(r.state, 'BLOCKED_OPERATOR');
  assert.equal(r.reason, 'WORKING_TREE_DIRTY');
}
// ── 2b. Already on target but dirty with no mission -> BLOCKED_OPERATOR ──
{
  const r = deriveJarvisProgramWaveStateV1({ waveRuns: [], branchTruth: ON_TARGET_DIRTY, dispatchCovered: true, acceptCovered: true });
  assert.equal(r.state, 'BLOCKED_OPERATOR');
  assert.equal(r.reason, 'WORKING_TREE_DIRTY');
  assert.equal(r.next_action, null);
}
// ── 3. Pure state derivation: no run yet -> PENDING, needs a task ──
{
  const r = deriveJarvisProgramWaveStateV1({ waveRuns: [], branchTruth: ON_TARGET, dispatchCovered: true, acceptCovered: true });
  assert.equal(r.state, 'PENDING');
  assert.equal(r.next_action.action, 'PROPOSE_WAVE_TASK');
}
// ── 4. Pure state derivation: approved+complete+covered -> VERIFY_AND_ACCEPT ──
{
  const r = deriveJarvisProgramWaveStateV1({
    waveRuns: [{ id: 'r1', approval_state: 'GRANTED', status: 'COMPLETE', acceptance_state: 'ACCEPTANCE_PENDING' }],
    branchTruth: ON_TARGET, dispatchCovered: true, acceptCovered: true
  });
  assert.equal(r.state, 'VERIFYING');
  assert.deepEqual(r.next_action, { action: 'VERIFY_AND_ACCEPT', request_id: 'r1' });
}
// ── 4b. COMPLETE with insufficient repo evidence -> bounded repair, never an impossible acceptance loop ──
{
  const r = deriveJarvisProgramWaveStateV1({
    waveRuns: [{
      id: 'r-noop', approval_state: 'GRANTED', status: 'COMPLETE', acceptance_state: 'ACCEPTANCE_PENDING',
      verification_sufficient: false, verification_insufficient_reason: 'NO_REAL_FILES_CHANGED'
    }],
    branchTruth: ON_TARGET, dispatchCovered: true, acceptCovered: true
  });
  assert.equal(r.state, 'REPAIRING');
  assert.equal(r.reason, 'VERIFICATION_INSUFFICIENT:NO_REAL_FILES_CHANGED');
  assert.deepEqual(r.next_action, { action: 'ANALYZE_FOR_REPAIR', request_id: 'r-noop', attempts_used: 1 });
}

// ── 5. Pure state derivation: complete but acceptance NOT covered -> stalls without an action (never silently self-authorizes) ──
{
  const r = deriveJarvisProgramWaveStateV1({
    waveRuns: [{ id: 'r1', approval_state: 'GRANTED', status: 'COMPLETE', acceptance_state: 'ACCEPTANCE_PENDING' }],
    branchTruth: ON_TARGET, dispatchCovered: true, acceptCovered: false
  });
  assert.equal(r.next_action, null);
}
// ── 6. Pure state derivation: max repair attempts exceeded -> BLOCKED_OPERATOR ──
{
  const waveRuns = Array.from({ length: JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS }, (_, i) => ({ id: `r${i}`, approval_state: 'GRANTED', status: 'FAILED', acceptance_state: 'NOT_APPLICABLE' }));
  const r = deriveJarvisProgramWaveStateV1({ waveRuns, branchTruth: ON_TARGET, dispatchCovered: true, acceptCovered: true });
  assert.equal(r.state, 'BLOCKED_OPERATOR');
  assert.equal(r.reason, 'MAX_REPAIR_ATTEMPTS_EXCEEDED');
}
// ── 7. Mechanical repair task is derived only from real syntax-check failures, never fabricated content ──
{
  const none = deriveJarvisMechanicalRepairTaskV1(null, 'Wave 0', PROGRAM, 0);
  assert.equal(none, null);
  const task = deriveJarvisMechanicalRepairTaskV1({ syntax_check: { results: [{ file: 'a.js', passed: false, error: 'Unexpected token' }] } }, 'Wave 0', PROGRAM, 0);
  assert.match(task.goal, /a\.js: Unexpected token/);
  assert.equal(task.wave_index, 0);
}

// ── 8. End-to-end tick sequence on a real fixture repo: PREPARE_BRANCH -> PROPOSE_WAVE_TASK -> AUTHORIZE_AND_RESUME (via Program Approval, no per-mission click) -> VERIFY_AND_ACCEPT -> progress becomes 5% -> ADVANCE_TO_NEXT_WAVE ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/jarvis-masterarchitecture-v2';
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': {
      exit_code: 0,
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch, branch_drift: false,
        files_changed: ['docs/jarvis/v2/JARVIS_MASTERARCHITECTURE_V2_CONTRACT.md'],
        pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 0, results: [] }, at: new Date().toISOString()
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

  const t1 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(t1.performed.action, 'PREPARE_BRANCH');
  assert.equal(t1.wave_state, 'PENDING');
  assert.equal(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']), branch, 'the fixture repo is genuinely on the target branch now');

  const t2 = await handleJarvisProgramTickRuntimeV1({ ...tickReq, task: { title: 'Wave 0', goal: 'Wave 0 goal text' } }, deps);
  assert.equal(t2.performed.action, 'PROPOSE_WAVE_TASK');
  const requestId = t2.performed.detail.request_id;
  assert.ok(requestId);
  assert.equal(t2.wave_state, 'EXECUTING');

  const t3 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(t3.performed.action, 'AUTHORIZE_AND_RESUME');
  assert.equal(t3.performed.detail.resumed, true);
  assert.equal(t3.performed.detail.claude_execution.state, 'COMPLETE');
  // Provenance check: this dispatch must be attributed to the Program
  // Controller, never mislabeled as a fresh individual OPERATOR click.
  const auditAfterAuth = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 200 });
  const authRow = auditAfterAuth.find((r) => r.request_id === requestId && r.approval?.program_approval_authorized === true);
  assert.ok(authRow, 'the dispatch audit row records it was authorized via Program Approval');
  assert.equal(authRow.approval.actor_type, 'PROGRAM_CONTROLLER');

  const t4 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(t4.performed.action, 'VERIFY_AND_ACCEPT');
  assert.equal(t4.performed.detail.accepted, true);
  assert.equal(t4.verified_progress_percent, 5, 'Wave 0 weight now genuinely counted');
  // The "after" snapshot already reflects Wave 0 ACCEPTED -> current_wave
  // advancing to Wave 1 within this same tick (v2Progress recomputed from
  // the freshly-persisted acceptance row) — genuinely automatic, no
  // separate "advance" tick required, and no fabricated Wave 1 task either.
  assert.equal(t4.current_wave, 1, 'the program genuinely advanced to Wave 1 within the same tick that accepted Wave 0');
  assert.equal(t4.wave_state, 'PENDING');
  assert.deepEqual(t4.next_action, { action: 'PROPOSE_WAVE_TASK' });

  // Wave 1 IS registered (wave-registry-v1.js), and its one dependency
  // (Wave 0) is already independently accepted, so the Wave Task Planner
  // proposes it automatically — no operator click needed, and still not a
  // fabrication (see wave-registry-v1.js's header for why).
  const t5 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(t5.current_wave, 1);
  assert.equal(t5.performed.action, 'PROPOSE_WAVE_TASK', 'Wave 1 has a registry entry — the Wave Task Planner proposes it automatically');
  assert.equal(t5.performed.detail.task_source, 'REGISTRY_PROPOSAL');
  assert.equal(t5.wave_state, 'EXECUTING');

  const state = await handleJarvisProgramStateRuntimeV1(tickReq, { memory_store: store });
  assert.equal(state.verified_progress_percent, 5);
  assert.equal(state.current_wave, 1);
  assert.equal(state.program_approval.granted, true);
}

// ── 8b. End-to-end: a worker COMPLETE with zero changed files is projected as insufficient evidence and enters REPAIRING ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/complete-noop-repair';
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'No-op proof': {
      exit_code: 0,
      verification: {
        schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch, branch_drift: false,
        files_changed: [], pre_existing_dirty_files: [],
        syntax_check: { passed: true, checked: 0, results: [] }, at: new Date().toISOString()
      }
    }
  }) });
  await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch,
    scope: ['CLAUDE_REPO_BOUND_EXECUTION', 'ACCEPTANCE', 'LOCAL_FEATURE_BRANCH_MANAGEMENT'], confirm_scope: true
  }, { memory_store: store });
  const req = { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch };
  const deps = { memory_store: store, claude_bridge: bridge };
  await handleJarvisProgramTickRuntimeV1(req, deps); // PREPARE_BRANCH
  await handleJarvisProgramTickRuntimeV1({ ...req, task: { title: 'No-op proof', goal: 'Must change one file.' } }, deps);
  const executed = await handleJarvisProgramTickRuntimeV1(req, deps);
  assert.equal(executed.performed.action, 'AUTHORIZE_AND_RESUME');
  assert.equal(executed.performed.detail.claude_execution.state, 'COMPLETE');
  assert.equal(executed.wave_state, 'REPAIRING');
  assert.equal(executed.wave_reason, 'VERIFICATION_INSUFFICIENT:NO_REAL_FILES_CHANGED');
  assert.equal(executed.next_action.action, 'ANALYZE_FOR_REPAIR');
}

// ── 9. Without a Program Approval grant, dispatch is never auto-authorized — stays BLOCKED_OPERATOR ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/no-approval';
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0 } }) });
  const tickReq = { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch };
  await handleJarvisProgramTickRuntimeV1(tickReq, { memory_store: store, claude_bridge: bridge }); // PREPARE_BRANCH
  const proposed = await handleJarvisProgramTickRuntimeV1({ ...tickReq, task: { title: 'Wave 0', goal: 'Wave 0 goal text' } }, { memory_store: store, claude_bridge: bridge });
  assert.equal(proposed.performed.action, 'PROPOSE_WAVE_TASK', 'proposing a mission never itself requires Program Approval — only dispatching it does');
  const t3 = await handleJarvisProgramTickRuntimeV1(tickReq, { memory_store: store, claude_bridge: bridge });
  assert.equal(t3.wave_state, 'BLOCKED_OPERATOR');
  assert.equal(t3.wave_reason, 'DISPATCH_NOT_COVERED_BY_PROGRAM_APPROVAL');
}

// ── 10. Manifest / safety invariants ──
{
  const man = jarvisProgramControllerManifestV1();
  assert.equal(man.state_is_audit_derived, true);
  assert.equal(man.state_has_its_own_mutable_table, false);
  assert.equal(man.dispatch_without_program_approval_ever, false);
  assert.equal(man.acceptance_without_program_approval_ever, false);
  assert.equal(man.acceptance_is_worker_self_report, false);
  assert.equal(man.repair_task_fabricated, false);
  assert.equal(man.one_mutating_action_per_tick, true);
  assert.equal(man.max_repair_attempts, 3);
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
  assert.equal(man.autonomy_pause_env_var, JARVIS_AUTONOMY_PAUSED_ENV_VAR);
  assert.equal(man.autonomy_paused, false, 'not paused by default in this process');
  assert.equal(man.autonomy_pause_blocks_all_mutating_actions, true);
  assert.equal(man.autonomy_pause_blocks_program_state_reads, false);
  assert.equal(man.program_complete_is_terminal, true);
  assert.equal(man.program_complete_next_action, null);
}

// ── 11. JARVIS_AUTONOMY_PAUSED: global pause gate — Tick performs no
//        mutating action while paused and reports it explicitly; Program
//        State stays readable throughout; unset/disabled leaves the
//        pre-existing tick behavior unchanged ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/autonomy-pause';
  const store = createMemoryJarvisStoreV1();
  const tickReq = { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch };
  const deps = { memory_store: store };
  const previousEnv = process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR];

  try {
    process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = 'true';

    const auditBefore = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 500 });
    const paused1 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
    assert.equal(paused1.ok, true);
    assert.equal(paused1.paused, true);
    assert.equal(paused1.pause_reason, JARVIS_AUTONOMY_PAUSED_ENV_VAR);
    assert.deepEqual(paused1.performed, { action: 'NONE', detail: JARVIS_AUTONOMY_PAUSED_ENV_VAR });
    assert.equal(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']), 'main', 'paused: PREPARE_BRANCH was never actually performed');
    assert.equal(paused1.wave_state, 'PREPARING', 'state reporting keeps working while paused — it just is not acted on');
    const auditAfter1 = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 500 });
    assert.equal(auditAfter1.length, auditBefore.length, 'a paused tick writes no new audit rows');

    // Program State stays fully readable while paused.
    const state = await handleJarvisProgramStateRuntimeV1(tickReq, { memory_store: store });
    assert.equal(state.ok, true);
    assert.equal(state.wave_state, 'PREPARING');

    // A second paused tick is equally inert — pausing is not a one-shot.
    const paused2 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
    assert.equal(paused2.paused, true);
    assert.equal(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']), 'main');

    // An explicit falsy value ("false") counts as disabled, not paused.
    process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = 'false';
    const disabled = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
    assert.equal(disabled.paused, undefined);
    assert.equal(disabled.performed.action, 'PREPARE_BRANCH');
    assert.equal(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']), branch, 'disabled ("false"): tick actually prepared the branch, same as pre-existing behavior');
  } finally {
    if (previousEnv === undefined) delete process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR];
    else process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR] = previousEnv;
  }

  // Unset entirely: still identical to pre-existing (never-gated) behavior —
  // the next pending action (proposing Wave 0's task) actually happens.
  assert.equal(process.env[JARVIS_AUTONOMY_PAUSED_ENV_VAR], previousEnv);
  const resumed = await handleJarvisProgramTickRuntimeV1({ ...tickReq, task: { title: 'Wave 0', goal: 'Wave 0 goal text' } }, deps);
  assert.equal(resumed.paused, undefined);
  assert.equal(resumed.performed.action, 'PROPOSE_WAVE_TASK');
}

// ── 12. 100% is terminal: PROGRAM_COMPLETE, no next action, Tick is inert ──
{
  const repo = makeFixtureRepo();
  const branch = 'factory/program-complete';
  git(repo, ['checkout', '-q', '-b', branch]);
  const store = createMemoryJarvisStoreV1();
  for (let wave = 0; wave <= 12; wave += 1) {
    await store.appendAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, event: {
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, wave, 0)).toISOString(),
      action: 'IMPLEMENTATION_MISSION',
      result: { program: PROGRAM, wave_index: wave, wave_state: 'COMPLETE', independent_acceptance: true, acceptance_ref: `accept:${wave}` }
    }});
  }
  const req = { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: branch };
  const before = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 200 });
  const state = await handleJarvisProgramStateRuntimeV1(req, { memory_store: store });
  assert.equal(state.verified_progress_percent, 100);
  assert.equal(state.wave_state, 'PROGRAM_COMPLETE');
  assert.equal(state.wave_reason, 'PROGRAM_COMPLETE');
  assert.equal(state.next_action, null);
  const tick = await handleJarvisProgramTickRuntimeV1(req, { memory_store: store });
  assert.equal(tick.performed.action, 'NONE');
  assert.equal(tick.wave_state, 'PROGRAM_COMPLETE');
  assert.equal(tick.next_action, null);
  const after = await store.readAudit({ owner_id: OWNER_ID, owner_ref: OWNER_REF, limit: 200 });
  assert.equal(after.length, before.length, 'terminal tick writes no audit row');
}

console.log('JARVIS Program Controller V1 smoke: PASS');
