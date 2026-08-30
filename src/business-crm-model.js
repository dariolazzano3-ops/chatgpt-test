export const CRM_CORE_ENTITIES = Object.freeze([
  'projects', 'companies', 'contacts', 'leads', 'deals', 'pipelines', 'pipeline_stages',
  'activities', 'notes', 'tasks', 'events'
]);

export const CRM_PHYSICAL_TABLES = Object.freeze({
  projects: 'customer_projects',
  companies: 'companies',
  contacts: 'contacts',
  leads: 'leads',
  deals: 'deals',
  pipelines: 'pipelines',
  pipeline_stages: 'pipeline_stages',
  pipeline_transitions: 'pipeline_transitions',
  activities: 'activities',
  notes: 'notes',
  tasks: 'tasks',
  events: 'business_events',
  custom_field_definitions: 'custom_field_definitions',
  custom_field_values: 'custom_field_values',
  idempotency: 'idempotency_registry',
  audit: 'audit_log',
  observability: 'business_run_log'
});

export const CRM_AUDIT_ACTIONS = Object.freeze(['created', 'updated', 'transitioned', 'automated', 'failed']);

export const BUSINESS_EVENT_TYPES = Object.freeze([
  'lead_created', 'lead_qualified', 'deal_created', 'deal_stage_changed', 'form_submitted',
  'contact_created', 'automation_completed', 'activity_created', 'task_created',
  'ai_action_completed', 'status_changed'
]);

export function crmSchemaManifest() {
  return {
    schema: 'riosystems.crm-schema.v1',
    project_boundary: 'project_id',
    logical_entities: [...CRM_CORE_ENTITIES],
    physical_tables: { ...CRM_PHYSICAL_TABLES },
    compatibility: { projects: 'customer_projects is the existing canonical project registry; logical projects maps to it' },
    project_scoped_foreign_keys: true,
    row_level_security_required: true,
    anonymous_access: false,
    destructive_delete_default: false,
    custom_fields: { definitions: 'custom_field_definitions', values: 'custom_field_values', project_scoped: true },
    idempotency: { scope: ['project_id', 'idempotency_key'], registry: 'idempotency_registry' },
    audit: { table: 'audit_log', append_only_by_adapter: true },
    access: { current: 'single_operator', future_roles: ['operator', 'client_admin', 'client_viewer'] }
  };
}

export function validatePipelineDefinition(pipeline = {}) {
  const stages = Array.isArray(pipeline?.stages) ? pipeline.stages : [];
  if (!pipeline?.key || stages.length < 2) return { ok: false, error: 'CRM_PIPELINE_STAGES_REQUIRED' };
  const keys = stages.map((stage) => stage.key);
  if (new Set(keys).size !== keys.length || keys.some((key) => !key)) return { ok: false, error: 'CRM_PIPELINE_STAGE_KEYS_INVALID' };
  const terminal = stages.filter((stage) => stage.terminal === true);
  if (!terminal.length) return { ok: false, error: 'CRM_PIPELINE_TERMINAL_STAGE_REQUIRED' };
  for (const stage of stages) {
    for (const next of stage.allowed_next || []) {
      if (!keys.includes(next)) return { ok: false, error: 'CRM_PIPELINE_TRANSITION_TARGET_INVALID', stage: stage.key, target: next };
    }
  }
  return { ok: true };
}

export function isPipelineTransitionAllowed(pipeline, fromKey, toKey) {
  const checked = validatePipelineDefinition(pipeline);
  if (!checked.ok) return checked;
  const stages = pipeline.stages;
  const from = stages.find((stage) => stage.key === fromKey);
  const to = stages.find((stage) => stage.key === toKey);
  if (!from || !to || from.terminal) return { ok: false, error: 'CRM_PIPELINE_TRANSITION_INVALID' };
  const allowed = from.allowed_next?.length ? from.allowed_next.includes(toKey) : to.position === from.position + 1;
  return allowed ? { ok: true, from: fromKey, to: toKey } : { ok: false, error: 'CRM_PIPELINE_TRANSITION_NOT_ALLOWED' };
}
