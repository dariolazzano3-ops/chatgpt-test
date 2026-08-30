import assert from 'node:assert/strict';
import { buildSyntheticAnalyticsFlow, posthogStagingEventSchema, validatePostHogStagingEvent } from '../src/posthog-staging-event-schema.js';
import { buildPostHogStagingBatchPlan, posthogStagingRunnerManifest, sendPostHogStagingBatchOnce } from '../src/posthog-staging-event-runner.js';

const scope = 'bakery-muller:digital-system-v1';
const makeExecutionId = 'e3198aaaeed64e7b8380c6e067439ecf';
const schema = posthogStagingEventSchema();
assert.deepEqual(schema.allowed_events, ['page_view','cta_clicked','lead_submitted','automation_started','lead_persisted','automation_failed']);
assert.deepEqual(schema.happy_path_events, ['page_view','cta_clicked','lead_submitted','automation_started','lead_persisted']);
assert.equal(schema.max_batch_events, 5);
assert.equal(schema.person_profiles_created, false);
assert.equal(schema.geoip_enrichment_disabled_per_event, true);
assert.equal(schema.production_deploy, false);

const flow = buildSyntheticAnalyticsFlow({ scope_key: scope, staging_only: true, synthetic_test_data_only: true,
  real_customer_data: false, make_execution_id: makeExecutionId, production_deploy: false });
assert.equal(flow.ok, true);
assert.equal(flow.event_count, 5);
assert.equal(flow.events.every(validatePostHogStagingEvent), true);
assert.equal(flow.events.some((event) => event.event === 'automation_failed'), false);
assert.equal(flow.events.every((event) => event.properties.$process_person_profile === false), true);
assert.equal(flow.events.every((event) => event.properties.$geoip_disable === true), true);
assert.equal(JSON.stringify(flow).includes('@'), false);
assert.equal(JSON.stringify(flow).includes('http://'), false);
assert.equal(JSON.stringify(flow).includes('https://'), false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: 'other:project', staging_only: true, synthetic_test_data_only: true }).ok, false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: scope, staging_only: false, synthetic_test_data_only: true }).ok, false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: scope, staging_only: true, synthetic_test_data_only: true, real_customer_data: true }).ok, false);
assert.equal(buildSyntheticAnalyticsFlow({ scope_key: scope, staging_only: true, synthetic_test_data_only: true, production_deploy: true }).error, 'PRODUCTION_DEPLOY_REJECTED');

const plan = buildPostHogStagingBatchPlan({ scope_key: scope, staging_only: true, synthetic_test_data_only: true,
  real_customer_data: false, make_execution_id: makeExecutionId, zero_cost_confirmed: true, max_variable_cost_eur: 0, production_deploy: false });
assert.equal(plan.ok, true);
assert.equal(plan.event_count, 5);
assert.equal(plan.endpoint, 'https://eu.i.posthog.com/batch/');
assert.equal(plan.retries_allowed, 0);
assert.equal(plan.token_ref, 'secret:POSTHOG_PROJECT_TOKEN');
assert.equal(JSON.stringify(plan).includes('phc_'), false);

const calls = [];
const fetchImpl = async (url, options = {}) => { calls.push({ url, options }); return new Response('{}', { status: 200 }); };
const denied = await sendPostHogStagingBatchOnce(plan, {});
assert.equal(denied.ok, false);
assert.equal(denied.error, 'POSTHOG_STAGING_BATCH_CONFIRMATION_REQUIRED');
const result = await sendPostHogStagingBatchOnce(plan, {
  confirmation: 'SEND_POSTHOG_STAGING_BATCH_ONCE', external_write_execution_approved: true, supervised_execution_approved: true,
  staging_only: true, synthetic_test_data_only: true, zero_cost_confirmed: true, max_variable_cost_eur: 0,
  fetch_impl: fetchImpl, resolve_secret: async (ref) => ref === 'secret:POSTHOG_PROJECT_TOKEN' ? 'secret-project-token' : null, production_deploy: false
});
assert.equal(result.ok, true);
assert.equal(result.event_count, 5);
assert.equal(result.requests_attempted, 1);
assert.equal(result.retries_performed, 0);
assert.equal(result.project_token_returned, false);
assert.equal(JSON.stringify(result).includes('secret-project-token'), false);
assert.equal(calls.length, 1);
const sent = JSON.parse(calls[0].options.body);
assert.equal(sent.api_key, 'secret-project-token');
assert.equal(sent.historical_migration, false);
assert.equal(sent.batch.length, 5);
assert.deepEqual(sent.batch.map((event) => event.event), schema.happy_path_events);
assert.equal(sent.batch.every((event) => event.properties.$process_person_profile === false), true);
assert.equal(sent.batch.every((event) => event.properties.$geoip_disable === true), true);
assert.equal(sent.batch.every((event) => event.properties.project_scope === scope), true);
assert.equal(sent.batch.every((event) => event.properties.synthetic === true), true);
assert.equal(JSON.stringify(sent.batch).includes('@'), false);

let failedCalls = 0;
const rejected = await sendPostHogStagingBatchOnce(plan, {
  confirmation: 'SEND_POSTHOG_STAGING_BATCH_ONCE', external_write_execution_approved: true, supervised_execution_approved: true,
  staging_only: true, synthetic_test_data_only: true, zero_cost_confirmed: true, max_variable_cost_eur: 0,
  fetch_impl: async () => { failedCalls += 1; return new Response('{}', { status: 429 }); },
  resolve_secret: async () => 'secret-project-token', production_deploy: false
});
assert.equal(rejected.ok, false);
assert.equal(rejected.error, 'POSTHOG_STAGING_BATCH_REJECTED');
assert.equal(failedCalls, 1);
const manifest = posthogStagingRunnerManifest();
assert.equal(manifest.max_batch_events, 5);
assert.equal(manifest.one_http_request_only, true);
assert.equal(manifest.retries_allowed, 0);
assert.equal(manifest.project_token_embedded, false);
assert.equal(manifest.production_deploy, false);
console.log('RIOSYSTEMS PostHog staging event smoke: OK');
