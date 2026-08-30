const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);

export function strategyQualityGate(input = {}) {
  const checks = {
    market_evidence: Array.isArray(input.evidence) && input.evidence.length > 0,
    ICP_clarity: Boolean(input.ICP?.ICP_id || input.ICP?.segment_id),
    positioning_differentiation: Boolean(input.positioning?.unique_value),
    offer_coherence: Boolean(input.offer?.core_offer && input.offer?.target_outcome),
    message_consistency: Boolean(input.messaging?.core_message),
    channel_fit: Boolean(input.channel_strategy?.primary_channels?.length),
    measurement_readiness: Boolean(input.measurement_ready),
    CRM_readiness: Boolean(input.CRM_ready),
    website_readiness: Boolean(input.website_ready),
    analytics_readiness: Boolean(input.analytics_ready)
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const blockers = failures.filter((k) => ['ICP_clarity','offer_coherence','measurement_readiness'].includes(k));
  return { status: blockers.length ? 'BLOCK' : failures.length ? 'WARN' : 'PASS', checks, failures, blockers };
}

export function gtmReadinessScore(input = {}) {
  const checks = {
    offer_defined: Boolean(input.offer_defined),
    ICP_defined: Boolean(input.ICP_defined),
    positioning_defined: Boolean(input.positioning_defined),
    message_defined: Boolean(input.message_defined),
    channels_defined: Boolean(input.channels_defined),
    tracking_defined: Boolean(input.tracking_defined),
    CRM_ready: Boolean(input.CRM_ready),
    landing_page_ready: Boolean(input.landing_page_ready),
    followup_ready: Boolean(input.followup_ready)
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: Object.keys(checks).length, percentage: Number((passed / Object.keys(checks).length * 100).toFixed(1)), formula: 'passed_deterministic_checks/total_checks' };
}

export function growthRecommendation(input = {}) {
  return {
    schema: 'riosystems.growth-recommendation.v1',
    recommended_action: clean(input.recommended_action, 240),
    why: clean(input.why, 500),
    evidence: clone(input.evidence || []),
    expected_effect: clean(input.expected_effect, 160) || 'directional_only',
    cost_class: clean(input.cost_class, 60) || 'unknown',
    effort: clean(input.effort, 60) || 'unknown',
    risk: clean(input.risk, 60) || 'unknown',
    dependencies: clone(input.dependencies || []),
    effect_guaranteed: false
  };
}

export function operatorView(input = {}) {
  return {
    schema: 'riosystems.growth-operator-view.v1',
    primary_growth_goal: clean(input.primary_growth_goal, 220),
    active_channels: clone(input.active_channels || []),
    lead_volume: Number.isFinite(Number(input.lead_volume)) ? Number(input.lead_volume) : null,
    qualified_leads: Number.isFinite(Number(input.qualified_leads)) ? Number(input.qualified_leads) : null,
    conversion: Number.isFinite(Number(input.conversion)) ? Number(input.conversion) : null,
    pipeline: clone(input.pipeline || null),
    best_channel: clean(input.best_channel, 80) || null,
    weakest_funnel_stage: clean(input.weakest_funnel_stage, 80) || null,
    active_experiments: clone(input.active_experiments || []),
    growth_warnings: clone(input.growth_warnings || []),
    recommended_next_action: clone(input.recommended_next_action || null)
  };
}

export function reputationRisk(input = {}) {
  const signals = [];
  if (Number(input.rating_change) < -0.2) signals.push({ signal: 'rating_drop', evidence: input.rating_change, recommended_action: 'investigate_negative_review_drivers' });
  if (Number(input.review_velocity_change) < -0.3) signals.push({ signal: 'review_decline', evidence: input.review_velocity_change, recommended_action: 'review_customer_success_and_request_eligibility' });
  if (Array.isArray(input.negative_themes) && input.negative_themes.length) signals.push({ signal: 'negative_themes', evidence: clone(input.negative_themes), recommended_action: 'address_operational_root_causes' });
  if (input.response_quality === 'slow' || input.response_quality === 'poor') signals.push({ signal: 'slow_review_responses', evidence: input.response_quality, recommended_action: 'improve_response_process' });
  return { schema: 'riosystems.reputation-risk.v1', signals, status: signals.length ? 'WARN' : 'PASS' };
}

export function productionSafetyGate(input = {}) {
  const violations = [];
  if (input.production === true) violations.push('PRODUCTION_DISABLED');
  if (input.real_customer_data === true) violations.push('REAL_CUSTOMER_DATA_DISABLED');
  if (Number(input.variable_cost_eur || 0) > 0) violations.push('VARIABLE_COST_CEILING_EXCEEDED');
  if (input.paid_campaign_activation === true) violations.push('PAID_CAMPAIGN_ACTIVATION_DISABLED');
  if (input.mass_email === true) violations.push('MASS_EMAIL_DISABLED');
  if (input.public_publish === true) violations.push('PUBLIC_PUBLISH_DISABLED');
  if (input.money_movement === true) violations.push('MONEY_MOVEMENT_DISABLED');
  return { ok: violations.length === 0, violations, status: violations.length ? 'BLOCK' : 'PASS' };
}
