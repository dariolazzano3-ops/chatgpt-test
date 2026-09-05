import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  canonicalProviderExecutorDescriptor,
  executeCanonicalProviderRoute
} from '../src/execution-adapters.js';
import {
  executeReadyMissionTasks,
  missionExecutionRouterManifest
} from '../src/mission-execution-router.js';

function missionFor(providerId, capability, executorId, overrides = {}) {
  const missionId = `mission-final-${providerId}`;
  const taskId = `task-final-${providerId}`;
  return {
    mission_id: missionId,
    revision: 1,
    mission_revision: 'fixture',
    status: 'READY',
    prompt: 'Canonical provider execution fixture',
    project: null,
    source_of_truth: {
      canonical_branch: 'factory-control',
      mission_revision: 'fixture',
      expected_parent_sha: 'fixture',
      bound: false
    },
    tasks: [{
      task_id: taskId,
      capability,
      domain: capability.startsWith('web.') ? 'web'
        : capability.startsWith('automation.') ? 'automation'
        : capability.startsWith('ai.') ? 'ai'
        : 'business',
      engine: capability.startsWith('web.') ? 'web'
        : capability.startsWith('automation.') ? 'automation'
        : capability.startsWith('ai.') ? 'ai'
        : 'business',
      goal: 'Execute through canonical provider route',
      depends_on: [],
      state: 'READY',
      attempt: 0,
      max_attempts: 3,
      inputs: {},
      outputs: {},
      production_deploy: false,
      execution_contract_binding: {
        mission_id: missionId,
        task_id: taskId,
        factory: capability.startsWith('web.') ? 'web'
          : capability.startsWith('automation.') ? 'automation'
          : capability.startsWith('ai.') ? 'ai'
          : 'business',
        capability,
        execution_id: `execution-final-${providerId}`,
        provider_route: { provider_id: providerId, capability },
        executor_id: executorId,
        budget_reservation_ref: overrides.budget_reservation_ref || null,
        approval_ref: overrides.approval_ref || null,
        environment: 'staging',
        write_policy: 'NO_EXTERNAL_WRITES',
        production_policy: 'PRODUCTION_DISABLED'
      }
    }],
    events: [],
    safeguards: { production_deploy: false }
  };
}

const nativeDescriptor = canonicalProviderExecutorDescriptor('riosystems-native-web');
assert.ok(nativeDescriptor);

const realNativeMission = missionFor('riosystems-native-web', 'web.build', 'web-factory-native-v1');
const realNative = await executeReadyMissionTasks(
  realNativeMission,
  { default: { authorized: true, production_deploy: false } },
  {
    current_runtime_verified_provider_ids: ['riosystems-native-web'],
    web_task: {
      capability: 'web.build',
      input: {
        business_name: 'Canonical Provider Fixture',
        industry: 'professional-services',
        primary_goal: 'Private staging preview',
        services: ['Website'],
        project_slug: 'canonical-provider-fixture',
        synthetic_test_data_only: true,
        production_deploy: false
      }
    },
    max_tasks: 1,
    production_deploy: false,
    external_writes: false
  }
);
assert.equal(realNative.ok, true);
assert.equal(realNative.executed_count, 1);
assert.equal(realNative.results[0].ok, true);
assert.equal(realNative.results[0].execution_mode, 'canonical_provider_route');
assert.equal(realNative.results[0].provider_truth.planned_provider, 'riosystems-native-web');
assert.equal(realNative.results[0].provider_truth.dispatched_provider, 'riosystems-native-web');
assert.equal(realNative.results[0].provider_truth.actual_provider, 'riosystems-native-web');
assert.equal(realNative.results[0].provider_truth.executor_id, 'web-factory-native-v1');
assert.equal(realNative.mission.tasks[0].state, 'COMPLETED');
assert.equal(realNative.mission.tasks[0].outputs.execution_evidence.provider_call_count, 0);
assert.equal(realNative.mission.tasks[0].outputs.execution_evidence.actual_cost_eur, 0);
assert.equal(realNative.mission.tasks[0].outputs.execution_evidence.external_write_state, 'NO_EXTERNAL_CUSTOMER_WRITE');

function envelope(providerId, capability, executorId) {
  return {
    ok: true,
    envelope_version: 1,
    mission_id: 'mission-final-truth',
    task_id: 'task-final-truth',
    execution_id: 'execution-final-truth',
    provider_execution_version: 'riosystems.provider-execution.v1',
    capability,
    factory: capability.startsWith('web.') ? 'web'
      : capability.startsWith('automation.') ? 'automation'
      : capability.startsWith('ai.') ? 'ai'
      : 'business',
    provider_route: { provider_id: providerId, capability },
    executor_id: executorId,
    environment: 'staging',
    write_policy: 'NO_EXTERNAL_WRITES',
    production_policy: 'PRODUCTION_DISABLED',
    execution: { production_deploy: false, external_writes: false, canonical_execution_contract: true }
  };
}

const mismatched = await executeCanonicalProviderRoute(
  envelope('riosystems-native-web', 'web.build', 'web-factory-native-v1'),
  {
    current_runtime_verified_provider_ids: ['riosystems-native-web'],
    executors: {
      'riosystems-native-web': async () => ({
        ok: true,
        status: 'COMPLETED',
        outputs: {},
        actual_provider: 'make-core',
        executor_id: 'web-factory-native-v1',
        actual_cost_eur: 0,
        provider_call_count: 0,
        production_deploy: false
      })
    }
  }
);
assert.equal(mismatched.ok, false);
assert.equal(mismatched.error, 'PROVIDER_EXECUTION_TRUTH_MISMATCH');

const wrongExecutor = await executeCanonicalProviderRoute(
  envelope('riosystems-native-web', 'web.build', 'web-factory-native-v1'),
  {
    current_runtime_verified_provider_ids: ['riosystems-native-web'],
    executors: {
      'riosystems-native-web': async () => ({
        ok: true,
        status: 'COMPLETED',
        outputs: {},
        actual_provider: 'riosystems-native-web',
        executor_id: 'wrong-executor',
        actual_cost_eur: 0,
        provider_call_count: 0,
        production_deploy: false
      })
    }
  }
);
assert.equal(wrongExecutor.ok, false);
assert.equal(wrongExecutor.error, 'PROVIDER_EXECUTOR_ID_MISMATCH');

const notVerified = await executeCanonicalProviderRoute(
  envelope('riosystems-native-web', 'web.build', 'web-factory-native-v1'),
  {
    current_runtime_verified_provider_ids: [],
    executors: {
      'riosystems-native-web': async () => {
        throw new Error('executor must not run');
      }
    }
  }
);
assert.equal(notVerified.ok, false);
assert.equal(notVerified.error, 'PROVIDER_NOT_EXECUTION_READY');

const missingExecutor = await executeCanonicalProviderRoute(
  envelope('cloudflare-workers-free', 'web.deploy', 'cloudflare-staging-preview-v1'),
  {
    current_runtime_verified_provider_ids: ['cloudflare-workers-free'],
    synthetic_acceptance: true,
    executors: {}
  }
);
assert.equal(missingExecutor.ok, false);
assert.equal(missingExecutor.error, 'PROVIDER_EXECUTOR_NOT_CONFIGURED');

let paidExecutorCalls = 0;
const paidMission = missionFor('openai-api', 'ai.generate', 'openai-api-adapter-v1');
const paidBlocked = await executeReadyMissionTasks(
  paidMission,
  { default: { authorized: true, production_deploy: false } },
  {
    current_runtime_verified_provider_ids: ['openai-api'],
    provider_executors: {
      'openai-api': async () => {
        paidExecutorCalls += 1;
        return {
          ok: true,
          status: 'COMPLETED',
          outputs: {},
          actual_provider: 'openai-api',
          executor_id: 'openai-api-adapter-v1',
          actual_cost_eur: 0.01,
          provider_call_count: 1,
          production_deploy: false
        };
      }
    },
    max_tasks: 1
  }
);
assert.equal(paidBlocked.results[0].ok, false);
assert.equal(paidBlocked.results[0].error, 'PROVIDER_COST_APPROVAL_NOT_VALIDATED');
assert.equal(paidExecutorCalls, 0);

let externalCalls = 0;
const externalMission = missionFor('make-core', 'automation.run', 'make-staging-execution-runner-v1', {
  budget_reservation_ref: { reservation_id: 'reserve-make', reserved_cost_units: 0 },
  approval_ref: { approval_ids: ['approval-make'] }
});
const externalBlocked = await executeReadyMissionTasks(
  externalMission,
  { default: { authorized: true, production_deploy: false } },
  {
    current_runtime_verified_provider_ids: ['make-core'],
    provider_executors: {
      'make-core': async () => {
        externalCalls += 1;
        return {
          ok: true,
          status: 'COMPLETED',
          outputs: {},
          actual_provider: 'make-core',
          executor_id: 'make-staging-execution-runner-v1',
          actual_cost_eur: 0,
          provider_call_count: 1,
          external_side_effect_performed: true,
          production_deploy: false
        };
      }
    },
    max_tasks: 1
  }
);
assert.equal(externalBlocked.results[0].ok, false);
assert.equal(externalBlocked.results[0].error, 'PROVIDER_EXTERNAL_WRITE_POLICY_BLOCKED');
assert.equal(externalCalls, 0);

const productionBlocked = await executeReadyMissionTasks(
  realNativeMission,
  { default: { authorized: true, production_deploy: false } },
  {
    current_runtime_verified_provider_ids: ['riosystems-native-web'],
    web_task: {
      capability: 'web.build',
      input: {
        business_name: 'Should Not Run',
        industry: 'services',
        primary_goal: 'blocked',
        services: ['Website']
      }
    },
    max_tasks: 1,
    production_deploy: true
  }
);
assert.equal(productionBlocked.results[0].ok, false);
assert.equal(productionBlocked.results[0].error, 'PRODUCTION_SIDE_EFFECT_REJECTED');

const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const exactFixture = spawnSync(process.execPath, ['scripts/project-repair-wave9-gelato-full-integration-dogfood-smoke.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    RIOSYSTEMS_TEST_EXPECTED_CANONICAL: currentHead,
    RIOSYSTEMS_CANONICAL_FIXTURE_ONLY: '1'
  },
  encoding: 'utf8'
});
assert.equal(exactFixture.status, 0, exactFixture.stderr || exactFixture.stdout);
assert.match(exactFixture.stdout, new RegExp(currentHead));

const staleHead = currentHead === '0000000000000000000000000000000000000000'
  ? '1111111111111111111111111111111111111111'
  : '0000000000000000000000000000000000000000';
const staleFixture = spawnSync(process.execPath, ['scripts/project-repair-wave9-gelato-full-integration-dogfood-smoke.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    RIOSYSTEMS_TEST_EXPECTED_CANONICAL: staleHead,
    RIOSYSTEMS_CANONICAL_FIXTURE_ONLY: '1'
  },
  encoding: 'utf8'
});
assert.notEqual(staleFixture.status, 0);
assert.match(`${staleFixture.stderr}\n${staleFixture.stdout}`, /expected canonical must equal the actual CI checkout HEAD/i);

const manifest = missionExecutionRouterManifest();
assert.equal(manifest.provider_bound_execution, 'canonical_provider_route_required');
assert.equal(manifest.canonical_provider_executor, 'execution-adapters.executeCanonicalProviderRoute');
assert.equal(manifest.operator_ai_same_backbone, true);
assert.equal(manifest.universal_synthetic_path_classification, 'SYNTHETIC_TEST_HARNESS');

console.log(JSON.stringify({
  ok: true,
  suite: 'project-repair-final-canonical-provider-execution-seal-v1',
  canonical_provider_route_real_native_web: 'PASS',
  planned_actual_mismatch: 'FAIL_CLOSED',
  executor_id_mismatch: 'FAIL_CLOSED',
  provider_not_runtime_verified: 'FAIL_CLOSED',
  provider_executor_missing: 'FAIL_CLOSED',
  paid_without_scoped_cost_approval: 'FAIL_CLOSED',
  external_write_without_explicit_scope: 'FAIL_CLOSED',
  production_intent: 'FAIL_CLOSED',
  exact_current_canonical_fixture: 'PASS',
  stale_canonical_fixture: 'TEST_FAILURE_CONFIRMED',
  production_deploy: false,
  external_writes: false
}, null, 2));
