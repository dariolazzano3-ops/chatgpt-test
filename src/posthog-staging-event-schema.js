const EVENT_NAMES = Object.freeze([
  'page_view',
  'cta_clicked',
  'lead_submitted',
  'automation_started',
  'lead_persisted',
  'automation_failed'
]);

const HAPPY_PATH = Object.freeze([
  'page_view',
  'cta_clicked',
  'lead_submitted',
  'automation_started',
  'lead_persisted'
]);

const SCOPE = 'bakery-muller:digital-system-v1';
const DISTINCT_ID = 'riosystems-staging:bakery-muller:digital-system-v1:block4-analytics-001';
const FLOW_ID = 'block4-posthog-staging-001';

const COMMON_PROPERTIES = Object.freeze([
  '$process_person_profile', '$geoip_disable', 'environment', 'project_scope', 'synthetic', 'flow_id', 'step_index', 'source'
]);
const OPTIONAL_PROPERTIES = Object.freeze(['make_execution_id', 'outcome', 'failure_code']);
const FORBIDDEN_KEYS = Object.freeze(['email','name','full_name','phone','address','ip','$ip','$current_url','url','message','customer_data']);

export function posthogStagingEventSchema() {
  return {
    schema: 'riosystems.posthog-staging-event-schema.v1', scope_key: SCOPE, distinct_id: DISTINCT_ID, flow_id: FLOW_ID,
    allowed_events: [...EVENT_NAMES], happy_path_events: [...HAPPY_PATH], max_batch_events: HAPPY_PATH.length,
    common_properties: [...COMMON_PROPERTIES], optional_properties: [...OPTIONAL_PROPERTIES], forbidden_properties: [...FORBIDDEN_KEYS],
    person_profiles_created: false, geoip_enrichment_disabled_per_event: true, real_customer_data: false,
    synthetic_test_data_only: true, automatic_paid_overflow: false, production_deploy: false
  };
}

export function buildSyntheticAnalyticsFlow(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (input.scope_key !== SCOPE) return { ok: false, error: 'POSTHOG_STAGING_SCOPE_REJECTED', production_deploy: false };
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.real_customer_data === true) {
    return { ok: false, error: 'POSTHOG_SYNTHETIC_STAGING_REQUIRED', production_deploy: false };
  }
  const makeExecutionId = String(input.make_execution_id || '').trim().slice(0, 160);
  const events = HAPPY_PATH.map((event, index) => ({
    event, distinct_id: DISTINCT_ID,
    properties: {
      '$process_person_profile': false, '$geoip_disable': true, environment: 'staging', project_scope: SCOPE,
      synthetic: true, flow_id: FLOW_ID, step_index: index + 1,
      source: event === 'automation_started' || event === 'lead_persisted' ? 'make-supabase-bridge' : 'riosystems-staging',
      ...(makeExecutionId && (event === 'automation_started' || event === 'lead_persisted') ? { make_execution_id: makeExecutionId } : {}),
      ...(event === 'lead_persisted' ? { outcome: 'success' } : {})
    }
  }));
  return { ok: true, schema: 'riosystems.posthog-staging-flow.v1', scope_key: SCOPE, flow_id: FLOW_ID, distinct_id: DISTINCT_ID,
    events, event_count: events.length, synthetic_test_data_only: true, real_customer_data: false, production_deploy: false };
}

export function validatePostHogStagingEvent(event = {}) {
  if (!EVENT_NAMES.includes(event.event) || event.distinct_id !== DISTINCT_ID) return false;
  const props = event.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) return false;
  if (props.$process_person_profile !== false || props.$geoip_disable !== true) return false;
  if (props.environment !== 'staging' || props.project_scope !== SCOPE || props.synthetic !== true || props.flow_id !== FLOW_ID) return false;
  if (!Number.isInteger(props.step_index) || props.step_index < 1 || props.step_index > HAPPY_PATH.length) return false;
  const allowed = new Set([...COMMON_PROPERTIES, ...OPTIONAL_PROPERTIES]);
  if (Object.keys(props).some((key) => !allowed.has(key) || FORBIDDEN_KEYS.includes(key))) return false;
  const serialized = JSON.stringify(event).toLowerCase();
  return !serialized.includes('@') && !serialized.includes('http://') && !serialized.includes('https://');
}
