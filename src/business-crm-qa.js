import { CRM_CORE_ENTITIES, validatePipelineDefinition } from './business-crm-model.js';
import { analyticsMappingIsMinimized } from './business-crm-events.js';

export function runCrmQa(input = {}) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: ok === true, detail });
  const schema = input.schema || {};
  const logical = new Set(schema.logical_entities || []);
  add('schema_integrity', CRM_CORE_ENTITIES.every((entity) => logical.has(entity)), 'required CRM entities present');
  add('project_isolation', schema.project_boundary === 'project_id' && schema.project_scoped_foreign_keys === true && input.cross_project_rows === 0, 'project_id boundary and synthetic isolation proof');
  add('duplicate_protection', schema.idempotency?.scope?.join(':') === 'project_id:idempotency_key' && input.idempotent_replay === true, 'project-scoped idempotency');
  add('pipeline_validity', validatePipelineDefinition(input.pipeline || {}).ok, 'configurable stages and transitions');
  add('event_consistency', Array.isArray(input.events) && input.events.length > 0 && input.events.every((event) => event.project_id === input.project_id), 'business events remain project scoped');
  add('data_minimization', Array.isArray(input.analytics_mappings) && input.analytics_mappings.every((mapping) => analyticsMappingIsMinimized(mapping).ok && mapping.contains_direct_pii === false), 'PostHog mappings exclude direct PII');
  add('audit_integrity', Array.isArray(input.audit_entries) && input.audit_entries.length >= 3 && input.audit_entries.every((entry) => entry.project_id === input.project_id), 'created, transitioned and automated actions are auditable');
  add('staging_safety', input.safety?.production === false && input.safety?.real_customer_data === false && input.safety?.variable_cost_ceiling_eur === 0 && input.safety?.destructive_db_operations === false, 'hard safety posture intact');
  add('contracts', input.contracts?.automation?.ok === true && input.contracts?.ai?.ok === true && input.contracts?.web?.ok === true, 'Automation, AI and Web factory contracts generated');
  const failed = checks.filter((check) => !check.ok);
  return { ok: failed.length === 0, schema: 'riosystems.crm-qa.v1', checks, failed: failed.map((item) => item.name), status: failed.length ? 'FAILED' : 'PASSED' };
}

export function buildCrmDeliveryManifest(input = {}) {
  return {
    schema: 'riosystems.crm-delivery-manifest.v1',
    project: input.project,
    business_run_id: input.business_run_id,
    crm_schema: input.crm_schema,
    tables: input.crm_schema?.physical_tables || {},
    pipeline: input.pipeline,
    custom_fields: input.custom_fields || [],
    events: input.events || [],
    analytics: input.analytics || [],
    automation_hooks: input.automation_hooks || [],
    ai_contract: input.ai_contract || null,
    web_contract: input.web_contract || null,
    qa: input.qa || null,
    status: input.qa?.ok === true ? 'READY' : 'BLOCKED',
    deployment: {
      supabase_migration: 'deployment-ready; external apply requires fresh explicit approval',
      posthog: 'mapping-ready; external event write requires fresh explicit approval',
      production: false,
      variable_cost_ceiling_eur: 0
    }
  };
}
