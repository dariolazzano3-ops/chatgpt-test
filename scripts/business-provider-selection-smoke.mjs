import assert from 'node:assert/strict';
import { businessProviderDecisionManifest, businessProviderStrategy, evaluateBusinessProviderReadiness } from '../src/business-provider-strategy.js';
import { planBusinessProviderRoute } from '../src/business-provider-router.js';

const manifest = businessProviderDecisionManifest();
assert.equal(manifest.primary_crm_backend, 'supabase-free');
assert.equal(manifest.primary_analytics, 'posthog-free');
assert.equal(manifest.standalone_crm_saas_required_for_v1, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

const strategy = businessProviderStrategy();
assert.equal(strategy.crm_posture, 'riosystems_owned_crm_model_on_portable_postgres');
assert.ok(strategy.providers.some((item) => item.id === 'supabase-free'));
assert.ok(strategy.providers.some((item) => item.id === 'posthog-free'));

const blocked = evaluateBusinessProviderReadiness();
assert.equal(blocked.ready, false);
assert.ok(blocked.blockers.some((item) => item.provider_id === 'supabase-free'));
assert.ok(blocked.blockers.some((item) => item.provider_id === 'posthog-free'));

const ready = evaluateBusinessProviderReadiness({ connected_providers: ['supabase-free','posthog-free'] });
assert.equal(ready.ready, true);
assert.equal(ready.external_write, false);

const writesBlocked = evaluateBusinessProviderReadiness({ connected_providers: ['supabase-free','posthog-free'], execute_external_writes: true, customer_project_isolated: true });
assert.equal(writesBlocked.ready, false);
assert.ok(writesBlocked.blockers.some((item) => item.code === 'BUSINESS_EXTERNAL_WRITE_APPROVAL_REQUIRED'));

const route = planBusinessProviderRoute({ source_revision: 'abc123', connected_providers: ['supabase-free','posthog-free'] });
assert.equal(route.ok, true);
assert.equal(route.state, 'ROUTE_READY');
assert.deepEqual(route.route, ['riosystems-native-business','supabase-free','posthog-free']);

const execRoute = planBusinessProviderRoute({ source_revision: 'abc123', connected_providers: ['supabase-free','posthog-free'], execute_external_writes: true, external_write_approved: true, customer_project_isolated: true, supervised_execution_approved: true });
assert.equal(execRoute.state, 'BUSINESS_EXECUTION_APPROVED');
assert.equal(execRoute.blockers.length, 0);

const production = planBusinessProviderRoute({ production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Business Factory provider selection smoke: OK');
