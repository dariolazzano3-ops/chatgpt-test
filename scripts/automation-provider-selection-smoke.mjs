import assert from 'node:assert/strict';
import { automationProviderDecisionManifest, automationProviderStrategy, selectAutomationRuntime } from '../src/automation-provider-strategy.js';
import { planAutomationProviderRoute } from '../src/automation-provider-router.js';
import { isMakeLiveStagingVerified, makeLiveStagingActivationEvidence } from '../src/make-live-staging-evidence.js';

const evidence = makeLiveStagingActivationEvidence();
assert.equal(isMakeLiveStagingVerified(), true);
assert.equal(evidence.provider_id, 'make-core');
assert.equal(evidence.scenario.scenario_id, 7149691);
assert.equal(evidence.execution.github_actions_run_id, 33258730803);
assert.equal(evidence.execution.scenario_restored_inactive, true);
assert.equal(evidence.authorization_posture.production_authorized, false);
assert.equal(evidence.account_binding.secret_value_embedded, false);

const manifest = automationProviderDecisionManifest();
assert.equal(manifest.primary_control_engine, 'riosystems-native-automation');
assert.equal(manifest.primary_external_runtime, 'make-core');
assert.equal(manifest.primary_external_runtime_staging_verified, true);
assert.equal(manifest.strategic_secondary_runtime, 'activepieces-cloud-free');
assert.equal(manifest.technical_specialist_runtime, 'n8n-client-owned');
assert.equal(manifest.production_deploy, false);

const strategy = automationProviderStrategy();
assert.equal(strategy.automatic_paid_overflow, false);
assert.equal(strategy.primary_external_runtime, 'make-core');
assert.equal(strategy.primary_external_runtime_staging_verified, true);
assert.equal(strategy.primary_external_runtime_evidence.execution.github_actions_run_id, 33258730803);
assert.equal(strategy.strategic_secondary_runtime, 'activepieces-cloud-free');
assert.ok(strategy.providers.some((item) => item.id === 'activepieces-community'));
assert.ok(strategy.providers.some((item) => item.id === 'cloudflare-workers-free'));
assert.equal(strategy.providers.find((item) => item.id === 'make-core')?.availability, 'staging_live_verified');

const defaultBlocked = selectAutomationRuntime();
assert.equal(defaultBlocked.provider.id, 'make-core');
assert.equal(defaultBlocked.ready, false);
assert.equal(defaultBlocked.staging_live_verified, true);
assert.ok(defaultBlocked.blockers.some((item) => item.code === 'AUTOMATION_PROVIDER_CONNECTION_REQUIRED'));
assert.ok(defaultBlocked.blockers.some((item) => item.code === 'PAID_PROVIDER_APPROVAL_REQUIRED'));

const defaultReady = selectAutomationRuntime({ connected_providers: ['make-core'], paid_provider_approved: true });
assert.equal(defaultReady.ready, true);
assert.equal(defaultReady.provider.id, 'make-core');
assert.equal(defaultReady.staging_live_verified, true);

const secondaryBlocked = selectAutomationRuntime({ mode: 'secondary' });
assert.equal(secondaryBlocked.provider.id, 'activepieces-cloud-free');
assert.equal(secondaryBlocked.ready, false);
assert.ok(secondaryBlocked.blockers.some((item) => item.code === 'AUTOMATION_PROVIDER_CONNECTION_REQUIRED'));

const secondaryReady = selectAutomationRuntime({ mode: 'secondary', connected_providers: ['activepieces-cloud-free'] });
assert.equal(secondaryReady.ready, true);

const legacyFallbackAlias = selectAutomationRuntime({ mode: 'connector_fallback', connected_providers: ['activepieces-cloud-free'] });
assert.equal(legacyFallbackAlias.ready, true);
assert.equal(legacyFallbackAlias.provider.id, 'activepieces-cloud-free');

const micro = selectAutomationRuntime({ mode: 'micro', connected_providers: ['cloudflare-workers-free'] });
assert.equal(micro.ready, true);
assert.equal(micro.provider.id, 'cloudflare-workers-free');

const n8nBlocked = selectAutomationRuntime({ mode: 'technical_specialist', connected_providers: ['n8n-client-owned'] });
assert.equal(n8nBlocked.ready, false);
assert.ok(n8nBlocked.blockers.some((item) => item.code === 'CLIENT_INSTANCE_REQUIRED'));

const selfHosted = selectAutomationRuntime({ mode: 'self_hosted' });
assert.equal(selfHosted.ready, false);
assert.ok(selfHosted.blockers.some((item) => item.code === 'SELF_HOSTED_RUNTIME_NOT_DEPLOYED'));

const route = planAutomationProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['make-core'],
  paid_provider_approved: true
});
assert.equal(route.ok, true);
assert.equal(route.state, 'ROUTE_READY');
assert.deepEqual(route.route, ['riosystems-native-automation','make-core']);
assert.equal(route.external_write, false);

const executionBlocked = planAutomationProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['make-core'],
  paid_provider_approved: true,
  execute_external: true
});
assert.equal(executionBlocked.state, 'ROUTE_BLOCKED');
assert.ok(executionBlocked.blockers.some((item) => item.code === 'EXTERNAL_WRITE_APPROVAL_REQUIRED'));
assert.ok(executionBlocked.blockers.some((item) => item.code === 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED'));

const production = planAutomationProviderRoute({ production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Automation Factory provider selection smoke: OK');
