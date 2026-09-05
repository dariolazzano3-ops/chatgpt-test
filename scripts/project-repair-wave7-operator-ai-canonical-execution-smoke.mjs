import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/runtime-governance.js';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { evaluateMissionRuntime } from '../src/runtime-control-plane.js';
import {
  handleOperatorAiMessage,
  handleOperatorAiCanonicalExecutionRequest,
  operatorAiServiceManifest
} from '../src/operator-ai/service-v1.js';
import { interpretOperatorAiResult, operatorAiResultInterpreterManifest } from '../src/operator-ai/result-interpreter-v1.js';

const canonicalHead = 'b4c52b0c375238c52caca085c1b3576f54199338';
const prompt = 'Implementiere eine Website für wave7-project.';

const projectContext = {
  schema: 'aurentara.project-mission-context.v1',
  project: {
    operator_id: 'operator-wave7',
    customer_id: 'wave7-customer',
    project_id: 'wave7-project',
    scope_key: 'wave7-customer:wave7-project'
  },
  knowledge_revision: 7,
  content_pack_ref: { pack_id: 'content-wave7', version: 1, knowledge_revision: 7 },
  visual_pack_ref: { pack_id: 'visual-wave7', version: 1, knowledge_revision: 7 },
  readiness_ref: { readiness_id: 'ready-wave7', status: 'READY', knowledge_revision: 7 },
  fact_version_refs: [],
  source_refs: ['wave7-fixture-source'],
  rights_constraints: {
    publishable_rights: ['OWNED_CONFIRMED','CUSTOMER_LICENSED','CUSTOMER_ASSERTED'],
    approved_asset_ids: [],
    reference_content_copy_forbidden: true
  },
  human_decision_refs: [],
  approved_assets: [],
  assets: [],
  open_critical_conflicts: [],
  verified_content: {
    'business.name': 'Wave 7 Fixture',
    'website.primary_goal': 'Qualified leads'
  },
  content_provenance: [{
    field_path: 'business.name',
    source_refs: ['wave7-fixture-source'],
    verification_status: 'OPERATOR_CONFIRMED'
  }],
  visual_context: {},
  visual_references: [],
  website_sources: [],
  constraints: [],
  quality_contract: { provenance_required: true, rights_enforced: true, critical_conflicts_blocked: true },
  deployment_policy: { staging_only: true, production_deploy: false }
};

const project = {
  customer_id: 'wave7-customer',
  project_id: 'wave7-project',
  scope_key: 'wave7-customer:wave7-project',
  name: 'Wave 7 Fixture',
  state: 'ACTIVE',
  environment: 'staging',
  blockers: []
};

const registry = createProviderRegistry([
  {
    id: 'riosystems-native-web',
    capability: 'web.build',
    enabled: true,
    external: false,
    paid: false,
    estimated_cost_units: 0,
    priority: 10,
    runner: async () => ({ ok: true })
  }
]);

const runtimeConfig = {
  registry,
  limit_cost_units: 0,
  approvals: [],
  provider_health: {}
};

const contextInput = {
  projects: [project],
  selected_project_scope: project.scope_key,
  project_state: project,
  project_context: projectContext,
  canonical_source: {
    canonical_branch: 'factory-control',
    canonical_head: canonicalHead,
    tree_sha: 'dce3d83111ffa4ec97894ab76280e5d381527436',
    verified_at: '2026-09-05T12:30:30.000Z'
  },
  mission_state: { status: 'READY' },
  quality_state: { hard_failures: [], dimensions: [] },
  provider_state: {
    provider_ecosystem: [
      { id: 'riosystems-native-web', runtime_eligible: true, connection_state: 'CONNECTED_STAGING' }
    ]
  },
  cost_state: {
    approval_required: false,
    cost_ceiling: 0,
    paid_provider_calls_expected: 0
  },
  approval_state: { approvals: [] },
  release_state: { production_approval_required: true, operator_production_approval: false },
  delivery_state: { status: 'NOT_STARTED' },
  recent_evidence: [],
  unknowns: [],
  conflicts: [],
  runtime_config: runtimeConfig
};

const options = {
  now: '2026-09-05T12:30:31.000Z',
  safe_internal_execution_active: true
};

const operatorPrepared = handleOperatorAiMessage({ message: prompt }, contextInput, options);
assert.equal(operatorPrepared.ok, true);
assert.equal(operatorPrepared.intent.execution_requested, true);
assert.equal(operatorPrepared.execution.actual_autonomy, 4);
assert.equal(operatorPrepared.execution.started, false);
assert.equal(operatorPrepared.canonical_execution.ok, true);
assert.equal(operatorPrepared.canonical_execution.ready_for_submission, true);
assert.equal(operatorPrepared.canonical_execution.execution_backbone, 'mission-execution-router.executeReadyMissionTasks');

const directCompiled = compileMissionPackage({
  prompt,
  project_context: projectContext,
  customer_id: project.customer_id,
  project_id: project.project_id,
  scope_key: project.scope_key,
  canonical_branch: 'factory-control',
  active_revision: canonicalHead,
  project_head: canonicalHead,
  mission_revision: canonicalHead,
  expected_parent_sha: canonicalHead
});
assert.equal(directCompiled.ok, true);

const directRuntime = evaluateMissionRuntime(directCompiled.package, {
  ...runtimeConfig,
  customer_id: project.customer_id,
  project_id: project.project_id,
  require_canonical_execution_binding: true
});
assert.equal(directRuntime.ok, true);
assert.equal(directRuntime.blocked, false);
assert.equal(directRuntime.ready_for_supervised_execution, true);

const operatorContracts = operatorPrepared.canonical_execution.contracts;
assert.equal(operatorContracts.length, directRuntime.tasks.length);
for (const operatorContract of operatorContracts) {
  const directContract = directRuntime.tasks.find((task) => task.task_id === operatorContract.task_id)?.canonical_execution_contract;
  assert.ok(directContract);
  assert.equal(operatorContract.mission_id, directContract.mission_id);
  assert.equal(operatorContract.execution_id, directContract.execution_id);
  assert.equal(operatorContract.execution_contract_hash, directContract.execution_contract_hash);
  assert.equal(operatorContract.provider_route.provider_id, directContract.provider_route.provider_id);
  assert.equal(operatorContract.budget_reservation_ref.reservation_id, directContract.budget_reservation_ref.reservation_id);
  assert.deepEqual(operatorContract.approval_ref, directContract.approval_ref);
  assert.equal(operatorContract.environment, directContract.environment);
  assert.equal(operatorContract.write_policy, directContract.write_policy);
  assert.equal(operatorContract.production_policy, directContract.production_policy);
}

const withoutRuntime = handleOperatorAiMessage(
  { message: prompt },
  { ...contextInput, runtime_config: undefined },
  options
);
assert.equal(withoutRuntime.canonical_execution.ok, true);
assert.equal(withoutRuntime.canonical_execution.status, 'PREPARED_RUNTIME_BINDING_REQUIRED');
assert.equal(withoutRuntime.canonical_execution.ready_for_submission, false);
assert.equal(withoutRuntime.execution.started, false);

const safeInternalOff = await handleOperatorAiCanonicalExecutionRequest(
  { message: prompt },
  contextInput,
  { ...options, safe_internal_execution_active: false, submit_canonical_execution: true }
);
assert.equal(safeInternalOff.status, 'PREPARED_BUT_BLOCKED');
assert.equal(safeInternalOff.error, 'SAFE_INTERNAL_EXECUTION_NOT_ACTIVATED');
assert.equal(safeInternalOff.execution.started, false);

const preparedOnly = await handleOperatorAiCanonicalExecutionRequest(
  { message: prompt },
  contextInput,
  { ...options, submit_canonical_execution: false }
);
assert.equal(preparedOnly.status, 'READY_FOR_CANONICAL_SUBMISSION');
assert.equal(preparedOnly.execution.canonical_contract_prepared, true);
assert.equal(preparedOnly.execution.canonical_ready_for_submission, true);
assert.equal(preparedOnly.execution.started, false);

const submitted = await handleOperatorAiCanonicalExecutionRequest(
  { message: prompt },
  contextInput,
  {
    ...options,
    submit_canonical_execution: true,
    dispatch_approvals: { default: { authorized: true, production_deploy: false } },
    execution_options: { project_slug: 'wave7-project' },
    max_tasks: 1,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  }
);
assert.equal(submitted.ok, true);
assert.equal(submitted.status, 'COMPLETED');
assert.equal(submitted.execution.started, true);
assert.equal(submitted.execution.backbone, 'mission-execution-router.executeReadyMissionTasks');
assert.equal(submitted.canonical_execution_result.executed_count, 1);
assert.equal(submitted.canonical_execution_result.pending_external_tasks.length, 0);
assert.equal(submitted.canonical_execution_result.results[0].execution_mode, 'canonical_provider_route');
assert.equal(submitted.canonical_execution_result.results[0].provider_truth.planned_provider, 'riosystems-native-web');
assert.equal(submitted.canonical_execution_result.results[0].provider_truth.dispatched_provider, 'riosystems-native-web');
assert.equal(submitted.canonical_execution_result.results[0].provider_truth.actual_provider, 'riosystems-native-web');
assert.equal(submitted.canonical_execution_result.results[0].provider_truth.executor_id, 'web-factory-native-v1');
assert.equal(submitted.result_interpretation.status, 'COMPLETED');
assert.equal(submitted.result_interpretation.canonical_execution, true);
assert.equal(submitted.result_interpretation.pending_external_tasks.length, 0);
assert.equal(submitted.production_deploy, false);
assert.equal(submitted.external_writes, false);

const pendingInterpretation = interpretOperatorAiResult({
  ok: true,
  status: 'RUNNING',
  canonical_execution: true,
  pending_external_tasks: ['task-web'],
  blockers: []
});
assert.equal(pendingInterpretation.status, 'IN_PROGRESS');
assert.notEqual(pendingInterpretation.status, 'COMPLETED');

const completedInterpretation = interpretOperatorAiResult({
  ok: true,
  status: 'COMPLETED',
  canonical_execution: true,
  pending_external_tasks: [],
  blockers: []
});
assert.equal(completedInterpretation.status, 'COMPLETED');

const serviceManifest = operatorAiServiceManifest();
assert.equal(serviceManifest.one_central_operator_ai, true);
assert.equal(serviceManifest.second_mission_engine, false);
assert.equal(serviceManifest.second_state_system, false);
assert.equal(serviceManifest.canonical_mission_compiler, 'mission-compiler.compileMissionPackage');
assert.equal(serviceManifest.canonical_runtime_binding, 'runtime-control-plane.evaluateMissionRuntime');
assert.equal(serviceManifest.canonical_execution_backbone, 'mission-execution-router.executeReadyMissionTasks');
assert.equal(serviceManifest.canonical_provider_executor, 'execution-adapters.executeCanonicalProviderRoute');

const interpreterManifest = operatorAiResultInterpreterManifest();
assert.equal(interpreterManifest.canonical_in_progress_distinct_from_success, true);
assert.equal(interpreterManifest.unsupported_execution_success_never_projected, true);
assert.equal(interpreterManifest.production_deploy, false);

console.log('PROJECT REPAIR Wave 7 Operator AI canonical execution integration: OK');
