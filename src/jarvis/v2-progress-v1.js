/* JARVIS — V2 compatibility progress projection.
   V2 remains sealed; generic multi-program logic lives in program-progress-v1.js. */

import { computeJarvisProgramProgressV1, JARVIS_PROGRAM_PROGRESS_STATES } from './program-progress-v1.js';
import { JARVIS_V2_PROGRAM_ID, getJarvisProgramDefinitionV1 } from './program-catalog-v1.js';

export { JARVIS_V2_PROGRAM_ID };
export const JARVIS_V2_WAVE_WEIGHTS = Object.freeze(getJarvisProgramDefinitionV1(JARVIS_V2_PROGRAM_ID).wave_weights);
export const JARVIS_V2_WAVE_STATES = JARVIS_PROGRAM_PROGRESS_STATES;

export function computeJarvisV2ProgressV1(rows = []) {
  const generic = computeJarvisProgramProgressV1(JARVIS_V2_PROGRAM_ID, rows);
  return {
    program: generic.evidence_present ? JARVIS_V2_PROGRAM_ID : null,
    current_wave: generic.current_wave,
    completed_waves: generic.completed_waves,
    blocked_wave: generic.blocked_wave,
    verified_progress_percent: generic.verified_progress_percent,
    updated_at: generic.updated_at,
    evidence_refs: generic.evidence_refs
  };
}

export function jarvisV2ProgressManifestV1() {
  return {
    schema: 'aurentara.jarvis.v2.progress.v1',
    program: JARVIS_V2_PROGRAM_ID,
    wave_weights: [...JARVIS_V2_WAVE_WEIGHTS],
    wave_count: JARVIS_V2_WAVE_WEIGHTS.length,
    total_weight: JARVIS_V2_WAVE_WEIGHTS.reduce((a, b) => a + b, 0),
    wave_states: JARVIS_V2_WAVE_STATES,
    progress_source: 'derived_from_owner_scoped_audit_log',
    generic_program_progress_core: true,
    infers_from_elapsed_time: false,
    infers_from_chat_activity: false,
    infers_from_run_count: false,
    infers_from_worker_claims: false,
    requires_independent_acceptance: true,
    worker_self_report_counts: false,
    fabricates_eta: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
