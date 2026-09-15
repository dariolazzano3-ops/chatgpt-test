import assert from 'node:assert/strict';
import { evaluateJarvisV2CompletionSealV1, jarvisV2CompletionSealManifestV1 } from '../src/jarvis/program-completion-seal-v1.js';
import { JARVIS_V2_PROGRAM_ID } from '../src/jarvis/v2-progress-v1.js';

function acceptedAudit(waves = Array.from({ length: 12 }, (_, i) => i)) {
  return waves.map((wave, i) => ({
    action: 'IMPLEMENTATION_MISSION',
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, i, 0)).toISOString(),
    result: {
      program: JARVIS_V2_PROGRAM_ID, wave_index: wave, wave_state: 'COMPLETE',
      independent_acceptance: true, acceptance_ref: `fixture-accept:${wave}`, evidence_id: `fixture-evidence:${wave}`
    }
  }));
}
const controllerState = {
  ok: true, current_wave: 12, verified_progress_percent: 96,
  wave_state: 'PENDING', wave_reason: 'NO_MISSION_DISPATCHED_YET', next_action: { action: 'PROPOSE_WAVE_TASK' }
};

const pass = evaluateJarvisV2CompletionSealV1({ audit: acceptedAudit(), controller_state: controllerState });
assert.equal(pass.ok, true, JSON.stringify(pass));
assert.equal(pass.status, 'PASS');
assert.deepEqual(pass.accepted_waves, Array.from({ length: 12 }, (_, i) => i));
assert.equal(pass.next_wave, 12);
assert.equal(pass.mutates_state, false);
assert.equal(pass.grants_acceptance, false);
const missing = evaluateJarvisV2CompletionSealV1({ audit: acceptedAudit().slice(0, 11), controller_state: controllerState });
assert.equal(missing.ok, false);
assert.equal(missing.reason, 'WAVES_0_11_NOT_EXACTLY_ACCEPTED');

const workerOnly = acceptedAudit();
workerOnly[11] = {
  action: 'IMPLEMENTATION_MISSION', timestamp: '2026-01-01T00:20:00Z',
  result: { program: JARVIS_V2_PROGRAM_ID, wave_index: 11, wave_state: 'COMPLETE', independent_acceptance: false, acceptance_ref: null }
};
const workerFail = evaluateJarvisV2CompletionSealV1({ audit: workerOnly, controller_state: controllerState });
assert.equal(workerFail.ok, false);
assert.equal(workerFail.reason, 'WAVES_0_11_NOT_EXACTLY_ACCEPTED');

const unsafe = evaluateJarvisV2CompletionSealV1({ audit: acceptedAudit(), controller_state: { ...controllerState, wave_state: 'BLOCKED_OPERATOR' } });
assert.equal(unsafe.ok, false);
assert.match(unsafe.reason, /CONTROLLER_STATE_UNSAFE/);

const manifest = jarvisV2CompletionSealManifestV1();
assert.equal(manifest.required_pre_seal_progress_percent, 96);
assert.equal(manifest.final_wave_index, 12);
assert.equal(manifest.final_progress_percent, 100);
assert.equal(manifest.read_only, true);
assert.equal(manifest.grants_acceptance, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.hamyren_data_flow, false);
console.log('JARVIS Program Completion Seal V1 smoke: PASS');
