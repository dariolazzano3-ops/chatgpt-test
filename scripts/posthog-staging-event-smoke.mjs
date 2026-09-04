import assert from 'node:assert/strict';
import { buildSyntheticAnalyticsFlow, posthogStagingEventSchema, validatePostHogStagingEvent } from '../src/posthog-staging-event-schema.js';
import { buildPostHogStagingBatchPlan, posthogStagingRunnerManifest, sendPostHogStagingBatchOnce } from '../src/posthog-staging-event-runner.js';

const scopes = [
  'bakery-muller:digital-system-v1',
  'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1'
];

for (const scope of scopes) {
  const schema = posthogStagingEventSchema({ scope_key: scope });
  assert.deepEqual(schema.allowed_events, ['page_view','cta_clicked','lead_submitted','automation_started','lead_persisted','automation_failed']);
  assert.equal(schema.max_batch_events, 5);
  assert.equal(schema.person_profiles_created, false);
  assert.equal(schema.geoip_enrichment_disabled_per_event, true);
  assert.equal(schema.production_deploy, false);

  const flow = buildSyntheticAnalyticsFlow({
    scope_key: scope,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    make_execution_id: 'synthetic-execution-ref-001',
    production_deploy: false
  });
  assert.equal(flow.ok, true);
  assert.equal(flow.event_count, 5);
  assert.equal(flow.events.every(validatePostHogStagingEvent), true);
  assert.equal(flow.events.every((event) => event.properties.project_scope === scope), true);
  assert.equal(flow.events.every((event) => event.properties.synthetic === true), true);
  assert.equal(JSON.stringify(flow).includes('@'), false);
  assert.equal(JSON.stringify(flow).includes('phone'), false);
  assert.equal(JSON.stringify(flow).includes('message'), false);

  const plan = buildPostHogStagingBatchPlan({
    scope_key: scope,
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    make_execution_id: 'synthetic-execution-ref-001',
    zero_cost_confirmed: true,
    max_variable_cost_eur: 0,
    production_deploy: false
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.event_count, 5);
  assert.equal(plan.retries_allowed, 0);
  assert.equal(plan.token_ref, 'secret:POSTHOG_PROJECT_TOKEN');

  const calls = [];
  const result = await sendPostHogStagingBatchOnce(plan, {
    confirmation: 'SEND_POSTHOG_STAGING_BATCH_ONCE',
    external_write_execution_approved: true,
    supervised_execution_approved: true,
    staging_only: true,
    synthetic_test_data_only: true,
    zero_cost_confirmed: true,
    max_variable_cost_eur: 0,
    fetch_impl: async (url, options = {}) => { calls.push({ url, options }); return new Response('{}', { status: 200 }); },
    resolve_secret: async () => 'synthetic-test-token',
    production_deploy: false
  });
  assert.equal(result.ok, true);
  assert.equal(result.event_count, 5);
  assert.equal(result.retries_performed, 0);
  assert.equal(result.project_token_returned, false);
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.batch.every((event) => event.properties.project_scope === scope), true);
  assert.equal(JSON.stringify(sent.batch).includes('@'), false);
}

assert.equal(buildSyntheticAnalyticsFlow({ scope_key: 'invalid scope', staging_only: true, synthetic_test_data_only: true }).ok, false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: scopes[1], staging_only: false, synthetic_test_data_only: true }).ok, false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: scopes[1], staging_only: true, synthetic_test_data_only: true, real_customer_data: true }).ok, false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: scopes[1], staging_only: true, synthetic_test_data_only: true, production_deploy: true }).error, 'PRODUCTION_DEPLOY_REJECTED');

const manifest = posthogStagingRunnerManifest();
assert.equal(manifest.max_batch_events, 5);
assert.equal(manifest.one_http_request_only, true);
assert.equal(manifest.retries_allowed, 0);
assert.equal(manifest.project_token_embedded, false);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS PostHog generalized staging event smoke: OK');
