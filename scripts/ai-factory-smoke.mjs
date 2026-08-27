import assert from 'node:assert/strict';
import {
  aiFactoryManifest,
  validateAIContract,
  normalizeAIContract,
  validateAIResultContract,
  normalizeAIResultContract
} from '../src/ai-factory.js';
import { resolveExecutionAdapter } from '../src/execution-adapters.js';
import { capabilityRegistry } from '../src/capability-router.js';

const manifest = aiFactoryManifest();
assert.equal(manifest.id, 'ai-factory-v1');
assert.equal(manifest.version, '1.0.0');
assert.equal(manifest.available, true);
assert.equal(manifest.execution_mode, 'contract_only');
assert.equal(manifest.provider_agnostic, true);
assert.equal(manifest.model_routing, false);
assert.equal(manifest.tool_access, false);
assert.equal(manifest.external_data_access, false);
assert.equal(manifest.external_side_effects, false);
assert.equal(manifest.production_deploy, false);

const structuredTask = {
  contract_version: 'ai.task.v1',
  task_type: 'extract',
  goal: 'Extract customer intent and urgency into deterministic fields.',
  input: { message: 'Please call me tomorrow. This is urgent.' },
  context: [
    { id: 'policy', kind: 'instruction', content: 'Do not invent missing customer data.' }
  ],
  output: {
    format: 'structured_json',
    schema: {
      type: 'object',
      required: ['intent', 'urgent'],
      properties: {
        intent: { type: 'string' },
        urgent: { type: 'boolean' }
      },
      additionalProperties: false
    },
    max_chars: 4000
  },
  execution: { max_attempts: 2, allow_tools: false, allow_external_data: false }
};

assert.equal(validateAIContract(structuredTask).ok, true);
const normalizedTask = normalizeAIContract(structuredTask);
assert.equal(normalizedTask.ok, true);
assert.equal(normalizedTask.contract.task_type, 'extract');
assert.equal(normalizedTask.contract.output.format, 'structured_json');
assert.equal(normalizedTask.contract.execution.max_attempts, 2);
assert.equal(normalizedTask.contract.execution.allow_tools, false);
assert.equal(normalizedTask.contract.execution.allow_external_data, false);
assert.equal(normalizedTask.contract.execution.production_deploy, false);

const textTask = normalizeAIContract({
  task_type: 'summarize',
  goal: 'Summarize the supplied note.',
  input: 'A short note.',
  output: { format: 'text', max_chars: 2000 }
});
assert.equal(textTask.ok, true);
assert.equal(textTask.contract.output.schema, null);

assert.equal(validateAIContract({ ...structuredTask, task_type: 'shell_exec' }).ok, false);
assert.equal(validateAIContract({ ...structuredTask, execution: { allow_tools: true } }).ok, false);
assert.equal(validateAIContract({ ...structuredTask, execution: { allow_external_data: true } }).ok, false);
assert.equal(validateAIContract({ ...structuredTask, execution: { production_deploy: true } }).ok, false);
assert.equal(validateAIContract({ ...structuredTask, execution: { max_attempts: 99 } }).ok, false);
assert.equal(validateAIContract({ ...structuredTask, output: { format: 'structured_json' } }).ok, false);

const completed = normalizeAIResultContract({
  status: 'COMPLETED',
  output: { intent: 'callback', urgent: true },
  provider: 'future-provider',
  model: 'future-model',
  attempts: 1
});
assert.equal(completed.ok, true);
assert.equal(completed.result.status, 'COMPLETED');
assert.equal(completed.result.production_deploy, false);
assert.equal(completed.result.external_side_effects, false);

assert.equal(validateAIResultContract({ status: 'FAILED', error: { code: 'MODEL_TIMEOUT' } }).ok, true);
assert.equal(validateAIResultContract({ status: 'FAILED', error: {} }).ok, false);
assert.equal(validateAIResultContract({ status: 'COMPLETED', output: {}, external_side_effects: true }).ok, false);

const adapter = resolveExecutionAdapter({ domain: 'ai', engine: 'ai', state: 'READY' });
assert.equal(adapter.ok, true);
assert.equal(adapter.adapter.id, 'ai-factory-v1');
assert.equal(adapter.adapter.mode, 'contract_only');
assert.equal(adapter.adapter.automatic_execution, false);
assert.equal(adapter.adapter.tool_access, false);
assert.equal(adapter.adapter.external_data_access, false);
assert.equal(adapter.adapter.production_deploy, false);

const aiCapability = capabilityRegistry().capabilities.find((item) => item.id === 'ai_system_build');
assert.equal(aiCapability.status, 'planned', 'Phase 1 must not enable automatic mission routing');

console.log('ai-factory-smoke: ok');
