/* JARVIS — Program Runner Restart Recovery V1.

   Pure recovery projection for the private Program Runner. There is no new
   mutable program-state table: recovery is derived from the same owner-scoped
   durable audit trail plus a fresh Program Controller state read. An unfinished
   prior runner cycle is evidence that a process stopped mid-cycle, never an
   instruction to replay the old action. The next decision always comes from the
   freshly-derived controller state and its existing duplicate guards. */

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const RUNNER_ACTION = 'PROGRAM_RUNNER_CYCLE';

function eventTime(row = {}) {
  const value = clean(row.occurred_at || row.timestamp, 80);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateJarvisProgramRunnerRecoveryV1({
  audit = [], program, repo_dir, target_branch, controller_state
} = {}) {
  const programId = clean(program, 80).toUpperCase();
  const repoDir = clean(repo_dir, 400);
  const branch = clean(target_branch, 200);
  const scoped = (Array.isArray(audit) ? audit : [])
    .filter((row) => row?.action === RUNNER_ACTION)
    .filter((row) => clean(row?.result?.program, 80).toUpperCase() === programId)
    .filter((row) => clean(row?.result?.repo_dir, 400) === repoDir)
    .filter((row) => clean(row?.result?.target_branch, 200) === branch)
    .sort((a, b) => eventTime(a) - eventTime(b));

  const cycles = new Map();
  for (const row of scoped) {
    const cycleId = clean(row?.result?.cycle_id, 160);
    if (!cycleId) continue;
    const current = cycles.get(cycleId) || { cycle_id: cycleId, started: null, finished: null };
    const status = clean(row?.result?.status, 80).toUpperCase();
    if (status === 'STARTED') current.started = row;
    if (status === 'FINISHED') current.finished = row;
    cycles.set(cycleId, current);
  }

  const cycleList = [...cycles.values()];
  const unfinished = cycleList.filter((cycle) => cycle.started && !cycle.finished);
  const latest = cycleList[cycleList.length - 1] || null;
  const state = controller_state;

  if (!state || state.ok !== true) {
    return {
      ok: false, resume_allowed: false, status: 'BLOCKED', reason: 'CONTROLLER_STATE_UNAVAILABLE',
      interrupted_cycle: unfinished.at(-1)?.cycle_id || null, last_cycle_id: latest?.cycle_id || null
    };
  }
  if (state.program_approval?.granted !== true) {
    return {
      ok: true, resume_allowed: false, status: 'BLOCKED', reason: 'PROGRAM_APPROVAL_REQUIRED',
      interrupted_cycle: unfinished.at(-1)?.cycle_id || null, last_cycle_id: latest?.cycle_id || null
    };
  }
  if (Number(state.verified_progress_percent) >= 100) {
    return {
      ok: true, resume_allowed: false, status: 'COMPLETE', reason: 'PROGRAM_COMPLETE',
      interrupted_cycle: unfinished.at(-1)?.cycle_id || null, last_cycle_id: latest?.cycle_id || null
    };
  }
  if (state.wave_state === 'BLOCKED_OPERATOR') {
    return {
      ok: true, resume_allowed: false, status: 'BLOCKED', reason: 'BLOCKED_OPERATOR',
      interrupted_cycle: unfinished.at(-1)?.cycle_id || null, last_cycle_id: latest?.cycle_id || null
    };
  }
  if (!state.next_action?.action) {
    return {
      ok: true, resume_allowed: false, status: 'BLOCKED', reason: 'NO_NEXT_ACTION',
      interrupted_cycle: unfinished.at(-1)?.cycle_id || null, last_cycle_id: latest?.cycle_id || null
    };
  }
  if (state.branch_truth?.working_tree_clean === false
      && ['PROPOSE_WAVE_TASK', 'PREPARE_BRANCH'].includes(state.next_action.action)) {
    return {
      ok: true, resume_allowed: false, status: 'BLOCKED', reason: 'ACCEPTED_WORK_AWAITS_PUBLICATION',
      interrupted_cycle: unfinished.at(-1)?.cycle_id || null, last_cycle_id: latest?.cycle_id || null
    };
  }

  return {
    ok: true,
    resume_allowed: true,
    status: unfinished.length ? 'RECOVERABLE_INTERRUPTION' : 'READY',
    reason: unfinished.length ? 'INTERRUPTED_CYCLE_REDERIVED_FROM_CONTROLLER' : 'CONTROLLER_STATE_SAFE',
    interrupted_cycle: unfinished.at(-1)?.cycle_id || null,
    last_cycle_id: latest?.cycle_id || null,
    current_wave: state.current_wave ?? null,
    verified_progress_percent: state.verified_progress_percent ?? null,
    next_action: state.next_action.action
  };
}

export function jarvisProgramRunnerRecoveryManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-runner-recovery.manifest.v1',
    mutable_recovery_table: false,
    source_of_truth: 'OWNER_SCOPED_AUDIT_PLUS_FRESH_CONTROLLER_STATE',
    interrupted_cycle_replayed_blindly: false,
    controller_state_rederived_after_restart: true,
    duplicate_guard_delegated_to_existing_controller_paths: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
