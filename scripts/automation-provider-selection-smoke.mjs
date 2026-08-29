import assert from 'node:assert/strict';
import { automationProviderDecisionManifest, automationProviderStrategy, selectAutomationRuntime } from '../src/automation-provider-strategy.js';
import { planAutomationProviderRoute } from '../src/automation-provider-router.js';

const manifest = automationProviderDecisionManifest();
assert.equal(manifest.primary_control_engine, 'riosystems-native-automation');
assert.equal(manifest.primary_external_runtime, 'activepieces-cloud-free');
assert.equal(manifest.fallback_external_runtime, 'make-core');
assert.equal(manifest.client_owned_n8n_only_by_default, true);
assert.equal(manifest.production_deploy, false);

const strategy = automationProviderStrategy();
assert.equal(strategy.automatic_paid_overflow, false);
assert.ok(strategy.providers.some((item) => item.id === 'activepieces-community'));
assert.ok(strategy.providers.some((item) => item.id === 'cloudflare-workers-free'));

const defaultBlocked = selectAutomationRuntime();
assert.equal(defaultBlocked.provider.id, 'activepieces-cloud-free');
assert.equal(defaultBlocked.ready, false);
assert.ok(defaultBlocked.blockers.some((item) => item.code === 'AUTOMATION_PROVIDER_CONNECTION_REQUIRED'));

const defaultReady = selectAutomationRuntime({ connected_providers: ['activepieces-cloud-free'] });
assert.equal(defaultReady.ready, true);

const micro = selectAutomationRuntime({ mode: 'micro', connected_providers: ['cloudflare-workers-free'] });
assert.equal(micro.ready, true);
assert.equal(micro.provider.id, 'cloudflare-workers-free');

const makeBlocked = selectAutomationRuntime({ mode: 'connector_fallback', connected_providers: ['make-core'] });
assert.equal(makeBlocked.ready, false);
assert.ok(makeBlocked.blockers.some((item) => item.code === 'PAID_PROVIDER_APPROVAL_REQUIRED'));

const n8nBlocked = selectAutomationRuntime({ mode: 'client_owned_n8n', connected_providers: ['n8n-client-owned'] });
assert.equal(n8nBlocked.ready, false);
assert.ok(n8nBlocked.blockers.some((item) => item.code === 'CLIENT_INSTANCE_REQUIRED'));

const selfHosted = selectAutomationRuntime({ mode: 'self_hosted' });
assert.equal(selfHosted.ready, false);
assert.ok(selfHosted.blockers.some((item) => item.code === 'SELF_HOSTED_RUNTIME_NOT_DEPLOYED'));

const route = planAutomationProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['activepieces-cloud-free']
});
assert.equal(route.ok, true);
assert.equal(route.state, 'ROUTE_READY');
assert.deepEqual(route.route, ['riosystems-native-automation','activepieces-cloud-free']);
assert.equal(route.external_write, false);

const executionBlocked = planAutomationProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['activepieces-cloud-free'],
  execute_external: true
});
assert.equal(executionBlocked.state, 'ROUTE_BLOCKED');
assert.ok(executionBlocked.blockers.some((item) => item.code === 'EXTERNAL_WRITE_APPROVAL_REQUIRED'));
assert.ok(executionBlocked.blockers.some((item) => item.code === 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED'));

const production = planAutomationProviderRoute({ production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Automation Factory provider selection smoke: OK');
