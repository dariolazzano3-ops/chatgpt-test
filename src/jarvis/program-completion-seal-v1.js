/* JARVIS V2 Completion Seal V1 — pure, read-only pre-Wave-12 closure gate. */
import { computeJarvisV2ProgressV1, JARVIS_V2_PROGRAM_ID, JARVIS_V2_WAVE_WEIGHTS } from './v2-progress-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const PRE_SEAL_WAVES = Object.freeze(Array.from({ length: 12 }, (_, i) => i));
const UNSAFE_CONTROLLER_STATES = new Set(['BLOCKED_OPERATOR', 'FAILED', 'EXECUTING', 'VERIFYING', 'REPAIRING', 'ACCEPTING']);

function progressRows(audit = []) {
  return (Array.isArray(audit) ? audit : [])
    .filter((row) => row?.action === 'IMPLEMENTATION_MISSION')
    .filter((row) => clean(row?.result?.program, 80).toUpperCase() === JARVIS_V2_PROGRAM_ID)
    .map((row) => ({
      wave_index: row?.result?.wave_index,
      wave_state: row?.result?.wave_state,
      independent_acceptance: row?.result?.independent_acceptance === true,
      acceptance_ref: clean(row?.result?.acceptance_ref || row?.result?.independent_acceptance_ref, 240) || null,
      at: clean(row?.occurred_at || row?.timestamp, 80),
      evidence_ref: clean(row?.result?.evidence_id, 300) || null
    }));
}

export function evaluateJarvisV2CompletionSealV1({ audit = [], controller_state = null } = {}) {
  const progress = computeJarvisV2ProgressV1(progressRows(audit));
  const completed = progress.completed_waves;
  const exactPreSeal = PRE_SEAL_WAVES.every((wave) => completed.includes(wave)) && !completed.includes(12);
  const state = controller_state;
  if (!exactPreSeal) return { ok: false, status: 'BLOCKED', reason: 'WAVES_0_11_NOT_EXACTLY_ACCEPTED', progress };
  if (Number(progress.verified_progress_percent) !== 96) return { ok: false, status: 'BLOCKED', reason: 'PRE_SEAL_PROGRESS_NOT_96', progress };
  if (progress.blocked_wave !== null) return { ok: false, status: 'BLOCKED', reason: 'BLOCKED_WAVE_PRESENT', progress };
  if (!state || state.ok !== true) return { ok: false, status: 'BLOCKED', reason: 'CONTROLLER_STATE_UNAVAILABLE', progress };
  if (Number(state.current_wave) !== 12 || Number(state.verified_progress_percent) !== 96) {
    return { ok: false, status: 'BLOCKED', reason: 'CONTROLLER_PROGRESS_MISMATCH', progress, controller_state: state };
  }
  if (UNSAFE_CONTROLLER_STATES.has(state.wave_state)) {
    return { ok: false, status: 'BLOCKED', reason: `CONTROLLER_STATE_UNSAFE:${state.wave_state}`, progress, controller_state: state };
  }
  const acceptedRefs = progressRows(audit)
    .filter((row) => PRE_SEAL_WAVES.includes(Number(row.wave_index)) && row.wave_state === 'COMPLETE' && row.independent_acceptance === true && row.acceptance_ref)
    .map((row) => row.acceptance_ref);
  if (new Set(acceptedRefs).size < 12) return { ok: false, status: 'BLOCKED', reason: 'ACCEPTANCE_REFS_INCOMPLETE', progress };
  return {
    ok: true, status: 'PASS', reason: null, schema: 'aurentara.jarvis.v2.completion-seal.v1',
    program: JARVIS_V2_PROGRAM_ID, pre_seal_progress_percent: 96,
    accepted_waves: [...PRE_SEAL_WAVES], next_wave: 12, acceptance_refs_verified: true,
    mutates_state: false, grants_acceptance: false, production_deploy: false, hamyren_data_flow: false
  };
}

export function jarvisV2CompletionSealManifestV1() {
  return {
    schema: 'aurentara.jarvis.v2.completion-seal.manifest.v1', program: JARVIS_V2_PROGRAM_ID,
    required_pre_seal_waves: [...PRE_SEAL_WAVES], required_pre_seal_progress_percent: 96,
    final_wave_index: JARVIS_V2_WAVE_WEIGHTS.length - 1, final_progress_percent: 100,
    read_only: true, grants_acceptance: false, mutates_state: false,
    requires_controller_truth: true, requires_independent_acceptance_refs: true,
    production_deploy: false, hamyren_data_flow: false
  };
}
