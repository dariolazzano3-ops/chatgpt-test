/* JARVIS — Program Catalog V1.
   Immutable definitions for independently tracked JARVIS programs. */

const clean = (value, max = 100) => String(value ?? '').trim().slice(0, max).toUpperCase();

export const JARVIS_V2_PROGRAM_ID = 'JARVIS_MASTERARCHITECTURE_V2';
export const JARVIS_V3_PROGRAM_ID = 'JARVIS_CAPABILITY_EXPANSION_V3';

const DEFINITIONS = Object.freeze({
  [JARVIS_V2_PROGRAM_ID]: Object.freeze({
    program: JARVIS_V2_PROGRAM_ID,
    title: 'JARVIS Masterarchitecture V2',
    wave_weights: Object.freeze([5, 10, 10, 10, 10, 10, 8, 8, 10, 5, 6, 4, 4]),
    first_human_gate_wave: null,
    autonomous_phase_a_last_wave: null
  }),
  [JARVIS_V3_PROGRAM_ID]: Object.freeze({
    program: JARVIS_V3_PROGRAM_ID,
    title: 'JARVIS Capability Expansion V3',
    wave_weights: Object.freeze([...Array(11).fill(5), ...Array(15).fill(3)]),
    first_human_gate_wave: 11,
    autonomous_phase_a_last_wave: 10
  })
});

export function getJarvisProgramDefinitionV1(program) {
  const definition = DEFINITIONS[clean(program)] || null;
  if (!definition) return null;
  return {
    ...definition,
    wave_weights: [...definition.wave_weights]
  };
}

export function isKnownJarvisProgramV1(program) {
  return Boolean(DEFINITIONS[clean(program)]);
}

export function jarvisProgramCatalogManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-catalog.v1',
    programs: Object.keys(DEFINITIONS),
    v2_definition_preserved: true,
    v3_phase_a_last_wave: DEFINITIONS[JARVIS_V3_PROGRAM_ID].autonomous_phase_a_last_wave,
    v3_first_human_gate_wave: DEFINITIONS[JARVIS_V3_PROGRAM_ID].first_human_gate_wave,
    mutable_state: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
