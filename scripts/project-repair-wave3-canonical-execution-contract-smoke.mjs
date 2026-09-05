import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { buildTaskExecutionContract } from '../src/orchestration-state.js';
import { buildAdapterDispatchEnvelope, resolveExecutionAdapter } from '../src/execution-adapters.js';
import { missionExecutionRouterManifest } from '../src/mission-execution-router.js';
import { factoryIntegrationBridgeManifest } from '../src/factory-integration-bridge.js';

const projectContext = {
  schema: 'aurentara.project-mission-context.v1',
  project: {
    operator_id: 'operator-repair',
    customer_id: 'wave3-customer',
    project_id: 'wave3-project',
    scope_key: 'wave3-customer:wave3-project'
  },
  knowledge_revision: 3,
  content_pack_ref: { pack_id: 'content-wave3', version: 1, knowledge_revision: 3 },
  visual_pack_ref: { pack_id: 'visual-wave3', version: 1, knowledge_revision: 3 },
  readiness_ref: { readiness_id: 'ready-wave3', status: 'READY', knowledge_revision: 3 },
  fact_version_refs: [],
  source_refs: [],
  rights_constraints: { publishable_rights: ['OWNED_CONFIRMED','CUSTOMER_LICENSED','CUSTOMER_ASSERTED'], approved_asset_ids: [], reference_content_copy_forbidden: true },
  human_decision_refs: [],
  approved_assets: [],
  assets: [],
  open_critical_conflicts: [],
  verified_content: { 'business.name': 'Wave 3 Fixture', 'website.primary_goal': 'Qualified leads' },
  visual_context: {},
  visual_references: [],
  website_sources: [],
  constraints: [],
  quality_contract: { provenance_required: true, rights_enforced: true, critical_conflicts_blocked: true },
  deployment_policy: { staging_only: true, production_deploy: false }
};

const compiled = compileMissionPackage({
  prompt: 'Baue eine Website, richte ein CRM ein, erstelle eine Support-KI und automatisiere eingehende Leads.',
  project_context: projectContext,
  customer_id: 'wave3-customer',
  project_id: 'wave3-project',
  scope_key: 'wave3-customer:wave3-project'
});
assert.equal(compiled.ok, true);

const mission = compiled.package.mission;
const contracts = mission.tasks.map((task) => buildTaskExecutionContract(mission, task.task_id));
assert.equal(contracts.length, 4);
assert.equal(contracts.every((contract) => contract.ok), true);
assert.deepEqual(new Set(contracts.map((contract) => contract.factory)), new Set(['web','business','ai','automation']));
assert.equal(contracts.every((contract) => contract.contract_version === 3), true);
assert.equal(contracts.every((contract) => contract.provider_execution_version === 'riosystems.provider-execution.v1'), true);
assert.equal(contracts.every((contract) => contract.customer_id === 'wave3-customer'), true);
assert.equal(contracts.every((contract) => contract.project_id === 'wave3-project'), true);
assert.equal(contracts.every((contract) => contract.project_scope_key === 'wave3-customer:wave3-project'), true);
assert.equal(new Set(contracts.map((contract) => contract.execution_id)).size, 4);
assert.equal(contracts.every((contract) => contract.environment === 'staging'), true);
assert.equal(contracts.every((contract) => contract.write_policy === 'NO_EXTERNAL_WRITES'), true);
assert.equal(contracts.every((contract) => contract.production_policy === 'PRODUCTION_DISABLED'), true);
assert.equal(contracts.every((contract) => contract.provider_route === null), true);
assert.equal(contracts.every((contract) => contract.executor_id === null), true);
assert.equal(contracts.every((contract) => contract.budget_reservation_ref === null), true);
assert.equal(contracts.every((contract) => contract.approval_ref === null), true);
assert.equal(contracts.every((contract) => contract.evidence_policy.actual_provider_from_executor_required === true), true);
assert.equal(contracts.every((contract) => contract.safeguards.canonical_execution_contract === true), true);

for (const original of contracts) {
  const readyContract = { ...original, state: 'READY' };
  const resolved = resolveExecutionAdapter(readyContract);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.adapter.engine, original.factory);
  const envelope = buildAdapterDispatchEnvelope(readyContract);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.envelope_version, 1);
  assert.equal(envelope.execution_id, original.execution_id);
  assert.equal(envelope.provider_execution_version, 'riosystems.provider-execution.v1');
  assert.equal(envelope.factory, original.factory);
  assert.equal(envelope.project_scope_key, 'wave3-customer:wave3-project');
  assert.equal(envelope.environment, 'staging');
  assert.equal(envelope.write_policy, 'NO_EXTERNAL_WRITES');
  assert.equal(envelope.production_policy, 'PRODUCTION_DISABLED');
  assert.equal(envelope.execution.canonical_execution_contract, true);
  assert.equal(envelope.execution.production_deploy, false);
  assert.equal(envelope.execution.external_writes, false);
}

const aiTask = mission.tasks.find((task) => task.domain === 'ai');
assert.ok(aiTask);
const boundMission = structuredClone(mission);
const boundTask = boundMission.tasks.find((task) => task.task_id === aiTask.task_id);
boundTask.execution_contract_binding = {
  mission_id: boundMission.mission_id,
  task_id: boundTask.task_id,
  factory: 'ai',
  capability: boundTask.capability,
  project_scope_key: 'wave3-customer:wave3-project',
  execution_id: 'execution-wave3-ai-001',
  provider_route: { provider_id: 'openai-api', capability: 'ai.generate', route_id: 'wave3-test-route' },
  executor_id: 'openai-executor-v1',
  budget_reservation_ref: { reservation_id: 'reservation-wave3-ai' },
  approval_ref: { approval_id: 'approval-wave3-ai' },
  environment: 'staging',
  write_policy: 'NO_EXTERNAL_WRITES',
  production_policy: 'PRODUCTION_DISABLED',
  evidence_policy: { actual_provider_from_executor_required: true, executor_identity_required: true, provider_execution_truth_validation_required: true }
};
const bound = buildTaskExecutionContract(boundMission, boundTask.task_id);
assert.equal(bound.ok, true);
assert.equal(bound.execution_id, 'execution-wave3-ai-001');
assert.equal(bound.provider_route.provider_id, 'openai-api');
assert.equal(bound.executor_id, 'openai-executor-v1');
assert.equal(bound.budget_reservation_ref.reservation_id, 'reservation-wave3-ai');
assert.equal(bound.approval_ref.approval_id, 'approval-wave3-ai');

const stableAgain = buildTaskExecutionContract(mission, aiTask.task_id);
assert.equal(stableAgain.execution_id, contracts.find((contract) => contract.task_id === aiTask.task_id).execution_id);

for (const [field, value, expected] of [
  ['factory', 'web', 'EXECUTION_BINDING_FACTORY_MISMATCH'],
  ['project_scope_key', 'other:scope', 'EXECUTION_BINDING_SCOPE_MISMATCH'],
  ['environment', 'production', 'EXECUTION_ENVIRONMENT_NOT_ALLOWED'],
  ['write_policy', 'EXTERNAL_WRITES_ALLOWED', 'EXECUTION_WRITE_POLICY_NOT_ALLOWED'],
  ['production_policy', 'PRODUCTION_ALLOWED', 'EXECUTION_PRODUCTION_POLICY_NOT_ALLOWED']
]) {
  const badMission = structuredClone(boundMission);
  const badTask = badMission.tasks.find((task) => task.task_id === aiTask.task_id);
  badTask.execution_contract_binding[field] = value;
  const result = buildTaskExecutionContract(badMission, badTask.task_id);
  assert.equal(result.ok, false);
  assert.equal(result.error, expected);
}

const wrongAdapter = resolveExecutionAdapter({ ...bound, state: 'READY', factory: 'web' });
assert.equal(wrongAdapter.ok, false);
assert.equal(wrongAdapter.error, 'EXECUTION_FACTORY_ADAPTER_MISMATCH');

const routerManifest = missionExecutionRouterManifest();
assert.equal(routerManifest.canonical_execution_contract, 'riosystems.provider-execution.v1');
assert.equal(routerManifest.shared_contract_for_all_factories, true);
assert.equal(routerManifest.universal_synthetic_path_classification, 'SYNTHETIC_TEST_HARNESS');

const bridgeManifest = factoryIntegrationBridgeManifest();
assert.match(bridgeManifest.canonical_execution_contract_source, /buildTaskExecutionContract/);
assert.match(bridgeManifest.shared_execution_envelope_source, /buildAdapterDispatchEnvelope/);

console.log('PROJECT REPAIR Wave 3 canonical execution contract: OK');
