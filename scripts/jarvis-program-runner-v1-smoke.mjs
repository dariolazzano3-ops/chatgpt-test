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

const man = jarvisProgramRunnerManifestV1();
assert.equal(man.capability_enabled_by_default, false);
assert.equal(man.explicit_start_confirmation_required, true);
assert.equal(man.recursive_single_flight_scheduler, true);
assert.equal(man.durable_recovery_supported, true);
assert.equal(man.overlapping_cycles_ever, false);
assert.equal(man.grants_program_approval_ever, false);
assert.equal(man.invents_wave_task_ever, false);
assert.equal(man.production_deploy, false);
assert.equal(man.hamyren_data_flow, false);

console.log('JARVIS Program Runner V1 smoke: PASS');
