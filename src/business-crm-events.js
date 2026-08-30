import { BUSINESS_EVENT_TYPES } from './business-crm-model.js';

const forbiddenAnalyticsKeys = new Set([
  'email', 'phone', 'full_name', 'first_name', 'last_name', 'message', 'notes', 'address',
  'street', 'postal_code', 'ip', 'ip_address', 'user_agent', 'raw_payload'
]);

function clean(value, max = 200) { return String(value ?? '').trim().slice(0, max); }

export function createBusinessEvent(input = {}) {
  const type = clean(input.type, 80);
  if (!BUSINESS_EVENT_TYPES.includes(type)) return { ok: false, error: 'CRM_EVENT_TYPE_INVALID' };
  const projectId = clean(input.project_id, 64);
  const resourceType = clean(input.resource_type, 60);
  if (!projectId || !resourceType) return { ok: false, error: 'CRM_EVENT_SCOPE_REQUIRED' };
  return {
    ok: true,
    event: {
      schema: 'riosystems.business-event.v1',
      project_id: projectId,
      business_run_id: clean(input.business_run_id, 100),
      type,
      resource_type: resourceType,
      resource_id: clean(input.resource_id, 120),
      source: clean(input.source || 'business-factory', 80),
      status: clean(input.status, 80),
      stage_key: clean(input.stage_key, 80),
      synthetic: input.synthetic === true,
      occurred_at: clean(input.occurred_at, 40) || 'synthetic-clock',
      metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? structuredClone(input.metadata) : {}
    }
  };
}

function sanitizeProperties(value) {
  const output = {};
  for (const [key, raw] of Object.entries(value || {})) {
    if (forbiddenAnalyticsKeys.has(key.toLowerCase())) continue;
    if (raw === undefined || raw === null) continue;
    if (typeof raw === 'string') output[key] = raw.slice(0, 200);
    else if (typeof raw === 'number' || typeof raw === 'boolean') output[key] = raw;
  }
  return output;
}

export function mapBusinessEventToPostHog(event = {}) {
  if (!BUSINESS_EVENT_TYPES.includes(event.type) || !event.project_id) return { ok: false, error: 'POSTHOG_EVENT_MAPPING_INVALID' };
  const properties = sanitizeProperties({
    event_schema: event.schema,
    project_id: event.project_id,
    business_run_id: event.business_run_id,
    resource_type: event.resource_type,
    source: event.source,
    status: event.status,
    stage_key: event.stage_key,
    synthetic: event.synthetic,
    ...event.metadata
  });
  return {
    ok: true,
    mapping: {
      provider: 'posthog',
      event: `business_${event.type}`,
      distinct_id: `project:${event.project_id}`,
      properties,
      person_profiles: 'never',
      contains_direct_pii: false,
      external_write_authorized: false
    }
  };
}

export function analyticsMappingIsMinimized(mapping = {}) {
  const keys = Object.keys(mapping?.properties || {}).map((key) => key.toLowerCase());
  const leaked = keys.filter((key) => forbiddenAnalyticsKeys.has(key));
  return leaked.length ? { ok: false, error: 'POSTHOG_DATA_MINIMIZATION_FAILED', leaked } : { ok: true };
}

export function businessObservabilityRecord(input = {}) {
  return {
    schema: 'riosystems.business-observability.v1',
    business_run_id: clean(input.business_run_id, 100),
    project: clean(input.project, 64),
    operation: clean(input.operation, 100),
    resource: clean(input.resource, 100),
    provider: clean(input.provider || 'local', 80),
    status: clean(input.status, 40),
    side_effect: clean(input.side_effect || 'none', 40),
    validation: clean(input.validation || 'not_run', 60),
    error: clean(input.error, 300) || null
  };
}
