import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleJarvisHttpV1, jarvisHttpManifestV1 } from '../src/jarvis/http-v1.js';

const authorize = async () => ({
  ok: true,
  email: 'operator@example.invalid',
  operator_id: 'jarvis-operator:operator@example.invalid',
  authentication: 'CLOUDFLARE_ACCESS_JWT'
});

let starts = 0;
let stops = 0;
const runner = {
  state() {
    return {
      ok: true, status: 200, schema: 'aurentara.jarvis.program-runner-state.v1',
      capability_enabled: true, active: false, cycle_in_flight: false, cycle_count: 3,
      last_finished_at: '2026-09-15T02:00:00.000Z', last_stop_reason: 'WAIT',
      recovery_status: 'READY', recovery_reason: 'CONTROLLER_STATE_SAFE'
    };
  },
  async start(request) {
    if (request.confirm_run !== true) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_RUNNER_CONFIRM_RUN_REQUIRED' };
    starts += 1;
    return { ok: true, status: 200, started: true, state: this.state() };
  },
  stop(request) {
    if (request.confirm_stop !== true) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_RUNNER_CONFIRM_STOP_REQUIRED' };
    stops += 1;
    return { ok: true, status: 200, stopped: true, state: this.state() };
  },
  matches_scope() { return true; }
};

const options = { authorize, program_runner: runner };

{
  const response = await handleJarvisHttpV1(new Request('https://jarvis.invalid/jarvis/api/program/runner/state'), {}, {}, options);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.capability_enabled, true);
  assert.equal(body.cycle_count, 3);
}

{
  const response = await handleJarvisHttpV1(new Request('https://jarvis.invalid/jarvis/api/program/runner/start', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
  }), {}, {}, options);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, 'JARVIS_PROGRAM_RUNNER_CONFIRM_RUN_REQUIRED');
  assert.equal(starts, 0);
}

{
  const response = await handleJarvisHttpV1(new Request('https://jarvis.invalid/jarvis/api/program/runner/start', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm_run: true })
  }), {}, {}, options);
  assert.equal(response.status, 200);
  assert.equal(starts, 1);
}

{
  const response = await handleJarvisHttpV1(new Request('https://jarvis.invalid/jarvis/api/program/runner/stop', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm_stop: true })
  }), {}, {}, options);
  assert.equal(response.status, 200);
  assert.equal(stops, 1);
}

{
  const mismatch = await handleJarvisHttpV1(
    new Request('https://jarvis.invalid/jarvis/api/program/runner/state'), {}, {},
    { authorize, program_runner: { ...runner, matches_scope: () => false } }
  );
  assert.equal(mismatch.status, 403);
  assert.equal((await mismatch.json()).error, 'JARVIS_PROGRAM_RUNNER_OWNER_SCOPE_MISMATCH');
}

{
  const ui = fs.readFileSync(new URL('../src/jarvis/command-center-ui/jarvis-command-center.jsx', import.meta.url), 'utf8');
  assert.match(ui, /\/program\/runner\/state/);
  assert.match(ui, /\/program\/runner\/\$\{action\}/);
  assert.match(ui, /24\/7 Runner starten/);
  assert.match(ui, /Runner stoppen/);
  assert.match(ui, /Autonomie-Pause/);
  assert.match(ui, /runner\.capability_enabled/);
  assert.match(ui, /runner\.active/);
  assert.match(ui, /runner\.recovery_status/);
  assert.match(ui, /runner\.last_stop_reason/);
}

{
  const controller = fs.readFileSync(new URL('../src/jarvis/program-controller-v1.js', import.meta.url), 'utf8');
  assert.match(controller, /autonomy_paused:\s*isJarvisAutonomyPausedV1\(\)/);
  const man = jarvisHttpManifestV1();
  assert.equal(man.command_center_program_runner_state_route, '/jarvis/api/program/runner/state');
  assert.equal(man.command_center_program_runner_start_route, '/jarvis/api/program/runner/start');
  assert.equal(man.command_center_program_runner_stop_route, '/jarvis/api/program/runner/stop');
  assert.equal(man.command_center_program_runner_scope_checked, true);
  assert.equal(man.command_center_program_runner_explicit_confirmation_required, true);
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
}

console.log('JARVIS Command Center Autonomy V1 smoke: PASS');
