/* JARVIS — Wave Registry V1.

   A deterministic, statically-authored table of what each wave of
   JARVIS_MASTERARCHITECTURE_V2 is FOR (title + goal + dependency), matching
   docs/jarvis/v2/JARVIS_MASTERARCHITECTURE_V2_CONTRACT.md §11. This is NOT a
   place for the Program Controller (or anything else) to invent wave
   content at runtime — it is the opposite: a fixed, reviewable, checked-in
   source of truth that the Wave Task Planner (wave-task-planner-v1.js) may
   read from mechanically, so a wave with no operator-supplied task can still
   propose the one, and only the one, task this file already commits to —
   never a guess computed on the fly. Amending what a wave contains means
   editing this file (a real, reviewed code change), never a runtime branch.

   Hard rules:
     - pure data + pure lookups only; no I/O, no randomness, no clock;
     - a wave not listed here has NO registry task — the planner falls back
       to AWAITING_OPERATOR_SUPPLIED_WAVE_TASK for it, exactly as before this
       module existed. Silence is correct until this file is deliberately
       amended with that wave's real, reviewed content — never filled in by
       guessing what a later wave "should" contain;
     - dependencies are explicit indices into this same registry; a wave's
       task is never proposable (see isJarvisWaveDependencySatisfiedV1) while
       any of its dependencies has not yet been independently accepted. */

export const JARVIS_WAVE_REGISTRY_PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';

// wave_index -> { id, title, goal, depends_on }. Only waves whose real,
// reviewed content is already decided belong here — see the file header.
// Weights for these indices are canonical in v2-progress-v1.js
// (JARVIS_V2_WAVE_WEIGHTS); this registry only ever describes the WORK, it
// never re-defines or re-derives the WEIGHT or the acceptance rule.
const REGISTRY = new Map([
  [0, {
    id: 'wave-0-contract',
    title: 'V2 Masterarchitecture Contract',
    goal: 'Author docs/jarvis/v2/JARVIS_MASTERARCHITECTURE_V2_CONTRACT.md: the binding V2 scope, accepted V1 baseline, target architecture, component boundaries, trust boundaries, worker contract, orchestration contract, evidence contract, recovery contract, safety constitution, and wave 0-12 acceptance model. Contract only — no implementation code in this wave.',
    depends_on: []
  }],
  [1, {
    id: 'wave-1-wave-registry-and-planner',
    title: 'Wave Registry + Wave Task Planner',
    goal: 'Add a deterministic, dependency-aware Wave Registry (src/jarvis/wave-registry-v1.js) and Wave Task Planner (src/jarvis/wave-task-planner-v1.js) for JARVIS_MASTERARCHITECTURE_V2, and wire the Planner into the Program Controller\'s PROPOSE_WAVE_TASK step: an operator-supplied task always takes precedence unchanged, and the automatic registry proposal is used ONLY when no task was supplied for the current wave. Never fabricate a task for a wave the registry does not define.',
    depends_on: [0]
  }]
]);

/** Pure. Returns the registry entry for one wave, or null if this wave has
 *  no registered task yet (never invented on the fly). */
export function getJarvisWaveRegistryEntryV1(program, waveIndex) {
  if (String(program ?? '').trim().toUpperCase() !== JARVIS_WAVE_REGISTRY_PROGRAM) return null;
  const idx = Number(waveIndex);
  if (!Number.isInteger(idx) || idx < 0) return null;
  const entry = REGISTRY.get(idx);
  if (!entry) return null;
  return { wave_index: idx, id: entry.id, title: entry.title, goal: entry.goal, depends_on: [...entry.depends_on] };
}

/** Pure. Are every one of this wave's dependencies already independently
 *  accepted (per `completedWaves`, e.g. v2-progress-v1.js's completed_waves)? */
export function isJarvisWaveDependencySatisfiedV1(entry, completedWaves = []) {
  if (!entry) return false;
  const done = new Set(Array.isArray(completedWaves) ? completedWaves : []);
  return entry.depends_on.every((dep) => done.has(dep));
}

export function jarvisWaveRegistryManifestV1() {
  const entries = [...REGISTRY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wave_index, e]) => ({ wave_index, id: e.id, title: e.title, depends_on: [...e.depends_on] }));
  return {
    schema: 'aurentara.jarvis.wave-registry.v1',
    program: JARVIS_WAVE_REGISTRY_PROGRAM,
    registered_waves: entries.map((e) => e.wave_index),
    entries,
    fabricates_undefined_waves: false,
    pure: true
  };
}
