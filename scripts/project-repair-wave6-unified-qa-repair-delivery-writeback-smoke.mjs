import assert from 'node:assert/strict';
import {
  createExecutionRun,
  checkpointExecution,
  runUnifiedQualityRepair,
  finalizeUnifiedOperationalDelivery
} from '../src/execution-delivery-operations.js';
import {
  createCustomerProject,
  assignProjectCapabilities,
  attachProjectMission,
  transitionCustomerProject
} from '../src/project-operating-layer.js';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';

const mission = {
  mission_id: 'mission-wave6',
  orchestration_id: 'orchestration-wave6',
  customer_id: 'customer-wave6',
  project_id: 'project-wave6',
  scope_key: 'customer-wave6:project-wave6',
  project: 'project-wave6',
  prompt: 'Unified QA repair delivery acceptance',
  status: 'COMPLETED',
  tasks: [
    {
      task_id: 'task-web',
      capability: 'web_generate',
      domain: 'web',
      engine: 'web',
      state: 'COMPLETED',
      attempt: 1,
      outputs: { preview_url: 'https://preview.invalid/wave6', qa_status: 'passed', artifacts: [{ type: 'website', ref: 'artifact-web' }] },
      inputs: { dispatch_envelope: { execution_id: 'execution-web', provider_execution_version: 'riosystems.provider-execution.v1', provider_route: { provider_id: 'riosystems-native-web', capability: 'web.build' } } }
    },
    {
      task_id: 'task-ai',
      capability: 'ai_system_build',
      domain: 'ai',
      engine: 'ai',
      state: 'COMPLETED',
      attempt: 1,
      outputs: { ai_output: { answer: 'ready' }, provider: 'openai-api', artifacts: [{ type: 'ai-output', ref: 'artifact-ai' }] },
      inputs: { dispatch_envelope: { execution_id: 'execution-ai', provider_execution_version: 'riosystems.provider-execution.v1', provider_route: { provider_id: 'openai-api', capability: 'ai.generate' } } }
    }
  ]
};

let project = createCustomerProject({
  customer_id: 'customer-wave6',
  project_id: 'project-wave6',
  name: 'Wave 6 Project',
  budget_cost_units: 25
}).project;
project = assignProjectCapabilities(project, [
  { id: 'web_generate', factory: 'web', required: true },
  { id: 'ai_system_build', factory: 'ai', required: true }
]).project;
project = attachProjectMission(project, {
  mission_id: mission.mission_id,
  customer_id: project.customer_id,
  project_id: project.project_id,
  status: 'COMPLETED'
}).project;
project = transitionCustomerProject(project, { state: 'READY', actor: 'system' }).project;
project = transitionCustomerProject(project, { state: 'ACTIVE', actor: 'system' }).project;

let run = createExecutionRun(project, { run_id: 'run-wave6' }).run;
run = checkpointExecution(run, { status: 'RUNNING', mission_id: mission.mission_id }).run;
run = checkpointExecution(run, { status: 'QA', mission_id: mission.mission_id }).run;

const runtimeCreated = createOperatorRuntime({
  operator_id: 'operator-wave6',
  portfolio: { operator_id: 'operator-wave6', projects: [project] },
  selected_project_scope: project.scope_key
});
assert.equal(runtimeCreated.ok, true);
const store = createMemoryOperatorRuntimeStore();
const service = createOperatorRuntimeApiService({
  operator_id: 'operator-wave6',
  store,
  initial_runtime: runtimeCreated.runtime
});

let validatorCalls = 0;
const evidence = {
  qa_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  execution_results: {
    'task-web': {
      execution_id: 'execution-web',
      provider_truth: {
        planned_provider: 'riosystems-native-web',
        dispatched_provider: 'riosystems-native-web',
        actual_provider: 'riosystems-native-web',
        executor_id: 'web-factory-native-v1'
      },
      actual_cost_eur: 0
    },
    'task-ai': {
      execution_id: 'execution-ai',
      provider_truth: {
        planned_provider: 'openai-api',
        dispatched_provider: 'openai-api',
        actual_provider: 'openai-api',
        executor_id: 'openai-api-adapter-v1'
      },
      actual_cost_eur: 0.2
    }
  },
  task_quality: {
    'task-web': { status: 'PASS', score: 96 },
    'task-ai': { status: 'PASS', score: 95 }
  },
  actor: 'operator-wave6',
  now: '2026-09-05T12:30:00.000Z'
};

const finalized = await finalizeUnifiedOperationalDelivery(
  project,
  run,
  { mission },
  evidence,
  {
    operator_runtime_service: service,
    runtime_revision: 1,
    validate: async (candidate) => {
      validatorCalls += 1;
      if (candidate.evidence.repaired === true) return { passed: true, quality: { status: 'PASS', score: 95 } };
      return { passed: false, repairable: true, quality: { status: 'REPAIRABLE_FAILURE', score: 88 }, code: 'SAFE_REPAIR_REQUIRED' };
    },
    repair: async (candidate) => ({
      result: { ...candidate, evidence: { ...candidate.evidence, repaired: true } },
      applied: true,
      provider_changed: false,
      cost_ceiling_exceeded: false,
      external_write_scope_expanded: false,
      production_scope_changed: false,
      knowledge_revision_changed: false
    })
  }
);
assert.equal(finalized.ok, true);
assert.equal(finalized.project.state, 'DELIVERED');
assert.equal(finalized.quality.status, 'PASS');
assert.equal(finalized.quality.repair_rounds, 1);
assert.equal(validatorCalls, 2);
assert.equal(finalized.standard_results.length, 2);
assert.equal(finalized.standard_results.every((item) => item.provider_truth_verified === true), true);
assert.equal(finalized.standard_results.find((item) => item.factory === 'ai').actual_provider, 'openai-api');
assert.equal(finalized.standard_results.find((item) => item.factory === 'ai').actual_cost, 0.2);
assert.equal(finalized.standard_results.find((item) => item.factory === 'web').preview.url, 'https://preview.invalid/wave6');
assert.equal(finalized.operator_context_updated, true);
assert.equal(finalized.runtime_revision, 2);
assert.equal(finalized.run.status, 'DELIVERED');
assert.equal(finalized.project.deliveries.length, 2);
assert.equal(finalized.project.audit.some((item) => item.event === 'PROJECT_DELIVERY_RECORDED'), true);
assert.equal(finalized.project.audit.some((item) => item.event === 'PROJECT_STATE_CHANGED' && item.state === 'DELIVERED'), true);

const persisted = await store.load('operator-wave6');
assert.equal(persisted.revision, 2);
const persistedProject = persisted.command_center_state.portfolio.projects.find((item) => item.scope_key === project.scope_key);
assert.equal(persistedProject.state, 'DELIVERED');
assert.equal(persistedProject.deliveries.length, 2);
assert.equal(persisted.audit.some((item) => item.event === 'CANONICAL_PROJECT_DELIVERY_RECORDED'), true);
assert.equal(persisted.missions.some((item) => item.mission_id === mission.mission_id && item.delivery_id === 'mission-wave6:aggregate:delivery'), true);

const approvalRecheck = await runUnifiedQualityRepair(
  { aggregate: { structural_completion: true }, evidence: {} },
  {
    validate: async () => ({ passed: false, repairable: true, quality: { status: 'REPAIRABLE_FAILURE' } }),
    repair: async (candidate) => ({ result: candidate, applied: true, provider_changed: true })
  }
);
assert.equal(approvalRecheck.ok, false);
assert.equal(approvalRecheck.status, 'APPROVAL_RECHECK_REQUIRED');
assert.deepEqual(approvalRecheck.approval_recheck_reasons, ['PROVIDER_CHANGED']);

const humanBlocker = await runUnifiedQualityRepair(
  { aggregate: { structural_completion: false }, evidence: {} },
  { validate: async () => ({ passed: false, repairable: false, human_blocker: true, code: 'HUMAN_INPUT_REQUIRED' }) }
);
assert.equal(humanBlocker.ok, false);
assert.equal(humanBlocker.status, 'HUMAN_EXTERNAL_BLOCKER');
assert.equal(humanBlocker.user_action_required, true);

const mismatchProject = structuredClone(project);
const mismatchRun = structuredClone(run);
const mismatchEvidence = structuredClone(evidence);
mismatchEvidence.execution_results['task-ai'].provider_truth.actual_provider = 'make-core';
const mismatch = await finalizeUnifiedOperationalDelivery(
  mismatchProject,
  mismatchRun,
  { mission },
  mismatchEvidence,
  {
    operator_runtime_service: service,
    runtime_revision: 2,
    validate: async () => ({ passed: true, quality: { status: 'PASS' } })
  }
);
assert.equal(mismatch.ok, false);
assert.equal(mismatch.error, 'PROVIDER_EXECUTION_TRUTH_MISMATCH');

const missingRuntime = await finalizeUnifiedOperationalDelivery(
  project,
  run,
  { mission },
  evidence,
  { validate: async () => ({ passed: true, quality: { status: 'PASS' } }) }
);
assert.equal(missingRuntime.ok, false);
assert.equal(missingRuntime.error, 'OPERATOR_RUNTIME_WRITEBACK_REQUIRED');

console.log('PROJECT REPAIR Wave 6 unified QA repair delivery writeback: OK');
