import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { buildTaskExecutionContract, executionContractSecurityHash } from '../src/orchestration-state.js';
import { createProviderRegistry } from '../src/runtime-governance.js';
import { createCostLedger, reserveCost, settleCost, releaseCost, runtimeCostLedgerManifest } from '../src/runtime-cost-ledger.js';
import { createApprovalRecord, createExecutionApprovalBinding, evaluateApproval, runtimeApprovalManifest } from '../src/runtime-approvals.js';
import { evaluateMissionRuntime, runtimeControlPlaneManifest } from '../src/runtime-control-plane.js';

const projectContext = {
  schema: 'aurentara.project-mission-context.v1',
  project: {
    operator_id: 'operator-repair',
    customer_id: 'wave4-customer',
    project_id: 'wave4-project',
    scope_key: 'wave4-customer:wave4-project'
  },
  knowledge_revision: 4,
  content_pack_ref: { pack_id: 'content-wave4', version: 1, knowledge_revision: 4 },
  visual_pack_ref: { pack_id: 'visual-wave4', version: 1, knowledge_revision: 4 },
  readiness_ref: { readiness_id: 'ready-wave4', status: 'READY', knowledge_revision: 4 },
  fact_version_refs: [],
  source_refs: [],
  rights_constraints: { publishable_rights: ['OWNED_CONFIRMED','CUSTOMER_LICENSED','CUSTOMER_ASSERTED'], approved_asset_ids: [], reference_content_copy_forbidden: true },
  human_decision_refs: [],
  approved_assets: [],
  assets: [],
  open_critical_conflicts: [],
  verified_content: { 'business.name': 'Wave 4 Fixture' },
  visual_context: {},
  visual_references: [],
  website_sources: [],
  constraints: [],
  quality_contract: { provenance_required: true, rights_enforced: true, critical_conflicts_blocked: true },
  deployment_policy: { staging_only: true, production_deploy: false }
};

const compiled = compileMissionPackage({
  prompt: 'Erstelle eine Support-KI.',
  project_context: projectContext,
  customer_id: 'wave4-customer',
  project_id: 'wave4-project',
  scope_key: 'wave4-customer:wave4-project'
});
assert.equal(compiled.ok, true);

const fullMission = structuredClone(compiled.package.mission);
const aiTask = fullMission.tasks.find((task) => task.domain === 'ai' || task.engine === 'ai');
assert.ok(aiTask, 'AI task required for Wave 4 fixture');
fullMission.tasks = [aiTask];

const routedMission = structuredClone(fullMission);
const routedTask = routedMission.tasks[0];
routedTask.execution_contract_binding = {
  mission_id: routedMission.mission_id,
  task_id: routedTask.task_id,
  factory: 'ai',
  capability: routedTask.capability,
  project_scope_key: 'wave4-customer:wave4-project',
  provider_route: {
    provider_id: 'openai-api',
    capability: 'ai.generate',
    route_primary: 'openai-api',
    fallback_provider_ids: []
  },
  executor_id: null,
  environment: 'staging',
  write_policy: 'NO_EXTERNAL_WRITES',
  production_policy: 'PRODUCTION_DISABLED'
};

const contract = buildTaskExecutionContract(routedMission, routedTask.task_id);
assert.equal(contract.ok, true);
assert.equal(contract.execution_contract_revision, 1);
assert.match(contract.execution_contract_hash, /^[a-f0-9]{64}$/);
assert.equal(contract.provider_route.provider_id, 'openai-api');
assert.equal(contract.environment, 'staging');
assert.equal(contract.write_policy, 'NO_EXTERNAL_WRITES');
assert.equal(contract.production_policy, 'PRODUCTION_DISABLED');

const approvalBinding = createExecutionApprovalBinding(contract, {
  provider_id: 'openai-api',
  cost_ceiling_eur: 3,
  write_scope: 'NO_EXTERNAL_WRITES',
  production_scope: 'PRODUCTION_DISABLED'
});
assert.equal(approvalBinding.execution_contract_hash, contract.execution_contract_hash);
assert.equal(approvalBinding.knowledge_revision, 4);
assert.equal(approvalBinding.cost_ceiling_eur, 3);

const scope = { customer_id: 'wave4-customer', project_id: 'wave4-project' };
const approvals = [
  createApprovalRecord({
    ...scope,
    approval_type: 'provider_cost',
    actor_id: 'operator-wave4',
    provider_id: 'openai-api',
    capability: 'ai.generate',
    granted: true,
    expires_at: '2099-01-01T00:00:00.000Z',
    binding: approvalBinding
  }).approval,
  createApprovalRecord({
    ...scope,
    approval_type: 'external_provider',
    actor_id: 'operator-wave4',
    provider_id: 'openai-api',
    capability: 'ai.generate',
    granted: true,
    expires_at: '2099-01-01T00:00:00.000Z',
    binding: approvalBinding
  }).approval
];

const approved = evaluateApproval(approvals, {
  ...scope,
  approval_type: 'provider_cost',
  provider_id: 'openai-api',
  capability: 'ai.generate',
  binding: approvalBinding,
  require_execution_binding: true
});
assert.equal(approved.approved, true);

const staleCostBinding = structuredClone(approvalBinding);
staleCostBinding.cost_ceiling_eur = 4;
const staleCost = evaluateApproval(approvals, {
  ...scope,
  approval_type: 'provider_cost',
  provider_id: 'openai-api',
  capability: 'ai.generate',
  binding: staleCostBinding,
  require_execution_binding: true
});
assert.equal(staleCost.approved, false);
assert.equal(staleCost.code, 'SCOPED_APPROVAL_BINDING_MISMATCH');

const staleKnowledgeBinding = structuredClone(approvalBinding);
staleKnowledgeBinding.knowledge_revision = 5;
assert.equal(evaluateApproval(approvals, {
  ...scope,
  approval_type: 'provider_cost',
  provider_id: 'openai-api',
  capability: 'ai.generate',
  binding: staleKnowledgeBinding,
  require_execution_binding: true
}).approved, false);

const staleEnvironmentBinding = structuredClone(approvalBinding);
staleEnvironmentBinding.environment = 'production';
assert.equal(evaluateApproval(approvals, {
  ...scope,
  approval_type: 'provider_cost',
  provider_id: 'openai-api',
  capability: 'ai.generate',
  binding: staleEnvironmentBinding,
  require_execution_binding: true
}).approved, false);

const registry = createProviderRegistry([
  {
    id: 'openai-api',
    capability: 'ai.generate',
    enabled: true,
    external: true,
    paid: true,
    estimated_cost_units: 3,
    priority: 10,
    runner: async () => ({ ok: true })
  }
]);

const runtime = evaluateMissionRuntime({ mission: fullMission }, {
  ...scope,
  registry,
  limit_cost_units: 10,
  approvals
});
assert.equal(runtime.ok, true);
assert.equal(runtime.blocked, false);
assert.equal(runtime.ready_for_supervised_execution, true);
assert.equal(runtime.ledger.reserved_cost_units, 3);
assert.equal(runtime.tasks.length, 1);
assert.equal(runtime.tasks[0].strict_execution_binding, true);
assert.equal(runtime.tasks[0].reservation.execution_id, contract.execution_id);
assert.equal(runtime.tasks[0].canonical_execution_contract.execution_contract_hash, contract.execution_contract_hash);
assert.equal(runtime.tasks[0].canonical_execution_contract.budget_reservation_ref.reservation_id, runtime.tasks[0].reservation.reservation_id);
assert.equal(runtime.tasks[0].canonical_execution_contract.approval_ref.approval_ids.length, 2);

const staleRuntime = evaluateMissionRuntime({ mission: fullMission }, {
  ...scope,
  registry,
  limit_cost_units: 10,
  approvals: approvals.map((record) => ({ ...record, binding: staleKnowledgeBinding }))
});
assert.equal(staleRuntime.blocked, true);
assert.equal(staleRuntime.tasks[0].approval_evidence.cost.code, 'SCOPED_APPROVAL_BINDING_MISMATCH');
assert.ok(staleRuntime.blockers.some((item) => item.code === 'PAID_PROVIDER_COST_APPROVAL_REQUIRED'));
assert.ok(staleRuntime.blockers.some((item) => item.code === 'EXTERNAL_PROVIDER_APPROVAL_REQUIRED'));

const ledger = createCostLedger({ ...scope, limit_cost_units: 10 }).ledger;
const reservationRequest = {
  reservation_id: 'wave4-reservation',
  cost_units: 3,
  provider_id: 'openai-api',
  capability: 'ai.generate',
  mission_id: contract.mission_id,
  task_id: contract.task_id,
  execution_id: contract.execution_id,
  ...scope,
  scope_key: 'wave4-customer:wave4-project',
  binding: approvalBinding
};
const firstReserve = reserveCost(ledger, reservationRequest);
assert.equal(firstReserve.ok, true);
assert.equal(firstReserve.ledger.reserved_cost_units, 3);

const duplicateReserve = reserveCost(firstReserve.ledger, reservationRequest);
assert.equal(duplicateReserve.ok, true);
assert.equal(duplicateReserve.duplicate, true);
assert.equal(duplicateReserve.ledger.reserved_cost_units, 3);

const changedExecution = reserveCost(firstReserve.ledger, { ...reservationRequest, execution_id: 'different-execution' });
assert.equal(changedExecution.ok, false);
assert.equal(changedExecution.error, 'COST_RESERVATION_IDEMPOTENCY_CONFLICT');

const crossScope = reserveCost(firstReserve.ledger, { ...reservationRequest, reservation_id: 'other', scope_key: 'other:scope' });
assert.equal(crossScope.ok, false);
assert.equal(crossScope.error, 'COST_RESERVATION_SCOPE_MISMATCH');

const settled = settleCost(firstReserve.ledger, {
  reservation_id: 'wave4-reservation',
  actual_cost_units: 2.5,
  execution_id: contract.execution_id,
  ...scope,
  scope_key: 'wave4-customer:wave4-project',
  binding: approvalBinding
});
assert.equal(settled.ok, true);
assert.equal(settled.ledger.spent_cost_units, 2.5);
assert.equal(settled.ledger.reserved_cost_units, 0);

const duplicateSettlement = settleCost(settled.ledger, {
  reservation_id: 'wave4-reservation',
  actual_cost_units: 2.5,
  execution_id: contract.execution_id,
  ...scope,
  scope_key: 'wave4-customer:wave4-project',
  binding: approvalBinding
});
assert.equal(duplicateSettlement.ok, true);
assert.equal(duplicateSettlement.duplicate, true);
assert.equal(duplicateSettlement.ledger.spent_cost_units, 2.5);

const conflictingSettlement = settleCost(settled.ledger, {
  reservation_id: 'wave4-reservation',
  actual_cost_units: 3,
  execution_id: contract.execution_id,
  ...scope,
  scope_key: 'wave4-customer:wave4-project',
  binding: approvalBinding
});
assert.equal(conflictingSettlement.ok, false);
assert.equal(conflictingSettlement.error, 'COST_TERMINAL_IDEMPOTENCY_CONFLICT');

const releaseAfterSettlement = releaseCost(settled.ledger, {
  reservation_id: 'wave4-reservation',
  execution_id: contract.execution_id,
  ...scope,
  scope_key: 'wave4-customer:wave4-project',
  binding: approvalBinding
});
assert.equal(releaseAfterSettlement.ok, false);
assert.equal(releaseAfterSettlement.error, 'COST_TERMINAL_IDEMPOTENCY_CONFLICT');

const sameSecurity = structuredClone(contract);
sameSecurity.approval_ref = { approval_ids: ['does-not-affect-security-hash'] };
sameSecurity.budget_reservation_ref = { reservation_id: 'does-not-affect-security-hash' };
assert.equal(executionContractSecurityHash(sameSecurity), contract.execution_contract_hash);

const changedRoute = structuredClone(contract);
changedRoute.provider_route.provider_id = 'different-provider';
assert.notEqual(executionContractSecurityHash(changedRoute), contract.execution_contract_hash);

const costManifest = runtimeCostLedgerManifest();
assert.equal(costManifest.retry_double_billing_blocked, true);
assert.equal(costManifest.scope_isolated, true);
const approvalManifest = runtimeApprovalManifest();
assert.equal(approvalManifest.supports_execution_contract_binding, true);
const runtimeManifest = runtimeControlPlaneManifest();
assert.equal(runtimeManifest.reservation_before_dispatch, true);
assert.equal(runtimeManifest.approval_binding_revalidated_on_security_change, true);
assert.equal(runtimeManifest.production_deploy, false);

console.log('PROJECT REPAIR Wave 4 cost + approval binding: OK');
