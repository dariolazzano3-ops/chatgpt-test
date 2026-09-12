/* JARVIS — Wave Task Planner V1.

   Proposes the current wave's task purely mechanically, from
   wave-registry-v1.js, for use by the Program Controller's
   PROPOSE_WAVE_TASK step ONLY when no operator-supplied task exists for the
   current wave. Precedence is fixed and enforced by the caller
   (program-controller-v1.js), not here: an operator-supplied task ALWAYS
   wins; this module is consulted only as the fallback, and it never invents
   anything the registry does not already say — see wave-registry-v1.js's
   header for why reading a fixed, checked-in table is not fabrication.

   Pure. No I/O, no randomness, no clock. */

import { getJarvisWaveRegistryEntryV1, isJarvisWaveDependencySatisfiedV1 } from './wave-registry-v1.js';

/** Pure. Returns { title, goal, program, wave_index, source, registry_id }
 *  or null when this wave has no registered task yet, or its dependencies
 *  are not all independently accepted yet — never a guess in either case. */
export function proposeJarvisWaveTaskV1({ program, waveIndex, completedWaves = [] } = {}) {
  const entry = getJarvisWaveRegistryEntryV1(program, waveIndex);
  if (!entry) return null;
  if (!isJarvisWaveDependencySatisfiedV1(entry, completedWaves)) return null;
  return {
    title: entry.title,
    goal: entry.goal,
    program: String(program ?? '').trim().toUpperCase(),
    wave_index: entry.wave_index,
    source: 'REGISTRY_PROPOSAL',
    registry_id: entry.id
  };
}

export function jarvisWaveTaskPlannerManifestV1() {
  return {
    schema: 'aurentara.jarvis.wave-task-planner.v1',
    operator_supplied_task_precedence: true,
    fabricates_task_text: false,
    reads_registry_only: true,
    pure: true
  };
}
