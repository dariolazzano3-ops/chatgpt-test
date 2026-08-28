import assert from 'node:assert/strict';
import {
  createProviderRegistry,
  routeProvider,
  evaluateRuntimeGovernance,
  runtimeGovernanceManifest
} from '../src/runtime-governance.js';

const noop = async () => ({ ok: true });
const registry = createProviderRegistry([
  { id: 'primary-ai', capability: 'ai.text', priority: 10, enabled: true, external: true, paid: true, estimated_cost_units: 3, runner: noop, fallback_ids: ['fallback-ai'] },
  { id: 'fallback-ai', capability: 'ai.text', priority: 20, enabled: true, external: true, paid: false, estimated_cost_units: 1, runner: noop },
  { id: 'disabled-ai', capability: 'ai.text', priority: 1, enabled: false, runner: noop }
]);

assert.equal(registry.registry_version, 'riosystems.providers.v1');
assert.equal(registry.providers.length, 3);

const route = routeProvider(registry, { capability: 'ai.text' });
assert.equal(route.ok, true);
assert.equal(route.primary, 'primary-ai');
assert.deepEqual(route.fallbacks.map((item) => item.id), ['fallback-ai']);
assert.equal(route.production_deploy, false);

const blocked = evaluateRuntimeGovernance({
  project: { customer_id: 'customer-a', project_id: 'project-1' },
  provider: route.provider,
  budget: { remaining_cost_units: 2 },
  approvals: { cost_approved: false, external_provider_approved: false }
});
assert.equal(blocked.blocked, true);
assert.equal(blocked.scope.scope_key, 'customer-a:project-1');
assert.deepEqual(blocked.blockers.map((item) => item.code).sort(), [
  'EXTERNAL_PROVIDER_APPROVAL_REQUIRED',
  'PAID_PROVIDER_COST_APPROVAL_REQUIRED',
  'PROJECT_BUDGET_EXCEEDED'
]);

const ready = evaluateRuntimeGovernance({
  project: { customer_id: 'customer-a', project_id: 'project-1' },
  provider: route.provider,
  budget: { remaining_cost_units: 10 },
  approvals: { cost_approved: true, external_provider_approved: true }
});
assert.equal(ready.blocked, false);
assert.equal(ready.ready_for_supervised_execution, true);
assert.equal(ready.production_deploy, false);

const missingScope = evaluateRuntimeGovernance({ provider: route.provider });
assert.equal(missingScope.ok, false);
assert.equal(missingScope.error, 'PROJECT_SCOPE_REQUIRED');

const manifest = runtimeGovernanceManifest();
assert.equal(manifest.automatic_external_activation, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({ ok: true, suite: 'runtime-governance-smoke', manifest }, null, 2));
