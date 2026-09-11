/* JARVIS — V2 progress projection V1.

   Truthful, non-inferred progress for JARVIS_MASTERARCHITECTURE_V2.

   Hard rules:
     - progress is NEVER derived from elapsed time, chat activity, run count,
       or a worker's own claim of success;
     - a wave contributes its weight ONLY when a row for it carries
       wave_state === 'COMPLETE' AND independent_acceptance === true AND a
       non-empty acceptance_ref — a worker (Claude Code bridge) self-reporting
       COMPLETE is never enough on its own (the bridge itself always sets
       independent_acceptance: false; see claude-code-bridge-v1.js);
     - BLOCKED / FAILED waves never add progress;
     - no program evidence at all -> verified_progress_percent = 0, current
       wave = 0, nothing blocked.

   This module is pure (no I/O). The one real caller is v2Progress() in
   command-center-read-bindings-v1.js, which supplies rows derived from the
   owner-scoped persisted JARVIS audit log — never fabricated here. */

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);

export const JARVIS_V2_PROGRAM_ID = 'JARVIS_MASTERARCHITECTURE_V2';

// Wave 0..12, canonical weights (sum = 100).
export const JARVIS_V2_WAVE_WEIGHTS = Object.freeze([5, 10, 10, 10, 10, 10, 8, 8, 10, 5, 6, 4, 4]);

export const JARVIS_V2_WAVE_STATES = Object.freeze(['NOT_STARTED', 'RUNNING', 'BLOCKED', 'FAILED', 'COMPLETE']);

/** Pure. `rows` are already-normalised { wave_index, wave_state,
 *  independent_acceptance, acceptance_ref, at, evidence_ref } entries for ONE
 *  program, most-authoritative-last order not assumed (this dedupes by
 *  latest `at` per wave_index itself). */
export function computeJarvisV2ProgressV1(rows = []) {
  const byWave = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const idx = Number(row?.wave_index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= JARVIS_V2_WAVE_WEIGHTS.length) continue;
    const at = clean(row.at, 80);
    const prior = byWave.get(idx);
    if (!prior || (at && Date.parse(at) >= Date.parse(prior.at || 0))) byWave.set(idx, { ...row, at });
  }

  let percent = 0;
  const completedWaves = [];
  const evidenceRefs = [];
  let blockedWave = null;
  let updatedAt = null;

  for (let idx = 0; idx < JARVIS_V2_WAVE_WEIGHTS.length; idx++) {
    const row = byWave.get(idx);
    if (!row) continue;
    if (row.at && (!updatedAt || Date.parse(row.at) > Date.parse(updatedAt))) updatedAt = row.at;

    const state = JARVIS_V2_WAVE_STATES.includes(row.wave_state) ? row.wave_state : null;
    const acceptanceRef = clean(row.acceptance_ref, 240);
    const independentlyAccepted = state === 'COMPLETE' && row.independent_acceptance === true && Boolean(acceptanceRef);

    if (independentlyAccepted) {
      percent += JARVIS_V2_WAVE_WEIGHTS[idx];
      completedWaves.push(idx);
      const ref = clean(row.evidence_ref, 300);
      if (ref) evidenceRefs.push(ref);
    } else if (state === 'BLOCKED' && blockedWave === null) {
      blockedWave = idx;
    }
  }

  let currentWave = JARVIS_V2_WAVE_WEIGHTS.length - 1;
  for (let idx = 0; idx < JARVIS_V2_WAVE_WEIGHTS.length; idx++) {
    if (!completedWaves.includes(idx)) { currentWave = idx; break; }
  }

  return {
    program: byWave.size ? JARVIS_V2_PROGRAM_ID : null,
    current_wave: currentWave,
    completed_waves: completedWaves,
    blocked_wave: blockedWave,
    verified_progress_percent: Math.round(percent * 100) / 100,
    updated_at: updatedAt,
    evidence_refs: [...new Set(evidenceRefs)]
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
