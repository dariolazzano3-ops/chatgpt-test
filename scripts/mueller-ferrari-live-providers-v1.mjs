import { buildMakeSafeStagingExecutionPlan, runMakeStagingScenarioOnce } from '../src/make-staging-execution-runner.js';
import { buildPostHogStagingBatchPlan, sendPostHogStagingBatchOnce } from '../src/posthog-staging-event-runner.js';

const SCOPE = Object.freeze({
  customer_id: 'synthetic-mueller-elektrotechnik-saarbruecken',
  project_id: 'mueller-elektrotechnik-digital-customer-system-v1',
  project_uuid: 'b3f54cc8-4abf-4f9c-92c9-81a4ebcdd001',
  scope_key: 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1'
});

const makeToken = String(process.env.MAKE_API_TOKEN || '').trim();
const posthogToken = String(process.env.POSTHOG_PROJECT_TOKEN || '').trim();
if (!makeToken) throw new Error('MAKE_API_TOKEN_SECRET_MISSING');
if (!posthogToken) throw new Error('POSTHOG_PROJECT_TOKEN_SECRET_MISSING');

const makePlan = buildMakeSafeStagingExecutionPlan({
  zone_url: process.env.MAKE_ZONE_URL || 'https://eu1.make.com',
  team_id: Number(process.env.MAKE_TEAM_ID || 939128),
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: process.env.MAKE_PLAN || 'core',
  granted_scopes: ['organization:read','scenarios:read','scenarios:write','scenarios:run'],
  scenario_id: Number(process.env.MAKE_SCENARIO_ID || 7149691),
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  bridge_scope: SCOPE,
  production_deploy: false
});
if (!makePlan.ok) throw new Error(makePlan.error || 'MUELLER_MAKE_PLAN_BLOCKED');
if (makePlan.project_scope !== SCOPE.scope_key) throw new Error('MUELLER_MAKE_SCOPE_MISMATCH');
if (makePlan.synthetic_payload.pii_in_envelope !== false) throw new Error('MUELLER_MAKE_PII_ENVELOPE_REJECTED');

const make = await runMakeStagingScenarioOnce(makePlan, {
  confirmation: 'RUN_STAGING_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? makeToken : null,
  timeout_ms: 15000,
  production_deploy: false
});
if (!make.ok) throw new Error(make.error || 'MUELLER_MAKE_EXECUTION_FAILED');
if (!make.scenario_restored_inactive) throw new Error('MUELLER_MAKE_SCENARIO_NOT_RESTORED_INACTIVE');

const posthogPlan = buildPostHogStagingBatchPlan({
  scope_key: SCOPE.scope_key,
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  make_execution_id: make.execution_id,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
if (!posthogPlan.ok) throw new Error(posthogPlan.error || 'MUELLER_POSTHOG_PLAN_BLOCKED');
const serializedEvents = JSON.stringify(posthogPlan.events).toLowerCase();
for (const forbidden of ['@','email','phone','full_name','message','free_text']) {
  if (serializedEvents.includes(forbidden)) throw new Error('MUELLER_POSTHOG_PII_GUARD_FAILED');
}

const analytics = await sendPostHogStagingBatchOnce(posthogPlan, {
  confirmation: 'SEND_POSTHOG_STAGING_BATCH_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:POSTHOG_PROJECT_TOKEN' ? posthogToken : null,
  timeout_ms: 12000,
  production_deploy: false
});
if (!analytics.ok) throw new Error(analytics.error || 'MUELLER_POSTHOG_EXECUTION_FAILED');

console.log('PROJECT FERRARI Müller live providers: PASS');
console.log(JSON.stringify({
  status: 'PASS',
  scope_key: SCOPE.scope_key,
  make: {
    provider: 'make-core',
    scenario_id: make.scenario_id,
    execution_id: make.execution_id,
    execution_status: make.execution_status,
    scenario_restored_inactive: make.scenario_restored_inactive,
    synthetic_test_data_only: true,
    external_connections: false,
    variable_cost_eur: 0
  },
  analytics: {
    provider: 'posthog-free',
    status: analytics.status,
    flow_id: analytics.flow_id,
    events_sent: analytics.events_sent,
    event_count: analytics.event_count,
    retries_performed: analytics.retries_performed,
    person_profiles_created: analytics.person_profiles_created,
    pii_present: false,
    variable_cost_eur: analytics.variable_cost_eur
  },
  production_deploy: false,
  real_customer_data: false,
  customer_communication_sent: false
}, null, 2));
