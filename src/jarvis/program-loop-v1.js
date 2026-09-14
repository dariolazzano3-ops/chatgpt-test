/* JARVIS — Bounded Autonomous Program Loop V1.

   Closes "the operator still has to click tick, tick, tick, tick...". This
   module is an EXTERNAL caller wrapped AROUND the already-accepted Program
   Controller (program-controller-v1.js) — it repeatedly calls
   controller.state(request) then, unless a stop condition already fires,
   controller.tick(requestWithOptionalTask). The Program Controller itself is
   completely unchanged by this file and keeps its own, independent
   guarantee: at most one mutating action per tick call. This loop adds
   nothing to that guarantee except a bound on HOW MANY tick calls happen
   before a human has to look again.

   Hard rules:
     - a hard ceiling of JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS (24) tick calls
       per invocation, no matter what the caller requests; the default when
       nothing is requested is JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS (12); any
       requested value is clamped into [1, 24] — never 0, never negative,
       never unbounded;
     - strictly sequential: one state() call, then at most one tick() call,
       then loop back — never two tick() calls in flight together, never a
       sleep, never a timer, never any I/O beyond calls on the injected
       `deps.controller`;
     - this loop NEVER grants Program Approval and NEVER invents task title/
       goal text. An optional `tasks_by_wave` map may supply an exact,
       already-authored {title, goal} for one specific wave index, and that
       pair is passed through to controller.tick(...) as `request.task`
       ONLY when the wave's current next_action is PROPOSE_WAVE_TASK or
       ANALYZE_FOR_REPAIR (the only two actions program-controller-v1.js
       ever reads request.task for) — never for any other action, and never
       synthesized when no entry exists for the current wave (the Program
       Controller / Wave Registry decide in that case, exactly as they do
       today; see wave-task-planner-v1.js);
     - fail-closed: a state() read that throws or returns ok !== true stops
       the loop immediately (STATE_READ_FAILED), as does a tick() call that
       throws or returns ok !== true (TICK_FAILED) — this loop never guesses
       what to do next from a read it could not trust;
     - stops BEFORE calling tick() when: the just-read state is
       BLOCKED_OPERATOR (BLOCKED_OPERATOR), the state has no next_action at
       all (NO_NEXT_ACTION), the next_action is WAIT (WAIT — nothing this
       loop can safely act on {i.e. a dispatch is already in flight}), or the
       working tree is dirty AND the next_action is PROPOSE_WAVE_TASK or
       PREPARE_BRANCH (ACCEPTED_WORK_AWAITS_PUBLICATION) — a wave that was
       just independently accepted but not yet published as a clean commit
       must never be silently carried into the next wave's dispatch;
     - stops AFTER a tick() call when: the controller reports paused === true
       (AUTONOMY_PAUSED — takes priority over the NONE check below, since a
       paused tick also reports performed.action === 'NONE'), the tick
       performed.action === 'NONE' (NONE — nothing happened, no point
       ticking again with identical inputs), or verified_progress_percent
       has reached 100 (PROGRAM_COMPLETE);
     - otherwise, once JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS ticks have been
       used without any of the above firing, the loop stops with
       MAX_TICKS_REACHED — never silently keeps going. */

export const JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS = 24;
export const JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS = 12;

const TASK_ELIGIBLE_ACTIONS = Object.freeze(['PROPOSE_WAVE_TASK', 'ANALYZE_FOR_REPAIR']);

/** Pure. Clamp a requested tick budget into [1, JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS].
 *  A missing / non-finite request falls back to the default (12), never to
 *  the hard max and never to 0. */
export function clampJarvisProgramLoopMaxTicksV1(requested) {
  if (requested === undefined || requested === null || (typeof requested === 'string' && requested.trim() === '')) {
    return JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS;
  }
  const n = Number(requested);
  if (!Number.isFinite(n)) return JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS;
  const truncated = Math.trunc(n);
  return Math.min(JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS, Math.max(1, truncated));
}

/** Pure. Extracts an exact, already-authored {title, goal} for `waveIndex`
 *  from `tasksByWave`, or null. Never fills in a missing title/goal, never
 *  reformats the text — an exact pass-through or nothing. */
function lookupJarvisLoopWaveTaskV1(tasksByWave, waveIndex) {
  if (!tasksByWave || typeof tasksByWave !== 'object') return null;
  const candidate = Object.prototype.hasOwnProperty.call(tasksByWave, waveIndex)
    ? tasksByWave[waveIndex]
    : tasksByWave[String(waveIndex)];
  if (!candidate || typeof candidate !== 'object') return null;
  const title = typeof candidate.title === 'string' ? candidate.title : '';
  const goal = typeof candidate.goal === 'string' ? candidate.goal : '';
  if (!title.trim() || !goal.trim()) return null;
  return { title, goal };
}

/** The one entry point. Never mutates anything itself — every mutation, if
 *  any, happens inside `deps.controller.tick`, unchanged from before this
 *  loop existed. */
export async function runJarvisBoundedProgramLoopV1(request = {}, deps = {}) {
  const controller = deps.controller;
  if (!controller || typeof controller.state !== 'function' || typeof controller.tick !== 'function') {
    return { ok: false, status: 503, error: 'JARVIS_PROGRAM_LOOP_CONTROLLER_REQUIRED' };
  }

  const maxTicks = clampJarvisProgramLoopMaxTicksV1(request.max_ticks);
  const tasksByWave = (request.tasks_by_wave && typeof request.tasks_by_wave === 'object') ? request.tasks_by_wave : {};

  // Forward everything else through to the controller unchanged, but strip
  // loop-only fields and any caller-supplied `task` — per-tick task
  // injection is this loop's own decision (see lookupJarvisLoopWaveTaskV1
  // and the TASK_ELIGIBLE_ACTIONS gate below), never a pass-through of
  // whatever the top-level request happened to contain.
  const { max_ticks: _maxTicks, tasks_by_wave: _tasksByWave, task: _ignoredTask, ...baseRequest } = request;

  const events = [];
  let ticksUsed = 0;
  let stopReason = null;
  let finalState = null;

  for (let i = 0; i < maxTicks; i += 1) {
    const tickNumber = i + 1;
    let state;
    try {
      state = await controller.state(baseRequest);
    } catch (err) {
      stopReason = 'STATE_READ_FAILED';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: 'STATE_CALL_THROWN' });
      break;
    }
    if (!state || state.ok !== true) {
      stopReason = 'STATE_READ_FAILED';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: 'STATE_READ_RETURNED_NOT_OK' });
      break;
    }
    finalState = state;

    if (typeof state.verified_progress_percent === 'number' && state.verified_progress_percent >= 100) {
      stopReason = 'PROGRAM_COMPLETE';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: null });
      break;
    }

    if (state.wave_state === 'BLOCKED_OPERATOR') {
      stopReason = 'BLOCKED_OPERATOR';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: state.wave_reason || null });
      break;
    }

    const nextAction = state.next_action;
    if (!nextAction || !nextAction.action) {
      stopReason = 'NO_NEXT_ACTION';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: state.wave_reason || null });
      break;
    }

    if (nextAction.action === 'WAIT') {
      stopReason = 'WAIT';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: null });
      break;
    }

    const workingTreeClean = state.branch_truth ? state.branch_truth.working_tree_clean : null;
    if (workingTreeClean === false && (nextAction.action === 'PROPOSE_WAVE_TASK' || nextAction.action === 'PREPARE_BRANCH')) {
      stopReason = 'ACCEPTED_WORK_AWAITS_PUBLICATION';
      events.push({ tick: tickNumber, phase: 'STATE', outcome: stopReason, detail: { blocked_action: nextAction.action } });
      break;
    }

    let taskInjected = null;
    let tickRequest = baseRequest;
    if (TASK_ELIGIBLE_ACTIONS.includes(nextAction.action)) {
      const task = lookupJarvisLoopWaveTaskV1(tasksByWave, state.current_wave);
      if (task) {
        taskInjected = task;
        tickRequest = { ...baseRequest, task };
      }
    }

    let tickResult;
    ticksUsed += 1;
    try {
      tickResult = await controller.tick(tickRequest);
    } catch {
      stopReason = 'TICK_FAILED';
      events.push({ tick: tickNumber, phase: 'TICK', outcome: stopReason, detail: 'TICK_CALL_THROWN' });
      break;
    }

    if (!tickResult || tickResult.ok !== true) {
      stopReason = 'TICK_FAILED';
      events.push({ tick: tickNumber, phase: 'TICK', outcome: stopReason, detail: 'TICK_RETURNED_NOT_OK' });
      break;
    }
    finalState = tickResult;

    const performedAction = tickResult.performed ? tickResult.performed.action : null;
    events.push({
      tick: tickNumber,
      phase: 'TICK',
      outcome: 'TICK_PERFORMED',
      action_requested: nextAction.action,
      performed_action: performedAction,
      task_injected: Boolean(taskInjected),
      wave_state: tickResult.wave_state,
      current_wave: tickResult.current_wave,
      verified_progress_percent: tickResult.verified_progress_percent
    });

    if (tickResult.paused === true) {
      stopReason = 'AUTONOMY_PAUSED';
      break;
    }
    if (performedAction === 'NONE') {
      stopReason = 'NONE';
      break;
    }
    if (typeof tickResult.verified_progress_percent === 'number' && tickResult.verified_progress_percent >= 100) {
      stopReason = 'PROGRAM_COMPLETE';
      break;
    }
  }

  if (!stopReason) stopReason = 'MAX_TICKS_REACHED';

  return {
    ok: stopReason !== 'STATE_READ_FAILED' && stopReason !== 'TICK_FAILED',
    status: (stopReason === 'STATE_READ_FAILED' || stopReason === 'TICK_FAILED') ? 503 : 200,
    schema: 'aurentara.jarvis.program-loop.v1',
    max_ticks: maxTicks,
    ticks_used: ticksUsed,
    stop_reason: stopReason,
    events,
    final_state: finalState
  };
}

export function jarvisProgramLoopManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-loop.manifest.v1',
    hard_max_ticks: JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS,
    default_max_ticks: JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS,
    requested_max_ticks_clamped_to: [1, JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS],
    controller_is_external_unmodified_dependency: true,
    controller_still_guarantees_one_mutating_action_per_tick: true,
    sequential_ticks_only: true,
    concurrent_ticks_ever: false,
    sleeps_or_timers_used: false,
    io_outside_injected_controller: false,
    task_fabricated: false,
    task_eligible_actions: [...TASK_ELIGIBLE_ACTIONS],
    grants_program_approval_ever: false,
    dirty_accepted_work_carried_into_next_wave_ever: false,
    deploys_ever: false,
    merges_ever: false,
    pushes_ever: false,
    touches_main_or_master_ever: false,
    touches_production_ever: false,
    touches_hamyren_ever: false
  };
}
