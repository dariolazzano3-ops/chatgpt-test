import assert from 'node:assert/strict';
import {
  runJarvisBoundedProgramLoopV1,
  clampJarvisProgramLoopMaxTicksV1,
  jarvisProgramLoopManifestV1,
  JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS,
  JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS
} from '../src/jarvis/program-loop-v1.js';

// A scriptable fake Program Controller. `stateFn`/`tickFn` receive the
// current 0-based cursor (which only advances on a tick() call) and the
// request the loop actually sent. `calls` records every call, in order, so
// tests can prove the loop is strictly sequential (state, [tick], state,
// [tick], ...) and never calls tick() when it should not have.
function makeFakeControllerV1({ stateFn, tickFn }) {
  const calls = [];
  let cursor = 0;
  return {
    calls,
    async state(request) {
      calls.push({ type: 'state', cursor, request });
      return stateFn(cursor, request);
    },
    async tick(request) {
      calls.push({ type: 'tick', cursor, request });
      const result = tickFn(cursor, request);
      cursor += 1;
      return result;
    }
  };
}

const BASE_REQUEST = { owner_id: '11111111-1111-4111-8111-111111111111', owner_ref: 'jarvis:operator:op@example.invalid', program: 'JARVIS_MASTERARCHITECTURE_V2', repo_dir: '/tmp/fixture', target_branch: 'factory/x' };
const CLEAN = { working_tree_clean: true };
const DIRTY = { working_tree_clean: false };

// ── 1. Pure clamp helper ──
{
  assert.equal(clampJarvisProgramLoopMaxTicksV1(undefined), JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(null), JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS);
  assert.equal(clampJarvisProgramLoopMaxTicksV1('not a number'), JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(1), 1);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(0), 1);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(-5), 1);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(24), 24);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(25), JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(999999), JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS);
  assert.equal(clampJarvisProgramLoopMaxTicksV1(7.9), 7, 'truncates, never rounds up past what was actually requested');
}

// ── 2. Manifest / safety invariants ──
{
  const man = jarvisProgramLoopManifestV1();
  assert.equal(man.hard_max_ticks, 24);
  assert.equal(man.default_max_ticks, 12);
  assert.equal(man.controller_still_guarantees_one_mutating_action_per_tick, true);
  assert.equal(man.sequential_ticks_only, true);
  assert.equal(man.concurrent_ticks_ever, false);
  assert.equal(man.sleeps_or_timers_used, false);
  assert.equal(man.io_outside_injected_controller, false);
  assert.equal(man.task_fabricated, false);
  assert.deepEqual(man.task_eligible_actions, ['PROPOSE_WAVE_TASK', 'ANALYZE_FOR_REPAIR']);
  assert.equal(man.grants_program_approval_ever, false);
  assert.equal(man.dirty_accepted_work_carried_into_next_wave_ever, false);
  assert.equal(man.deploys_ever, false);
  assert.equal(man.merges_ever, false);
  assert.equal(man.pushes_ever, false);
  assert.equal(man.touches_main_or_master_ever, false);
  assert.equal(man.touches_production_ever, false);
  assert.equal(man.touches_hamyren_ever, false);
}

// ── 3. Missing / invalid controller -> fail closed, never throws ──
{
  const r1 = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, {});
  assert.equal(r1.ok, false);
  assert.equal(r1.error, 'JARVIS_PROGRAM_LOOP_CONTROLLER_REQUIRED');

  const r2 = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: { state: () => {} } });
  assert.equal(r2.ok, false, 'a controller missing tick() is rejected, not partially used');
}

// ── 4. Happy multi-tick progression: two waves, each PROPOSE_WAVE_TASK ->
//        RESUME -> VERIFY_AND_ACCEPT, ending at verified_progress_percent
//        100 -> PROGRAM_COMPLETE ──
{
  const script = [
    { // cursor 0: wave 0 pending
      state: { ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'PROPOSE_WAVE_TASK' }, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 0 }
    },
    { // cursor 1: wave 0 executing
      state: { ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'RESUME' }, wave_state: 'VERIFYING', next_action: { action: 'VERIFY_AND_ACCEPT' }, current_wave: 0, verified_progress_percent: 0 }
    },
    { // cursor 2: wave 0 verifying -> accept -> advances to wave 1 at 50%
      state: { ok: true, wave_state: 'VERIFYING', next_action: { action: 'VERIFY_AND_ACCEPT' }, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'VERIFY_AND_ACCEPT' }, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 1, verified_progress_percent: 50 }
    },
    { // cursor 3: wave 1 pending
      state: { ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 1, verified_progress_percent: 50, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'PROPOSE_WAVE_TASK' }, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 1, verified_progress_percent: 50 }
    },
    { // cursor 4: wave 1 executing
      state: { ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 1, verified_progress_percent: 50, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'RESUME' }, wave_state: 'VERIFYING', next_action: { action: 'VERIFY_AND_ACCEPT' }, current_wave: 1, verified_progress_percent: 50 }
    },
    { // cursor 5: wave 1 verifying -> accept -> 100%
      state: { ok: true, wave_state: 'VERIFYING', next_action: { action: 'VERIFY_AND_ACCEPT' }, current_wave: 1, verified_progress_percent: 50, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'VERIFY_AND_ACCEPT' }, wave_state: 'ACCEPTED', next_action: { action: 'ADVANCE_TO_NEXT_WAVE' }, current_wave: 2, verified_progress_percent: 100 }
    }
  ];
  const controller = makeFakeControllerV1({
    stateFn: (cursor) => script[cursor].state,
    tickFn: (cursor) => script[cursor].tick
  });
  const result = await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, max_ticks: 12 }, { controller });
  assert.equal(result.ok, true);
  assert.equal(result.schema, 'aurentara.jarvis.program-loop.v1');
  assert.equal(result.max_ticks, 12);
  assert.equal(result.ticks_used, 6);
  assert.equal(result.stop_reason, 'PROGRAM_COMPLETE');
  assert.equal(result.events.length, 6);
  assert.equal(result.final_state.verified_progress_percent, 100);
  const tickCalls = controller.calls.filter((c) => c.type === 'tick');
  const stateCalls = controller.calls.filter((c) => c.type === 'state');
  assert.equal(tickCalls.length, 6);
  assert.equal(stateCalls.length, 6, 'exactly one state() read before each tick()');
  // Strictly sequential: state, tick, state, tick, ... never two ticks back to back.
  assert.deepEqual(controller.calls.map((c) => c.type), ['state', 'tick', 'state', 'tick', 'state', 'tick', 'state', 'tick', 'state', 'tick', 'state', 'tick']);
}

// ── 5. Hard max clamp: a controller that never naturally stops is still cut
//        off at exactly JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS ──
{
  const neverStops = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 10, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'RESUME' }, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 10 })
  });
  const result = await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, max_ticks: 999999 }, { controller: neverStops });
  assert.equal(result.max_ticks, JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS);
  assert.equal(result.ticks_used, JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS, 'never exceeds the hard ceiling regardless of what was requested');
  assert.equal(result.stop_reason, 'MAX_TICKS_REACHED');
  assert.equal(neverStops.calls.filter((c) => c.type === 'tick').length, JARVIS_PROGRAM_LOOP_HARD_MAX_TICKS);

  // No max_ticks requested at all -> the default (12), not the hard max.
  const defaultCtrl = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 10, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'RESUME' }, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 10 })
  });
  const defaultResult = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: defaultCtrl });
  assert.equal(defaultResult.max_ticks, JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS);
  assert.equal(defaultResult.ticks_used, JARVIS_PROGRAM_LOOP_DEFAULT_MAX_TICKS);
  assert.equal(defaultResult.stop_reason, 'MAX_TICKS_REACHED');

  // A requested max below 1 clamps up to exactly 1 tick, not 0.
  const oneCtrl = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 10, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'RESUME' }, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 10 })
  });
  const oneResult = await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, max_ticks: -5 }, { controller: oneCtrl });
  assert.equal(oneResult.max_ticks, 1);
  assert.equal(oneResult.ticks_used, 1);
}

// ── 6. WAIT stops without ever calling tick() ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'EXECUTING', next_action: { action: 'WAIT' }, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN }),
    tickFn: () => { throw new Error('tick() must never be called when next_action is WAIT'); }
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'WAIT');
  assert.equal(result.ticks_used, 0);
  assert.deepEqual(controller.calls.map((c) => c.type), ['state']);
}

// ── 7. BLOCKED_OPERATOR stops without ever calling tick() ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'BLOCKED_OPERATOR', wave_reason: 'TARGET_BRANCH_PROTECTED', next_action: null, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN }),
    tickFn: () => { throw new Error('tick() must never be called when BLOCKED_OPERATOR'); }
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'BLOCKED_OPERATOR');
  assert.equal(result.ticks_used, 0);
  assert.deepEqual(controller.calls.map((c) => c.type), ['state']);
}

// ── 7b. Missing next_action (not BLOCKED_OPERATOR) also stops before tick() ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'VERIFYING', wave_reason: 'ACCEPTANCE_NOT_COVERED_BY_PROGRAM_APPROVAL', next_action: null, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN }),
    tickFn: () => { throw new Error('tick() must never be called with no next_action'); }
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'NO_NEXT_ACTION');
  assert.equal(result.ticks_used, 0);
}

// ── 7c. A state read failure stops fail-closed ──
{
  const failing = makeFakeControllerV1({
    stateFn: () => ({ ok: false, error: 'JARVIS_PROGRAM_STATE_REQUEST_INVALID' }),
    tickFn: () => { throw new Error('tick() must never be called after a failed state read'); }
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: failing });
  assert.equal(result.stop_reason, 'STATE_READ_FAILED');
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.ticks_used, 0);

  const throwing = makeFakeControllerV1({
    stateFn: () => { throw new Error('boom'); },
    tickFn: () => { throw new Error('tick() must never be called after a throwing state read'); }
  });
  const result2 = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: throwing });
  assert.equal(result2.stop_reason, 'STATE_READ_FAILED');
  assert.equal(result2.ok, false);
  assert.equal(result2.events[0].detail, 'STATE_CALL_THROWN', 'raw thrown error text is never echoed');
  assert.equal(result2.ticks_used, 0);
}


// ── 7d. Already-complete state stops before another tick ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'ACCEPTED', next_action: { action: 'ADVANCE_TO_NEXT_WAVE' }, current_wave: 13, verified_progress_percent: 100, branch_truth: CLEAN }),
    tickFn: () => { throw new Error('tick() must never be called once progress is already 100%'); }
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'PROGRAM_COMPLETE');
  assert.equal(result.ticks_used, 0);
  assert.deepEqual(controller.calls.map((c) => c.type), ['state']);
}

// ── 7e. Tick failure counts the attempted tick, fails closed, and never echoes raw exception text ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME' }, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN }),
    tickFn: () => { throw new Error('SECRET-LIKE-INTERNAL-TEXT'); }
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'TICK_FAILED');
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.ticks_used, 1);
  assert.equal(result.events[0].detail, 'TICK_CALL_THROWN');
  assert.doesNotMatch(JSON.stringify(result), /SECRET-LIKE-INTERNAL-TEXT/);
}

// ── 8. A tick returning performed.action NONE stops the loop ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 4, verified_progress_percent: 35, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'NONE', detail: 'AWAITING_OPERATOR_SUPPLIED_WAVE_TASK' }, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 4, verified_progress_percent: 35 })
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'NONE');
  assert.equal(result.ticks_used, 1);
  const tickCall = controller.calls.find((c) => c.type === 'tick');
  assert.equal(tickCall.request.task, undefined, 'no tasks_by_wave entry for wave 4 -> no fabricated task ever passed');
}

// ── 9. paused: true takes priority over the NONE check ──
{
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'PREPARING', next_action: { action: 'PREPARE_BRANCH' }, current_wave: 0, verified_progress_percent: 0, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, paused: true, pause_reason: 'JARVIS_AUTONOMY_PAUSED', performed: { action: 'NONE', detail: 'JARVIS_AUTONOMY_PAUSED' }, wave_state: 'PREPARING', next_action: { action: 'PREPARE_BRANCH' }, current_wave: 0, verified_progress_percent: 0 })
  });
  const result = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller });
  assert.equal(result.stop_reason, 'AUTONOMY_PAUSED', 'reported as AUTONOMY_PAUSED, never mistaken for a plain NONE');
  assert.equal(result.ticks_used, 1);
}

// ── 10. Dirty working tree blocks PROPOSE_WAVE_TASK / PREPARE_BRANCH before
//         tick(), but NOT other actions ──
{
  const proposeCtrl = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 5, verified_progress_percent: 40, branch_truth: DIRTY }),
    tickFn: () => { throw new Error('tick() must never be called: dirty tree + PROPOSE_WAVE_TASK'); }
  });
  const r1 = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: proposeCtrl });
  assert.equal(r1.stop_reason, 'ACCEPTED_WORK_AWAITS_PUBLICATION');
  assert.equal(r1.ticks_used, 0);

  const prepareCtrl = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'PREPARING', next_action: { action: 'PREPARE_BRANCH' }, current_wave: 5, verified_progress_percent: 40, branch_truth: DIRTY }),
    tickFn: () => { throw new Error('tick() must never be called: dirty tree + PREPARE_BRANCH'); }
  });
  const r2 = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: prepareCtrl });
  assert.equal(r2.stop_reason, 'ACCEPTED_WORK_AWAITS_PUBLICATION');
  assert.equal(r2.ticks_used, 0);

  // Dirty tree + an action OTHER than PROPOSE_WAVE_TASK/PREPARE_BRANCH is not
  // this boundary — the loop proceeds normally (the controller itself is the
  // one that actually cares about tree cleanliness for its own actions).
  const resumeCtrl = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'EXECUTING', next_action: { action: 'RESUME', request_id: 'r1' }, current_wave: 5, verified_progress_percent: 40, branch_truth: DIRTY }),
    tickFn: () => ({ ok: true, performed: { action: 'NONE', detail: 'stub' }, wave_state: 'EXECUTING', next_action: { action: 'RESUME', request_id: 'r1' }, current_wave: 5, verified_progress_percent: 40 })
  });
  const r3 = await runJarvisBoundedProgramLoopV1(BASE_REQUEST, { controller: resumeCtrl });
  assert.equal(r3.ticks_used, 1, 'RESUME is not gated by the dirty-tree boundary');
  assert.equal(r3.stop_reason, 'NONE');
}

// ── 11. Exact per-wave task injection: ONLY on PROPOSE_WAVE_TASK / ANALYZE_FOR_REPAIR,
//          for the EXACT current wave, and never otherwise, even if tasks_by_wave still
//          has an entry for that wave index ──
{
  const script = [
    { // cursor 0: wave 2, PROPOSE_WAVE_TASK -> eligible, must inject
      state: { ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 2, verified_progress_percent: 20, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'PROPOSE_WAVE_TASK' }, wave_state: 'EXECUTING', next_action: { action: 'AUTHORIZE_AND_RESUME', request_id: 'r1' }, current_wave: 2, verified_progress_percent: 20 }
    },
    { // cursor 1: still wave 2, AUTHORIZE_AND_RESUME -> not eligible, must NOT inject
      state: { ok: true, wave_state: 'EXECUTING', next_action: { action: 'AUTHORIZE_AND_RESUME', request_id: 'r1' }, current_wave: 2, verified_progress_percent: 20, branch_truth: CLEAN },
      tick: { ok: true, performed: { action: 'NONE', detail: 'stub-end' }, wave_state: 'EXECUTING', next_action: { action: 'AUTHORIZE_AND_RESUME', request_id: 'r1' }, current_wave: 2, verified_progress_percent: 20 }
    }
  ];
  const controller = makeFakeControllerV1({
    stateFn: (cursor) => script[cursor].state,
    tickFn: (cursor) => script[cursor].tick
  });
  const tasksByWave = { 2: { title: 'W2 TITLE', goal: 'W2 GOAL TEXT' } };
  const result = await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, tasks_by_wave: tasksByWave }, { controller });
  assert.equal(result.ticks_used, 2);
  const [firstTick, secondTick] = controller.calls.filter((c) => c.type === 'tick');
  assert.deepEqual(firstTick.request.task, { title: 'W2 TITLE', goal: 'W2 GOAL TEXT' }, 'PROPOSE_WAVE_TASK for wave 2 gets the exact configured task');
  // Validation may inspect trimmed content, but the actual task payload is byte-for-byte the caller's authored strings.
  const spacedController = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 8, verified_progress_percent: 60, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'NONE' }, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 8, verified_progress_percent: 60 })
  });
  await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, tasks_by_wave: { 8: { title: '  EXACT TITLE  ', goal: '  EXACT GOAL  ' } } }, { controller: spacedController });
  assert.deepEqual(spacedController.calls.find((c) => c.type === 'tick').request.task, { title: '  EXACT TITLE  ', goal: '  EXACT GOAL  ' }, 'task strings are validated but never rewritten');
  assert.equal(secondTick.request.task, undefined, 'AUTHORIZE_AND_RESUME never receives a task, even though tasks_by_wave[2] still exists');
  assert.equal(result.events[0].task_injected, true);
  assert.equal(result.events[1].task_injected, false);

  // ANALYZE_FOR_REPAIR is the other eligible action.
  const repairController = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'REPAIRING', next_action: { action: 'ANALYZE_FOR_REPAIR', request_id: 'r9', attempts_used: 1 }, current_wave: 3, verified_progress_percent: 25, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'NONE', detail: 'stub-end' }, wave_state: 'REPAIRING', next_action: { action: 'ANALYZE_FOR_REPAIR', request_id: 'r9', attempts_used: 1 }, current_wave: 3, verified_progress_percent: 25 })
  });
  const repairResult = await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, tasks_by_wave: { 3: { title: 'REPAIR TITLE', goal: 'REPAIR GOAL' } } }, { controller: repairController });
  const repairTick = repairController.calls.find((c) => c.type === 'tick');
  assert.deepEqual(repairTick.request.task, { title: 'REPAIR TITLE', goal: 'REPAIR GOAL' });
  assert.equal(repairResult.stop_reason, 'NONE');
}

// ── 12. No task fabrication: a mismatched wave index, a malformed entry, or
//          no tasks_by_wave at all all result in request.task === undefined,
//          NEVER a synthesized value ──
{
  async function tickTaskFor(tasksByWave, currentWave) {
    const controller = makeFakeControllerV1({
      stateFn: () => ({ ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: currentWave, verified_progress_percent: 0, branch_truth: CLEAN }),
      tickFn: () => ({ ok: true, performed: { action: 'NONE' }, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: currentWave, verified_progress_percent: 0 })
    });
    await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, tasks_by_wave: tasksByWave }, { controller });
    return controller.calls.find((c) => c.type === 'tick').request.task;
  }

  assert.equal(await tickTaskFor(undefined, 7), undefined, 'no tasks_by_wave at all');
  assert.equal(await tickTaskFor({}, 7), undefined, 'empty tasks_by_wave');
  assert.equal(await tickTaskFor({ 2: { title: 'X', goal: 'Y' } }, 7), undefined, 'entry exists but for a different wave index');
  assert.equal(await tickTaskFor({ 7: { title: 'only a title' } }, 7), undefined, 'malformed entry missing goal -> never partially injected');
  assert.equal(await tickTaskFor({ 7: { goal: 'only a goal' } }, 7), undefined, 'malformed entry missing title -> never partially injected');
  assert.equal(await tickTaskFor({ 7: { title: '  ', goal: '  ' } }, 7), undefined, 'whitespace-only strings never count as a real task');

  // A caller-supplied top-level `task` on the loop request itself is ignored
  // — the loop decides task injection ONLY via tasks_by_wave, per current wave.
  const controller = makeFakeControllerV1({
    stateFn: () => ({ ok: true, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 9, verified_progress_percent: 0, branch_truth: CLEAN }),
    tickFn: () => ({ ok: true, performed: { action: 'NONE' }, wave_state: 'PENDING', next_action: { action: 'PROPOSE_WAVE_TASK' }, current_wave: 9, verified_progress_percent: 0 })
  });
  await runJarvisBoundedProgramLoopV1({ ...BASE_REQUEST, task: { title: 'SMUGGLED', goal: 'SMUGGLED GOAL' } }, { controller });
  const tickCall = controller.calls.find((c) => c.type === 'tick');
  assert.equal(tickCall.request.task, undefined, 'a top-level request.task is stripped, never forwarded verbatim');
}

console.log('JARVIS Program Loop V1 smoke: PASS');
