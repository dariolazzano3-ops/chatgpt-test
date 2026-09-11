export const JARVIS_SCHEMA = 'aurentara.jarvis.personal-assistant.v1';

export const JARVIS_AUTONOMY = Object.freeze({
  READ_ONLY: 0,
  ADVISE: 1,
  PLAN_GENERATE: 2,
  PREPARE_ACTION: 3,
  SAFE_PERSONAL_ACTION: 4,
  APPROVAL_GATED_EXTERNAL_ACTION: 5
});

export const JARVIS_RISK = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

export const JARVIS_INTENTS = Object.freeze([
  'INFORMATION_REQUEST',
  'MEMORY_REQUEST',
  'STATUS_REQUEST',
  'SEARCH_REQUEST',
  'PLANNING_REQUEST',
  'TASK_REQUEST',
  'REMINDER_REQUEST',
  'CALENDAR_REQUEST',
  'EMAIL_REQUEST',
  'FILE_REQUEST',
  'PROJECT_REQUEST',
  'AUTOMATION_REQUEST',
  'DEVICE_REQUEST',
  'EXECUTION_REQUEST',
  'APPROVAL_REQUEST',
  'RESEARCH_REQUEST',
  'DECISION_SUPPORT_REQUEST',
  'IMPLEMENTATION_MISSION_REQUEST'
]);

export const JARVIS_DOMAINS = Object.freeze([
  'GENERAL',
  'PERSONAL_STATUS',
  'MEMORY',
  'REMINDER',
  'CALENDAR',
  'EMAIL',
  'TASKS',
  'FILES',
  'PROJECTS',
  'RESEARCH',
  'AUTOMATION',
  'SMART_HOME',
  'ENGINEERING'
]);

export const JARVIS_ACTIONS = Object.freeze({
  READ_PERSONAL_CONTEXT: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false, capability: 'personal_context.read' },
  READ_PERSONAL_MEMORY: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false, capability: 'personal_memory.read' },
  RESEARCH_WEB: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false, capability: 'web.search' },
  SEARCH_FILES: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false, capability: 'files.read' },
  READ_CALENDAR: { class: 'READ', risk: 'LOW', approval_required: false, external_write: false, capability: 'calendar.read' },
  DRAFT_EMAIL: { class: 'PREPARE', risk: 'LOW', approval_required: false, external_write: false, capability: 'email.draft' },
  PREPARE_CALENDAR_EVENT: { class: 'PREPARE', risk: 'LOW', approval_required: false, external_write: false, capability: 'calendar.prepare' },
  PREPARE_TASK: { class: 'PREPARE', risk: 'LOW', approval_required: false, external_write: false, capability: 'tasks.prepare' },
  CREATE_REMINDER: { class: 'PERSONAL_WRITE', risk: 'LOW', approval_required: true, external_write: true, capability: 'reminders.write' },
  CREATE_CALENDAR_EVENT: { class: 'PERSONAL_WRITE', risk: 'MEDIUM', approval_required: true, external_write: true, capability: 'calendar.write' },
  CREATE_TASK: { class: 'PERSONAL_WRITE', risk: 'MEDIUM', approval_required: true, external_write: true, capability: 'tasks.write' },
  SEND_EMAIL: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true, capability: 'email.send' },
  FILE_WRITE: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true, capability: 'files.write' },
  SMART_HOME_ACTION: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true, capability: 'devices.write' },
  // Explicit operator-dispatched engineering work (see engineering-mission-v1.js).
  // Never reached via the free-text intent resolver (intent-v1.js) — an
  // operator must call the dedicated /jarvis/api/engineering-mission route.
  IMPLEMENTATION_MISSION: { class: 'EXTERNAL_WRITE', risk: 'HIGH', approval_required: true, external_write: true, capability: 'engineering.mission' },
  FINANCIAL_ACTION: { class: 'BLOCKED', risk: 'CRITICAL', approval_required: true, external_write: true, capability: 'finance.write' }
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
    allow_memory_writeback: input.allow_memory_writeback === true,
    allow_sensitive_memory_writeback: input.allow_sensitive_memory_writeback === true,
    high_cost_threshold_eur: Number.isFinite(Number(input.high_cost_threshold_eur))
      ? Math.max(0, Number(input.high_cost_threshold_eur))
      : 1,
    financial_actions_enabled: false,
    production_actions_enabled: false,
    billing_actions_enabled: false,
    credential_actions_enabled: false,
    hamyren_connector_enabled: false
  };
}

export function jarvisContractsManifestV1() {
  return {
    schema: JARVIS_SCHEMA,
    codename: 'JARVIS',
    product_role: 'private_personal_operating_system',
    memory_namespace: 'jarvis.personal',
    hamyren_memory_access: false,
    hamyren_memory_write: false,
    shared_memory_with_hamyren: false,
    automatic_data_flow_to_hamyren: false,
    intents: [...JARVIS_INTENTS],
    domains: [...JARVIS_DOMAINS],
    actions: structuredClone(JARVIS_ACTIONS),
    autonomy_levels: { ...JARVIS_AUTONOMY },
    risk_levels: { ...JARVIS_RISK },
    default_policy: normalizeJarvisPolicy(),
    financial_actions_enabled: false,
    production_actions_enabled: false
  };
}
