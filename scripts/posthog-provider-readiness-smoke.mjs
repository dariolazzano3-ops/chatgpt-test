import assert from 'node:assert/strict';
import { planProviderStackMission, providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';
import { buildCommandCenterSnapshot, createCommandCenterState } from '../src/command-center.js';
import { isPostHogStagingAnalyticsVerified } from '../src/posthog-staging-event-evidence.js';

assert.equal(isPostHogStagingAnalyticsVerified(), true);

const stack = providerStackV1();
assert.equal(stack.factories.business.analytics_staging_verified, true);
assert.equal(stack.factories.business.analytics_staging_evidence.delivery.accepted_batch_count, 1);
assert.equal(stack.factories.business.analytics_staging_evidence.delivery.event_count, 5);
assert.equal(stack.factories.business.analytics_staging_evidence.delivery.retries_performed, 0);
assert.equal(stack.factories.business.analytics_staging_evidence.verification.automation_failed_count, 0);
assert.equal(stack.factories.business.analytics_staging_evidence.verification.pii_properties_present, false);
assert.equal(stack.factories.business.analytics_staging_evidence.safety.variable_cost_eur, 0);
assert.equal(stack.factories.business.analytics_staging_evidence.safety.production_deploy, false);

const matrix = providerActivationMatrix();
const posthog = matrix.providers.find((item) => item.id === 'posthog-free');
assert.equal(posthog?.activation, 'live_read_and_staging_analytics_verified');
assert.equal(posthog?.project_read, 'verified');
assert.equal(posthog?.staging_analytics_verified, true);
assert.equal(posthog?.staging_analytics_evidence.scope.flow_id, 'block4-posthog-staging-001');
assert.equal(posthog?.staging_analytics_evidence.verification.page_view_count, 1);
assert.equal(posthog?.staging_analytics_evidence.verification.lead_persisted_count, 1);
assert.equal(posthog?.real_write, 'synthetic_event_approval_required_per_execution');

const mission = planProviderStackMission({ project: 'Bäckerei Müller' });
assert.equal(mission.ok, true);
assert.equal(mission.activation_status.business_posthog_staging_analytics_verified, true);
assert.equal(mission.activation_status.ai_cloudflare_runtime_verified, true);
assert.equal(mission.activation_evidence.business_posthog_staging_analytics.delivery.github_actions_run_id, 33287690485);
assert.equal(mission.activation_evidence.business_posthog_staging_analytics.safety.production_deploy, false);
assert.equal(mission.activation_evidence.ai_cloudflare_staging_runtime.inference.http_status, 200);
assert.equal(mission.next_gate, 'STAGING_EXECUTION_APPROVAL_REQUIRED');

const state = createCommandCenterState({ operator_id: 'operator' });
assert.equal(state.ok, true);
const snapshot = buildCommandCenterSnapshot(state.state);
assert.equal(snapshot.provider_readiness.factories.business.posthog_staging_analytics_verified, true);
assert.equal(snapshot.provider_readiness.factories.business.posthog_staging_analytics_evidence.delivery.event_count, 5);
assert.equal(snapshot.provider_readiness.factories.business.posthog_staging_analytics_evidence.verification.automation_failed_count, 0);
assert.equal(snapshot.provider_readiness.factories.business.posthog_staging_analytics_evidence.verification.email_property_present, false);
assert.equal(snapshot.provider_readiness.factories.business.posthog_staging_analytics_evidence.safety.variable_cost_eur, 0);
assert.equal(snapshot.provider_readiness.factories.ai.cloudflare_runtime_verified, true);
assert.equal(snapshot.provider_readiness.factories.ai.blocker, null);
assert.equal(snapshot.provider_readiness.production_deploy, false);

console.log('RIOSYSTEMS PostHog provider readiness smoke: OK');
