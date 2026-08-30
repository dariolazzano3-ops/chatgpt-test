import assert from 'node:assert/strict';
import {
  AI_FACTORY_V1_REFERENCE_TASKS,
  AI_FACTORY_V1_SAFETY,
  aiFactoryV1Manifest,
  evaluateAIFactory,
  routeAIModelAndProvider,
  runAIFactoryTask,
  validateAITaskContract
} from '../src/ai-factory-v1.js';
import { compilePromptContract, promptRegistryManifest } from '../src/ai-prompt-registry-v1.js';
import { createCloudflareWorkersAIAdapter, createDeterministicTestProvider, createOpenAIAdapter, providerAdapterManifest } from '../src/ai-provider-adapters-v1.js';

assert.equal(AI_FACTORY_V1_SAFETY.production, false);
assert.equal(AI_FACTORY_V1_SAFETY.real_customer_data, false);
assert.equal(AI_FACTORY_V1_SAFETY.automatic_paid_overflow, false);
assert.equal(AI_FACTORY_V1_SAFETY.variable_cost_ceiling_eur, 0);
assert.equal(aiFactoryV1Manifest().model_ladder.join('>'), 'Luna>Terra>Sol');
assert.equal(promptRegistryManifest().prompt_count >= 8, true);

const invalid = validateAITaskContract({ project: 'x', task_type: 'magic', input: {}, expected_output_schema: {}, quality_level: 'Luna', latency_class: 'standard', cost_limit: 0, data_sensitivity: 'synthetic', fallback_allowed: false });
assert.equal(invalid.ok, false);

const businessTask = AI_FACTORY_V1_REFERENCE_TASKS[0].task;
const prompt = compilePromptContract(businessTask);
assert.equal(prompt.ok, true);
assert.equal(prompt.prompt.prompt_contract, 'riosystems.ai.prompt.v1');
assert.equal(prompt.metadata.version, '1.0.0');
assert.equal(prompt.metadata.change_history.length > 0, true);
assert.equal(prompt.metadata.test_fixtures.length > 0, true);

const attempts = new Map();
const deterministic = createDeterministicTestProvider({
  scripted_response: async (request) => {
    const key = request.task.fixture_id;
    attempts.set(key, (attempts.get(key) || 0) + 1);
    if (key === 'ref-business-classification') {
      if (request.attempt === 1) return { class: 'qualified' };
      return { class: 'qualified', next_action: 'Schedule a synthetic discovery call.' };
    }
    if (key === 'ref-web-plan') {
      return { pages: [{ slug: '/', purpose: 'Explain the offer and route visitors.' }, { slug: '/services', purpose: 'Describe services clearly.' }] };
    }
    return request.task.deterministic_output || { ok: true };
  }
});
assert.equal(providerAdapterManifest(deterministic).secrets_exposed, false);

const openai = createOpenAIAdapter({ enabled: true, credential_present: true, paid_execution_approved: true, invoke: async () => ({ ok: true, output: {} }) });
const cfUnverified = createCloudflareWorkersAIAdapter({ enabled: true, credential_present: true, zero_cost_verified: false, invoke: async () => ({ ok: true, output: {} }) });

const route = routeAIModelAndProvider(businessTask, [openai, cfUnverified, deterministic], { variable_cost_ceiling_eur: 0 });
assert.equal(route.ok, true);
assert.equal(route.provider.id, 'deterministic-local');
assert.equal(route.logical_model, 'Luna');

const businessRun = await runAIFactoryTask(businessTask, { providers: [openai, cfUnverified, deterministic], ai_run_id: 'smoke-business' });
assert.equal(businessRun.ok, true);
assert.deepEqual(businessRun.output.class, 'qualified');
assert.equal(businessRun.attempts, 2);
assert.equal(businessRun.repair_count, 1);
assert.equal(businessRun.cost.actual_provider_cost_eur, 0);
assert.equal(businessRun.redaction.input_logged, false);
assert.equal(businessRun.redaction.prompt_content_logged, false);
assert.equal(businessRun.trace.some((event) => Object.prototype.hasOwnProperty.call(event, 'input')), false);

const customerTask = { ...businessTask, task_id: 'customer-block', data_sensitivity: 'customer' };
const customerRun = await runAIFactoryTask(customerTask, { providers: [deterministic], ai_run_id: 'smoke-customer' });
assert.equal(customerRun.ok, false);
assert.equal(customerRun.status, 'BLOCKED');
assert.equal(customerRun.error, 'REAL_CUSTOMER_DATA_DISABLED');

const fallbackPrimary = createDeterministicTestProvider({ id: 'deterministic-primary', scripted_response: async () => { throw new Error('synthetic provider outage'); } });
const fallbackSecondary = createDeterministicTestProvider({ id: 'deterministic-secondary', scripted_response: async (request) => request.task.deterministic_output });
const fallbackTask = {
  project: 'synthetic-fallback', task_type: 'extraction', input: { text: 'Order 42' },
  expected_output_schema: { type: 'object', required: ['order_id'], properties: { order_id: { type: 'integer' } }, additionalProperties: false },
  quality_level: 'Luna', latency_class: 'standard', cost_limit: 0, data_sensitivity: 'synthetic', preferred_provider: 'deterministic-primary', fallback_allowed: true, max_attempts: 1,
  deterministic_output: { order_id: 42 }
};
const fallbackRun = await runAIFactoryTask(fallbackTask, { providers: [fallbackPrimary, fallbackSecondary], ai_run_id: 'smoke-fallback' });
assert.equal(fallbackRun.ok, true);
assert.equal(fallbackRun.provider, 'deterministic-secondary');
assert.equal(fallbackRun.fallback_count, 1);

const evaluation = await evaluateAIFactory(AI_FACTORY_V1_REFERENCE_TASKS, { providers: [deterministic], repetitions: 2 });
assert.equal(evaluation.ok, true);
assert.equal(evaluation.metrics.correctness_rate, 1);
assert.equal(evaluation.metrics.schema_compliance_rate, 1);
assert.equal(evaluation.metrics.consistency_rate, 1);
assert.equal(evaluation.metrics.total_actual_cost_eur, 0);
assert.equal(evaluation.cases.length, 2);

console.log(JSON.stringify({
  smoke: 'ai-factory-v1-major:ok',
  reference_tasks: evaluation.cases.length,
  repair_verified: businessRun.repair_count === 1,
  fallback_verified: fallbackRun.fallback_count === 1,
  zero_cost_eur: evaluation.metrics.total_actual_cost_eur,
  openai_gate: 'zero-cost-ceiling-blocks-paid-route',
  cloudflare_gate: 'requires-explicit-zero-cost-verification',
  production: false,
  real_customer_data: false
}, null, 2));
