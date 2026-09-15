/* JARVIS — Generic Program Progress V1.
   Truth comes only from independently accepted audit rows for a known program. */

import { getJarvisProgramDefinitionV1 } from './program-catalog-v1.js';

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
export const JARVIS_PROGRAM_PROGRESS_STATES = Object.freeze(['NOT_STARTED', 'RUNNING', 'BLOCKED', 'FAILED', 'COMPLETE']);

export function computeJarvisProgramProgressV1(program, rows = []) {
  const definition = getJarvisProgramDefinitionV1(program);
  if (!definition) return { known_program: false, program: null, error: 'JARVIS_PROGRAM_UNKNOWN' };
  const weights = definition.wave_weights;
  const byWave = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const idx = Number(row?.wave_index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= weights.length) continue;
    const at = clean(row.at, 80);
    const prior = byWave.get(idx);
    if (!prior || (at && Date.parse(at) >= Date.parse(prior.at || 0))) byWave.set(idx, { ...row, at });
  }

  let percent = 0;
  const completedWaves = [];
  const evidenceRefs = [];
  let blockedWave = null;
  let updatedAt = null;
  for (let idx = 0; idx < weights.length; idx++) {
    const row = byWave.get(idx);
    if (!row) continue;
    if (row.at && (!updatedAt || Date.parse(row.at) > Date.parse(updatedAt))) updatedAt = row.at;
    const state = JARVIS_PROGRAM_PROGRESS_STATES.includes(row.wave_state) ? row.wave_state : null;
    const acceptanceRef = clean(row.acceptance_ref, 240);
    const accepted = state === 'COMPLETE' && row.independent_acceptance === true && Boolean(acceptanceRef);
    if (accepted) {
      percent += weights[idx];
      completedWaves.push(idx);
      const ref = clean(row.evidence_ref, 300);
      if (ref) evidenceRefs.push(ref);
    } else if (state === 'BLOCKED' && blockedWave === null) blockedWave = idx;
  }

  let currentWave = weights.length - 1;
  for (let idx = 0; idx < weights.length; idx++) {
    if (!completedWaves.includes(idx)) { currentWave = idx; break; }
  }
  return {
    known_program: true,
    program: definition.program,
    evidence_present: byWave.size > 0,
    current_wave: currentWave,
    completed_waves: completedWaves,
    blocked_wave: blockedWave,
    verified_progress_percent: Math.round(percent * 100) / 100,
    updated_at: updatedAt,
    evidence_refs: [...new Set(evidenceRefs)],
    wave_count: weights.length
  };
}

export function jarvisProgramProgressManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-progress.v1',
    source: 'OWNER_SCOPED_AUDIT_INDEPENDENT_ACCEPTANCE_ONLY',
    worker_self_report_counts: false,
    elapsed_time_counts: false,
    run_count_counts: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
