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
       any of its dependencies has not yet been independently accepted;
     - `expected_files` is the fixed, reviewed set of paths this wave's real
       work is allowed to touch, and `required_checks` is the fixed set of
       commands that must genuinely pass before this wave's work can be
       accepted. Both are consumed by commit-range-evidence-v1.js
       (independent, historical-commit-based acceptance evidence for work
       already implemented and committed before a live dispatch could
       observe it) — a commit's diff outside `expected_files`, or a wave
       whose `required_checks` do not actually pass right now, is never
       admissible evidence, however the diff was produced. Both belong ONLY
       here, in this fixed, reviewed file — never as a parameter a caller of
       the acceptance path can supply, which would let a caller weaken or
       skip its own verification. */

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
    depends_on: [],
    expected_files: ['docs/jarvis/v2/JARVIS_MASTERARCHITECTURE_V2_CONTRACT.md'],
    required_checks: [],
    generated_files: []
  }],
  [1, {
    id: 'wave-1-wave-registry-and-planner',
    title: 'Wave Registry + Wave Task Planner',
    goal: 'Add a deterministic, dependency-aware Wave Registry (src/jarvis/wave-registry-v1.js) and Wave Task Planner (src/jarvis/wave-task-planner-v1.js) for JARVIS_MASTERARCHITECTURE_V2, and wire the Planner into the Program Controller\'s PROPOSE_WAVE_TASK step: an operator-supplied task always takes precedence unchanged, and the automatic registry proposal is used ONLY when no task was supplied for the current wave. Never fabricate a task for a wave the registry does not define.',
    depends_on: [0],
    expected_files: [
      'src/jarvis/wave-registry-v1.js',
      'src/jarvis/wave-task-planner-v1.js',
      'src/jarvis/program-controller-v1.js',
      'scripts/jarvis-wave-registry-v1-smoke.mjs',
      'scripts/jarvis-program-controller-v1-smoke.mjs'
    ],
    required_checks: [
      { command: 'node', args: ['scripts/jarvis-wave-registry-v1-smoke.mjs'] },
      { command: 'node', args: ['scripts/jarvis-program-controller-v1-smoke.mjs'] }
    ],
    generated_files: []
  }],
  [2, {
    id: 'wave-2-command-center-program-controller',
    title: 'Program Controller in the Command Center',
    goal: 'Let the operator drive the already-accepted Program Controller (/api/program/state, /api/program/tick) from the existing Command Center instead of typing repo_dir/target_branch into curl by hand: real program-state display (Auftrag, Laufstatus, Ergebnis, Blocker), one explicit operator-triggered controller action, double-click/duplicate-dispatch protection, Program Approval/Budget shown with unknown values marked honestly, and no automatic start of further waves. No change to acceptance, approval, budget, or repair-attempt rules.',
    depends_on: [1],
    expected_files: [
      'scripts/jarvis-command-center-program-controller-v1-smoke.mjs',
      'src/jarvis/command-center-ui/bundle.built.js',
      'src/jarvis/command-center-ui/jarvis-command-center.jsx',
      'src/jarvis/command-center-v1.js',
      'src/jarvis/http-v1.js',
      'src/jarvis/local-operator-server-v1.js'
    ],
    required_checks: [
      { command: 'node', args: ['scripts/jarvis-command-center-program-controller-v1-smoke.mjs'] },
      { command: 'node', args: ['scripts/jarvis-local-operator-server-v1-smoke.mjs'] },
      { command: 'node', args: ['scripts/jarvis-command-center-orange-ui-v1-smoke.mjs'] }
    ],
    // Mechanically regenerated by `npm run jarvis:command-center:build`
    // FROM jarvis-command-center.jsx (which IS content-scanned) — a single,
    // giant minified line, never meaningfully reviewable line-by-line and
    // prone to incidental forbidden-pattern substring matches purely from
    // its size. Still required to appear in the commit's real diff (see
    // expected_files above) — only exempt from the content scan itself.
    generated_files: ['src/jarvis/command-center-ui/bundle.built.js']
  }],
  [3, {
    id: 'wave-3-program-approval-grant-revoke',
    title: 'Program Approval Grant/Revoke in the Command Center',
    goal: 'Let the operator grant and revoke Program Approval (the authorization that lets the Program Controller actually dispatch/accept for a program+repo+branch) directly from the Command Center, instead of a curl command — the last manual step before Wave 2\'s tick button can do anything on a fresh program/repo/branch. Adds a real handleJarvisProgramApprovalRevokeRuntimeV1 (program-approval-v1.js had grant only) and its /api/program/approve/revoke route, mirroring the existing grant handler/route exactly (same audit shape, same fail-closed rules, same distinct-explicit-operator-action requirement). No change to what capabilities are approvable (JARVIS_PROGRAM_APPROVAL_COVERABLE / _NEVER_COVERED untouched), no new scope invented, no automatic grant or revoke ever issued by the controller itself.',
    depends_on: [2],
    expected_files: [
      'scripts/jarvis-command-center-program-controller-v1-smoke.mjs',
      'scripts/jarvis-program-approval-v1-smoke.mjs',
      'src/jarvis/command-center-ui/bundle.built.js',
      'src/jarvis/command-center-ui/jarvis-command-center.jsx',
      'src/jarvis/http-v1.js',
      'src/jarvis/program-approval-v1.js'
    ],
    required_checks: [
      { command: 'node', args: ['scripts/jarvis-program-approval-v1-smoke.mjs'] },
      { command: 'node', args: ['scripts/jarvis-command-center-program-controller-v1-smoke.mjs'] },
      { command: 'node', args: ['scripts/jarvis-local-operator-server-v1-smoke.mjs'] },
      { command: 'node', args: ['scripts/jarvis-command-center-orange-ui-v1-smoke.mjs'] }
    ],
    // Same reasoning as Wave 2 — see its comment above.
    generated_files: ['src/jarvis/command-center-ui/bundle.built.js']
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
  return {
    wave_index: idx,
    id: entry.id,
    title: entry.title,
    goal: entry.goal,
    depends_on: [...entry.depends_on],
    expected_files: [...entry.expected_files],
    required_checks: entry.required_checks.map((c) => ({ command: c.command, args: [...c.args] })),
    generated_files: [...entry.generated_files]
  };
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
    .map(([wave_index, e]) => ({
      wave_index, id: e.id, title: e.title, depends_on: [...e.depends_on],
      expected_files: [...e.expected_files], required_checks_count: e.required_checks.length
    }));
  return {
    schema: 'aurentara.jarvis.wave-registry.v1',
    program: JARVIS_WAVE_REGISTRY_PROGRAM,
    registered_waves: entries.map((e) => e.wave_index),
    entries,
    fabricates_undefined_waves: false,
    pure: true
  };
}
