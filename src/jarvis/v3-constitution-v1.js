/* JARVIS Capability Expansion V3 Constitution V1.1.
   Machine-checkable companion to the binding V3 contract.
   Pure data and pure functions only. It grants no permission and performs no I/O. */

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

export const JARVIS_V3_CONSTITUTION_SCHEMA = 'aurentara.jarvis.v3-constitution.v1.1';
export const JARVIS_V3_PROGRAM = 'JARVIS_CAPABILITY_EXPANSION_V3';
export const JARVIS_V3_TOTAL_WAVES = 26;
export const JARVIS_V3_PHASE_A_WAVE_WEIGHT_PERCENT = 5;
export const JARVIS_V3_POST_GATE_WAVE_WEIGHT_PERCENT = 3;
export const JARVIS_V3_WAVE_WEIGHTS = Object.freeze([...Array(11).fill(5), ...Array(15).fill(3)]);
export const JARVIS_V3_AUTONOMOUS_PHASE_A_LAST_WAVE = 10;
export const JARVIS_V3_FIRST_HUMAN_GATE_WAVE = 11;

const ROADMAP = Object.freeze([
  Object.freeze({ wave_index: 0, id: 'v3-wave-0-contract-constitution', title: 'V3 Contract + Constitution', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 1, id: 'v3-wave-1-skill-registry', title: 'Skill Registry V1', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 2, id: 'v3-wave-2-skill-runtime', title: 'Skill Runtime V1', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 3, id: 'v3-wave-3-skill-permission-engine', title: 'Skill Permission Engine', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 4, id: 'v3-wave-4-memory-model', title: 'Memory Model V1', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 5, id: 'v3-wave-5-memory-ingestion', title: 'Memory Ingestion V1', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 6, id: 'v3-wave-6-memory-retrieval-context', title: 'Memory Retrieval + Context Compiler', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 7, id: 'v3-wave-7-memory-governance', title: 'Memory Governance', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 8, id: 'v3-wave-8-connector-core', title: 'Connector Core V1', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 9, id: 'v3-wave-9-unified-action-plane', title: 'Connector Pack + Unified Action Plane', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 10, id: 'v3-wave-10-autonomy-readiness', title: '24/7 Readiness V1', phase: 'PHASE_A' }),
  Object.freeze({ wave_index: 11, id: 'v3-wave-11-phase-b-authorization-v3-1', title: 'Phase B Authorization + Constitution Amendment V3.1', phase: 'HUMAN_GATE' }),
  Object.freeze({ wave_index: 12, id: 'v3-wave-12-connector-live-read', title: 'Connector Live Read Activation', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 13, id: 'v3-wave-13-connector-live-write', title: 'Connector Live Write Activation', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 14, id: 'v3-wave-14-scheduled-autonomous-cycles', title: 'Scheduled Autonomous Cycles', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 15, id: 'v3-wave-15-cross-skill-orchestration', title: 'Cross-Skill Orchestration', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 16, id: 'v3-wave-16-personal-context-fusion', title: 'Personal Context Fusion', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 17, id: 'v3-wave-17-observability-alerting', title: 'Observability + Alerting', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 18, id: 'v3-wave-18-failure-matrix-hardening', title: 'Failure Matrix + Safety Hardening V3', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 19, id: 'v3-wave-19-infrastructure-seal', title: 'Phase B Infrastructure Seal', phase: 'PHASE_B' }),
  Object.freeze({ wave_index: 20, id: 'v3-wave-20-voice-input', title: 'Voice Input', phase: 'PHASE_C' }),
  Object.freeze({ wave_index: 21, id: 'v3-wave-21-voice-output', title: 'Voice Output', phase: 'PHASE_C' }),
  Object.freeze({ wave_index: 22, id: 'v3-wave-22-realtime-voice-command-center', title: 'Realtime Voice Loop + Command Center UX', phase: 'PHASE_C' }),
  Object.freeze({ wave_index: 23, id: 'v3-wave-23-proactive-signal-attention', title: 'Proactive Signal + Attention Engine', phase: 'PHASE_C' }),
  Object.freeze({ wave_index: 24, id: 'v3-wave-24-proactive-operator', title: 'Proactive Operator', phase: 'PHASE_C' }),
  Object.freeze({ wave_index: 25, id: 'v3-wave-25-final-completion-seal', title: 'Autonomous E2E + Final Completion Seal', phase: 'PHASE_C' })
]);

export const JARVIS_V3_SAFETY_DENYLIST = Object.freeze([
  'MAIN_MASTER_MUTATION', 'MERGE', 'PUSH', 'FORCE_PUSH', 'DEPLOY',
  'PRODUCTION_ACTIVATION', 'PUBLIC_RELEASE', 'DNS_MUTATION', 'CLOUDFLARE_MUTATION',
  'BILLING', 'DESTRUCTIVE_DB', 'HAMYREN_DATA_FLOW',
  'UNAPPROVED_EXTERNAL_NETWORK_CALL', 'UNAPPROVED_ACCOUNT_CONNECTION', 'UNAPPROVED_EXTERNAL_WRITE',
  'WORKER_SECRET_ACCESS', 'SECRET_OUTPUT', 'CREDENTIAL_EXFILTRATION', 'SELF_GRANTED_PERMISSION'
]);

export const JARVIS_V3_POST_GATE_CAPABILITIES = Object.freeze([
  'OPERATOR_AUTHORIZED_EXTERNAL_READ',
  'OPERATOR_AUTHORIZED_ACCOUNT_CONNECTION',
  'APPROVAL_GATED_EXTERNAL_WRITE'
]);

export function isJarvisV3ForbiddenCapabilityV1(capability) {
  return JARVIS_V3_SAFETY_DENYLIST.includes(clean(capability, 80).toUpperCase());
}

export function getJarvisV3RoadmapEntryV1(waveIndex) {
  const idx = Number(waveIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= JARVIS_V3_TOTAL_WAVES) return null;
  const entry = ROADMAP[idx];
  return entry ? { ...entry } : null;
}

export function computeJarvisV3PhaseV1(waveIndex) {
  return getJarvisV3RoadmapEntryV1(waveIndex)?.phase || null;
}

export function isJarvisV3HumanGateClearedV1(completedWaves = []) {
  return Array.isArray(completedWaves) && completedWaves.includes(JARVIS_V3_FIRST_HUMAN_GATE_WAVE);
}

export function isJarvisV3PostGateReachableV1(waveIndex, { human_gate_cleared } = {}) {
  const entry = getJarvisV3RoadmapEntryV1(waveIndex);
  if (!entry) return false;
  if (entry.wave_index <= JARVIS_V3_FIRST_HUMAN_GATE_WAVE) return true;
  return human_gate_cleared === true;
}

export function isJarvisV3PhaseBReachableV1(waveIndex, options = {}) {
  return isJarvisV3PostGateReachableV1(waveIndex, options);
}

export function evaluateJarvisV3PermissionGrantV1({ actor_type, capability, human_gate_cleared = false } = {}) {
  const cap = clean(capability, 80).toUpperCase();
  if (isJarvisV3ForbiddenCapabilityV1(cap)) return { granted: false, reason: 'CONSTITUTIONALLY_FORBIDDEN' };
  if (JARVIS_V3_POST_GATE_CAPABILITIES.includes(cap) && human_gate_cleared !== true) {
    return { granted: false, reason: 'HUMAN_GATE_NOT_CLEARED' };
  }
  if (clean(actor_type, 40).toUpperCase() !== 'OPERATOR') {
    return { granted: false, reason: 'ONLY_OPERATOR_MAY_GRANT_NEVER_SELF' };
  }
  return { granted: true, reason: 'OPERATOR_ELIGIBLE' };
}

export function jarvisV3ConstitutionManifestV1() {
  return {
    schema: JARVIS_V3_CONSTITUTION_SCHEMA,
    program: JARVIS_V3_PROGRAM,
    total_waves: JARVIS_V3_TOTAL_WAVES,
    wave_weights: [...JARVIS_V3_WAVE_WEIGHTS],
    phase_a_wave_weight_percent: JARVIS_V3_PHASE_A_WAVE_WEIGHT_PERCENT,
    post_gate_wave_weight_percent: JARVIS_V3_POST_GATE_WAVE_WEIGHT_PERCENT,
    total_weight_percent: JARVIS_V3_WAVE_WEIGHTS.reduce((sum, weight) => sum + weight, 0),
    autonomous_phase_a_last_wave: JARVIS_V3_AUTONOMOUS_PHASE_A_LAST_WAVE,
    first_human_gate_wave: JARVIS_V3_FIRST_HUMAN_GATE_WAVE,
    roadmap: ROADMAP.map((entry) => ({ ...entry })),
    safety_denylist: [...JARVIS_V3_SAFETY_DENYLIST],
    post_gate_capabilities: [...JARVIS_V3_POST_GATE_CAPABILITIES],
    self_grant_allowed: false,
    unapproved_external_calls_allowed: false,
    unapproved_account_connections_allowed: false,
    unapproved_external_writes_allowed: false,
    operator_authorized_post_gate_reads_possible: true,
    operator_authorized_post_gate_account_connections_possible: true,
    approval_gated_external_writes_possible: true,
    w11_external_effects_allowed: false,
    production_actions_allowed: false,
    public_actions_allowed: false,
    dns_actions_allowed: false,
    cloudflare_actions_allowed: false,
    billing_actions_allowed: false,
    secret_output_allowed: false,
    hamyren_data_flow: false,
    merge_allowed: false,
    push_allowed: false,
    deploy_allowed: false,
    pure: true,
    mutable_state: false
  };
}
