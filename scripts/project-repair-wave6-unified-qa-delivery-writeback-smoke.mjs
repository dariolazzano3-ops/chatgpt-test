import assert from 'node:assert/strict';
import {
  createExecutionRun,
  checkpointExecution,
  runUnifiedQualityRepairFlow,
  finalizeOperationalDeliveryAndWriteback,
  executionDeliveryOperationsManifest
} from '../src/execution-delivery-operations.js';
import {
  createCustomerProject,
  assignProjectCapabilities,
  attachProjectMission,
  transitionCustomerProject,
  projectOperatingLayerManifest
} from '../src/project-operating-layer.js';
import { aggregateMissionDelivery, missionDeliveryAggregatorManifest } from '../src/mission-delivery-aggregator.js';
import { createOperatorRuntime, operatorRuntimeManifest } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { validateAdapterResult } from '../src/execution-adapters.js';

const providerValidated = validateAdapterResult({
  ok: true,
  execution_id: 'exec-evidence-1',
  provider_execution_version: 'riosystems.provider-execution.v1',
  provider_route: { provider_id: 'openai-api', capability: 'ai.generate' },
  executor_id: 'openai-api-adapter-v1'
}, {
  status: 'COMPLETED',
  outputs: { ai_output: 'bounded result' },
  dispatched_provider: 'openai-api',
  actual_provider: 'openai-api',
  executor_id: 'openai-api-adapter-v1',
  actual_cost_eur: 0.12,
  evidence: { source: 'SAFE_INJECTED_ACCEPTANCE' },
  production_deploy: false
});
assert.equal(providerValidated.ok, true);
assert.equal(providerValidated.result.outputs.execution_evidence.actual_provider, 'openai-api');
assert.equal(providerValidated.result.outputs.execution_evidence.actual_cost_eur, 0.12);
assert.equal(providerValidated.result.outputs.execution_evidence.evidence.source, 'SAFE_INJECTED_ACCEPTANCE');

let project = createCustomerProject({
  customer_id: 'wave6-customer',
  project_id: 'wave6-project',
  name: 'Wave 6 Integration Fixture',
  budget_cost_units: 25,
  actor: 'operator'
}).project;
project = assignProjectCapabilities(project, [
  { id: 'website', factory: 'web', required: true },
  { id: 'crm', factory: 'business', required: true },
  { id: 'support-ai', factory: 'ai', required: true },
  { id: 'lead-flow', factory: 'automation', required: true }
]).project;
project = transitionCustomerProject(project, { state: 'READY', actor: 'operator' }).project;
project = transitionCustomerProject(project, { state: 'ACTIVE', actor: 'operator' }).project;

const mission = {
  mission_id: 'mission-wave6',
  customer_id: project.customer_id,
  project_id: project.project_id,
  scope_key: project.scope_key,
  project: project.project_id,
  status: 'COMPLETED',
  tasks: [
    {
      task_id: 'task-web',
      capability: 'website',
      domain: 'web',
      engine: 'web',
      state: 'COMPLETED',
      attempt: 1,
      outputs: {
        project_slug: 'wave6-project',
        preview_url: 'https://example.invalid/wave6',
        commit_sha: 'abc123',
        qa_status: 'PASS',
        execution_evidence: {
          schema: 'riosystems.execution-evidence.v1',
          execution_id: 'exec-web',
          provider_execution_version: 'riosystems.provider-execution.v1',
          planned_provider: 'riosystems-native-web',
          dispatched_provider: 'riosystems-native-web',
          actual_provider: 'riosystems-native-web',
          executor_id: 'web-factory-native-v1',
          actual_cost_eur: 0.1,
          evidence: { acceptance: 'SAFE_INJECTED_RUNNER' },
          production_deploy: false
        }
      }
    },
    {
      task_id: 'task-business',
      capability: 'crm',
      domain: 'business',
      engine: 'business',
      state: 'COMPLETED',
      attempt: 1,
      outputs: {
        business_system: { crm: 'configured' },
        execution_evidence: {
          schema: 'riosystems.execution-evidence.v1',
          execution_id: 'exec-business',
          provider_execution_version: 'riosystems.provider-execution.v1',
          planned_provider: 'supabase-free',
          dispatched_provider: 'supabase-free',
          actual_provider: 'supabase-free',
          executor_id: 'supabase-staging-write-runner-v2',
          actual_cost_eur: 0.2,
          evidence: { acceptance: 'SAFE_INJECTED_RUNNER' },
          production_deploy: false
        }
      }
    },
    {
      task_id: 'task-ai',
      capability: 'support-ai',
      domain: 'ai',
      engine: 'ai',
      state: 'COMPLETED',
      attempt: 1,
      outputs: {
        ai_output: 'support AI ready',
        execution_evidence: {
          schema: 'riosystems.execution-evidence.v1',
          execution_id: 'exec-ai',
          provider_execution_version: 'riosystems.provider-execution.v1',
          planned_provider: 'openai-api',
          dispatched_provider: 'openai-api',
          actual_provider: 'openai-api',
          executor_id: 'openai-api-adapter-v1',
          actual_cost_eur: 0.3,
          evidence: { acceptance: 'SAFE_INJECTED_RUNNER' },
          production_deploy: false
        }
      }
    },
    {
      task_id: 'task-automation',
      capability: 'lead-flow',
      domain: 'automation',
      engine: 'automation',
      state: 'COMPLETED',
      attempt: 1,
      outputs: {
        result: { workflow: 'configured' },
        execution_evidence: {
          schema: 'riosystems.execution-evidence.v1',
          execution_id: 'exec-automation',
          provider_execution_version: 'riosystems.provider-execution.v1',
          planned_provider: 'make-core',
          dispatched_provider: 'make-core',
          actual_provider: 'make-core',
          executor_id: 'make-staging-execution-runner-v1',
          actual_cost_eur: 0.4,
          evidence: { acceptance: 'SAFE_INJECTED_RUNNER' },
          production_deploy: false
        }
      }
    }
  ]
};

project = attachProjectMission(project, mission).project;

const qualityByTask = Object.fromEntries(mission.tasks.map((task) => [task.task_id, {
  status: 'PASS',
  score: 100,
  repair_rounds: 0
}]));

const aggregated = aggregateMissionDelivery(mission, { quality_by_task: qualityByTask });
assert.equal(aggregated.ok, true);
assert.equal(aggregated.structural_completion, true);
assert.equal(aggregated.counts.provider_truth_failures, 0);
assert.equal(aggregated.standard_delivery_results.length, 4);
assert.equal(aggregated.standard_delivery_results.find((item) => item.task_id === 'task-ai').actual_provider, 'openai-api');
assert.equal(aggregated.standard_delivery_results.find((item) => item.task_id === 'task-ai').actual_cost_eur, 0.3);
assert.equal(aggregated.standard_delivery_results.find((item) => item.task_id === 'task-web').preview, 'https://example.invalid/wave6');

const mismatchMission = structuredClone(mission);
mismatchMission.tasks[0].outputs.execution_evidence.actual_provider = 'cloudflare-workers-free';
const mismatched = aggregateMissionDelivery(mismatchMission, { quality_by_task: qualityByTask });
assert.equal(mismatched.structural_completion, false);
assert.equal(mismatched.counts.provider_truth_failures, 1);
assert.equal(mismatched.unresolved.some((item) => item.error?.code === 'PROVIDER_EXECUTION_TRUTH_MISMATCH'), true);

let repairRun = createExecutionRun(project, { run_id: 'repair-run', max_attempts: 3 }).run;
repairRun = checkpointExecution(repairRun, { status: 'RUNNING', actor: 'operator' }).run;
const repairFlow = await runUnifiedQualityRepairFlow(repairRun, {
  mission_completed: true,
  capability_outputs_present: true,
  regression_passed: false,
  scope_verified: true,
  costs_reconciled: true,
  repairable_failure: true,
  failure_class: 'REPAIRABLE_FAILURE'
}, {
  actor: 'operator',
  repair: async () => ({
    ok: true,
    execution_attempted: true,
    evidence: { regression_passed: true },
    failure_class: null,
    repairable_failure: false
  })
});
assert.equal(repairFlow.ok, true);
assert.equal(repairFlow.status, 'QUALITY_PASS_AFTER_REPAIR');
assert.equal(repairFlow.repair_rounds, 1);
assert.equal(repairFlow.run.attempt, 2);

const approvalBlockedRepair = await runUnifiedQualityRepairFlow(repairRun, {
  mission_completed: true,
  capability_outputs_present: true,
  regression_passed: false,
  scope_verified: true,
  costs_reconciled: true,
  repairable_failure: true,
  failure_class: 'REPAIRABLE_FAILURE',
  repair_change: { provider_changed: true }
}, {
  repair: async () => ({ ok: true, evidence: { regression_passed: true } })
});
assert.equal(approvalBlockedRepair.ok, false);
assert.equal(approvalBlockedRepair.error, 'REPAIR_APPROVAL_REVALIDATION_REQUIRED');
assert.deepEqual(approvalBlockedRepair.approval_recheck_fields, ['provider_changed']);

const runtimeCreated = createOperatorRuntime({
  operator_id: 'operator-wave6',
  portfolio: { operator_id: 'operator-wave6', projects: [project] },
  selected_project_scope: project.scope_key
});
assert.equal(runtimeCreated.ok, true);
const store = createMemoryOperatorRuntimeStore([runtimeCreated.runtime]);

let run = createExecutionRun(project, { run_id: 'delivery-run', max_attempts: 3 }).run;
run = checkpointExecution(run, { status: 'RUNNING', actor: 'operator' }).run;
const deliveryEvidence = {
  mission,
  quality_by_task: qualityByTask,
  capabilities: project.capabilities.map((item) => ({ id: item.id, completed: true })),
  mission_completed: true,
  capability_outputs_present: true,
  regression_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  actor: 'operator',
  delivery_id: 'delivery-wave6'
};
const written = await finalizeOperationalDeliveryAndWriteback(project, run, deliveryEvidence, {
  actor: 'operator',
  runtime: runtimeCreated.runtime,
  runtime_store: store,
  expected_runtime_revision: 1
});
assert.equal(written.ok, true);
assert.equal(written.status, 'DELIVERY_WRITTEN_BACK');
assert.equal(written.project.state, 'DELIVERED');
assert.equal(written.project.project_revision, 1);
assert.equal(written.project_revision_before, 0);
assert.equal(written.project_revision_after, 1);
assert.equal(written.project.deliveries.length, 1);
assert.equal(written.project.deliveries[0].standard_results.length, 4);
assert.equal(written.project.capabilities.every((item) => item.status === 'COMPLETED'), true);
assert.equal(written.project.missions.find((item) => item.mission_id === mission.mission_id)?.status, 'DELIVERED');
assert.equal(written.project.last_actual_cost_eur, 1);
assert.equal(written.delivery.actual_cost_eur, 1);
assert.equal(written.delivery.preview, 'https://example.invalid/wave6');
assert.equal(written.repair_rounds, 0);
assert.equal(written.runtime.revision, 2);
assert.equal(written.runtime_revision_before, 1);
assert.equal(written.runtime_revision_after, 2);
assert.equal(written.runtime.command_center_state.portfolio.projects[0].state, 'DELIVERED');
assert.equal(written.runtime.command_center_state.portfolio.projects[0].last_delivery_ref, 'delivery-wave6');
assert.equal(written.audit_refs.length, 2);
assert.equal(written.production_deploy, false);

const persisted = await store.load('operator-wave6');
assert.equal(persisted.revision, 2);
assert.equal(persisted.command_center_state.portfolio.projects[0].last_delivery_ref, 'delivery-wave6');

const duplicate = await finalizeOperationalDeliveryAndWriteback(written.project, run, deliveryEvidence, {
  actor: 'operator',
  runtime: written.runtime,
  runtime_store: store,
  expected_runtime_revision: 2
});
assert.equal(duplicate.ok, true);
assert.equal(duplicate.project_revision_before, 1);
assert.equal(duplicate.project_revision_after, 1);
assert.equal(duplicate.runtime_revision_before, 2);
assert.equal(duplicate.runtime_revision_after, 2);
assert.equal(duplicate.project.deliveries.length, 1);
assert.equal(duplicate.persistence.duplicate, true);
const persistedAfterDuplicate = await store.load('operator-wave6');
assert.equal(persistedAfterDuplicate.revision, 2);

const staleRuntime = await finalizeOperationalDeliveryAndWriteback(project, run, deliveryEvidence, {
  actor: 'operator',
  runtime: written.runtime,
  runtime_store: store,
  expected_runtime_revision: 1
});
assert.equal(staleRuntime.ok, false);
assert.equal(staleRuntime.error, 'RUNTIME_REVISION_CONFLICT');

const opsManifest = executionDeliveryOperationsManifest();
assert.equal(opsManifest.max_repair_rounds, 2);
assert.equal(opsManifest.max_execution_attempts, 3);
assert.equal(opsManifest.approval_recheck_on_security_sensitive_repair, true);
assert.equal(opsManifest.standard_delivery_result_writeback, true);

const deliveryManifest = missionDeliveryAggregatorManifest();
assert.equal(deliveryManifest.standard_delivery_result_v1, true);
assert.equal(deliveryManifest.provider_execution_truth_forwarded, true);
assert.equal(deliveryManifest.provider_truth_failure_blocks_structural_completion, true);

const projectManifest = projectOperatingLayerManifest();
assert.equal(projectManifest.idempotent_delivery_writeback, true);
assert.equal(projectManifest.project_revision_writeback, true);

const runtimeManifest = operatorRuntimeManifest();
assert.equal(runtimeManifest.local_mutations.includes('record_project_delivery_writeback'), true);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-repair-wave6-unified-qa-delivery-writeback-v1',
  provider_truth: 'PASS',
  bounded_repair: 'PASS',
  approval_revalidation: 'PASS',
  project_writeback: 'PASS',
  operator_runtime_cas: 'PASS',
  paid_provider_calls: 0,
  external_writes: false,
  production_deploy: false
}, null, 2));
