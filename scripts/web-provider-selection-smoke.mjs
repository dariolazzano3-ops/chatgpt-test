import assert from 'node:assert/strict';
import { selectWebBuildProvider, webProviderDecisionManifest, webProviderStrategy } from '../src/web-provider-strategy.js';
import { authorizeWebStagingExecution, planWebFactoryProviderRoute } from '../src/web-provider-router.js';

const manifest = webProviderDecisionManifest();
assert.equal(manifest.primary_build_engine, 'riosystems-native-web');
assert.equal(manifest.primary_staging_host, 'cloudflare-workers-free');
assert.equal(manifest.provider_choice_complete_for_web_factory_v1, true);
assert.equal(manifest.production_deploy, false);

const strategy = webProviderStrategy();
assert.equal(strategy.default_builder, 'riosystems-native-web');
assert.equal(strategy.automatic_paid_overflow, false);
assert.ok(strategy.providers.some((item) => item.id === 'lovable-github'));
assert.ok(strategy.providers.some((item) => item.id === 'framer-server-api'));
assert.ok(strategy.providers.some((item) => item.id === 'webflow-api'));

const defaultBuild = selectWebBuildProvider();
assert.equal(defaultBuild.ok, true);
assert.equal(defaultBuild.ready, true);
assert.equal(defaultBuild.provider.id, 'riosystems-native-web');
assert.equal(defaultBuild.provider.code_ownership, 'full_repository_ownership');

const lovableBlocked = selectWebBuildProvider({ mode: 'visual_accelerator' });
assert.equal(lovableBlocked.provider.id, 'lovable-github');
assert.equal(lovableBlocked.ready, false);
assert.ok(lovableBlocked.blockers.some((item) => item.code === 'WEB_PROVIDER_CONNECTION_REQUIRED'));

const lovableReady = selectWebBuildProvider({ mode: 'visual_accelerator', connected_providers: ['lovable-github'] });
assert.equal(lovableReady.ready, true);

const framerBlocked = selectWebBuildProvider({ mode: 'visual_platform', connected_providers: ['framer-server-api'] });
assert.equal(framerBlocked.ready, false);
assert.ok(framerBlocked.blockers.some((item) => item.code === 'PLATFORM_HOSTING_ACCEPTANCE_REQUIRED'));

const webflowBlocked = selectWebBuildProvider({ mode: 'client_editable_cms', connected_providers: ['webflow-api'] });
assert.equal(webflowBlocked.ready, false);
assert.ok(webflowBlocked.blockers.some((item) => item.code === 'PAID_PROVIDER_APPROVAL_REQUIRED'));

const production = selectWebBuildProvider({ production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

const route = planWebFactoryProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['cloudflare-workers-free']
});
assert.equal(route.ok, true);
assert.equal(route.state, 'ROUTE_READY');
assert.deepEqual(route.route, ['riosystems-native-web','cloudflare-workers-free']);
assert.equal(route.external_write, false);

const plannedExecution = planWebFactoryProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['cloudflare-workers-free'],
  execute_staging: true
});
assert.equal(plannedExecution.state, 'ROUTE_BLOCKED');
assert.ok(plannedExecution.blockers.some((item) => item.code === 'STAGING_EXTERNAL_WRITE_APPROVAL_REQUIRED'));
assert.ok(plannedExecution.blockers.some((item) => item.code === 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED'));

const approvedPlan = planWebFactoryProviderRoute({
  source_revision: 'abc123',
  connected_providers: ['cloudflare-workers-free'],
  execute_staging: true,
  external_write_approved: true,
  supervised_execution_approved: true
});
assert.equal(approvedPlan.state, 'STAGING_EXECUTION_APPROVED');
assert.equal(approvedPlan.blockers.length, 0);

const auth = authorizeWebStagingExecution(approvedPlan, {
  external_write_approved: true,
  supervised_execution_approved: true
});
assert.equal(auth.ok, true);
assert.equal(auth.state, 'STAGING_EXECUTION_AUTHORIZED');
assert.equal(auth.production_deploy, false);

const domainChange = planWebFactoryProviderRoute({ source_revision: 'abc123', custom_domain_change: true });
assert.equal(domainChange.ok, false);
assert.equal(domainChange.error, 'CUSTOM_DOMAIN_CHANGE_REQUIRES_SEPARATE_APPROVAL');

console.log('RIOSYSTEMS Web Factory provider selection smoke: OK');
