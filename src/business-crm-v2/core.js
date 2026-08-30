const clone = (value) => structuredClone(value ?? null);
const text = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const list = (value, limit = 50) => [...new Set((Array.isArray(value) ? value : []).map((v) => text(v, 160)).filter(Boolean))].slice(0, limit);

export const BUSINESS_OS_V2_SAFETY = Object.freeze({
  production: false,
  real_customer_data: false,
  automatic_paid_provider_usage: false,
  automatic_paid_overflow: false,
  mass_email: false,
  money_movement: false,
  destructive_delete_default: false,
  cross_project_data_access: false,
  unapproved_external_writes: false,
  secrets_in_repo: false,
  blind_ai_mutation: false,
  unsafe_automatic_merge: false,
  unvalidated_import: false,
  variable_development_cost_ceiling_eur: 0
});

export const CANONICAL_ENTITIES = Object.freeze([
  'project','company','contact','lead','deal','pipeline','pipeline_stage','activity','task','note',
  'tag','source','owner','custom_field','event'
]);

const BASE_FIELDS = Object.freeze(['id','project_id','created_at','updated_at','status','metadata']);

const ENTITY_FIELDS = Object.freeze({
  project: ['name','industry','country','language','config_version','schema_version'],
  company: ['name','domain','external_id','owner_id','tags','classification'],
  contact: ['company_id','name','email','phone','external_id','owner_id','consent','classification'],
  lead: ['contact_id','company_id','source_id','owner_id','score','next_action','last_activity_at','lifecycle_state'],
  deal: ['company_id','contact_id','lead_id','pipeline_id','stage_id','owner_id','value','currency','probability','expected_close','source_id'],
  pipeline: ['key','name','version','entry_rules','automation_hooks'],
  pipeline_stage: ['pipeline_id','key','name','order','entry_rules','exit_rules','required_fields','probability','sla'],
  activity: ['entity_refs','type','timestamp','actor','source','correlation_id'],
  task: ['entity_ref','owner_id','due_at','priority','task_type','created_source'],
  note: ['entity_ref','body_reference','classification','access_policy'],
  tag: ['name','scope'],
  source: ['source_type','campaign','medium','origin','first_touch','last_touch'],
  owner: ['actor_ref','assignment_method','active'],
  custom_field: ['field_id','entity_type','name','data_type','required','default','allowed_values','validation','searchable','sensitive'],
  event: ['event_id','event_type','entity_id','timestamp','correlation_id','schema_version','payload_reference']
});

export function canonicalBusinessModel() {
  return {
    schema: 'riosystems.business-canonical-model.v2',
    version: '2.0.0',
    project_boundary: 'project_id',
    entities: Object.fromEntries(CANONICAL_ENTITIES.map((entity) => [entity, {
      required_core_fields: [...BASE_FIELDS],
      domain_fields: [...(ENTITY_FIELDS[entity] || [])],
      provider_neutral: true,
      project_scoped: true
    }])),
    provider_storage_binding: 'adapter_owned',
    schema_evolution: 'versioned_expand_migrate_validate_contract'
  };
}

export function relationshipGraph() {
  const edges = [
    ['project','company','owns_many'], ['project','contact','owns_many'], ['project','lead','owns_many'], ['project','deal','owns_many'],
    ['project','pipeline','owns_many'], ['project','activity','owns_many'], ['project','task','owns_many'], ['project','note','owns_many'],
    ['company','contact','has_many'], ['contact','lead','may_generate_many'], ['lead','deal','may_convert_to'], ['company','deal','has_many'],
    ['deal','activity','has_many'], ['deal','task','has_many'], ['pipeline','pipeline_stage','has_many'], ['lead','activity','has_many'],
    ['contact','activity','has_many'], ['company','activity','has_many'], ['project','event','emits_many']
  ].map(([from,to,relation], i) => ({ edge_id: `rel-${i + 1}`, from, to, relation, project_scoped: true }));
  return { schema: 'riosystems.business-relationship-graph.v2', nodes: [...CANONICAL_ENTITIES], edges };
}

export const DATA_CLASSIFICATIONS = Object.freeze(['public','internal','confidential','customer_data','sensitive']);

export function buildDataPolicy(input = {}) {
  const retention = Array.isArray(input.retention) ? input.retention : [];
  const fields = Array.isArray(input.fields) ? input.fields : [];
  return {
    schema: 'riosystems.business-data-policy.v2',
    classifications: [...DATA_CLASSIFICATIONS],
    field_policies: fields.map((field) => ({
      field: text(field.field, 120),
      classification: DATA_CLASSIFICATIONS.includes(field.classification) ? field.classification : 'internal',
      analytics_allowed: field.analytics_allowed === true && !['customer_data','sensitive'].includes(field.classification),
      ai_allowed: field.ai_allowed === true && !['sensitive'].includes(field.classification),
      export_allowed: field.export_allowed === true,
      log_mode: ['masked','metadata_only','none'].includes(field.log_mode) ? field.log_mode : 'metadata_only'
    })),
    retention: retention.map((r) => ({
      data_class: text(r.data_class, 80),
      retention_period: text(r.retention_period, 80) || 'project-configured',
      archive_policy: text(r.archive_policy, 120) || 'project-configured',
      delete_policy: text(r.delete_policy, 120) || 'requires_explicit_policy_and_approval',
      legal_hold_possible: r.legal_hold_possible === true,
      legal_policy_asserted: false
    })),
    default: { classification: 'internal', logs: 'metadata_only', analytics: 'minimized', ai: 'policy_routed' }
  };
}

export function buildConsentContract(input = {}) {
  return {
    schema: 'riosystems.consent-contract.v2',
    project_id: text(input.project_id, 80),
    entity_ref: text(input.entity_ref, 160),
    consent_status: text(input.consent_status, 40) || 'unknown',
    consent_type: text(input.consent_type, 80) || null,
    captured_at: input.captured_at || null,
    source: text(input.source, 100) || null,
    withdrawn_at: input.withdrawn_at || null,
    compliance_claim: false
  };
}

export function buildFieldAccessContract(input = {}) {
  const allowed = new Set(['read','write','restricted','masked']);
  return {
    schema: 'riosystems.field-access.v2',
    project_id: text(input.project_id, 80),
    role: text(input.role, 80) || 'operator',
    field_rules: Object.fromEntries(Object.entries(input.field_rules || {}).map(([field, mode]) => [field, allowed.has(mode) ? mode : 'restricted'])),
    default: 'restricted',
    provider_enforcement: 'adapter_or_policy_layer'
  };
}

export function validateCustomFieldDefinition(input = {}) {
  const types = new Set(['text','number','boolean','date','datetime','select','multiselect','json','currency','email','phone','url']);
  const entityType = text(input.entity_type, 80);
  const fieldId = text(input.field_id || input.name, 120).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const dataType = text(input.data_type, 40).toLowerCase();
  const errors = [];
  if (!CANONICAL_ENTITIES.includes(entityType)) errors.push('CUSTOM_FIELD_ENTITY_INVALID');
  if (!fieldId) errors.push('CUSTOM_FIELD_ID_REQUIRED');
  if (!types.has(dataType)) errors.push('CUSTOM_FIELD_TYPE_INVALID');
  return {
    ok: errors.length === 0,
    errors,
    definition: errors.length ? null : {
      schema: 'riosystems.custom-field.v2', field_id: fieldId, entity_type: entityType,
      name: text(input.name, 120) || fieldId, data_type: dataType, required: input.required === true,
      default: clone(input.default), allowed_values: list(input.allowed_values, 100), validation: clone(input.validation || {}),
      searchable: input.searchable === true, sensitive: input.sensitive === true, provider_strategy: 'flexible_value_store_preferred'
    }
  };
}

function scoped(rows, projectId) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row?.project_id === projectId);
}

export function buildCustomer360(input = {}) {
  const projectId = text(input.project_id, 80);
  if (!projectId) return { ok: false, error: 'CUSTOMER_360_PROJECT_REQUIRED' };
  const contactId = text(input.contact_id, 160);
  const contact = scoped(input.contacts, projectId).find((x) => x.id === contactId) || null;
  if (!contact) return { ok: false, error: 'CUSTOMER_360_CONTACT_NOT_FOUND' };
  const company = contact.company_id ? scoped(input.companies, projectId).find((x) => x.id === contact.company_id) || null : null;
  const leads = scoped(input.leads, projectId).filter((x) => x.contact_id === contactId);
  const deals = scoped(input.deals, projectId).filter((x) => x.contact_id === contactId || (company && x.company_id === company.id));
  const entityIds = new Set([contactId, company?.id, ...leads.map((x) => x.id), ...deals.map((x) => x.id)].filter(Boolean));
  const activities = scoped(input.activities, projectId).filter((a) => (a.entity_refs || []).some((ref) => entityIds.has(ref.id)));
  const tasks = scoped(input.tasks, projectId).filter((t) => entityIds.has(t.entity_ref?.id));
  const notes = scoped(input.notes, projectId).filter((n) => entityIds.has(n.entity_ref?.id));
  const other = (name) => scoped(input[name], projectId).filter((x) => !x.contact_id || x.contact_id === contactId);
  return {
    ok: true,
    view: {
      schema: 'riosystems.customer-360.v2', project_id: projectId,
      identity: { contact_id: contact.id, name: contact.name || contact.full_name || null, external_id: contact.external_id || null },
      company: clone(company), contact_channels: { email: contact.email || null, phone: contact.phone || null },
      lead_history: clone(leads), deal_history: clone(deals), activities: clone(activities), tasks: clone(tasks), notes: clone(notes),
      ai_insights: clone(other('ai_insights')), website_interactions: clone(other('website_interactions')),
      automation_events: clone(other('automation_events')), support_history: clone(other('support_history')),
      analytics_summary: clone(input.analytics_summary || null), aggregation_only: true
    }
  };
}

export function buildSearchContract(input = {}) {
  const mode = ['exact','prefix','filtered','semantic'].includes(input.mode) ? input.mode : 'filtered';
  return {
    schema: 'riosystems.crm-search.v2', project_id: text(input.project_id, 80),
    entities: list(input.entities, 10).filter((x) => ['contact','company','lead','deal','note','activity'].includes(x)),
    mode, query: text(input.query, 300), filters: clone(input.filters || {}), semantic_provider_required: mode === 'semantic',
    cross_project: false
  };
}

export function buildDocumentLink(input = {}) {
  return {
    schema: 'riosystems.business-document-link.v2', project_id: text(input.project_id, 80), entity_ref: clone(input.entity_ref),
    document_type: text(input.document_type, 60), document_ref: text(input.document_ref, 240), metadata: clone(input.metadata || {}),
    content_duplicated: false
  };
}

export function assertNoCrossProject(records = [], projectId) {
  const foreign = (Array.isArray(records) ? records : []).filter((record) => record?.project_id !== projectId);
  return foreign.length ? { ok: false, error: 'CROSS_PROJECT_DATA_ACCESS_BLOCKED', foreign_count: foreign.length } : { ok: true, project_id: projectId };
}

export function businessCoreManifest() {
  return {
    schema: 'riosystems.business-core-v2', canonical_entities: [...CANONICAL_ENTITIES], relationship_graph: true,
    customer_360: true, custom_fields: 'provider_neutral', data_classification: [...DATA_CLASSIFICATIONS],
    field_access: true, consent: true, retention: true, documents: 'references_only', search: ['exact','prefix','filtered','semantic_later'],
    safety: clone(BUSINESS_OS_V2_SAFETY)
  };
}
