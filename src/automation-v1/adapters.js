import { makeStagingActivationManifest, bakeryMullerMakeStagingSpec } from '../make-staging-bridge.js';
import { makeStagingExecutionRunnerManifest } from '../make-staging-execution-runner.js';

const clone = (value) => structuredClone(value ?? null);

function genericScenarioSpec(plan, nodes) {
  return {
    schema: 'riosystems.automation-scenario-spec.v1',
    project: plan.mission.project,
    name: `RIOSYSTEMS STAGING - ${plan.mission.project} - ${plan.workflow_type}`,
    environment: 'staging',
    workflow_id: plan.workflow_id,
    nodes: nodes.map((node) => ({ id: node.id, type: node.type, depends_on: clone(node.depends_on), synthetic_test_data_only: true })),
    isolated_scenario_required: true,
    existing_operator_scenarios: 'DO_NOT_TOUCH',
    restore_inactive_required: true,
    synthetic_test_data_only: true,
    production: false
  };
}

export function compileMakeAdapterPlan(plan = {}) {
  const nodes = (plan.nodes || []).filter((node) => node.provider_id === 'make-core');
  if (!nodes.length) return null;
  const bakery = plan.mission?.project_id === 'bakery-muller' || /b.ckerei.*m.ller/i.test(plan.mission?.project || '');
  const referenceSpec = bakery ? bakeryMullerMakeStagingSpec() : null;
  return {
    provider_id: 'make-core',
    adapter: 'make-staging-bridge',
    activation: makeStagingActivationManifest(),
    execution_runner: makeStagingExecutionRunnerManifest(),
    scenario_spec: referenceSpec || genericScenarioSpec(plan, nodes),
    node_ids: nodes.map((node) => node.id),
    mode: 'PLAN_AND_SYNTHETIC_SIMULATION_ONLY',
    isolated_scenario_required: true,
    create_then_test_then_restore_inactive: true,
    existing_operator_scenarios: 'DO_NOT_TOUCH',
    provider_http_executed: false,
    paid_execution: false,
    variable_cost_eur: 0,
    production: false
  };
}

function compileGenericAdapterPlan(plan, providerId, adapter, rules = {}) {
  const nodes = (plan.nodes || []).filter((node) => node.provider_id === providerId);
  if (!nodes.length) return null;
  return {
    provider_id: providerId,
    adapter,
    node_ids: nodes.map((node) => node.id),
    mode: 'PLAN_AND_SYNTHETIC_SIMULATION_ONLY',
    isolated_workflow_required: true,
    external_provider_execution: false,
    ...clone(rules),
    paid_execution: false,
    variable_cost_eur: 0,
    production: false
  };
}

export function compileProviderPlans(routedPlan = {}) {
  if (!routedPlan.ok) return { ok: false, error: 'ROUTED_PLAN_REQUIRED', plans: [], production: false };
  const plans = [
    compileMakeAdapterPlan(routedPlan),
    compileGenericAdapterPlan(routedPlan, 'activepieces-cloud-free', 'activepieces-flow-adapter', { connection_required_before_external_execution: true }),
    compileGenericAdapterPlan(routedPlan, 'n8n-client-owned', 'n8n-client-instance-adapter', { client_owned_instance_required: true }),
    compileGenericAdapterPlan(routedPlan, 'cloudflare-workers-free', 'cloudflare-workers-micro-automation-adapter', { free_tier_hard_cap_required: true }),
    compileGenericAdapterPlan(routedPlan, 'riosystems-native-automation', 'native-deterministic-adapter', { repository_owned: true })
  ].filter(Boolean);
  return { ok: true, schema: 'riosystems.automation-provider-plans.v1', plans, external_provider_execution: false, variable_cost_eur: 0, production: false };
}
