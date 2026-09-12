/* JARVIS — Program Controller V1.

   Closes "operator is still acting as the glue between steps". Drives
   PLAN -> PREPARE -> EXECUTE -> VERIFY -> REPAIR -> REVERIFY -> ACCEPT ->
   UPDATE PROGRESS -> START NEXT WAVE for one program (JARVIS_MASTERARCHITECTURE_V2)
   by re-using every existing, already-audited primitive — branch-manager-v1.js,
   engineering-mission-v1.js, engineering-mission-resume-v1.js,
   engineering-mission-acceptance-v1.js, program-approval-v1.js,
   v2-progress-v1.js — instead of inventing a new, separately-persisted state
   machine. Program/wave state is DERIVED from the same durable audit trail
   as everything else in this codebase (same pattern as v2-progress-v1.js),
   never a new mutable table of its own.

   Hard bounds:
     - a mission is only ever dispatched without a fresh per-request operator
       click when a real, persisted Program Approval already covers this
       exact program + repo_dir + target_branch + capability
       (program-approval-v1.js evaluateJarvisProgramApprovalActionV1) — this
       module never grants that approval itself, and never treats "the
       controller decided to" as authorization on its own;
     - Independent Acceptance is still never a worker self-report: ticking
       calls the SAME acceptance handler (engineering-mission-acceptance-v1.js)
       that requires real, bridge-computed verification evidence;
     - repair is bounded (JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS) and, when
       auto-generated, its task text is mechanically derived from real
       syntax-check error output already persisted for the failed attempt —
       never invented content describing what a wave should contain. A wave
       whose task has never been supplied stays PENDING, awaiting an
       operator-supplied task, rather than fabricating one;
     - one tick == at most one mutating action. Nothing loops internally;
       autonomy comes from calling tick repeatedly (a timer, a script, or an
       operator), so each step stays independently observable and auditable. */

import { createJarvisCommandCenterReadBindingsV1 } from './command-center-read-bindings-v1.js';
import { evaluateJarvisProgramApprovalStateV1, evaluateJarvisProgramApprovalActionV1 } from './program-approval-v1.js';
import { evaluateJarvisBranchTruthV1, prepareJarvisTargetBranchV1 } from './branch-manager-v1.js';
import { handleJarvisEngineeringMissionRuntimeV1 } from './engineering-mission-v1.js';
import { handleJarvisEngineeringMissionResumeRuntimeV1 } from './engineering-mission-resume-v1.js';
import { handleJarvisEngineeringMissionAcceptanceRuntimeV1, evaluateJarvisEngineeringMissionAcceptanceStateV1 } from './engineering-mission-acceptance-v1.js';
import { proposeJarvisWaveTaskV1 } from './wave-task-planner-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_PROGRAM_WAVE_STATES = Object.freeze([
  'PENDING', 'PREPARING', 'EXECUTING', 'VERIFYING', 'REPAIRING', 'ACCEPTING', 'ACCEPTED', 'BLOCKED_OPERATOR', 'FAILED'
]);
export const JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS = 3;

function newRequestId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Pure. Decide ONE wave's canonical state + next action from already-
 *  computed inputs — no I/O here. `waveRuns` are the runs() projection items
 *  (already carrying status/approval_state/acceptance_state/resumable) for
 *  this exact program+wave_index, oldest first. */
export function deriveJarvisProgramWaveStateV1({ waveRuns = [], branchTruth = null, dispatchCovered = false, acceptCovered = false } = {}) {
  // "Prepared" means genuinely checked out on the target branch — safe_to_prepare
  // alone only says preparation COULD be attempted safely, not that it happened.
  const onTargetBranch = Boolean(branchTruth) && branchTruth.current_branch === branchTruth.target_branch;
  if (!onTargetBranch) {
    if (branchTruth?.target_branch_protected) return { state: 'BLOCKED_OPERATOR', reason: 'TARGET_BRANCH_PROTECTED', next_action: null };
    if (branchTruth?.working_tree_clean === false) return { state: 'BLOCKED_OPERATOR', reason: 'WORKING_TREE_DIRTY', next_action: null };
    if (!branchTruth || branchTruth.safe_to_prepare !== true) return { state: 'BLOCKED_OPERATOR', reason: 'BRANCH_TRUTH_UNSAFE', next_action: null };
    return { state: 'PREPARING', reason: 'BRANCH_NOT_YET_PREPARED', next_action: { action: 'PREPARE_BRANCH' } };
  }

  const latest = waveRuns[waveRuns.length - 1] || null;
  if (!latest) {
    return { state: 'PENDING', reason: 'NO_MISSION_DISPATCHED_YET', next_action: { action: 'PROPOSE_WAVE_TASK' } };
  }

  if (latest.acceptance_state === 'INDEPENDENTLY_ACCEPTED') {
    return { state: 'ACCEPTED', reason: null, next_action: { action: 'ADVANCE_TO_NEXT_WAVE' } };
  }

  if (latest.approval_state !== 'GRANTED') {
    if (!dispatchCovered) return { state: 'BLOCKED_OPERATOR', reason: 'DISPATCH_NOT_COVERED_BY_PROGRAM_APPROVAL', next_action: null };
    return { state: 'EXECUTING', reason: 'AUTHORIZING_VIA_PROGRAM_APPROVAL', next_action: { action: 'AUTHORIZE_AND_RESUME', request_id: latest.id } };
  }

  if (latest.status === 'WAITING_APPROVAL' || latest.status === 'QUEUED') {
    return { state: 'EXECUTING', reason: 'APPROVED_NOT_YET_DISPATCHED', next_action: { action: 'RESUME', request_id: latest.id } };
  }
  if (latest.status === 'RUNNING') {
    return { state: 'EXECUTING', reason: 'DISPATCH_IN_FLIGHT', next_action: { action: 'WAIT' } };
  }
  if (latest.status === 'COMPLETE') {
    if (!acceptCovered) return { state: 'VERIFYING', reason: 'ACCEPTANCE_NOT_COVERED_BY_PROGRAM_APPROVAL', next_action: null };
    return { state: 'VERIFYING', reason: 'READY_FOR_ACCEPTANCE_EVALUATION', next_action: { action: 'VERIFY_AND_ACCEPT', request_id: latest.id } };
  }
  if (latest.status === 'FAILED' || latest.status === 'BLOCKED' || latest.status === 'INTERRUPTED') {
    const attempts = waveRuns.length;
    if (attempts >= JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS) {
      return { state: 'BLOCKED_OPERATOR', reason: 'MAX_REPAIR_ATTEMPTS_EXCEEDED', next_action: null };
    }
    return { state: 'REPAIRING', reason: `LAST_ATTEMPT_${latest.status}`, next_action: { action: 'ANALYZE_FOR_REPAIR', request_id: latest.id, attempts_used: attempts } };
  }
  return { state: 'BLOCKED_OPERATOR', reason: `UNRECOGNIZED_RUN_STATUS:${latest.status}`, next_action: null };
}

/** Mechanical only: derives a bounded repair task from REAL, already-
 *  persisted syntax-check failures for `verification`. Returns null (never a
 *  guess) if nothing mechanically actionable is present. */
export function deriveJarvisMechanicalRepairTaskV1(verification, title, program, waveIndex) {
  const failing = (verification?.syntax_check?.results || []).filter((r) => r.passed === false);
  if (!failing.length) return null;
  const detail = failing.map((f) => `${f.file}: ${clean(f.error, 300)}`).join(' | ');
  return {
    title: `${title} (repair attempt)`,
    goal: `The previous attempt left syntax errors. Fix ONLY these files so \`node --check\` passes; make no other changes: ${detail}`,
    program,
    wave_index: waveIndex
  };
}

async function computeProgramContextV1({ ownerId, ownerRef, program, repoDir, targetBranch, memoryStore, now }) {
  const bindings = createJarvisCommandCenterReadBindingsV1({ store: memoryStore, owner_id: ownerId, owner_ref: ownerRef, now });
  const [runsEnv, v2Env] = await Promise.all([bindings.runs(), bindings.v2_progress()]);
  const audit = await memoryStore.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 });
  const approvalState = evaluateJarvisProgramApprovalStateV1(audit, program);
  const branchTruth = evaluateJarvisBranchTruthV1({ repo_dir: repoDir, target_branch: targetBranch, base_ref: 'HEAD' });
  const currentWave = v2Env.data.program ? v2Env.data.current_wave : 0;
  const waveRuns = runsEnv.data
    .filter((r) => r.program === program && r.wave_index === currentWave)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));

  const dispatchCheck = evaluateJarvisProgramApprovalActionV1(approvalState, {
    capability: 'CLAUDE_REPO_BOUND_EXECUTION', program, repo_dir: repoDir, target_branch: targetBranch
  });
  const acceptCheck = evaluateJarvisProgramApprovalActionV1(approvalState, {
    capability: 'ACCEPTANCE', program, repo_dir: repoDir, target_branch: targetBranch
  });

  const waveState = deriveJarvisProgramWaveStateV1({
    waveRuns, branchTruth, dispatchCovered: dispatchCheck.covered, acceptCovered: acceptCheck.covered
  });

  return {
    audit, approvalState, branchTruth, currentWave, waveRuns, waveState,
    v2Progress: v2Env.data,
    dispatchCovered: dispatchCheck.covered, dispatchCoverReason: dispatchCheck.reason,
    acceptCovered: acceptCheck.covered, acceptCoverReason: acceptCheck.reason
  };
}

/** Read-only: report state without doing anything. */
export async function handleJarvisProgramStateRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const program = clean(request.program, 80).toUpperCase();
  const repoDir = clean(request.repo_dir, 400);
  const targetBranch = clean(request.target_branch, 200);
  if (!UUID_RE.test(ownerId) || !ownerRef || !program || !repoDir || !targetBranch) {
    return { ok: false, status: 400, error: 'JARVIS_PROGRAM_STATE_REQUEST_INVALID' };
  }
  if (!deps.memory_store) return { ok: false, status: 503, error: 'JARVIS_PROGRAM_STATE_MEMORY_STORE_REQUIRED' };

  const ctx = await computeProgramContextV1({ ownerId, ownerRef, program, repoDir, targetBranch, memoryStore: deps.memory_store, now: request.now });
  return {
    ok: true, status: 200,
    schema: 'aurentara.jarvis.program-state.v1',
    program, repo_dir: repoDir, target_branch: targetBranch,
    current_wave: ctx.currentWave,
    completed_waves: ctx.v2Progress.completed_waves,
    verified_progress_percent: ctx.v2Progress.verified_progress_percent,
    program_approval: { granted: ctx.approvalState.granted, scope: ctx.approvalState.scope },
    dispatch_covered: ctx.dispatchCovered,
    accept_covered: ctx.acceptCovered,
    branch_truth: ctx.branchTruth,
    wave_state: ctx.waveState.state,
    wave_reason: ctx.waveState.reason,
    next_action: ctx.waveState.next_action,
    attempts_used: ctx.waveRuns.length
  };
}

/** The one mutating entry point. Performs AT MOST ONE action per call. */
export async function handleJarvisProgramTickRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const program = clean(request.program, 80).toUpperCase();
  const repoDir = clean(request.repo_dir, 400);
  const targetBranch = clean(request.target_branch, 200);
  const now = clean(request.now, 80) || new Date().toISOString();
  if (!UUID_RE.test(ownerId) || !ownerRef || !program || !repoDir || !targetBranch) {
    return { ok: false, status: 400, error: 'JARVIS_PROGRAM_TICK_REQUEST_INVALID' };
  }
  if (!deps.memory_store) return { ok: false, status: 503, error: 'JARVIS_PROGRAM_TICK_MEMORY_STORE_REQUIRED' };

  const ctx = await computeProgramContextV1({ ownerId, ownerRef, program, repoDir, targetBranch, memoryStore: deps.memory_store, now });
  const action = ctx.waveState.next_action;
  let performed = { action: null, detail: null };

  if (!action) {
    // BLOCKED_OPERATOR / VERIFYING-but-not-covered / nothing to do this tick.
    performed = { action: 'NONE', detail: ctx.waveState.reason };
  } else if (action.action === 'PREPARE_BRANCH') {
    const prep = prepareJarvisTargetBranchV1({ repo_dir: repoDir, target_branch: targetBranch, base_ref: 'HEAD' });
    performed = { action: 'PREPARE_BRANCH', detail: prep };
  } else if (action.action === 'PROPOSE_WAVE_TASK') {
    // Operator-supplied task ALWAYS takes precedence, unchanged. The
    // deterministic Wave Registry proposal (wave-task-planner-v1.js) is
    // consulted ONLY as a fallback when no task was supplied — it never
    // overrides an operator task, and it never fabricates one for a wave
    // the registry does not define (see wave-registry-v1.js).
    const operatorTask = (request.task && clean(request.task.title, 1) && clean(request.task.goal, 1)) ? request.task : null;
    const registryTask = operatorTask ? null : proposeJarvisWaveTaskV1({
      program, waveIndex: ctx.currentWave, completedWaves: ctx.v2Progress.completed_waves
    });
    const task = operatorTask || registryTask;
    if (!task) {
      // No fabricated task. Report PENDING and wait for a real one.
      performed = { action: 'NONE', detail: 'AWAITING_OPERATOR_SUPPLIED_WAVE_TASK' };
    } else {
      const correlationId = newRequestId();
      const mission = await handleJarvisEngineeringMissionRuntimeV1({
        owner_id: ownerId, owner_ref: ownerRef, now,
        title: task.title, goal: task.goal, program, correlation_id: correlationId, wave_index: ctx.currentWave
      }, { memory_store: deps.memory_store });
      performed = {
        action: 'PROPOSE_WAVE_TASK',
        detail: { request_id: correlationId, mission, task_source: operatorTask ? 'OPERATOR_SUPPLIED' : 'REGISTRY_PROPOSAL' }
      };
    }
  } else if (action.action === 'AUTHORIZE_AND_RESUME') {
    if (!ctx.dispatchCovered) {
      performed = { action: 'NONE', detail: 'DISPATCH_NOT_COVERED' };
    } else {
      const resume = await handleJarvisEngineeringMissionResumeRuntimeV1({
        owner_id: ownerId, owner_ref: ownerRef, request_id: action.request_id, now
      }, { memory_store: deps.memory_store, claude_bridge: deps.claude_bridge, claude_timeout_ms: deps.claude_timeout_ms, program_approval_covers_dispatch: true });
      performed = { action: 'AUTHORIZE_AND_RESUME', detail: resume };
    }
  } else if (action.action === 'RESUME') {
    const resume = await handleJarvisEngineeringMissionResumeRuntimeV1({
      owner_id: ownerId, owner_ref: ownerRef, request_id: action.request_id, now
    }, { memory_store: deps.memory_store, claude_bridge: deps.claude_bridge, claude_timeout_ms: deps.claude_timeout_ms });
    performed = { action: 'RESUME', detail: resume };
  } else if (action.action === 'VERIFY_AND_ACCEPT') {
    const accept = await handleJarvisEngineeringMissionAcceptanceRuntimeV1({
      owner_id: ownerId, owner_ref: ownerRef, request_id: action.request_id, now
    }, { memory_store: deps.memory_store });
    performed = { action: 'VERIFY_AND_ACCEPT', detail: accept };
  } else if (action.action === 'ANALYZE_FOR_REPAIR') {
    const acceptState = evaluateJarvisEngineeringMissionAcceptanceStateV1(ctx.audit, action.request_id);
    const lastRun = ctx.waveRuns[ctx.waveRuns.length - 1];
    const mechanical = deriveJarvisMechanicalRepairTaskV1(acceptState.verification, lastRun?.title || 'Wave repair', program, ctx.currentWave);
    const task = mechanical || (request.task && clean(request.task.title, 1) && clean(request.task.goal, 1) ? request.task : null);
    if (!task) {
      performed = { action: 'NONE', detail: 'NO_MECHANICAL_REPAIR_AND_NO_OPERATOR_TASK_SUPPLIED' };
    } else if (!ctx.dispatchCovered) {
      performed = { action: 'NONE', detail: 'REPAIR_DISPATCH_NOT_COVERED' };
    } else {
      const correlationId = newRequestId();
      const mission = await handleJarvisEngineeringMissionRuntimeV1({
        owner_id: ownerId, owner_ref: ownerRef, now,
        title: task.title, goal: task.goal, program, correlation_id: correlationId, wave_index: ctx.currentWave
      }, { memory_store: deps.memory_store });
      performed = { action: 'ANALYZE_FOR_REPAIR', detail: { request_id: correlationId, mechanical: Boolean(mechanical), mission } };
    }
  } else if (action.action === 'ADVANCE_TO_NEXT_WAVE' || action.action === 'WAIT') {
    performed = { action: action.action, detail: null };
  }

  const after = await computeProgramContextV1({ ownerId, ownerRef, program, repoDir, targetBranch, memoryStore: deps.memory_store, now });
  return {
    ok: true, status: 200,
    schema: 'aurentara.jarvis.program-tick-response.v1',
    program, repo_dir: repoDir, target_branch: targetBranch,
    performed,
    current_wave: after.currentWave,
    verified_progress_percent: after.v2Progress.verified_progress_percent,
    wave_state: after.waveState.state,
    wave_reason: after.waveState.reason,
    next_action: after.waveState.next_action
  };
}

export function jarvisProgramControllerManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-controller.v1',
    states: [...JARVIS_PROGRAM_WAVE_STATES],
    max_repair_attempts: JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS,
    state_is_audit_derived: true,
    state_has_its_own_mutable_table: false,
    dispatch_without_program_approval_ever: false,
    acceptance_without_program_approval_ever: false,
    acceptance_is_worker_self_report: false,
    repair_task_fabricated: false,
    wave_task_source_precedence: 'OPERATOR_SUPPLIED_THEN_REGISTRY_PROPOSAL',
    wave_task_fabricated_for_unregistered_wave: false,
    one_mutating_action_per_tick: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
