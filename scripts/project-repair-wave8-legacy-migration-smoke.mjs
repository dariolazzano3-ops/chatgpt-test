import assert from 'node:assert/strict';
import { universalMissionRunManifest, runUniversalMission } from '../src/universal-mission-run.js';
import { buildProviderEcosystemProjection, operatorProviderPreflightManifest } from '../src/operator-provider-preflight-v1.js';
import { canonicalProviderExecutorDescriptor } from '../src/execution-adapters.js';
import { runtimeCostLedgerManifest } from '../src/runtime-cost-ledger.js';
import { runtimeApprovalManifest } from '../src/runtime-approvals.js';
import { operatorControlledPaidStagingDashboardManifest } from '../src/operator-controlled-paid-staging-dashboard-v1.js';
import { factoryIntegrationBridgeManifest } from '../src/factory-integration-bridge.js';

const universal = universalMissionRunManifest();
assert.equal(universal.legacy_classification, 'KEEP');
assert.equal(universal.runtime_role, 'SYNTHETIC_TEST_HARNESS');
assert.equal(universal.canonical_runtime_execution_route, false);
assert.equal(universal.synthetic_only, true);
assert.equal(universal.real_provider_calls, false);
assert.deepEqual(universal.canonical_factories, ['web','automation','ai','business']);
assert.deepEqual(universal.specialist_domains, ['growth_gtm','business_crm','analytics']);

const synthetic = runUniversalMission({
  customer_id: 'wave8-synthetic-customer',
  project_id: 'wave8-synthetic-project',
  business_name: 'Wave 8 Synthetic Fixture',
  industry: 'services',
  mission_text: 'Erstelle eine Website und verbessere die Kundengewinnung.',
  budget_policy: { variable_cost_ceiling_eur: 0 },
  data_policy: { synthetic_only: true, real_customer_data: false },
  environment: 'staging'
});
assert.equal(synthetic.ok, true);
assert.equal(synthetic.delivery.execution_evidence.mode, 'synthetic_staging');
assert.equal(synthetic.delivery.execution_evidence.real_provider_calls, 0);
assert.equal(synthetic.delivery.execution_evidence.external_writes, 0);
assert.equal(synthetic.delivery.production_deploy, false);

const ecosystem = buildProviderEcosystemProjection();
assert.equal(ecosystem.provider_selection_without_executor_is_runtime_execution, false);
assert.equal(ecosystem.legacy_provider_selection_runtime_route, 'DEPRECATED');
assert.equal(ecosystem.canonical_runtime_execution_source, 'execution-adapters.executeCanonicalProviderRoute');
assert.equal(ecosystem.active_runtime_requires_current_runtime_verification, true);
assert.equal(ecosystem.active_runtime_requires_canonical_executor, true);

const openai = ecosystem.provider_ecosystem.find((provider) => provider.id === 'openai-api');
assert.ok(openai);
assert.equal(openai.canonical_executor_available, true);
assert.equal(openai.canonical_executor_id, canonicalProviderExecutorDescriptor('openai-api').executor_id);
assert.equal(openai.current_runtime_verified, false);
assert.equal(openai.active_runtime, false);
assert.equal(openai.runtime_execution_route_status, 'SELECTION_ONLY_NOT_RUNTIME_EXECUTION');

const framer = ecosystem.provider_ecosystem.find((provider) => provider.id === 'framer-server-api');
assert.ok(framer);
assert.equal(canonicalProviderExecutorDescriptor('framer-server-api'), null);
assert.equal(framer.canonical_executor_available, false);
assert.equal(framer.active_runtime, false);
assert.equal(framer.runtime_execution_route_status, 'SELECTION_ONLY_NOT_RUNTIME_EXECUTION');

for (const provider of ecosystem.active_runtime_routes) {
  assert.equal(provider.current_runtime_verified, true);
  assert.equal(provider.canonical_executor_available, true);
  assert.equal(provider.runtime_execution_route_status, 'CANONICAL_EXECUTION_ROUTE_AVAILABLE');
}

const preflight = operatorProviderPreflightManifest();
assert.equal(preflight.legacy_classification, 'ADAPT');
assert.equal(preflight.provider_selection_without_executor_runtime_route, 'DEPRECATED');
assert.equal(preflight.canonical_runtime_execution_source, 'execution-adapters.executeCanonicalProviderRoute');

const cost = runtimeCostLedgerManifest();
assert.equal(cost.legacy_classification, 'ADAPT');
assert.equal(cost.legacy_cost_truth_status, 'MIGRATED_TO_CANONICAL_RUNTIME_COST_LEDGER');
assert.equal(cost.canonical_cost_truth, true);
assert.equal(cost.parallel_cost_engine, false);

const approval = runtimeApprovalManifest();
assert.equal(approval.legacy_classification, 'ADAPT');
assert.equal(approval.legacy_approval_status, 'MIGRATED_TO_CANONICAL_SCOPED_APPROVAL');
assert.equal(approval.canonical_approval_truth, true);
assert.equal(approval.parallel_approval_system, false);

const controlled = operatorControlledPaidStagingDashboardManifest();
assert.equal(controlled.legacy_classification, 'ADAPT');
assert.equal(controlled.migration_status, 'MIGRATED_TO_CANONICAL_EXECUTION_CONTRACT');
assert.equal(controlled.legacy_mission_compiler_kept_zero_cost_synthetic_for_planning_only, true);
assert.equal(controlled.legacy_provider_selection_without_executor_runtime_route, 'DEPRECATED');
assert.equal(controlled.canonical_executor_source, 'execution-adapters.executeCanonicalProviderRoute');
assert.equal(controlled.provider_routes_drive_actual_executor, true);
assert.equal(controlled.planned_dispatched_actual_truth_required, true);

const bridge = factoryIntegrationBridgeManifest();
assert.match(bridge.canonical_execution_contract_source, /buildTaskExecutionContract/);
assert.match(bridge.shared_execution_envelope_source, /buildAdapterDispatchEnvelope/);

console.log('PROJECT REPAIR Wave 8 legacy migration: OK');
