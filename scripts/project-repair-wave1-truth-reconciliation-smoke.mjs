import assert from 'node:assert/strict';
import { normalizeExecutionCapabilityId, capabilityFactoryFor } from '../src/capability-router.js';
import { integrationCapabilityForTask } from '../src/factory-integration-bridge.js';
import { providerActivationInventory, providerRuntimeTruth, evaluateProviderActivationInventory } from '../src/provider-activation-inventory.js';
import { providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';

assert.equal(normalizeExecutionCapabilityId('web_generate'), 'web.build');
assert.equal(normalizeExecutionCapabilityId('website'), 'web.build');
assert.equal(normalizeExecutionCapabilityId('automation_build'), 'automation.run');
assert.equal(normalizeExecutionCapabilityId('ai_system_build'), 'ai.generate');
assert.equal(normalizeExecutionCapabilityId('crm'), 'business.configure');
assert.equal(normalizeExecutionCapabilityId('web.analytics'), 'web.analytics');
assert.equal(normalizeExecutionCapabilityId('app_build', 'app'), null);
assert.equal(capabilityFactoryFor('business.crm.write'), 'business');

assert.equal(integrationCapabilityForTask({ capability: 'web_generate', domain: 'web' }), 'web.build');
assert.equal(integrationCapabilityForTask({ capability: 'automation', domain: 'automation' }), 'automation.run');
assert.equal(integrationCapabilityForTask({ capability: null, domain: 'ai' }), 'ai.generate');

const stack = providerStackV1();
assert.deepEqual(stack.active_factories, ['web','automation','ai','business']);
assert.equal(stack.app_factory.status, 'PLANNED');
assert.equal(stack.evidence_scope, 'HISTORICAL_REPOSITORY_EVIDENCE');
assert.equal(stack.historical_evidence_is_not_current_runtime, true);
assert.equal(stack.activation_policy.production_deploy, false);

const inventory = providerActivationInventory();
assert.equal(inventory.historical_evidence_is_not_current_runtime, true);
const openai = inventory.providers.find((item) => item.id === 'openai-api');
assert.ok(openai);
assert.equal(openai.runtime_truth.current_runtime_verified, false);
assert.equal(openai.runtime_truth.actual_executor_availability, 'NOT_CURRENTLY_VERIFIED');
assert.equal(openai.runtime_truth.execution_readiness, 'HISTORICAL_EXECUTION_EVIDENCE_REVALIDATION_REQUIRED');
assert.equal(openai.runtime_truth.production_eligibility, 'NOT_ELIGIBLE');

const framerTruth = providerRuntimeTruth('framer-server-api');
assert.equal(framerTruth.routing_eligibility, 'SPECIALIST_ONLY');
assert.equal(framerTruth.actual_executor_availability, 'NOT_CURRENTLY_VERIFIED');
assert.equal(framerTruth.production_eligibility, 'NOT_ELIGIBLE');

const routeOnly = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate'],
  zero_cost_only: true,
  account_bindings: ['cloudflare-workers-ai-free'],
  credential_refs: ['cloudflare-workers-ai-free']
});
assert.equal(routeOnly.ready_for_route_resolution, true);
assert.equal(routeOnly.ready_for_execution, false);
assert.equal(routeOnly.blockers.some((item) => item.code === 'PROVIDER_CURRENT_RUNTIME_VERIFICATION_REQUIRED'), true);

const currentRuntime = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate'],
  zero_cost_only: true,
  account_bindings: ['cloudflare-workers-ai-free'],
  credential_refs: ['cloudflare-workers-ai-free'],
  current_runtime_verified_provider_ids: ['cloudflare-workers-ai-free']
});
assert.equal(currentRuntime.ready_for_execution, true);
assert.equal(currentRuntime.ready_for_real_staging, true);
assert.equal(currentRuntime.plan[0].runtime_truth.actual_executor_availability, 'CURRENT_RUNTIME_VERIFIED');

const matrix = providerActivationMatrix();
assert.equal(matrix.evidence_scope, 'HISTORICAL_REPOSITORY_EVIDENCE');
assert.equal(matrix.historical_evidence_is_not_current_runtime, true);
assert.equal(matrix.providers.every((item) => item.current_runtime_verified === false), true);
assert.equal(matrix.providers.find((item) => item.id === 'openai-api')?.activation, 'historical_connected_staging_evidence_budget_gate');
assert.equal(matrix.providers.find((item) => item.id === 'make-core')?.activation, 'historical_staging_execution_evidence');
assert.equal(matrix.production_deploy, false);
assert.equal(matrix.automatic_paid_overflow, false);

console.log('PROJECT REPAIR Wave 1 truth reconciliation: OK');
