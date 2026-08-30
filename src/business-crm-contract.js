const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const COUNTRY = /^[A-Z]{2}$/;
const LANGUAGE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const FIELD_TYPES = new Set(['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'json']);

function normalizeStringList(value, maxItems = 50) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, 120)).filter(Boolean))].slice(0, maxItems);
}

function normalizePipeline(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const key = clean(value.key || value.id || 'sales', 80).toLowerCase();
  const name = clean(value.name || 'Sales', 120);
  const rawStages = Array.isArray(value.stages) ? value.stages : [];
  const stages = rawStages.map((stage, index) => {
    if (typeof stage === 'string') {
      const stageKey = clean(stage, 80).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const outcome = stageKey.includes('won') ? 'won' : stageKey.includes('lost') ? 'lost' : null;
      return { key: stageKey, name: clean(stage, 120), position: index, terminal: outcome !== null, outcome, allowed_next: [] };
    }
    const stageKey = clean(stage?.key || stage?.id || stage?.name, 80).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    return {
      key: stageKey,
      name: clean(stage?.name || stageKey, 120),
      position: Number.isInteger(stage?.position) ? stage.position : index,
      terminal: stage?.terminal === true || stageKey.includes('won') || stageKey.includes('lost'),
      outcome: ['won', 'lost', 'none'].includes(stage?.outcome) ? stage.outcome : stageKey.includes('won') ? 'won' : stageKey.includes('lost') ? 'lost' : null,
      allowed_next: normalizeStringList(stage?.allowed_next, 20)
    };
  }).filter((stage) => stage.key && stage.name);
  if (!SLUG.test(key) || stages.length < 2 || stages.length > 30) return null;
  const keys = new Set();
  for (const stage of stages) {
    if (keys.has(stage.key)) return null;
    keys.add(stage.key);
  }
  const sorted = stages.sort((a, b) => a.position - b.position);
  if (!sorted.some((stage) => stage.terminal)) sorted[sorted.length - 1].terminal = true;
  return { key, name, stages: sorted };
}

function normalizeCustomFields(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const fields = [];
  for (const field of value.slice(0, 100)) {
    if (!field || typeof field !== 'object' || Array.isArray(field)) continue;
    const key = clean(field.key, 80).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const entity = clean(field.entity || 'lead', 40).toLowerCase();
    const type = clean(field.type || 'text', 30).toLowerCase();
    if (!key || seen.has(`${entity}:${key}`) || !FIELD_TYPES.has(type)) continue;
    seen.add(`${entity}:${key}`);
    fields.push({
      key,
      entity,
      type,
      required: field.required === true,
      label: clean(field.label || key, 120),
      options: type === 'select' || type === 'multiselect' ? normalizeStringList(field.options, 100) : []
    });
  }
  return fields;
}

export function normalizeBusinessProjectContract(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'BUSINESS_PROJECT_CONTRACT_INVALID' };
  const projectId = clean(input.project_id, 64).toLowerCase();
  if (!SLUG.test(projectId)) return { ok: false, error: 'BUSINESS_PROJECT_ID_INVALID' };
  const business = clean(input.business, 160);
  const industry = clean(input.industry, 120);
  const country = clean(input.country, 2).toUpperCase();
  const language = clean(input.language, 8);
  if (!business || !industry || !COUNTRY.test(country) || !LANGUAGE.test(language)) return { ok: false, error: 'BUSINESS_PROJECT_CORE_FIELDS_INVALID' };
  const pipeline = normalizePipeline(input.sales_pipeline);
  if (!pipeline) return { ok: false, error: 'BUSINESS_PIPELINE_INVALID' };
  const contract = {
    schema: 'riosystems.business-project-contract.v1',
    project_id: projectId,
    business,
    industry,
    country,
    language,
    crm_requirements: normalizeStringList(input.crm_requirements),
    lead_sources: normalizeStringList(input.lead_sources),
    sales_pipeline: pipeline,
    custom_fields: normalizeCustomFields(input.custom_fields),
    analytics_requirements: normalizeStringList(input.analytics_requirements),
    access_model: {
      current_mode: 'single_operator',
      supported_roles: ['operator', 'client_admin', 'client_viewer'],
      auth_complexity: 'deferred'
    },
    safety: {
      production: false,
      real_customer_data: false,
      payments: false,
      mass_email: false,
      automatic_paid_overflow: false,
      variable_cost_ceiling_eur: 0,
      destructive_db_operations: false,
      synthetic_test_data_only: true,
      fail_closed: true
    },
    metadata: clone(input.metadata || {})
  };
  return { ok: true, contract };
}

export function assertProjectScope(expectedProjectId, record = {}) {
  const expected = clean(expectedProjectId, 64).toLowerCase();
  const actual = clean(record?.project_id, 64).toLowerCase();
  if (!SLUG.test(expected) || actual !== expected) return { ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' };
  return { ok: true, project_id: expected };
}
