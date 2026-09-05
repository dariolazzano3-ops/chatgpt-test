import assert from 'node:assert/strict';
import {
  canonicalProviderExecutorDescriptor,
  executeCanonicalProviderRoute,
  validateProviderExecutionTruth
} from '../src/execution-adapters.js';

const cases = [
  ['riosystems-native-web', 'web.build', 'web-factory-native-v1'],
  ['cloudflare-workers-free', 'web.deploy', 'cloudflare-staging-preview-v1'],
  ['openai-api', 'ai.generate', 'openai-api-adapter-v1'],
  ['make-core', 'automation.run', 'make-staging-execution-runner-v1'],
  ['supabase-free', 'business.crm.write', 'supabase-staging-write-runner-v2'],
  ['posthog-free', 'business.analytics', 'posthog-staging-runner-v1']
];

function envelope(providerId, capability) {
  const descriptor = canonicalProviderExecutorDescriptor(providerId);
  assert.ok(descriptor);
  return {
    ok: true,
    envelope_version: 1,
    mission_id: 'mission-wave5-acceptance',
    task_id: `task-${providerId}`,
    execution_id: `execution-${providerId}`,
    provider_execution_version: 'riosystems.provider-execution.v1',
    capability,
    factory: capability.split('.')[0] === 'storage' ? 'business' : capability.split('.')[0],
    provider_route: { provider_id: providerId, capability },
    executor_id: descriptor.executor_id,
    environment: 'staging',
    write_policy: 'NO_EXTERNAL_WRITES',
    production_policy: 'PRODUCTION_DISABLED',
    execution: {
      production_deploy: false,
      external_writes: false,
      canonical_execution_contract: true
    }
  };
}

for (const [providerId, capability, executorId] of cases) {
  const env = envelope(providerId, capability);
  const executed = await executeCanonicalProviderRoute(env, {
    current_runtime_verified_provider_ids: [providerId],
    synthetic_acceptance: true,
    executors: {
      [providerId]: async ({ provider_id, capability: actualCapability, descriptor }) => ({
        ok: true,
        status: 'COMPLETED',
        outputs: { provider_id, capability: actualCapability, acceptance: 'SAFE_INJECTED_RUNNER' },
        actual_provider: provider_id,
        executor_id: descriptor.executor_id,
        external_job_id: `job-${provider_id}`,
        actual_cost_eur: 0,
        production_deploy: false
      })
    }
  });
  assert.equal(executed.ok, true, providerId);
  assert.equal(executed.status, 'COMPLETED', providerId);
  assert.equal(executed.provider_truth.planned_provider, providerId);
  assert.equal(executed.provider_truth.dispatched_provider, providerId);
  assert.equal(executed.provider_truth.actual_provider, providerId);
  assert.equal(executed.provider_truth.executor_id, executorId);
  assert.equal(executed.result.production_deploy, false);
}

const mismatchEnvelope = envelope('openai-api', 'ai.generate');
const mismatch = await executeCanonicalProviderRoute(mismatchEnvelope, {
  current_runtime_verified_provider_ids: ['openai-api'],
  synthetic_acceptance: true,
  executors: {
    'openai-api': async () => ({
      ok: true,
      status: 'COMPLETED',
      outputs: {},
      actual_provider: 'make-core',
      executor_id: 'openai-api-adapter-v1',
      production_deploy: false
    })
  }
});
assert.equal(mismatch.ok, false);
assert.equal(mismatch.error, 'PROVIDER_EXECUTION_TRUTH_MISMATCH');

const wrongExecutorTruth = validateProviderExecutionTruth(
  envelope('supabase-free', 'business.crm.write'),
  {
    dispatched_provider: 'supabase-free',
    actual_provider: 'supabase-free',
    executor_id: 'wrong-executor'
  }
);
assert.equal(wrongExecutorTruth.ok, false);
assert.equal(wrongExecutorTruth.error, 'PROVIDER_EXECUTOR_ID_MISMATCH');

const notReady = await executeCanonicalProviderRoute(envelope('posthog-free', 'business.analytics'), {
  current_runtime_verified_provider_ids: [],
  synthetic_acceptance: true,
  executors: {
    'posthog-free': async () => {
      throw new Error('must not execute');
    }
  }
});
assert.equal(notReady.ok, false);
assert.equal(notReady.error, 'PROVIDER_NOT_EXECUTION_READY');

const missingExecutor = await executeCanonicalProviderRoute(envelope('cloudflare-workers-free', 'web.deploy'), {
  current_runtime_verified_provider_ids: ['cloudflare-workers-free'],
  synthetic_acceptance: true,
  executors: {}
});
assert.equal(missingExecutor.ok, false);
assert.equal(missingExecutor.error, 'PROVIDER_EXECUTOR_NOT_CONFIGURED');

const wrongCapability = await executeCanonicalProviderRoute(envelope('make-core', 'automation.run'), {
  current_runtime_verified_provider_ids: ['make-core'],
  synthetic_acceptance: true,
  executors: {
    'make-core': async () => ({ ok: true, status: 'COMPLETED', outputs: {}, actual_provider: 'make-core', executor_id: 'make-staging-execution-runner-v1' })
  }
});
assert.equal(wrongCapability.ok, true);

const forged = envelope('make-core', 'automation.run');
forged.provider_route.capability = 'ai.generate';
const capabilityRejected = await executeCanonicalProviderRoute(forged, {
  current_runtime_verified_provider_ids: ['make-core'],
  synthetic_acceptance: true,
  executors: {
    'make-core': async () => ({ ok: true, status: 'COMPLETED', outputs: {}, actual_provider: 'make-core', executor_id: 'make-staging-execution-runner-v1' })
  }
});
assert.equal(capabilityRejected.ok, false);
assert.equal(capabilityRejected.error, 'PROVIDER_CAPABILITY_NOT_ACCEPTED');

console.log('PROJECT REPAIR Wave 5 actual provider executor wiring: OK');
