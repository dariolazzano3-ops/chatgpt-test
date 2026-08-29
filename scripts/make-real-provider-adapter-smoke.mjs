import assert from 'node:assert/strict';
import {
  buildMakeRealProviderCandidate,
  buildMakeRealProviderIntegration,
  evaluateMakeRealProviderActivation,
  makeRealProviderAdapterManifest
} from '../src/make-real-provider-adapter.js';

const base = {
  zone_url: 'https://eu1.make.com',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read', 'scenarios:read'],
  estimated_monthly_cost_eur: 12,
  estimated_cost_per_run_eur: 0.01,
  automatic_extra_credit_purchase: false
};

const manifest = makeRealProviderAdapterManifest();
assert.equal(manifest.provider_id, 'make-core');
assert.equal(manifest.capability, 'automation.run');
assert.equal(manifest.real_provider_bridge_integrated, true);
assert.equal(manifest.runner_configured_by_default, false);
assert.equal(manifest.automatic_extra_credit_purchase, false);
assert.equal(manifest.production_deploy, false);

const candidate = buildMakeRealProviderCandidate(base);
assert.equal(candidate.ok, true);
assert.equal(candidate.provider.id, 'make-core');
assert.equal(candidate.provider.capability, 'automation.run');
assert.equal(candidate.provider.kind, 'automation');
assert.equal(candidate.provider.credential_ref, 'secret://MAKE_API_TOKEN');
assert.equal(candidate.provider.endpoint, 'https://eu1.make.com/api/v2');
assert.deepEqual(candidate.provider.allowed_hosts, ['eu1.make.com']);
assert.equal(candidate.provider.paid, true);
assert.equal(candidate.provider.external_write, true);
assert.equal(candidate.provider.production, false);

const missingCost = buildMakeRealProviderCandidate({ ...base, estimated_monthly_cost_eur: undefined });
assert.equal(missingCost.ok, false);
assert.ok(missingCost.blockers.some((item) => item.code === 'MAKE_MONTHLY_COST_ESTIMATE_REQUIRED'));

const autoCredits = buildMakeRealProviderCandidate({ ...base, automatic_extra_credit_purchase: true });
assert.equal(autoCredits.ok, false);
assert.ok(autoCredits.blockers.some((item) => item.code === 'MAKE_AUTOMATIC_EXTRA_CREDITS_REJECTED'));

const dryGate = evaluateMakeRealProviderActivation(base, {
  max_monthly_cost_eur: 80,
  max_cost_per_run_eur: 1,
  data_classes: ['business']
});
assert.equal(dryGate.ok, true);
assert.equal(dryGate.gate.stage, 'REAL_PROVIDER_STAGING_READY');
assert.equal(dryGate.gate.execution_mode, 'dry_run');
assert.equal(dryGate.gate.external_side_effects_allowed, false);

const blockedExecution = evaluateMakeRealProviderActivation(base, {
  execute: true,
  max_monthly_cost_eur: 80,
  max_cost_per_run_eur: 1,
  data_classes: ['business']
});
assert.equal(blockedExecution.ok, false);
for (const code of [
  'REAL_PROVIDER_ACTIVATION_APPROVAL_REQUIRED',
  'SUPERVISED_EXECUTION_APPROVAL_REQUIRED',
  'PAID_PROVIDER_REQUIRES_USER_APPROVAL',
  'EXTERNAL_WRITE_REQUIRES_USER_APPROVAL'
]) assert.ok(blockedExecution.gate.blockers.some((item) => item.code === code));

const approvedExecution = evaluateMakeRealProviderActivation(base, {
  execute: true,
  max_monthly_cost_eur: 80,
  max_cost_per_run_eur: 1,
  data_classes: ['business'],
  provider_activation_approved: true,
  supervised_execution_approved: true,
  cost_approved: true,
  external_write_approved: true
});
assert.equal(approvedExecution.ok, true);
assert.equal(approvedExecution.gate.stage, 'REAL_PROVIDER_EXECUTION_READY');
assert.equal(approvedExecution.gate.external_side_effects_allowed, true);
assert.equal(approvedExecution.production_deploy, false);

const integration = buildMakeRealProviderIntegration(base, { health: 'unknown' });
assert.equal(integration.ok, true);
assert.equal(integration.entry.real_provider, true);
assert.equal(integration.entry.provider, 'make-core');
assert.equal(integration.entry.capability, 'automation.run');
assert.equal(integration.entry.runner, null);
assert.equal(integration.runner_configured, false);
assert.equal(integration.production_deploy, false);

const production = buildMakeRealProviderCandidate({ ...base, production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Make real provider adapter smoke: OK');
