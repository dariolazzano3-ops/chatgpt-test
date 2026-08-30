import { normalizeBusinessProjectContract } from './business-crm-contract.js';
import { crmSchemaManifest, CRM_PHYSICAL_TABLES, isPipelineTransitionAllowed } from './business-crm-model.js';
import { createBusinessEvent, mapBusinessEventToPostHog, businessObservabilityRecord } from './business-crm-events.js';
import { buildAutomationFactoryEnvelope, buildAiFactoryLeadInput, buildWebFactoryLeadContract } from './business-crm-contracts.js';
import { createInMemoryCrmAdapter } from './business-crm-adapter.js';
import { runCrmQa, buildCrmDeliveryManifest } from './business-crm-qa.js';

const clone = (value) => structuredClone(value ?? null);

export function businessCrmFactoryV1Manifest() {
  return {
    schema: 'riosystems.business-crm-factory.v1',
    engine: 'business-crm',
    providers: { backend: 'supabase', product_analytics: 'posthog' },
    capabilities: ['projects','companies','contacts','leads','deals','pipelines','activities','notes','tasks','custom_fields','business_events','analytics_mapping','idempotency','audit','qa','delivery'],
    contracts: ['automation_factory', 'ai_factory', 'web_factory'],
    staging_only: true,
    synthetic_test_data_only: true,
    production: false,
    real_customer_data: false,
    destructive_db_operations: false,
    variable_cost_ceiling_eur: 0
  };
}

export function buildBusinessCrmV1(input = {}) {
  const normalized = normalizeBusinessProjectContract(input);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    schema: 'riosystems.business-crm-blueprint.v1',
    mission: { schema: 'riosystems.business-crm-mission.v1', objective: 'build_operational_crm', project_id: normalized.contract.project_id, business: normalized.contract.business },
    contract: normalized.contract,
    crm_schema: crmSchemaManifest(),
    pipeline: clone(normalized.contract.sales_pipeline),
    custom_fields: clone(normalized.contract.custom_fields),
    providers: { backend: 'supabase', analytics: 'posthog' },
    external_writes: false,
    status: 'BLUEPRINT_READY'
  };
}

export async function runSyntheticCrmE2E(input = {}, options = {}) {
  const blueprint = buildBusinessCrmV1(input);
  if (!blueprint.ok) return blueprint;
  const projectId = blueprint.contract.project_id;
  const adapter = options.adapter || createInMemoryCrmAdapter();
  const businessRunId = options.business_run_id || `${projectId}:crm-v1:synthetic`;
  const trace = [];
  const observe = (operation, resource, status, validation = 'passed', error = null) => trace.push(businessObservabilityRecord({ business_run_id: businessRunId, project: projectId, operation, resource, provider: adapter.provider, status, side_effect: 'synthetic_memory_only', validation, error }));

  const project = await adapter.create(CRM_PHYSICAL_TABLES.projects, projectId, { id: `${projectId}-project`, slug: `${projectId}-staging`, display_name: blueprint.contract.business, environment: 'staging', synthetic: true });
  if (!project.ok) return { ok: false, error: project.error, trace };
  observe('create', 'project', 'completed');

  const company = await adapter.create(CRM_PHYSICAL_TABLES.companies, projectId, { external_ref: `${projectId}:company:001`, name: 'Synthetic Company', status: 'prospect', synthetic: true });
  const contact = await adapter.create(CRM_PHYSICAL_TABLES.contacts, projectId, { external_ref: `${projectId}:contact:001`, company_id: company.row.id, full_name: 'Synthetic Contact', email: 'synthetic@example.invalid', source: 'synthetic', synthetic: true });
  observe('create', 'company_contact', company.ok && contact.ok ? 'completed' : 'failed');

  const web = buildWebFactoryLeadContract({ project_id: projectId, idempotency_key: `${projectId}:web:lead:001`, source: blueprint.contract.lead_sources[0] || 'website', form_id: 'synthetic-contact-form', fields: { synthetic: true }, synthetic: true });
  const leadRecord = { idempotency_key: web.contract.idempotency_key, source: web.contract.source, status: 'new', contact_id: contact.row.id, company_id: company.row.id, score: 10, owner_ref: 'operator', last_activity_at: 'synthetic-clock', next_action: 'qualify synthetic lead', synthetic: true };
  const lead = await adapter.create(CRM_PHYSICAL_TABLES.leads, projectId, leadRecord);
  const replay = await adapter.create(CRM_PHYSICAL_TABLES.leads, projectId, leadRecord);
  if (!lead.ok || replay.idempotent_replay !== true || lead.row.id !== replay.row.id) return { ok: false, error: 'CRM_IDEMPOTENCY_E2E_FAILED', trace };
  observe('create', 'lead', 'completed');

  const pipeline = blueprint.pipeline;
  const first = pipeline.stages[0];
  const second = pipeline.stages[1];
  const transition = isPipelineTransitionAllowed(pipeline, first.key, second.key);
  if (!transition.ok) return { ok: false, error: transition.error, trace };
  const pipelineRow = await adapter.create(CRM_PHYSICAL_TABLES.pipelines, projectId, { id: `${projectId}-pipeline`, pipeline_key: pipeline.key, name: pipeline.name, synthetic: true });
  const stageRows = [];
  for (const stage of pipeline.stages) {
    stageRows.push((await adapter.create(CRM_PHYSICAL_TABLES.pipeline_stages, projectId, { id: `${projectId}-stage-${stage.key}`, pipeline_id: pipelineRow.row.id, stage_key: stage.key, name: stage.name, position: stage.position, terminal: stage.terminal, outcome: stage.outcome, stage_rules: { allowed_next: stage.allowed_next }, synthetic: true })).row);
  }
  const deal = await adapter.create(CRM_PHYSICAL_TABLES.deals, projectId, { idempotency_key: `${projectId}:deal:001`, lead_id: lead.row.id, contact_id: contact.row.id, company_id: company.row.id, pipeline_id: pipelineRow.row.id, stage_id: stageRows[0].id, title: 'Synthetic Deal', status: 'open', value_minor: 0, currency: 'EUR', synthetic: true });
  const moved = await adapter.update(CRM_PHYSICAL_TABLES.deals, projectId, deal.row.id, { stage_id: stageRows[1].id, status: 'open' });
  observe('transition', 'deal', moved.ok ? 'completed' : 'failed');

  const activity = await adapter.create(CRM_PHYSICAL_TABLES.activities, projectId, { idempotency_key: `${projectId}:activity:001`, resource_type: 'lead', resource_id: lead.row.id, lead_id: lead.row.id, activity_type: 'form', summary: 'Synthetic form activity', synthetic: true });
  const task = await adapter.create(CRM_PHYSICAL_TABLES.tasks, projectId, { idempotency_key: `${projectId}:task:001`, resource_type: 'lead', resource_id: lead.row.id, lead_id: lead.row.id, status: 'open', title: 'Synthetic next action', synthetic: true });
  const note = await adapter.create(CRM_PHYSICAL_TABLES.notes, projectId, { idempotency_key: `${projectId}:note:001`, resource_type: 'lead', resource_id: lead.row.id, lead_id: lead.row.id, body: 'Synthetic note only', synthetic: true });
  observe('create', 'timeline', activity.ok && task.ok && note.ok ? 'completed' : 'failed');

  const customFieldRows = [];
  for (const field of blueprint.custom_fields) {
    const definition = await adapter.create(CRM_PHYSICAL_TABLES.custom_field_definitions, projectId, { entity_type: field.entity, field_key: field.key, label: field.label, field_type: field.type, required: field.required, options: field.options, synthetic: true });
    if (!definition.ok) return definition;
    customFieldRows.push(definition.row);
  }
  observe('configure', 'custom_fields', 'completed');

  const eventSpecs = [
    { type: 'form_submitted', resource_type: 'lead', resource_id: lead.row.id, status: 'new', stage_key: first.key },
    { type: 'lead_created', resource_type: 'lead', resource_id: lead.row.id, status: 'new', stage_key: first.key },
    { type: 'deal_created', resource_type: 'deal', resource_id: deal.row.id, status: 'open', stage_key: first.key },
    { type: 'deal_stage_changed', resource_type: 'deal', resource_id: deal.row.id, status: 'open', stage_key: second.key }
  ];
  const events = [];
  const analytics = [];
  for (const spec of eventSpecs) {
    const built = createBusinessEvent({ project_id: projectId, business_run_id: businessRunId, source: 'synthetic-e2e', synthetic: true, metadata: { industry: blueprint.contract.industry }, ...spec });
    if (!built.ok) return built;
    events.push(built.event);
    const persisted = await adapter.create(CRM_PHYSICAL_TABLES.events, projectId, { idempotency_key: `${projectId}:event:${spec.type}:${spec.stage_key}`, event_type: spec.type, resource_type: spec.resource_type, resource_id: spec.resource_id, payload: built.event, synthetic: true });
    if (!persisted.ok) return persisted;
    const mapped = mapBusinessEventToPostHog(built.event);
    if (!mapped.ok) return mapped;
    analytics.push(mapped.mapping);
  }
  observe('map', 'business_events_to_posthog', 'completed');

  const auditEntries = [];
  for (const [action, key, metadata] of [
    ['created', 'lead-created', { resource_type: 'lead', resource_id: lead.row.id }],
    ['transitioned', 'deal-transitioned', { resource_type: 'deal', resource_id: deal.row.id, from_stage: first.key, to_stage: second.key }],
    ['automated', 'automation-prepared', { resource_type: 'lead', resource_id: lead.row.id }]
  ]) {
    const audit = await adapter.create(CRM_PHYSICAL_TABLES.audit, projectId, { entity_type: metadata.resource_type, action, actor_type: 'riosystems-operator', actor_ref: 'business-crm-factory-v1', idempotency_key: `${projectId}:audit:${key}`, metadata: { ...metadata, synthetic: true } });
    if (!audit.ok) return audit;
    auditEntries.push(audit.row);
  }
  observe('audit', 'audit_log', 'completed');

  const automation = buildAutomationFactoryEnvelope({ project_id: projectId, business_run_id: businessRunId, operation: 'crm.lead.next_action', resource_type: 'lead', resource_id: lead.row.id, idempotency_key: `${projectId}:automation:001`, payload: { task_id: task.row.id, synthetic: true } });
  const ai = buildAiFactoryLeadInput(lead.row, { industry: blueprint.contract.industry, pipeline_stage: second.key, synthetic: true });
  const foreignProject = `${projectId}-other`;
  const foreignRows = await adapter.query(CRM_PHYSICAL_TABLES.leads, foreignProject, {});
  const crossProjectRows = foreignRows.ok ? foreignRows.rows.length : -1;

  const qaInput = {
    schema: blueprint.crm_schema,
    pipeline,
    project_id: projectId,
    cross_project_rows: crossProjectRows,
    idempotent_replay: replay.idempotent_replay,
    events,
    analytics_mappings: analytics,
    safety: blueprint.contract.safety,
    contracts: { automation, ai, web },
    audit_entries: auditEntries
  };
  const qa = runCrmQa(qaInput);
  const delivery = buildCrmDeliveryManifest({ project: { project_id: projectId, business: blueprint.contract.business, industry: blueprint.contract.industry, country: blueprint.contract.country, language: blueprint.contract.language }, business_run_id: businessRunId, crm_schema: blueprint.crm_schema, pipeline, custom_fields: blueprint.custom_fields, events: events.map((event) => event.type), analytics, automation_hooks: [automation.envelope], ai_contract: ai.input, web_contract: web.contract, qa });
  observe('quality_gate', 'crm_delivery', qa.ok ? 'completed' : 'failed', qa.ok ? 'passed' : 'failed', qa.ok ? null : qa.failed.join(','));

  return {
    ok: qa.ok,
    status: qa.ok ? 'CRM_V1_SYNTHETIC_E2E_PASSED' : 'CRM_V1_QA_FAILED',
    project_id: projectId,
    mission: blueprint.mission,
    business_run_id: businessRunId,
    proof: { lead_id: lead.row.id, duplicate_lead_id: replay.row.id, idempotent_replay: replay.idempotent_replay, deal_id: deal.row.id, pipeline_transition: `${first.key}->${second.key}`, activity_id: activity.row.id, business_event_count: events.length, posthog_mapping_count: analytics.length, audit_count: auditEntries.length, custom_field_count: customFieldRows.length, cross_project_rows: crossProjectRows },
    contracts: { automation: automation.envelope, ai: ai.input, web: web.contract },
    qa,
    delivery,
    trace,
    external_side_effects: false,
    estimated_variable_cost_eur: 0,
    production: false
  };
}
