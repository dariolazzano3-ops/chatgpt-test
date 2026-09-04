import { buildPostHogStagingBatchPlan, sendPostHogStagingBatchOnce } from '../src/posthog-staging-event-runner.js';

const SCOPE_KEY = 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1';
const token = String(process.env.POSTHOG_PROJECT_TOKEN || '').trim();
if (!token) throw new Error('POSTHOG_PROJECT_TOKEN_SECRET_MISSING');

const plan = buildPostHogStagingBatchPlan({
  scope_key: SCOPE_KEY,
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  make_execution_id: String(process.env.MUELLER_MAKE_EXECUTION_ID || '').trim(),
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
if (!plan.ok) throw new Error(plan.error || 'MUELLER_POSTHOG_PLAN_BLOCKED');

const serialized = JSON.stringify(plan.events).toLowerCase();
for (const forbidden of ['@','email','phone','full_name','message','free_text']) {
  if (serialized.includes(forbidden)) throw new Error('MUELLER_POSTHOG_PII_GUARD_FAILED');
}

const result = await sendPostHogStagingBatchOnce(plan, {
  confirmation: 'SEND_POSTHOG_STAGING_BATCH_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:POSTHOG_PROJECT_TOKEN' ? token : null,
  timeout_ms: 12000,
  production_deploy: false
});
if (!result.ok) throw new Error(result.error || 'MUELLER_POSTHOG_EXECUTION_FAILED');

console.log('PROJECT FERRARI Müller live PostHog: PASS');
console.log(JSON.stringify({
  status: 'PASS',
  scope_key: SCOPE_KEY,
  provider: 'posthog-free',
  status_code: result.status,
  flow_id: result.flow_id,
  events_sent: result.events_sent,
  event_count: result.event_count,
  retries_performed: result.retries_performed,
  person_profiles_created: result.person_profiles_created,
  pii_present: false,
  variable_cost_eur: result.variable_cost_eur,
  production_deploy: false,
  real_customer_data: false
}, null, 2));
