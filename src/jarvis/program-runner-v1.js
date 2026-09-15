/* JARVIS — Private Program Runner V1.

   A small scheduler around the already-accepted bounded Program Loop. It never
   performs a controller mutation itself: every real program action still goes
   through runJarvisBoundedProgramLoopV1 -> Program Controller, preserving the
   controller's one-mutating-action-per-tick rule and every approval gate.

   The runner is capability-gated and OFF by default. A start is explicit,
   single-flight, and recursively scheduled with setTimeout only after the prior
   cycle finishes, so two cycles can never overlap. */

import { runJarvisBoundedProgramLoopV1 } from './program-loop-v1.js';

export const JARVIS_PROGRAM_RUNNER_DEFAULT_INTERVAL_MS = 60_000;
export const JARVIS_PROGRAM_RUNNER_MIN_INTERVAL_MS = 30_000;
export const JARVIS_PROGRAM_RUNNER_MAX_INTERVAL_MS = 15 * 60_000;

const TERMINAL_STOP_REASONS = new Set([
  'AUTONOMY_PAUSED',
  'BLOCKED_OPERATOR',
  'NO_NEXT_ACTION',
  'ACCEPTED_WORK_AWAITS_PUBLICATION',
  'PROGRAM_COMPLETE',
  'STATE_READ_FAILED',
  'TICK_FAILED'
]);

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export function clampJarvisProgramRunnerIntervalMsV1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return JARVIS_PROGRAM_RUNNER_DEFAULT_INTERVAL_MS;
  return Math.min(JARVIS_PROGRAM_RUNNER_MAX_INTERVAL_MS, Math.max(JARVIS_PROGRAM_RUNNER_MIN_INTERVAL_MS, Math.trunc(n)));
}

export function createJarvisProgramRunnerV1(config = {}, deps = {}) {
  const controller = deps.controller;
  const runLoop = deps.run_loop || runJarvisBoundedProgramLoopV1;
  const setTimer = deps.set_timeout || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clear_timeout || ((id) => clearTimeout(id));
  const now = deps.now || (() => new Date().toISOString());

  const fixedRequest = Object.freeze({
    owner_id: clean(config.owner_id, 80),
    owner_ref: clean(config.owner_ref, 320),
    program: clean(config.program, 80).toUpperCase(),
    repo_dir: clean(config.repo_dir, 400),
    target_branch: clean(config.target_branch, 200),
    max_ticks: config.max_ticks
  });
  const capabilityEnabled = config.enabled === true;
  const intervalMs = clampJarvisProgramRunnerIntervalMsV1(config.interval_ms);

  let active = false;
  let inFlight = false;
  let timer = null;
  let cycleCount = 0;
  let lastStartedAt = null;
  let lastFinishedAt = null;
  let lastStopReason = null;
  let lastError = null;
  let lastResult = null;
  let nextScheduledAt = null;

  function validBinding() {
    return Boolean(
      fixedRequest.owner_id && fixedRequest.owner_ref && fixedRequest.program
      && fixedRequest.repo_dir && fixedRequest.target_branch
      && controller && typeof controller.state === 'function' && typeof controller.tick === 'function'
    );
  }

  function snapshot() {
    return {
      ok: true,
      status: 200,
      schema: 'aurentara.jarvis.program-runner-state.v1',
      capability_enabled: capabilityEnabled,
      active,
      cycle_in_flight: inFlight,
      cycle_count: cycleCount,
      interval_ms: intervalMs,
      last_started_at: lastStartedAt,
      last_finished_at: lastFinishedAt,
      last_stop_reason: lastStopReason,
      last_error: lastError,
      next_scheduled_at: nextScheduledAt,
      program: fixedRequest.program || null,
      repo_dir: fixedRequest.repo_dir || null,
      target_branch: fixedRequest.target_branch || null,
      current_wave: lastResult?.final_state?.current_wave ?? null,
      verified_progress_percent: lastResult?.final_state?.verified_progress_percent ?? null
    };
  }

  function cancelScheduled() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    nextScheduledAt = null;
  }

  function suspend(reason, error = null) {
    active = false;
    lastStopReason = reason || lastStopReason;
    lastError = error || null;
    cancelScheduled();
  }

  function schedule(delayMs = intervalMs) {
    if (!active || !capabilityEnabled || timer !== null) return false;
    const delay = Math.max(0, Number(delayMs) || 0);
    nextScheduledAt = new Date(Date.parse(now()) + delay).toISOString();
    timer = setTimer(async () => {
      timer = null;
      nextScheduledAt = null;
      const result = await runOnce();
      if (active && result.ok) schedule(intervalMs);
    }, delay);
    if (timer && typeof timer.unref === 'function') timer.unref();
    return true;
  }

  async function runOnce() {
    if (!capabilityEnabled) return { ok: false, status: 403, error: 'JARVIS_PROGRAM_RUNNER_DISABLED', state: snapshot() };
    if (!active) return { ok: false, status: 409, error: 'JARVIS_PROGRAM_RUNNER_NOT_ACTIVE', state: snapshot() };
    if (!validBinding()) {
      suspend('RUNNER_BINDING_INVALID', 'JARVIS_PROGRAM_RUNNER_BINDING_INVALID');
      return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_BINDING_INVALID', state: snapshot() };
    }
    if (inFlight) return { ok: false, status: 409, error: 'JARVIS_PROGRAM_RUNNER_CYCLE_IN_FLIGHT', duplicate_guard: true, state: snapshot() };

    inFlight = true;
    cycleCount += 1;
    lastStartedAt = now();
    lastError = null;
    try {
      const preflight = await controller.state(fixedRequest);
      if (!preflight || preflight.ok !== true) {
        suspend('STATE_READ_FAILED', 'JARVIS_PROGRAM_RUNNER_STATE_READ_FAILED');
        return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_STATE_READ_FAILED', state: snapshot() };
      }
      if (preflight.program_approval?.granted !== true) {
        suspend('PROGRAM_APPROVAL_REQUIRED');
        return { ok: true, status: 200, cycle_executed: false, stop_reason: 'PROGRAM_APPROVAL_REQUIRED', state: snapshot() };
      }

      const result = await runLoop(fixedRequest, { controller });
      lastResult = result;
      lastStopReason = result?.stop_reason || (result?.ok ? 'UNKNOWN' : 'RUNNER_LOOP_FAILED');
      if (!result || result.ok !== true) {
        suspend(lastStopReason, result?.error || 'JARVIS_PROGRAM_RUNNER_LOOP_FAILED');
        return { ok: false, status: result?.status || 503, error: result?.error || 'JARVIS_PROGRAM_RUNNER_LOOP_FAILED', result, state: snapshot() };
      }
      if (TERMINAL_STOP_REASONS.has(lastStopReason)) suspend(lastStopReason);
      return { ok: true, status: 200, cycle_executed: true, stop_reason: lastStopReason, result, state: snapshot() };
    } catch (error) {
      suspend('RUNNER_CYCLE_FAILED', clean(error?.message, 300) || 'JARVIS_PROGRAM_RUNNER_CYCLE_FAILED');
      return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_CYCLE_FAILED', state: snapshot() };
    } finally {
      inFlight = false;
      lastFinishedAt = now();
    }
  }

  function start(request = {}) {
    if (request.confirm_run !== true) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_RUNNER_CONFIRM_RUN_REQUIRED', state: snapshot() };
    if (!capabilityEnabled) return { ok: false, status: 403, error: 'JARVIS_PROGRAM_RUNNER_DISABLED', state: snapshot() };
    if (!validBinding()) return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_BINDING_INVALID', state: snapshot() };
    if (active) return { ok: true, status: 200, already_active: true, state: snapshot() };
    active = true;
    lastStopReason = null;
    lastError = null;
    schedule(0);
    return { ok: true, status: 200, started: true, state: snapshot() };
  }

  function stop(request = {}) {
    if (request.confirm_stop !== true) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_RUNNER_CONFIRM_STOP_REQUIRED', state: snapshot() };
    active = false;
    cancelScheduled();
    lastStopReason = request.reason ? clean(request.reason, 120) : 'OPERATOR_STOPPED';
    return { ok: true, status: 200, stopped: true, cycle_in_flight: inFlight, state: snapshot() };
  }

  function matchesScope(ownerId, ownerRef) {
    return clean(ownerId, 80) === fixedRequest.owner_id && clean(ownerRef, 320) === fixedRequest.owner_ref;
  }

  return { start, stop, run_once: runOnce, state: snapshot, matches_scope: matchesScope };
}

export function jarvisProgramRunnerManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-runner.manifest.v1',
    capability_enabled_by_default: false,
    explicit_start_confirmation_required: true,
    recursive_single_flight_scheduler: true,
    overlapping_cycles_ever: false,
    delegates_to_bounded_program_loop: true,
    grants_program_approval_ever: false,
    invents_wave_task_ever: false,
    mutates_program_directly: false,
    public_access: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
