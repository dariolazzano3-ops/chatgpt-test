import { createApprovalRecord } from './runtime-approvals.js';

const clone = (value) => structuredClone(value ?? null);
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const money = (value) => Math.round((finite(value) + Number.EPSILON) * 100) / 100;
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const asArray = (value) => Array.isArray(value) ? value : [];
const unique = (items) => [...new Set(items.filter(Boolean))];

const CAPABILITY_COST_BANDS = Object.freeze({
  growth_gtm: { low: 0.25, high: 1.2, provider_classes: ['ai', 'business_analytics'] },
  web_presence: { low: 0.6, high: 2.8, provider_classes: ['web_design', 'deployment_edge_runtime', 'ai'] },
  business_crm: { low: 0.4, high: 2.0, provider_classes: ['business'] },
  automation_followup: { low: 0.4, high: 2.4, provider_classes: ['automation', 'deployment_edge_runtime'] },
  ai_assistance: { low: 0.35, high: 3.2, provider_classes: ['ai'] },
  analytics: { low: 0.15, high: 0.9, provider_classes: ['business_analytics'] },
  unknown: { low: 0.6, high: 3.5, provider_classes: ['unknown'] }
});

export const ROUTE_POLICIES = Object.freeze({
  ECONOMY: Object.freeze({
    route: 'ECONOMY',
    cost_factor: 0.72,
    repair_reserve: 0.08,
    quality_floor: 0.72,
    reliability_floor: 0.65,
    optimization: 'MINIMIZE_COST_SUBJECT_TO_QUALITY_SAFETY_GOVERNANCE_RELIABILITY'
  }),
  BALANCED: Object.freeze({
    route: 'BALANCED',
    cost_factor: 1,
    repair_reserve: 0.18,
    quality_floor: 0.82,
    reliability_floor: 0.75,
    optimization: 'BALANCE_QUALITY_COST_RELIABILITY_SPEED'
  }),
  PREMIUM: Object.freeze({
    route: 'PREMIUM',
    cost_factor: 1.45,
    repair_reserve: 0.35,
    quality_floor: 0.9,
    reliability_floor: 0.82,
    optimization: 'MAXIMIZE_QUALITY_AND_REPAIR_HEADROOM_SUBJECT_TO_SAFETY_GOVERNANCE'
  })
});

function normalizeRoute(value) {
  const route = clean(value, 40).toUpperCase();
  return ROUTE_POLICIES[route] ? route : 'BALANCED';
}

function normalizedCapabilities(input = {}) {
  const direct = asArray(input.expected_capabilities);
  const selected = asArray(input.selected_capabilities).map((item) => item?.capability || item?.id || item?.name);
  const plan = asArray(input.plan?.selected_capabilities).map((item) => item?.capability || item?.id || item?.name);
  const values = unique([...direct, ...selected, ...plan].map((item) => clean(item, 120)));
  return values.length ? values : ['unknown'];
}

function missionComplexity(input = {}, capabilities = []) {
  const missionText = clean(input.mission_text || input.mission?.mission_text, 4000);
  const outcomes = asArray(input.requested_outcomes || input.mission?.requested_outcomes);
  const constraints = asArray(input.known_constraints || input.mission?.known_constraints);
  const words = missionText.split(/\s+/).filter(Boolean).length;
  const complexTerms = ['integration', 'migration', 'multi', 'portal', 'payment', 'auth', 'crm', 'automation', 'workflow', 'agent', 'realtime', 'ecommerce'];
  const termHits = complexTerms.filter((term) => missionText.toLowerCase().includes(term)).length;
  const score = clamp(
    1
      + Math.max(0, capabilities.length - 1) * 0.11
      + Math.max(0, outcomes.length - 1) * 0.04
      + Math.min(0.32, words / 900)
      + Math.min(0.28, termHits * 0.04)
      + Math.min(0.14, constraints.length * 0.02),
    1,
    2.2
  );
  return { score, words, term_hits: termHits, outcome_count: outcomes.length, constraint_count: constraints.length };
}

function confidenceLabel(score) {
  if (score >= 0.78) return 'HIGH';
  if (score >= 0.56) return 'MEDIUM';
  return 'LOW';
}

function median(values = []) {
  const rows = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

export function calibrateEstimateFromHistory(input = {}, history = []) {
  const route = normalizeRoute(input.route);
  const missionType = clean(input.mission_type || 'GENERAL', 120).toUpperCase();
  const capabilityMix = unique(asArray(input.capability_mix).map((item) => clean(item, 120))).sort();
  const comparable = asArray(history).filter((row) => {
    if (!Number.isFinite(Number(row?.estimated_cost)) || Number(row.estimated_cost) <= 0 || !Number.isFinite(Number(row?.actual_cost))) return false;
    const rowRoute = normalizeRoute(row.route);
    const rowType = clean(row.mission_type || 'GENERAL', 120).toUpperCase();
    const rowMix = unique(asArray(row.capability_mix).map((item) => clean(item, 120))).sort();
    const overlap = capabilityMix.length === 0 || capabilityMix.some((item) => rowMix.includes(item));
    return rowRoute === route && (rowType === missionType || missionType === 'GENERAL' || rowType === 'GENERAL') && overlap;
  });
  const ratios = comparable.map((row) => Number(row.actual_cost) / Number(row.estimated_cost)).filter((value) => Number.isFinite(value) && value >= 0);
  const factor = comparable.length >= 2 ? clamp(median(ratios) ?? 1, 0.65, 1.5) : 1;
  const errors = comparable.map((row) => Math.abs(Number(row.actual_cost) - Number(row.estimated_cost)) / Math.max(0.01, Number(row.estimated_cost)));
  return {
    schema: 'aurentara.cost-estimate-calibration.v1',
    comparable_samples: comparable.length,
    calibration_applied: comparable.length >= 2,
    calibration_factor: Number(factor.toFixed(4)),
    median_relative_error: errors.length ? Number((median(errors) ?? 0).toFixed(4)) : null,
    confidence_bonus: comparable.length >= 5 ? 0.1 : comparable.length >= 2 ? 0.05 : 0,
    method: 'median_actual_to_estimated_ratio',
    machine_learning: false
  };
}

function estimateDuration(capabilities = [], complexity = {}, deep = false) {
  if (!capabilities.length || capabilities.includes('unknown')) return null;
  const base = capabilities.length * (deep ? 5 : 4);
  const factor = finite(complexity.score, 1);
  return {
    low_minutes: Math.max(2, Math.round(base * factor * 0.65)),
    high_minutes: Math.max(4, Math.round(base * factor * 1.65)),
    basis: 'synthetic_execution_structure_heuristic_not_wall_clock_commitment'
  };
}

function buildUncertainties(input = {}, capabilities = [], calibration = {}) {
  const uncertainties = [];
  if (capabilities.includes('unknown')) uncertainties.push('CAPABILITY_SCOPE_NOT_YET_RESOLVED');
  if (!asArray(input.plan?.selected_capabilities).length && !asArray(input.selected_capabilities).length) uncertainties.push('PROVIDER_PLAN_NOT_YET_RESOLVED');
  if (!asArray(input.requested_outcomes || input.mission?.requested_outcomes).length) uncertainties.push('REQUESTED_OUTCOMES_SPARSE');
  if (calibration.comparable_samples < 2) uncertainties.push('LIMITED_HISTORICAL_CALIBRATION');
  if (input.external_dependencies_unknown !== false) uncertainties.push('EXTERNAL_DEPENDENCIES_MAY_CHANGE_COST');
  uncertainties.push('PROVIDER_PRICING_REQUIRES_REVERIFICATION_BEFORE_PAID_EXECUTION');
  return unique(uncertainties);
}

function estimateForRoute(input = {}, routeName = 'BALANCED', options = {}) {
  const route = ROUTE_POLICIES[normalizeRoute(routeName)];
  const capabilities = normalizedCapabilities(input);
  const complexity = missionComplexity(input, capabilities);
  const missionType = clean(input.mission_type || input.mission?.mission_type || 'GENERAL', 120).toUpperCase();
  const calibration = calibrateEstimateFromHistory({ mission_type: missionType, route: route.route, capability_mix: capabilities }, options.history || input.history || []);
  let rawLow = 0;
  let rawHigh = 0;
  const providerClasses = [];
  for (const capability of capabilities) {
    const band = CAPABILITY_COST_BANDS[capability] || CAPABILITY_COST_BANDS.unknown;
    rawLow += band.low;
    rawHigh += band.high;
    providerClasses.push(...band.provider_classes);
  }
  const deep = options.deep === true;
  const structureFactor = deep ? 0.97 : 1;
  rawLow *= route.cost_factor * complexity.score * structureFactor * calibration.calibration_factor;
  rawHigh *= route.cost_factor * complexity.score * (1 + route.repair_reserve) * calibration.calibration_factor;

  let confidence = 0.42;
  if (!capabilities.includes('unknown')) confidence += 0.16;
  if (asArray(input.plan?.selected_capabilities).length || asArray(input.selected_capabilities).length) confidence += 0.12;
  if (clean(input.mission_text || input.mission?.mission_text, 4000).length >= 40) confidence += 0.06;
  confidence += calibration.confidence_bonus;
  if (deep) confidence += 0.14;
  confidence = clamp(confidence, 0.28, 0.92);

  const uncertaintySpread = 1 + (1 - confidence) * (deep ? 0.38 : 0.7);
  const low = money(Math.max(0, rawLow / uncertaintySpread));
  const high = money(Math.max(low, rawHigh * uncertaintySpread));
  const estimated = money((low + high) / 2);
  const uncertainties = buildUncertainties(input, capabilities, calibration);

  return {
    route: route.route,
    estimated_cost: estimated,
    estimated_cost_eur: estimated,
    low_estimate: low,
    low_estimate_eur: low,
    high_estimate: high,
    high_estimate_eur: high,
    confidence: confidenceLabel(confidence),
    confidence_score: Number(confidence.toFixed(2)),
    estimated_duration: estimateDuration(capabilities, complexity, deep),
    expected_capabilities: capabilities,
    expected_provider_classes: unique(providerClasses),
    estimate_basis: {
      method: deep ? 'capability_graph_plus_provider_class_heuristic' : 'capability_band_heuristic',
      pricing_calls_performed: 0,
      paid_calls_performed: 0,
      route_optimization: route.optimization,
      quality_floor: route.quality_floor,
      reliability_floor: route.reliability_floor,
      repair_reserve_ratio: route.repair_reserve,
      historical_calibration: calibration,
      precision_warning: 'ESTIMATE_IS_A_RANGE_NOT_A_QUOTE'
    },
    uncertainties,
    recommended_cost_ceiling_eur: high,
    complexity: clone(complexity),
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}

export function quickMissionCostEstimate(input = {}, options = {}) {
  const start = globalThis.performance?.now?.() ?? Date.now();
  const requestedRoute = normalizeRoute(input.route);
  const economy = estimateForRoute(input, 'ECONOMY', options);
  const balanced = estimateForRoute(input, 'BALANCED', options);
  const premium = estimateForRoute(input, 'PREMIUM', options);
  const selected = { ECONOMY: economy, BALANCED: balanced, PREMIUM: premium }[requestedRoute];
  const end = globalThis.performance?.now?.() ?? Date.now();
  return {
    schema: 'aurentara.mission-cost-preflight.quick.v1',
    mode: 'QUICK_ESTIMATE',
    default_route: 'BALANCED',
    selected_route: requestedRoute,
    ...clone(selected),
    routes: { economy, balanced, premium },
    deep_preflight_required: input.force_deep_preflight === true || input.governance_requires_deep_preflight === true || input.safety_requires_deep_preflight === true,
    calculation_latency_ms: Number(Math.max(0, end - start).toFixed(3)),
    latency_target_ms: 5000,
    paid_calls_performed: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}

function estimateAiTokens(input = {}, capabilities = []) {
  if (!capabilities.some((item) => item === 'ai_assistance' || item === 'growth_gtm' || item === 'web_presence')) return null;
  const text = clean(input.mission_text || input.mission?.mission_text, 4000);
  const base = Math.max(600, text.length * 1.8 + capabilities.length * 900);
  return {
    low_tokens: Math.round(base * 0.75),
    high_tokens: Math.round(base * 2.4),
    basis: 'heuristic_only_no_model_call'
  };
}

export function deepMissionCostPreflight(input = {}, options = {}) {
  const start = globalThis.performance?.now?.() ?? Date.now();
  const quick = quickMissionCostEstimate(input, { ...options, deep: true });
  const selected = estimateForRoute(input, quick.selected_route, { ...options, deep: true });
  const capabilities = selected.expected_capabilities;
  const planTasks = asArray(input.plan?.selected_capabilities || input.selected_capabilities);
  const dependencyGraph = planTasks.length
    ? planTasks.map((task) => ({ capability: task.capability || task.id || task.name, depends_on: clone(task.dependencies || []), factory: task.factory || null }))
    : capabilities.map((capability, index) => ({ capability, depends_on: index === 0 ? [] : [capabilities[index - 1]], factory: null, inferred: true }));
  const expectedRuns = Math.max(1, capabilities.length + Math.ceil(capabilities.length * ROUTE_POLICIES[quick.selected_route].repair_reserve));
  const expectedRetries = {
    low: 0,
    high: Math.max(1, Math.ceil(capabilities.length * ROUTE_POLICIES[quick.selected_route].repair_reserve)),
    automatic_limit_not_changed: true
  };
  const externalDependencies = unique([
    ...asArray(input.external_dependencies).map((item) => clean(item, 160)),
    ...(selected.uncertainties.includes('EXTERNAL_DEPENDENCIES_MAY_CHANGE_COST') ? ['UNRESOLVED_EXTERNAL_DEPENDENCIES'] : [])
  ]);
  const end = globalThis.performance?.now?.() ?? Date.now();
  return {
    schema: 'aurentara.mission-cost-preflight.deep.v1',
    mode: 'DEEP_PREFLIGHT',
    ...clone(selected),
    routes: quick.routes,
    provider_plan: {
      optimization_route: quick.selected_route,
      expected_provider_classes: clone(selected.expected_provider_classes),
      provider_selection_rule: 'MINIMIZE_COST_SUBJECT_TO_CAPABILITY_QUALITY_SAFETY_GOVERNANCE_RELIABILITY_OPERATOR_POLICY',
      strategic_catalog_is_not_runtime_connection: true
    },
    expected_execution_structure: {
      capability_graph: dependencyGraph,
      expected_runs: expectedRuns,
      expected_retries: expectedRetries,
      repair_loops: { reserved_ratio: ROUTE_POLICIES[quick.selected_route].repair_reserve, bounded: true },
      ai_tokens: estimateAiTokens(input, capabilities),
      deployment: capabilities.includes('web_presence') ? { expected: true, environment: 'staging', production: false } : { expected: false, environment: null, production: false },
      external_dependencies: externalDependencies
    },
    confidence_improved_over_quick: selected.confidence_score >= quick.routes[quick.selected_route.toLowerCase()].confidence_score,
    calculation_latency_ms: Number(Math.max(0, end - start).toFixed(3)),
    paid_calls_performed: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}

function providerEligible(candidate = {}, capability, policy = {}) {
  const capabilityMatch = !capability || asArray(candidate.capabilities).includes(capability) || asArray(candidate.capability_classes).includes(capability);
  const connected = candidate.runtime_eligible !== false && candidate.connected !== false && !['NOT_CONNECTED', 'UNAVAILABLE'].includes(clean(candidate.verification || candidate.state, 80).toUpperCase());
  const quality = finite(candidate.quality_score, 0);
  const reliability = finite(candidate.reliability_score, 0);
  const qualityFloor = finite(policy.quality_floor, ROUTE_POLICIES.BALANCED.quality_floor);
  const reliabilityFloor = finite(policy.reliability_floor, ROUTE_POLICIES.BALANCED.reliability_floor);
  return capabilityMatch
    && connected
    && candidate.safety_ok !== false
    && candidate.governance_ok !== false
    && quality >= qualityFloor
    && reliability >= reliabilityFloor;
}

export function selectCostAwareProvider(input = {}) {
  const route = ROUTE_POLICIES[normalizeRoute(input.route)];
  const capability = clean(input.capability, 120);
  const candidates = asArray(input.candidates).map((candidate) => ({ ...clone(candidate) }));
  const eligible = candidates.filter((candidate) => providerEligible(candidate, capability, route));
  if (!eligible.length) {
    return {
      ok: false,
      error: 'NO_PROVIDER_MEETS_ROUTE_FLOORS',
      route: route.route,
      capability,
      rejected: candidates.map((candidate) => ({ id: candidate.id, reason: 'CAPABILITY_OR_QUALITY_OR_SAFETY_OR_GOVERNANCE_OR_RELIABILITY_OR_CONNECTION_GATE' })),
      production_deploy: false
    };
  }
  const scored = eligible.map((candidate) => {
    const cost = Math.max(0, finite(candidate.estimated_cost_eur, candidate.cost_estimate_eur));
    const quality = clamp(candidate.quality_score, 0, 1);
    const reliability = clamp(candidate.reliability_score, 0, 1);
    let score = 0;
    if (route.route === 'ECONOMY') score = cost + (1 - quality) * 0.2 + (1 - reliability) * 0.15;
    else if (route.route === 'PREMIUM') score = (1 - quality) * 2.2 + (1 - reliability) * 0.8 + cost * 0.08;
    else score = cost * 0.45 + (1 - quality) * 0.85 + (1 - reliability) * 0.55;
    return { ...candidate, routing_score: Number(score.toFixed(6)) };
  }).sort((a, b) => a.routing_score - b.routing_score || finite(a.estimated_cost_eur) - finite(b.estimated_cost_eur));
  return {
    ok: true,
    route: route.route,
    capability,
    selected: clone(scored[0]),
    eligible: clone(scored),
    rule: route.optimization,
    cheapest_provider_not_forced: true,
    production_deploy: false
  };
}

export function evaluateMissionCostCeiling(input = {}) {
  const actualSpend = money(Math.max(0, finite(input.actual_spend_eur)));
  const projected = money(Math.max(actualSpend, finite(input.projected_final_cost_eur)));
  const ceiling = Number.isFinite(Number(input.approved_ceiling_eur)) ? money(Math.max(0, Number(input.approved_ceiling_eur))) : null;
  if (ceiling === null) {
    return {
      ok: false,
      status: 'COST_CEILING_REQUIRED',
      actual_spend_eur: actualSpend,
      projected_final_cost_eur: projected,
      approved_ceiling_eur: null,
      additional_required_budget_eur: null,
      mission_paused: true,
      approval_required: true,
      reason: 'OPERATOR_COST_CEILING_REQUIRED_BEFORE_COST_AWARE_EXECUTION',
      actions: ['CONTINUE_APPROVE', 'ALTERNATIVE_ROUTE', 'STOP'],
      production_deploy: false
    };
  }
  const overrun = projected > ceiling;
  const additional = overrun ? money(projected - ceiling) : 0;
  let approval = null;
  if (overrun) {
    const record = createApprovalRecord({
      customer_id: clean(input.customer_id || 'synthetic-operator', 120),
      project_id: clean(input.project_id || 'synthetic-mission', 120),
      approval_type: 'MISSION_COST_CEILING_OVERRUN',
      actor_id: clean(input.actor_id || 'operator', 160),
      granted: false,
      metadata: {
        mission_id: clean(input.mission_id, 180) || null,
        actual_spend_eur: actualSpend,
        projected_final_cost_eur: projected,
        approved_ceiling_eur: ceiling,
        additional_required_budget_eur: additional,
        reason: clean(input.reason || 'PROJECTED_FINAL_COST_EXCEEDS_APPROVED_CEILING', 240)
      }
    });
    approval = record.ok ? record.approval : null;
  }
  return {
    ok: !overrun,
    status: overrun ? 'PAUSED_COST_OVERRUN' : 'WITHIN_APPROVED_CEILING',
    actual_spend_eur: actualSpend,
    projected_final_cost_eur: projected,
    approved_ceiling_eur: ceiling,
    additional_required_budget_eur: additional,
    mission_paused: overrun,
    approval_required: overrun,
    approval,
    reason: overrun ? 'PROJECTED_FINAL_COST_EXCEEDS_APPROVED_CEILING' : 'PROJECTED_FINAL_COST_WITHIN_APPROVED_CEILING',
    actions: overrun ? ['CONTINUE_APPROVE', 'ALTERNATIVE_ROUTE', 'STOP'] : ['START_OR_CONTINUE'],
    existing_approval_contract_reused: true,
    production_deploy: false,
    external_writes: false,
    additional_variable_cost_eur: 0
  };
}

export function historicalEstimateRecord(input = {}) {
  const estimated = Number.isFinite(Number(input.estimated_cost)) ? money(input.estimated_cost) : null;
  const actual = Number.isFinite(Number(input.actual_cost)) ? money(input.actual_cost) : null;
  const error = estimated !== null && actual !== null ? money(actual - estimated) : null;
  const relative = estimated && actual !== null ? Number((Math.abs(actual - estimated) / Math.max(0.01, estimated)).toFixed(4)) : null;
  return {
    schema: 'aurentara.mission-estimate-history-record.v1',
    mission_id: clean(input.mission_id, 180) || null,
    mission_type: clean(input.mission_type || 'GENERAL', 120).toUpperCase(),
    route: normalizeRoute(input.route),
    capability_mix: unique(asArray(input.capability_mix).map((item) => clean(item, 120))),
    estimated_cost: estimated,
    actual_cost: actual,
    estimate_error: error,
    relative_error: relative,
    completed: input.completed !== false,
    evidence_only: true,
    machine_learning: false,
    production_deploy: false
  };
}

export function missionCostPreflightManifest() {
  return {
    schema: 'aurentara.mission-cost-preflight.v1',
    quick_estimate: true,
    quick_latency_target_ms: 5000,
    routes: ['ECONOMY', 'BALANCED', 'PREMIUM'],
    default_route: 'BALANCED',
    optional_deep_preflight: true,
    mandatory_deep_preflight_only_for_safety_or_governance: true,
    cost_ceiling: true,
    overrun_pause: true,
    existing_approval_contract_reused: true,
    cost_aware_provider_routing: true,
    historical_calibration: 'simple_median_ratio_no_ml',
    paid_calls_performed: 0,
    paid_provider_activation: false,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  };
}
