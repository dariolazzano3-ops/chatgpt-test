import assert from 'node:assert/strict';
import {
  createJarvisProgramRunnerV1,
  clampJarvisProgramRunnerIntervalMsV1,
  jarvisProgramRunnerManifestV1,
  JARVIS_PROGRAM_RUNNER_DEFAULT_INTERVAL_MS,
  JARVIS_PROGRAM_RUNNER_MIN_INTERVAL_MS,
  JARVIS_PROGRAM_RUNNER_MAX_INTERVAL_MS
} from '../src/jarvis/program-runner-v1.js';

const REQUEST = {
  owner_id: '11111111-1111-4111-8111-111111111111',
  owner_ref: 'jarvis:operator:fixture@example.invalid',
  program: 'JARVIS_MASTERARCHITECTURE_V2',
  repo_dir: '/tmp/jarvis-fixture',
  target_branch: 'factory/jarvis-masterarchitecture-v2'
};

assert.equal(clampJarvisProgramRunnerIntervalMsV1(undefined), JARVIS_PROGRAM_RUNNER_DEFAULT_INTERVAL_MS);
assert.equal(clampJarvisProgramRunnerIntervalMsV1(1), JARVIS_PROGRAM_RUNNER_MIN_INTERVAL_MS);
assert.equal(clampJarvisProgramRunnerIntervalMsV1(99_999_999), JARVIS_PROGRAM_RUNNER_MAX_INTERVAL_MS);

{
  const runner = createJarvisProgramRunnerV1({ ...REQUEST }, { controller: { state: async () => ({ ok: true }), tick: async () => ({ ok: true }) } });
  assert.equal(runner.state().capability_enabled, false, 'runner is OFF unless explicitly capability-enabled');
  assert.equal((await runner.start({ confirm_run: true })).error, 'JARVIS_PROGRAM_RUNNER_DISABLED');
}

{
  const scheduled = [];
  const calls = [];
  const controller = {
    state: async (request) => ({ ok: true, program_approval: { granted: true }, current_wave: 7, verified_progress_percent: 63 }),
    tick: async () => ({ ok: true })
  };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true, interval_ms: 30_000, max_ticks: 5 },
    {
      controller,
      now: () => '2026-09-15T01:00:00.000Z',
      set_timeout: (fn, ms) => { scheduled.push({ fn, ms }); return { unref() {} }; },
      clear_timeout: () => {},
      run_loop: async (request, deps) => {
        calls.push({ request, deps });
        return { ok: true, status: 200, stop_reason: 'WAIT', final_state: { current_wave: 7, verified_progress_percent: 63 } };
      }
    }
  );
  assert.equal((await runner.start({})).error, 'JARVIS_PROGRAM_RUNNER_CONFIRM_RUN_REQUIRED');
  const started = await runner.start({ confirm_run: true });
  assert.equal(started.ok, true);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].ms, 0, 'explicit start schedules first cycle immediately but asynchronously');
  await scheduled.shift().fn();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.program, REQUEST.program);
  assert.equal(calls[0].request.repo_dir, REQUEST.repo_dir);
  assert.equal(calls[0].request.target_branch, REQUEST.target_branch);
  assert.equal(calls[0].request.max_ticks, 5);
  assert.equal(calls[0].request.task, undefined, 'runner never invents task text');
  assert.equal(runner.state().active, true, 'WAIT ends this bounded loop cycle but remains safe to poll later');
  assert.equal(scheduled.length, 1, 'next cycle is scheduled only after the prior cycle finished');
  runner.stop({ confirm_stop: true });
  assert.equal(runner.state().active, false);
}

{
  const scheduled = [];
  const controller = { state: async () => ({ ok: true, program_approval: { granted: true }, current_wave: 11, verified_progress_percent: 55 }), tick: async () => ({ ok: true }) };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true, interval_ms: 30_000 },
    {
      controller,
      set_timeout: (fn, ms) => { scheduled.push({ fn, ms }); return { unref() {} }; },
      clear_timeout: () => {},
      run_loop: async () => ({ ok: true, status: 200, stop_reason: 'NONE', final_state: { current_wave: 11, verified_progress_percent: 55 } })
    }
  );
  await runner.start({ confirm_run: true });
  await scheduled.shift().fn();
  assert.equal(runner.state().active, true, 'NONE is idle, not terminal, so later audit work can be picked up without a service restart');
  assert.equal(scheduled.length, 1, 'NONE schedules the next bounded poll');
  assert.equal(scheduled[0].ms, 30_000);
  runner.stop({ confirm_stop: true });
}

{
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const controller = { state: async () => ({ ok: true, program_approval: { granted: true } }), tick: async () => ({ ok: true }) };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true },
    {
      controller,
      set_timeout: () => ({ unref() {} }), clear_timeout: () => {},
      run_loop: async () => { await pending; return { ok: true, stop_reason: 'WAIT', final_state: {} }; }
    }
  );
  await runner.start({ confirm_run: true });
  const first = runner.run_once();
  await Promise.resolve();
  const duplicate = await runner.run_once();
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'JARVIS_PROGRAM_RUNNER_CYCLE_IN_FLIGHT');
  assert.equal(duplicate.duplicate_guard, true);
  release();
  await first;
}

{
  const controller = { state: async () => ({ ok: true, program_approval: { granted: true } }), tick: async () => ({ ok: true }) };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true },
    {
      controller,
      set_timeout: () => ({ unref() {} }), clear_timeout: () => {},
      run_loop: async () => ({ ok: true, stop_reason: 'AUTONOMY_PAUSED', final_state: { current_wave: 7, verified_progress_percent: 63 } })
    }
  );
  await runner.start({ confirm_run: true });
  const result = await runner.run_once();
  assert.equal(result.ok, true);
  assert.equal(result.stop_reason, 'AUTONOMY_PAUSED');
  assert.equal(runner.state().active, false, 'terminal safety stop suspends the runner');
}

{
  const controller = { state: async () => ({ ok: true, program_approval: { granted: false } }), tick: async () => ({ ok: true }) };
  let loopCalled = false;
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true },
    { controller, set_timeout: () => ({ unref() {} }), clear_timeout: () => {}, run_loop: async () => { loopCalled = true; return { ok: true }; } }
  );
  await runner.start({ confirm_run: true });
  const result = await runner.run_once();
  assert.equal(result.stop_reason, 'PROGRAM_APPROVAL_REQUIRED');
  assert.equal(loopCalled, false, 'no Program Approval means the bounded loop is never entered');
  assert.equal(runner.state().active, false);
}


// BLOCKED_OPERATOR may ask the trusted recoverer regardless of presentation-level
// wave_reason. The recoverer itself owns the durable evidence gate.
{
  let recoveryCalls = 0;
  const controller = { state: async () => ({ ok: true, program_approval: { granted: true } }), tick: async () => ({ ok: true }) };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true },
    {
      controller,
      set_timeout: () => ({ unref() {} }), clear_timeout: () => {},
      run_loop: async () => ({ ok: true, stop_reason: 'BLOCKED_OPERATOR', final_state: { current_wave: 11, wave_reason: 'UNKNOWN', verified_progress_percent: 55 } }),
      trusted_candidate_recoverer: { recover: async () => { recoveryCalls += 1; return { ok: true, request_id: 'trusted-fixture' }; } }
    }
  );
  await runner.start({ confirm_run: true });
  const result = await runner.run_once();
  assert.equal(recoveryCalls, 1, 'BLOCKED_OPERATOR asks the strict trusted recoverer even when wave_reason rendering differs');
  assert.equal(result.ok, true);
  assert.equal(result.stop_reason, 'TRUSTED_CANDIDATE_RECOVERED');
}

// An ineligible candidate is not promoted and does not turn an ordinary blocked
// operator state into a recovery-system failure.
{
  let recoveryCalls = 0;
  const controller = { state: async () => ({ ok: true, program_approval: { granted: true } }), tick: async () => ({ ok: true }) };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true },
    {
      controller,
      set_timeout: () => ({ unref() {} }), clear_timeout: () => {},
      run_loop: async () => ({ ok: true, stop_reason: 'BLOCKED_OPERATOR', final_state: { current_wave: 11, wave_reason: 'OTHER_BLOCK', verified_progress_percent: 55 } }),
      trusted_candidate_recoverer: { recover: async () => { recoveryCalls += 1; return { ok: false, status: 409, error: 'TRUSTED_CANDIDATE_RECOVERY_INELIGIBLE', reason: 'REPAIR_BUDGET_NOT_EXHAUSTED' }; } }
    }
  );
  await runner.start({ confirm_run: true });
  const result = await runner.run_once();
  assert.equal(recoveryCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.stop_reason, 'BLOCKED_OPERATOR');
  assert.equal(runner.state().active, false, 'ordinary blocked state remains fail-closed when recovery is ineligible');
}

// Infrastructure failures inside the recoverer remain hard failures.
{
  const controller = { state: async () => ({ ok: true, program_approval: { granted: true } }), tick: async () => ({ ok: true }) };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true },
    {
      controller,
      set_timeout: () => ({ unref() {} }), clear_timeout: () => {},
      run_loop: async () => ({ ok: true, stop_reason: 'BLOCKED_OPERATOR', final_state: { current_wave: 11, wave_reason: 'UNKNOWN', verified_progress_percent: 55 } }),
      trusted_candidate_recoverer: { recover: async () => ({ ok: false, status: 503, error: 'TRUSTED_CANDIDATE_RECOVERY_STORE_REQUIRED' }) }
    }
  );
  await runner.start({ confirm_run: true });
  const result = await runner.run_once();
  assert.equal(result.ok, false);
  assert.equal(result.error, 'JARVIS_TRUSTED_CANDIDATE_RECOVERY_FAILED');
  assert.equal(runner.state().active, false);
}


// Restart with a dirty tree probes strict candidate recovery before publication.
{
  const scheduled = [];
  let candidateRecovered = false;
  let candidateCalls = 0;
  let publicationCalls = 0;
  const controller = {
    state: async () => candidateRecovered
      ? { ok: true, program_approval: { granted: true }, current_wave: 11, verified_progress_percent: 55, wave_state: 'READY', next_action: { action: 'ACCEPT_WAVE' }, branch_truth: { working_tree_clean: false } }
      : { ok: true, program_approval: { granted: true }, current_wave: 11, verified_progress_percent: 55, wave_state: 'BLOCKED_OPERATOR', wave_reason: 'WORKING_TREE_DIRTY', next_action: { action: 'PROPOSE_WAVE_TASK' }, branch_truth: { working_tree_clean: false } },
    tick: async () => ({ ok: true })
  };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true, require_recovery: true },
    {
      controller,
      memory_store: { readAudit: async () => [], appendAudit: async () => ({ ok: true }) },
      trusted_candidate_recoverer: { recover: async () => { candidateCalls += 1; candidateRecovered = true; return { ok: true, request_id: 'trusted-startup-fixture' }; } },
      publisher: { publish: async () => { publicationCalls += 1; return { ok: true, commit: 'should-not-run' }; } },
      set_timeout: (fn, ms) => { scheduled.push({ fn, ms }); return { unref() {} }; }, clear_timeout: () => {}
    }
  );
  const started = await runner.start({ confirm_run: true });
  assert.equal(started.ok, true);
  assert.equal(candidateCalls, 1, 'startup dirty tree asks trusted recovery first');
  assert.equal(publicationCalls, 0, 'unaccepted candidate is never published before trusted recovery');
  assert.equal(scheduled.length, 1);
  runner.stop({ confirm_stop: true });
}

// If strict candidate recovery is ineligible, established accepted-work
// publication remains the fallback and restart behavior is preserved.
{
  const scheduled = [];
  let published = false;
  let candidateCalls = 0;
  let publicationCalls = 0;
  const controller = {
    state: async () => published
      ? { ok: true, program_approval: { granted: true }, current_wave: 12, verified_progress_percent: 60, wave_state: 'READY', next_action: { action: 'PROPOSE_WAVE_TASK' }, branch_truth: { working_tree_clean: true } }
      : { ok: true, program_approval: { granted: true }, current_wave: 11, verified_progress_percent: 55, wave_state: 'BLOCKED_OPERATOR', wave_reason: 'WORKING_TREE_DIRTY', next_action: { action: 'PROPOSE_WAVE_TASK' }, branch_truth: { working_tree_clean: false } },
    tick: async () => ({ ok: true })
  };
  const runner = createJarvisProgramRunnerV1(
    { ...REQUEST, enabled: true, require_recovery: true },
    {
      controller,
      memory_store: { readAudit: async () => [], appendAudit: async () => ({ ok: true }) },
      trusted_candidate_recoverer: { recover: async () => { candidateCalls += 1; return { ok: false, status: 409, error: 'TRUSTED_CANDIDATE_RECOVERY_INELIGIBLE', reason: 'WAVE_ALREADY_ACCEPTED' }; } },
      publisher: { publish: async () => { publicationCalls += 1; published = true; return { ok: true, commit: 'accepted-fixture' }; } },
      set_timeout: (fn, ms) => { scheduled.push({ fn, ms }); return { unref() {} }; }, clear_timeout: () => {}
    }
  );
  const started = await runner.start({ confirm_run: true });
  assert.equal(started.ok, true);
  assert.equal(candidateCalls, 1);
  assert.equal(publicationCalls, 1, 'accepted work still publishes after candidate probe declines');
  assert.equal(scheduled.length, 1);
  runner.stop({ confirm_stop: true });
}

const man = jarvisProgramRunnerManifestV1();
assert.equal(man.capability_enabled_by_default, false);
assert.equal(man.explicit_start_confirmation_required, true);
assert.equal(man.recursive_single_flight_scheduler, true);
assert.equal(man.none_keeps_scheduler_active, true);
assert.equal(man.durable_recovery_supported, true);
assert.equal(man.overlapping_cycles_ever, false);
assert.equal(man.grants_program_approval_ever, false);
assert.equal(man.invents_wave_task_ever, false);
assert.equal(man.production_deploy, false);
assert.equal(man.hamyren_data_flow, false);

console.log('JARVIS Program Runner V1 smoke: PASS');
