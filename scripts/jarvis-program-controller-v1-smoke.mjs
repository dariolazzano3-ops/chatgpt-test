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
  JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS
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

  const t5 = await handleJarvisProgramTickRuntimeV1(tickReq, deps);
  assert.equal(t5.current_wave, 1);
  assert.equal(t5.performed.action, 'NONE', 'no fabricated Wave 1 task — it stays PENDING, awaiting a real one');
  assert.equal(t5.wave_state, 'PENDING');

  const state = await handleJarvisProgramStateRuntimeV1(tickReq, { memory_store: store });
  assert.equal(state.verified_progress_percent, 5);
  assert.equal(state.current_wave, 1);
  assert.equal(state.program_approval.granted, true);
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
}

console.log('JARVIS Program Controller V1 smoke: PASS');
