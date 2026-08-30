const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const uniq = (a = []) => [...new Set((Array.isArray(a) ? a : []).map((v) => clean(v)).filter(Boolean))];
const clamp = (n, min = 0, max = 5) => Math.max(min, Math.min(max, Number(n) || 0));

export function buildPositioning(input = {}) {
  const required = ['category', 'target_customer', 'core_problem', 'unique_value'];
  const missing = required.filter((key) => !clean(input[key]));
  if (missing.length) return { ok: false, error: 'POSITIONING_INPUT_INCOMPLETE', missing };
  const claims = uniq(input.claims || []);
  const proof = uniq(input.proof || []);
  const unsupported = claims.filter((claim) => !proof.some((p) => claim.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(claim.toLowerCase())));
  return {
    ok: true,
    positioning: {
      schema: 'riosystems.positioning.v1',
      category: clean(input.category, 160),
      target_customer: clean(input.target_customer, 240),
      core_problem: clean(input.core_problem, 300),
      unique_value: clean(input.unique_value, 300),
      why_us: clean(input.why_us, 400) || 'requires_proof',
      alternative: clean(input.alternative, 300) || 'status_quo',
      proof,
      claims,
      unsupported_claims: unsupported,
      positioning_statement: `${clean(input.category, 160)} for ${clean(input.target_customer, 240)} that helps solve ${clean(input.core_problem, 300)} through ${clean(input.unique_value, 300)}.`,
      false_claims_allowed: false
    }
  };
}

export function positioningVariants(base = {}, capabilities = []) {
  const modes = ['premium', 'specialist', 'speed', 'convenience', 'local', 'trust', 'innovation', 'cost-efficient'];
  const caps = uniq(capabilities);
  return modes.map((mode) => {
    const supported = caps.includes(mode) || (mode === 'local' && caps.some((x) => x.includes('local'))) || (mode === 'speed' && caps.some((x) => x.includes('fast')));
    return {
      strategy: mode,
      fit: supported ? 5 : 2,
      risk: supported ? 'medium' : 'high',
      market_differentiation: supported ? 'candidate' : 'unknown',
      operational_feasibility: supported ? 'supported' : 'requires_validation',
      positioning: { ...clone(base), strategy: mode }
    };
  });
}

export function engineerOffer(input = {}) {
  if (!input.core_offer || !input.target_outcome) return { ok: false, error: 'OFFER_CORE_AND_OUTCOME_REQUIRED' };
  return {
    ok: true,
    offer: {
      schema: 'riosystems.offer-architecture.v1',
      core_offer: clean(input.core_offer, 240),
      target_outcome: clean(input.target_outcome, 320),
      included_scope: uniq(input.included_scope || []),
      excluded_scope: uniq(input.excluded_scope || []),
      delivery_model: clean(input.delivery_model, 100) || 'service',
      pricing_model: clean(input.pricing_model, 60) || 'unknown',
      risk_reversal: clean(input.risk_reversal, 240) || null,
      proof: uniq(input.proof || []),
      bonuses: uniq(input.bonuses || []),
      upsells: uniq(input.upsells || []),
      cross_sells: uniq(input.cross_sells || []),
      constraints: uniq(input.constraints || []),
      price_amount: null
    }
  };
}

export function validateOfferFit(input = {}) {
  const checks = {
    ICP_fit: input.ICP_fit === true,
    problem_fit: input.problem_fit === true,
    operational_feasibility: input.operational_feasibility === true,
    margin_logic: input.margin_logic === true || input.margin_logic === 'unknown',
    trust_requirement: input.trust_requirement === true,
    positioning_consistency: input.positioning_consistency === true,
    delivery_complexity: input.delivery_complexity !== 'unmanageable'
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { ok: failures.length === 0, status: failures.length ? 'WARN' : 'PASS', checks, failures };
}

export function pricingStrategy(input = {}) {
  const supported = new Set(['fixed', 'subscription', 'usage_based', 'tiered', 'package', 'retainer', 'hybrid']);
  const requested = clean(input.preferred_model, 40);
  let recommended = requested && supported.has(requested) ? requested : null;
  if (!recommended) {
    if (input.recurring_value === true && input.scope_variability === 'high') recommended = 'retainer';
    else if (input.recurring_value === true) recommended = 'subscription';
    else if (input.packaged_scope === true) recommended = 'package';
    else recommended = 'fixed';
  }
  return {
    schema: 'riosystems.pricing-strategy.v1',
    recommended_model: recommended,
    reason: input.reason || `Model selected from delivery pattern, not from invented market price data.`,
    risks: uniq(input.risks || []),
    required_data: uniq(input.required_data || ['delivery_cost', 'gross_margin_target', 'willingness_to_pay_evidence']),
    price_research_needed: input.price_evidence_available !== true,
    recommended_price: null
  };
}

export function valueProposition(input = {}) {
  return {
    schema: 'riosystems.value-proposition.v1',
    primary_value_proposition: clean(input.primary_value_proposition, 400),
    secondary_value_propositions: uniq(input.secondary_value_propositions || []),
    customer_outcome: clean(input.customer_outcome, 320),
    proof_points: uniq(input.proof_points || []),
    objection_responses: clone(input.objection_responses || {}),
    CTA_direction: clean(input.CTA_direction, 160) || 'low_friction_next_step'
  };
}

export function messagingSystem(input = {}) {
  const forbidden = uniq(input.forbidden_claims || []);
  return {
    schema: 'riosystems.messaging.v1',
    core_message: clean(input.core_message, 400),
    one_liner: clean(input.one_liner, 260),
    elevator_pitch: clean(input.elevator_pitch, 700),
    headline_direction: clean(input.headline_direction, 260),
    subheadline_direction: clean(input.subheadline_direction, 400),
    proof_points: uniq(input.proof_points || []),
    objections: clone(input.objections || {}),
    CTA_language: uniq(input.CTA_language || []),
    tone: clean(input.tone, 120) || 'clear_and_credible',
    forbidden_claims: forbidden,
    hierarchy: {
      WHAT: clean(input.WHAT || input.core_message, 400),
      WHY: clean(input.WHY, 400),
      WHY_NOW: clean(input.WHY_NOW, 400),
      WHY_US: clean(input.WHY_US, 400),
      PROOF: uniq(input.proof_points || []),
      NEXT_STEP: clean(input.NEXT_STEP || input.CTA_language?.[0], 200)
    }
  };
}

const CHANNEL_DEFAULTS = Object.freeze({
  SEO: { speed: 2, cost: 1, effort: 4, measurement: 4, risk: 2 },
  'Local SEO': { speed: 3, cost: 1, effort: 3, measurement: 4, risk: 1 },
  'Google Business': { speed: 3, cost: 1, effort: 2, measurement: 3, risk: 1 },
  'organic social': { speed: 2, cost: 1, effort: 4, measurement: 3, risk: 2 },
  'paid search': { speed: 5, cost: 5, effort: 3, measurement: 5, risk: 4 },
  'paid social': { speed: 4, cost: 5, effort: 4, measurement: 4, risk: 4 },
  email: { speed: 4, cost: 1, effort: 2, measurement: 5, risk: 2 },
  outbound: { speed: 4, cost: 1, effort: 4, measurement: 4, risk: 3 },
  referrals: { speed: 3, cost: 1, effort: 2, measurement: 3, risk: 1 },
  partnerships: { speed: 2, cost: 1, effort: 3, measurement: 2, risk: 2 },
  marketplaces: { speed: 4, cost: 3, effort: 2, measurement: 4, risk: 3 },
  events: { speed: 2, cost: 3, effort: 4, measurement: 2, risk: 2 },
  content: { speed: 2, cost: 1, effort: 4, measurement: 3, risk: 1 },
  community: { speed: 2, cost: 1, effort: 3, measurement: 2, risk: 1 }
});

export function channelStrategy(input = {}) {
  const channels = input.channels || Object.keys(CHANNEL_DEFAULTS);
  const budgetZero = input.budget_class === 'zero' || input.budget_class === 'zero_or_low';
  const local = input.local === true;
  const scored = channels.map((name) => {
    const d = CHANNEL_DEFAULTS[name] || { speed: 2, cost: 2, effort: 3, measurement: 3, risk: 2 };
    const fitBase = clamp(input.channel_fit?.[name] ?? 3);
    const localBoost = local && ['Local SEO', 'Google Business', 'referrals', 'partnerships'].includes(name) ? 1 : 0;
    const paidPenalty = budgetZero && name.startsWith('paid ') ? 5 : 0;
    const score = fitBase + localBoost + d.speed * 0.3 + d.measurement * 0.2 - d.cost * 0.4 - d.effort * 0.15 - d.risk * 0.2 - paidPenalty;
    return {
      channel: name,
      fit: Math.max(0, Math.min(5, fitBase + localBoost)),
      expected_speed: d.speed,
      expected_cost_class: d.cost,
      operational_effort: d.effort,
      measurement_quality: d.measurement,
      dependency: input.dependencies?.[name] || [],
      risk: d.risk,
      recommended_priority: Number(score.toFixed(2)),
      paid_activation_allowed: false
    };
  }).sort((a, b) => b.recommended_priority - a.recommended_priority || a.channel.localeCompare(b.channel));

  const viable = scored.filter((x) => !(budgetZero && x.channel.startsWith('paid ')));
  return {
    schema: 'riosystems.channel-strategy.v1',
    evaluated_channels: scored,
    primary_channels: viable.slice(0, 3).map((x) => x.channel),
    secondary_channels: viable.slice(3, 6).map((x) => x.channel),
    experimental_channels: viable.slice(6, 8).map((x) => x.channel),
    not_recommended_channels: scored.filter((x) => budgetZero && x.channel.startsWith('paid ')).map((x) => ({ channel: x.channel, reason: 'budget_or_readiness_constraint' }))
  };
}

export function acquisitionStrategy(input = {}) {
  return {
    schema: 'riosystems.acquisition-strategy.v1',
    acquisition_goal: clean(input.acquisition_goal, 220),
    ICP: clone(input.ICP || null),
    channel: clean(input.channel, 80),
    offer: clone(input.offer || null),
    message: clone(input.message || null),
    conversion_surface: clean(input.conversion_surface, 120) || 'landing_page',
    followup: clone(input.followup || { execution: 'automation_factory_candidate_only' }),
    measurement: clone(input.measurement || {}),
    traffic_purchase_allowed: false
  };
}

export function planCampaignPortfolio(input = {}) {
  const channels = input.channel_strategy?.primary_channels || [];
  return channels.map((channel, index) => ({
    campaign_id: `${clean(input.project_id, 80)}:campaign:${index + 1}`,
    goal: clean(input.goal, 220),
    ICP: clone(input.ICP || null),
    offer: clone(input.offer || null),
    message: clone(input.message || null),
    channel,
    CTA: clean(input.CTA, 120) || 'next_step',
    budget_class: input.budget_class || 'unknown',
    status: 'planned',
    activation_allowed: false
  }));
}

export function budgetAllocation(input = {}) {
  const priorities = input.channels || [];
  return priorities.map((channel, index) => ({ channel, test_budget_class: input.budget_class === 'zero' ? 'zero' : index === 0 ? 'small' : 'minimal', expected_learning: `validate_${channel.toLowerCase().replace(/\W+/g, '_')}_fit`, risk: input.budget_class === 'zero' ? 'low' : 'medium', priority: index + 1, spend_allowed: false }));
}

export function zeroBudgetGrowthMode(input = {}) {
  const local = input.local === true;
  const channels = ['SEO', ...(local ? ['Local SEO', 'Google Business'] : []), 'content', 'referrals', 'partnerships', 'community', 'outbound'];
  return { schema: 'riosystems.zero-budget-growth.v1', budget_eur: 0, channels, paid_channels: [], execution: 'strategy_only', priorities: channels.map((channel, i) => ({ channel, priority: i + 1 })) };
}

export function paidGrowthReadiness(input = {}) {
  const checks = {
    offer_proven: input.offer_proven === true,
    landing_page_ready: input.landing_page_ready === true,
    tracking_ready: input.tracking_ready === true,
    CRM_ready: input.CRM_ready === true,
    followup_ready: input.followup_ready === true,
    budget_defined: input.budget_defined === true,
    unit_economics_known: input.unit_economics_known === true
  };
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { status: missing.length ? 'PAID_GROWTH_NOT_READY' : 'PAID_GROWTH_READY_FOR_OPERATOR_REVIEW', checks, prerequisites: missing, automatic_activation: false };
}

export function opportunityScore(input = {}) {
  const factors = {
    market_fit: clamp(input.market_fit),
    business_value: clamp(input.business_value),
    cost: clamp(input.cost),
    effort: clamp(input.effort),
    confidence: clamp(input.confidence),
    risk: clamp(input.risk)
  };
  const score = factors.market_fit + factors.business_value + factors.confidence - 0.6 * factors.cost - 0.5 * factors.effort - 0.7 * factors.risk;
  return { score: Number(score.toFixed(2)), factors, formula: 'market_fit+business_value+confidence-0.6*cost-0.5*effort-0.7*risk' };
}

export function prioritizeGrowthRecommendations(recommendations = []) {
  return (recommendations || []).map((r) => ({ ...clone(r), prioritization: opportunityScore({ market_fit: r.market_fit, business_value: r.business_impact, cost: r.cost, effort: r.effort, confidence: r.evidence, risk: r.risk }) })).sort((a, b) => b.prioritization.score - a.prioritization.score);
}
