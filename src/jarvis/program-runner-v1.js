/* JARVIS — Private Program Runner V1.

   Scheduler around the accepted bounded Program Loop. Every real program
   action still goes through Program Loop -> Program Controller. The runner is
   capability-gated OFF by default, single-flight, audit-backed, and restart
   recovery is derived from durable audit + fresh controller state. */

import { runJarvisBoundedProgramLoopV1 } from './program-loop-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { evaluateJarvisProgramRunnerRecoveryV1 } from './program-runner-recovery-v1.js';

export const JARVIS_PROGRAM_RUNNER_DEFAULT_INTERVAL_MS = 60_000;
export const JARVIS_PROGRAM_RUNNER_MIN_INTERVAL_MS = 30_000;
export const JARVIS_PROGRAM_RUNNER_MAX_INTERVAL_MS = 15 * 60_000;

const TERMINAL_STOP_REASONS = new Set([
  'AUTONOMY_PAUSED', 'BLOCKED_OPERATOR', 'NO_NEXT_ACTION',
  'ACCEPTED_WORK_AWAITS_PUBLICATION', 'PROGRAM_COMPLETE',
  'STATE_READ_FAILED', 'TICK_FAILED'
]);
const RUNNER_ACTION = 'PROGRAM_RUNNER_CYCLE';
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export function clampJarvisProgramRunnerIntervalMsV1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return JARVIS_PROGRAM_RUNNER_DEFAULT_INTERVAL_MS;
  return Math.min(JARVIS_PROGRAM_RUNNER_MAX_INTERVAL_MS, Math.max(JARVIS_PROGRAM_RUNNER_MIN_INTERVAL_MS, Math.trunc(n)));
}

export function createJarvisProgramRunnerV1(config = {}, deps = {}) {
  const controller = deps.controller;
  const runLoop = deps.run_loop || runJarvisBoundedProgramLoopV1;
  const store = deps.memory_store || null;
  const publisher = deps.publisher || null;
  const trustedCandidateRecoverer = deps.trusted_candidate_recoverer || null;
  const setTimer = deps.set_timeout || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clear_timeout || ((id) => clearTimeout(id));
  const now = deps.now || (() => new Date().toISOString());
  const requireRecovery = config.require_recovery === true;

  const fixedRequest = Object.freeze({
    owner_id: clean(config.owner_id, 80), owner_ref: clean(config.owner_ref, 320),
    program: clean(config.program, 80).toUpperCase(), repo_dir: clean(config.repo_dir, 400),
    target_branch: clean(config.target_branch, 200), max_ticks: config.max_ticks
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
  let lastPublication = null;
  let lastCandidateRecovery = null;
  let recovery = { status: requireRecovery ? 'NOT_CHECKED' : 'NOT_REQUIRED', resume_allowed: !requireRecovery, reason: null };

  function validBinding() {
    return Boolean(fixedRequest.owner_id && fixedRequest.owner_ref && fixedRequest.program
      && fixedRequest.repo_dir && fixedRequest.target_branch && controller
      && typeof controller.state === 'function' && typeof controller.tick === 'function');
  }

  function snapshot() {
    return {
      ok: true, status: 200, schema: 'aurentara.jarvis.program-runner-state.v1',
      capability_enabled: capabilityEnabled, active, cycle_in_flight: inFlight, cycle_count: cycleCount,
      interval_ms: intervalMs, last_started_at: lastStartedAt, last_finished_at: lastFinishedAt,
      last_stop_reason: lastStopReason, last_error: lastError, next_scheduled_at: nextScheduledAt,
      program: fixedRequest.program || null, repo_dir: fixedRequest.repo_dir || null,
      target_branch: fixedRequest.target_branch || null,
      current_wave: lastResult?.final_state?.current_wave ?? recovery?.current_wave ?? null,
      verified_progress_percent: lastResult?.final_state?.verified_progress_percent ?? recovery?.verified_progress_percent ?? null,
      recovery_status: recovery?.status || null, recovery_reason: recovery?.reason || null,
      interrupted_cycle: recovery?.interrupted_cycle || null,
      trusted_publisher_bound: Boolean(publisher && typeof publisher.publish === 'function'),
      trusted_candidate_recoverer_bound: Boolean(trustedCandidateRecoverer && typeof trustedCandidateRecoverer.recover === 'function'),
      last_publication: lastPublication, last_candidate_recovery: lastCandidateRecovery
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

  async function appendCycleAudit(status, cycleId, extra = {}) {
    if (!store || typeof store.appendAudit !== 'function') {
      if (requireRecovery) throw new Error('JARVIS_PROGRAM_RUNNER_AUDIT_STORE_REQUIRED');
      return null;
    }
    const event = createJarvisAuditEventV1({
      timestamp: now(), owner_ref: fixedRequest.owner_ref,
      request: `[PROGRAM RUNNER] ${fixedRequest.program} · ${fixedRequest.target_branch}`,
      intent: { intent_type: RUNNER_ACTION, domain: 'PROGRAM', action: RUNNER_ACTION },
      tools_used: [], permissions: [], action: RUNNER_ACTION,
      result: {
        status, program: fixedRequest.program, repo_dir: fixedRequest.repo_dir,
        target_branch: fixedRequest.target_branch, cycle_id: cycleId, ...extra
      },
      approval: { required: false, explicit: false, actor_type: 'SYSTEM', gate_status: 'PROGRAM_APPROVAL_ENFORCED_BY_CONTROLLER' },
      cost: { estimated_eur: 0, actual_eur: 0 },
      memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
    });
    return store.appendAudit({ owner_id: fixedRequest.owner_id, owner_ref: fixedRequest.owner_ref, event });
  }

  async function recover() {
    if (!requireRecovery) {
      recovery = { status: 'NOT_REQUIRED', resume_allowed: true, reason: null };
      return { ok: true, ...recovery };
    }
    if (!store || typeof store.readAudit !== 'function') {
      recovery = { status: 'BLOCKED', resume_allowed: false, reason: 'AUDIT_READ_REQUIRED' };
      return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_RECOVERY_STORE_REQUIRED', ...recovery };
    }
    let audit;
    let state;
    try {
      [audit, state] = await Promise.all([
        store.readAudit({ owner_id: fixedRequest.owner_id, owner_ref: fixedRequest.owner_ref, limit: 200 }),
        controller.state(fixedRequest)
      ]);
    } catch {
      recovery = { status: 'BLOCKED', resume_allowed: false, reason: 'RECOVERY_READ_FAILED' };
      return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_RECOVERY_READ_FAILED', ...recovery };
    }
    recovery = evaluateJarvisProgramRunnerRecoveryV1({
      audit, program: fixedRequest.program, repo_dir: fixedRequest.repo_dir,
      target_branch: fixedRequest.target_branch, controller_state: state
    });
    return recovery;
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
    const cycleId = `${lastStartedAt}#${cycleCount}`;
    let output;
    let finishExtra = {};
    try {
      const preflight = await controller.state(fixedRequest);
      if (!preflight || preflight.ok !== true) {
        suspend('STATE_READ_FAILED', 'JARVIS_PROGRAM_RUNNER_STATE_READ_FAILED');
        output = { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_STATE_READ_FAILED' };
        return output;
      }
      if (preflight.program_approval?.granted !== true) {
        suspend('PROGRAM_APPROVAL_REQUIRED');
        output = { ok: true, status: 200, cycle_executed: false, stop_reason: 'PROGRAM_APPROVAL_REQUIRED' };
        return output;
      }

      try { await appendCycleAudit('STARTED', cycleId, { current_wave: preflight.current_wave ?? null }); }
      catch {
        suspend('AUDIT_PERSIST_FAILED', 'JARVIS_PROGRAM_RUNNER_AUDIT_PERSIST_FAILED');
        output = { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_AUDIT_PERSIST_FAILED' };
        return output;
      }

      const result = await runLoop({ ...fixedRequest, stop_after_progress_increment: Boolean(publisher && typeof publisher.publish === 'function') }, { controller });
      lastResult = result;
      lastStopReason = result?.stop_reason || (result?.ok ? 'UNKNOWN' : 'RUNNER_LOOP_FAILED');
      finishExtra = {
        stop_reason: lastStopReason,
        current_wave: result?.final_state?.current_wave ?? null,
        verified_progress_percent: result?.final_state?.verified_progress_percent ?? null
      };
      if (!result || result.ok !== true) {
        suspend(lastStopReason, result?.error || 'JARVIS_PROGRAM_RUNNER_LOOP_FAILED');
        output = { ok: false, status: result?.status || 503, error: result?.error || 'JARVIS_PROGRAM_RUNNER_LOOP_FAILED', result };
        return output;
      }
      // BLOCKED_OPERATOR is only a prompt to ASK the trusted recoverer. The
      // recoverer is the authority: it independently requires the exhausted
      // repair budget, exact registry dirty set, same-wave provenance, branch
      // truth, syntax, forbidden-pattern scan, and all registry checks. Do not
      // couple that durable evidence gate to one presentation-level wave_reason.
      const candidateRecoveryNeeded = lastStopReason === 'BLOCKED_OPERATOR';
      let candidateRecoveryDeclined = false;
      if (candidateRecoveryNeeded && trustedCandidateRecoverer && typeof trustedCandidateRecoverer.recover === 'function') {
        const candidateRecovery = await trustedCandidateRecoverer.recover({
          ...fixedRequest,
          wave_index: result?.final_state?.current_wave,
          max_repair_attempts: 3
        });
        lastCandidateRecovery = candidateRecovery;
        if (!candidateRecovery?.ok) {
          if (candidateRecovery?.error === 'TRUSTED_CANDIDATE_RECOVERY_INELIGIBLE') {
            candidateRecoveryDeclined = true;
          } else {
            suspend('TRUSTED_CANDIDATE_RECOVERY_FAILED', candidateRecovery?.reason || candidateRecovery?.error || 'TRUSTED_CANDIDATE_RECOVERY_FAILED');
            output = { ok: false, status: candidateRecovery?.status || 409, error: 'JARVIS_TRUSTED_CANDIDATE_RECOVERY_FAILED', candidate_recovery: candidateRecovery, result };
            return output;
          }
        } else {
          lastStopReason = 'TRUSTED_CANDIDATE_RECOVERED';
          finishExtra = { ...finishExtra, stop_reason: lastStopReason, candidate_recovery_request_id: candidateRecovery.request_id || null };
        }
      }
      if (!candidateRecoveryNeeded || candidateRecoveryDeclined || lastStopReason !== 'TRUSTED_CANDIDATE_RECOVERED') {
        const publicationNeeded = lastStopReason === 'ACCEPTED_WORK_AWAITS_PUBLICATION'
          || (lastStopReason === 'BLOCKED_OPERATOR' && result?.final_state?.wave_reason === 'WORKING_TREE_DIRTY');
        if (publicationNeeded && publisher && typeof publisher.publish === 'function') {
        const publication = await publisher.publish(fixedRequest);
        lastPublication = publication;
        if (!publication?.ok) {
          suspend('PUBLICATION_FAILED', publication?.error || 'JARVIS_ACCEPTED_WORK_PUBLICATION_FAILED');
          output = { ok: false, status: 409, error: 'JARVIS_ACCEPTED_WORK_PUBLICATION_FAILED', publication, result };
          return output;
        }
        lastStopReason = 'ACCEPTED_WORK_PUBLISHED';
        finishExtra = { ...finishExtra, stop_reason: lastStopReason, publication_commit: publication.commit || null };
        } else if (TERMINAL_STOP_REASONS.has(lastStopReason)) suspend(lastStopReason);
      }
      output = { ok: true, status: 200, cycle_executed: true, stop_reason: lastStopReason, result };
      return output;
    } catch (error) {
      suspend('RUNNER_CYCLE_FAILED', clean(error?.message, 300) || 'JARVIS_PROGRAM_RUNNER_CYCLE_FAILED');
      output = { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_CYCLE_FAILED' };
      return output;
    } finally {
      lastFinishedAt = now();
      if (store && typeof store.appendAudit === 'function' && cycleId) {
        try { await appendCycleAudit('FINISHED', cycleId, { ...finishExtra, final_ok: output?.ok === true }); }
        catch { suspend('AUDIT_PERSIST_FAILED', 'JARVIS_PROGRAM_RUNNER_AUDIT_PERSIST_FAILED'); }
      }
      inFlight = false;
    }
  }

  async function start(request = {}) {
    if (request.confirm_run !== true) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_RUNNER_CONFIRM_RUN_REQUIRED', state: snapshot() };
    if (!capabilityEnabled) return { ok: false, status: 403, error: 'JARVIS_PROGRAM_RUNNER_DISABLED', state: snapshot() };
    if (!validBinding()) return { ok: false, status: 503, error: 'JARVIS_PROGRAM_RUNNER_BINDING_INVALID', state: snapshot() };
    if (active) return { ok: true, status: 200, already_active: true, state: snapshot() };
    let recovered = await recover();
    if (requireRecovery && recovered?.reason === 'ACCEPTED_WORK_AWAITS_PUBLICATION' && publisher && typeof publisher.publish === 'function') {
      const publication = await publisher.publish(fixedRequest);
      lastPublication = publication;
      if (!publication?.ok) return { ok: false, status: 409, error: 'JARVIS_PROGRAM_RUNNER_RECOVERY_PUBLICATION_FAILED', publication, recovery: recovered, state: snapshot() };
      recovered = await recover();
    }
    if (requireRecovery && recovered?.reason === 'TRUSTED_CANDIDATE_RECOVERY_REQUIRED'
        && trustedCandidateRecoverer && typeof trustedCandidateRecoverer.recover === 'function') {
      const candidateRecovery = await trustedCandidateRecoverer.recover({
        ...fixedRequest, wave_index: recovered.current_wave, max_repair_attempts: 3
      });
      lastCandidateRecovery = candidateRecovery;
      if (!candidateRecovery?.ok) return { ok: false, status: candidateRecovery?.status || 409, error: 'JARVIS_PROGRAM_RUNNER_RECOVERY_CANDIDATE_FAILED', candidate_recovery: candidateRecovery, recovery: recovered, state: snapshot() };
      recovered = await recover();
    }
    if (requireRecovery && (!recovered.ok || recovered.resume_allowed !== true)) {
      return { ok: false, status: 409, error: 'JARVIS_PROGRAM_RUNNER_RECOVERY_BLOCKED', recovery: recovered, state: snapshot() };
    }
    active = true;
    lastStopReason = null;
    lastError = null;
    schedule(0);
    return { ok: true, status: 200, started: true, recovery: recovered, state: snapshot() };
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

  return { start, stop, run_once: runOnce, recover, state: snapshot, matches_scope: matchesScope };
}

export function jarvisProgramRunnerManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-runner.manifest.v1',
    capability_enabled_by_default: false,
    explicit_start_confirmation_required: true,
    recursive_single_flight_scheduler: true,
    none_keeps_scheduler_active: true,
    overlapping_cycles_ever: false,
    delegates_to_bounded_program_loop: true,
    durable_recovery_supported: true,
    optional_trusted_publisher_supported: true,
    trusted_publisher_can_be_worker_supplied: false,
    recovery_source: 'AUDIT_PLUS_FRESH_CONTROLLER_STATE',
    grants_program_approval_ever: false,
    invents_wave_task_ever: false,
    mutates_program_directly: false,
    public_access: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
