import { buildSyntheticAnalyticsFlow, validatePostHogStagingEvent } from './posthog-staging-event-schema.js';

const POSTHOG_EU_HOST = 'https://eu.i.posthog.com';
const CONFIRMATION = 'SEND_POSTHOG_STAGING_BATCH_ONCE';
const TOKEN_REF = 'secret:POSTHOG_PROJECT_TOKEN';
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export function buildPostHogStagingBatchPlan(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (input.zero_cost_confirmed !== true || Number(input.max_variable_cost_eur) !== 0) return { ok: false, error: 'POSTHOG_ZERO_VARIABLE_COST_CONFIRMATION_REQUIRED', production_deploy: false };
  const flow = buildSyntheticAnalyticsFlow({ scope_key: input.scope_key, staging_only: input.staging_only,
    synthetic_test_data_only: input.synthetic_test_data_only, real_customer_data: input.real_customer_data,
    make_execution_id: input.make_execution_id, production_deploy: false });
  if (!flow.ok) return flow;
  if (flow.event_count < 1 || flow.event_count > 5 || flow.events.some((event) => !validatePostHogStagingEvent(event))) return { ok: false, error: 'POSTHOG_STAGING_BATCH_VALIDATION_FAILED', production_deploy: false };
  return { ok: true, schema: 'riosystems.posthog-staging-batch-plan.v1', state: 'POSTHOG_STAGING_BATCH_READY_APPROVAL_REQUIRED',
    provider_id: 'posthog-free', host: POSTHOG_EU_HOST, endpoint: `${POSTHOG_EU_HOST}/batch/`, token_ref: TOKEN_REF,
    scope_key: flow.scope_key, flow_id: flow.flow_id, events: structuredClone(flow.events), event_count: flow.event_count,
    required_confirmation: CONFIRMATION, one_http_request_only: true, retries_allowed: 0, person_profiles_created: false,
    geoip_enrichment_disabled_per_event: true, synthetic_test_data_only: true, real_customer_data: false,
    max_variable_cost_eur: 0, automatic_paid_overflow: false, external_write: true, production_deploy: false };
}

export async function sendPostHogStagingBatchOnce(plan = {}, runtime = {}) {
  if (plan.production_deploy === true || runtime.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  if (plan.state !== 'POSTHOG_STAGING_BATCH_READY_APPROVAL_REQUIRED') return { ok: false, error: 'POSTHOG_STAGING_BATCH_PLAN_REQUIRED', production_deploy: false };
  if (runtime.confirmation !== CONFIRMATION) return { ok: false, error: 'POSTHOG_STAGING_BATCH_CONFIRMATION_REQUIRED', production_deploy: false };
  if (runtime.external_write_execution_approved !== true || runtime.supervised_execution_approved !== true || runtime.staging_only !== true || runtime.synthetic_test_data_only !== true) return { ok: false, error: 'POSTHOG_STAGING_EXECUTION_GATES_REQUIRED', production_deploy: false };
  if (runtime.zero_cost_confirmed !== true || Number(runtime.max_variable_cost_eur) !== 0) return { ok: false, error: 'POSTHOG_ZERO_VARIABLE_COST_CONFIRMATION_REQUIRED', production_deploy: false };
  if (typeof runtime.fetch_impl !== 'function' || typeof runtime.resolve_secret !== 'function') return { ok: false, error: 'POSTHOG_STAGING_RUNTIME_REQUIRED', production_deploy: false };
  if (plan.host !== POSTHOG_EU_HOST || plan.endpoint !== `${POSTHOG_EU_HOST}/batch/`) return { ok: false, error: 'POSTHOG_HOST_REJECTED', production_deploy: false };
  if (!Array.isArray(plan.events) || plan.events.length < 1 || plan.events.length > 5 || plan.events.some((event) => !validatePostHogStagingEvent(event))) return { ok: false, error: 'POSTHOG_STAGING_BATCH_VALIDATION_FAILED', production_deploy: false };
  const token = clean(await runtime.resolve_secret(plan.token_ref), 500);
  if (!token) return { ok: false, error: 'POSTHOG_PROJECT_TOKEN_MISSING', production_deploy: false };
  const payload = { api_key: token, historical_migration: false, batch: plan.events.map((item) => ({ event: item.event, properties: { distinct_id: item.distinct_id, ...item.properties } })) };
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(Number(runtime.timeout_ms) || 8000, 1000), 12000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await runtime.fetch_impl(plan.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), redirect: 'error', signal: controller.signal });
  } catch (error) {
    return { ok: false, error: 'POSTHOG_STAGING_BATCH_TRANSPORT_FAILED', message: clean(error?.message, 160), requests_attempted: 1, external_side_effect_performed: false, production_deploy: false };
  } finally { clearTimeout(timer); }
  if (!response?.ok) return { ok: false, error: 'POSTHOG_STAGING_BATCH_REJECTED', status: Number(response?.status) || null, requests_attempted: 1, external_side_effect_performed: true, production_deploy: false };
  return { ok: true, schema: 'riosystems.posthog-staging-batch-result.v1', stage: 'POSTHOG_SYNTHETIC_STAGING_BATCH_ACCEPTED',
    status: Number(response.status) || null, scope_key: plan.scope_key, flow_id: plan.flow_id,
    events_sent: plan.events.map((event) => event.event), event_count: plan.events.length, requests_attempted: 1,
    retries_performed: 0, project_token_returned: false, person_profiles_created: false, geoip_enrichment_disabled_per_event: true,
    synthetic_test_data_only: true, real_customer_data: false, variable_cost_eur: 0, automatic_paid_overflow: false,
    external_side_effect_performed: true, production_deploy: false };
}

export function posthogStagingRunnerManifest() {
  return { schema: 'riosystems.posthog-staging-runner.v1', provider_id: 'posthog-free', host: POSTHOG_EU_HOST,
    endpoint: `${POSTHOG_EU_HOST}/batch/`, max_batch_events: 5, one_http_request_only: true, retries_allowed: 0,
    project_token_ref: TOKEN_REF, project_token_embedded: false, person_profiles_created: false,
    geoip_enrichment_disabled_per_event: true, synthetic_test_data_only: true, zero_variable_cost_required: true,
    automatic_paid_overflow: false, production_deploy: false };
}
