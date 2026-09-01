import { quickMissionCostEstimate, deepMissionCostPreflight } from './mission-cost-preflight-v1.js';

const clone = (value) => structuredClone(value ?? null);

export function runMissionCostPreflight(input = {}, options = {}) {
  const quick = quickMissionCostEstimate(input, options);
  if (quick.deep_preflight_required !== true) {
    return {
      ...clone(quick),
      automatically_triggered: false,
      automatic_trigger_reason: null
    };
  }

  const deep = deepMissionCostPreflight(input, options);
  const reasons = [];
  if (input.safety_requires_deep_preflight === true) reasons.push('SAFETY_POLICY');
  if (input.governance_requires_deep_preflight === true) reasons.push('GOVERNANCE_POLICY');
  if (input.force_deep_preflight === true) reasons.push('EXPLICIT_SYSTEM_REQUIREMENT');

  return {
    ...clone(deep),
    automatically_triggered: true,
    automatic_trigger_reason: reasons.length ? reasons : ['MANDATORY_PREFLIGHT_POLICY'],
    quick_estimate_snapshot: {
      selected_route: quick.selected_route,
      estimated_cost_eur: quick.estimated_cost_eur,
      low_estimate_eur: quick.low_estimate_eur,
      high_estimate_eur: quick.high_estimate_eur,
      confidence: quick.confidence,
      confidence_score: quick.confidence_score,
      calculation_latency_ms: quick.calculation_latency_ms
    },
    paid_calls_performed: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}

export function missionCostPreflightRunnerManifest() {
  return {
    schema: 'aurentara.mission-cost-preflight-runner.v1',
    quick_by_default: true,
    optional_deep_action: true,
    automatic_deep_only_for_safety_governance_or_explicit_system_requirement: true,
    paid_calls_performed: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}
