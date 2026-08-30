import { buildMakeSafeStagingExecutionPlan, runMakeStagingScenarioOnce } from './make-staging-execution-runner.js';
import { bakeryMullerBlock6SyntheticLead, bakeryMullerBlock6Manifest } from './bakery-muller-live-e2e.js';

const clone = (value) => structuredClone(value ?? null);

function exactPayload(payload = {}) {
  const expected = bakeryMullerBlock6SyntheticLead();
  return JSON.stringify(payload) === JSON.stringify(expected);
}

export function buildBlock6MakeExecutionPlan(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const manifest = bakeryMullerBlock6Manifest();
  if (input.staging_only !== true || input.synthetic_test_data_only !== true || input.zero_cost_confirmed !== true || Number(input.max_variable_cost_eur) !== 0) {
    return { ok: false, error: 'BLOCK6_MAKE_SAFETY_GATES_REQUIRED', production_deploy: false };
  }
  const base = buildMakeSafeStagingExecutionPlan({
    ...input,
    scenario_id: manifest.scope ? 7149691 : input.scenario_id,
    staging_only: true,
    production_deploy: false
  });
  if (!base.ok || base.state !== 'STAGING_EXECUTION_APPROVED_NOT_EXECUTED') return base;
  const payload = bakeryMullerBlock6SyntheticLead();
  if (!exactPayload(payload)) return { ok: false, error: 'BLOCK6_MAKE_PAYLOAD_REJECTED', production_deploy: false };
  return {
    ...base,
    schema: 'riosystems.block6-make-staging-execution-plan.v1',
    synthetic_payload: clone(payload),
    block6_trace_id: manifest.trace_id,
    block6_scope_key: manifest.scope.scope_key,
    max_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export async function runBlock6MakeOnce(plan = {}, runtime = {}) {
  const manifest = bakeryMullerBlock6Manifest();
  if (plan.schema !== 'riosystems.block6-make-staging-execution-plan.v1') return { ok: false, error: 'BLOCK6_MAKE_PLAN_REQUIRED', production_deploy: false };
  if (!exactPayload(plan.synthetic_payload) || plan.block6_trace_id !== manifest.trace_id || plan.block6_scope_key !== manifest.scope.scope_key) {
    return { ok: false, error: 'BLOCK6_MAKE_TRACE_REJECTED', production_deploy: false };
  }
  const result = await runMakeStagingScenarioOnce(plan, runtime);
  if (!result.ok) return result;
  if (!exactPayload(result.synthetic_payload) || result.scenario_restored_inactive !== true || Number(result.scenario_id) !== 7149691) {
    return { ok: false, error: 'BLOCK6_MAKE_RESULT_REJECTED', scenario_restored_inactive: result.scenario_restored_inactive === true, production_deploy: false };
  }
  return {
    ...result,
    schema: 'riosystems.block6-make-staging-execution-result.v1',
    block6_trace_id: manifest.trace_id,
    block6_scope_key: manifest.scope.scope_key,
    variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function block6MakeRunnerManifest() {
  return {
    schema: 'riosystems.block6-make-staging-runner.v1',
    scenario_id: 7149691,
    exact_payload_required: true,
    restore_inactive_required: true,
    external_connections_allowed: false,
    max_variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
