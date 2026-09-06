export const JARVIS_SCHEMA = 'aurentara.jarvis.personal-assistant.v1';

export const JARVIS_AUTONOMY = Object.freeze({
  READ_ONLY: 0,
  ADVISE: 1,
  PLAN_GENERATE: 2,
  PREPARE_ACTION: 3,
  SAFE_PERSONAL_ACTION: 4,
  APPROVAL_GATED_EXTERNAL_ACTION: 5
});

export const JARVIS_DOMAINS = Object.freeze([
  'GENERAL',
  'PERSONAL_STATUS',
  'REMINDER',
  'CALENDAR',
  'EMAIL',
  'TASKS',
  'FILES',
  'PROJECTS',
  'RESEARCH',
  'AUTOMATION',
  'SMART_HOME'
]);

export const JARVIS_ACTIONS = Object.freeze({
  READ_PERSONAL_CONTEXT: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false },
  RESEARCH_WEB: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false },
  DRAFT_EMAIL: { class: 'PREPARE', risk: 'LOW', approval_required: false, external_write: false },
  PREPARE_CALENDAR_EVENT: { class: 'PREPARE', risk: 'LOW', approval_required: false, external_write: false },
  PREPARE_TASK: { class: 'PREPARE', risk: 'LOW', approval_required: false, external_write: false },
  CREATE_REMINDER: { class: 'PERSONAL_WRITE', risk: 'MEDIUM', approval_required: true, external_write: true },
  CREATE_CALENDAR_EVENT: { class: 'PERSONAL_WRITE', risk: 'MEDIUM', approval_required: true, external_write: true },
  CREATE_TASK: { class: 'PERSONAL_WRITE', risk: 'MEDIUM', approval_required: true, external_write: true },
  SEND_EMAIL: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true },
  FILE_WRITE: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true },
  SMART_HOME_ACTION: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true },
  FINANCIAL_ACTION: { class: 'BLOCKED', risk: 'CRITICAL', approval_required: true, external_write: true }
});

export function normalizeJarvisPolicy(input = {}) {
  const raw = Number(input.autonomy_level);
  const autonomyLevel = Number.isInteger(raw) ? Math.max(0, Math.min(5, raw)) : JARVIS_AUTONOMY.ADVISE;
  return {
    autonomy_level: autonomyLevel,
    allow_sensitive_context: input.allow_sensitive_context === true,
    allow_personal_writes: input.allow_personal_writes === true,
    allow_external_writes: input.allow_external_writes === true,
    require_explicit_approval_for_writes: input.require_explicit_approval_for_writes !== false,
    financial_actions_enabled: false,
    production_actions_enabled: false,
    billing_actions_enabled: false,
    credential_actions_enabled: false
  };
}

export function jarvisContractsManifestV1() {
  return {
    schema: JARVIS_SCHEMA,
    codename: 'JARVIS',
    product_role: 'private_personal_assistant',
    memory_namespace: 'jarvis.personal',
    hamyren_memory_access: false,
    hamyren_memory_write: false,
    shared_memory_with_hamyren: false,
    automatic_data_flow_to_hamyren: false,
    domains: [...JARVIS_DOMAINS],
    actions: structuredClone(JARVIS_ACTIONS),
    autonomy_levels: { ...JARVIS_AUTONOMY },
    default_policy: normalizeJarvisPolicy(),
    financial_actions_enabled: false,
    production_actions_enabled: false
  };
}
