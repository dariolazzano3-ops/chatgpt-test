const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const uniq = (a = []) => [...new Set((Array.isArray(a) ? a : []).map((v) => clean(v)).filter(Boolean))];
const clamp = (n, min = 0, max = 5) => Math.max(min, Math.min(max, Number(n) || 0));

export function marketIntelligence(input = {}) {
  const supplied = input.market_data || {};
  const synthetic = input.synthetic === true;
  const state = synthetic ? 'ASSUMED' : input.evidence?.length ? 'KNOWN' : 'UNKNOWN';
  const field = (name, fallback = []) => ({ value: clone(supplied[name] ?? fallback), evidence_state: supplied[name] != null ? state : 'UNKNOWN' });
  return {
    schema: 'riosystems.market-intelligence.v1',
    industry: clean(input.industry, 120) || 'unknown',
    geography: clone(input.geography || null),
    offer: clone(input.offer || null),
    business_stage: clean(input.business_stage, 60) || 'unknown',
    market_structure: field('market_structure'),
    customer_segments: field('customer_segments'),
    market_maturity: field('market_maturity', 'unknown'),
    demand_patterns: field('demand_patterns'),
    common_offers: field('common_offers'),
    common_price_models: field('common_price_models'),
    trust_factors: field('trust_factors'),
    buying_triggers: field('buying_triggers'),
    market_risks: field('market_risks'),
    opportunity_areas: field('opportunity_areas'),
    evidence: clone(input.evidence || []),
    synthetic
  };
}

export function discoverCustomerSegments(input = {}) {
  const source = Array.isArray(input.segment_candidates) ? input.segment_candidates : [];
  return source.map((segment, index) => ({
    segment_id: clean(segment.segment_id, 100) || `segment-${index + 1}`,
    description: clean(segment.description, 300),
    problem: clean(segment.problem, 300),
    urgency: clamp(segment.urgency),
    buying_power: clamp(segment.buying_power),
    reachability: clamp(segment.reachability),
    market_fit: clamp(segment.market_fit),
    expected_value: clamp(segment.expected_value),
    sales_complexity: clamp(segment.sales_complexity),
    competition: clamp(segment.competition),
    business_capability_fit: clamp(segment.business_capability_fit ?? segment.market_fit),
    priority: null,
    basis: clean(segment.basis, 200) || (input.synthetic ? 'synthetic_fixture' : 'business_input')
  }));
}

export function buildICP(segment = {}, context = {}) {
  if (!segment.segment_id) return { ok: false, error: 'ICP_SEGMENT_REQUIRED' };
  const language = context.customer_language || {};
  return {
    ok: true,
    ICP: {
      schema: 'riosystems.icp.v1',
      ICP_id: `icp:${clean(segment.segment_id, 100)}`,
      segment_id: clean(segment.segment_id, 100),
      business_type: clean(context.business_type || segment.description, 180),
      job_to_be_done: clean(context.job_to_be_done || segment.problem, 300),
      pain_points: uniq(context.pain_points || [segment.problem]),
      desired_outcomes: uniq(context.desired_outcomes || []),
      buying_triggers: uniq(context.buying_triggers || []),
      objections: uniq(language.common_objections || context.objections || []),
      decision_criteria: uniq(context.decision_criteria || []),
      trust_requirements: uniq(context.trust_requirements || []),
      preferred_channels: uniq(context.preferred_channels || []),
      search_behavior: uniq(context.search_behavior || []),
      purchase_urgency: segment.urgency ?? null,
      estimated_value_class: segment.expected_value ?? null
    }
  };
}

export function prioritizeICPs(segments = []) {
  const scored = (segments || []).map((s) => {
    const factors = {
      pain_severity: clamp(s.urgency),
      market_fit: clamp(s.market_fit),
      reachability: clamp(s.reachability),
      expected_value: clamp(s.expected_value),
      sales_complexity: clamp(s.sales_complexity),
      competition: clamp(s.competition),
      business_capability_fit: clamp(s.business_capability_fit)
    };
    const positive = factors.pain_severity + factors.market_fit + factors.reachability + factors.expected_value + factors.business_capability_fit;
    const drag = factors.sales_complexity + factors.competition;
    const score = positive - 0.5 * drag;
    return { ...s, priority_score: Number(score.toFixed(2)), score_factors: factors };
  }).sort((a, b) => b.priority_score - a.priority_score || a.segment_id.localeCompare(b.segment_id));
  return {
    recommended_primary_ICP: scored[0] || null,
    secondary_ICPs: scored.slice(1),
    rationale: scored[0] ? `Primary ICP selected from transparent factors: pain, fit, reachability, value, complexity, competition, capability fit. Score=${scored[0].priority_score}` : 'No segment evidence available.',
    scoring_formula: 'pain+market_fit+reachability+expected_value+capability_fit-0.5*(sales_complexity+competition)'
  };
}

export function buildJTBD(input = {}) {
  return {
    schema: 'riosystems.jtbd.v1',
    customer_situation: clean(input.customer_situation, 400),
    problem: clean(input.problem, 400),
    desired_progress: clean(input.desired_progress, 400),
    alternatives: uniq(input.alternatives || []),
    switching_trigger: clean(input.switching_trigger, 300) || null,
    anxieties: uniq(input.anxieties || []),
    habit_inertia: uniq(input.habit_inertia || [])
  };
}

export function customerLanguage(input = {}) {
  return {
    schema: 'riosystems.customer-language.v1',
    terms_customers_use: uniq(input.terms_customers_use || []),
    problem_language: uniq(input.problem_language || []),
    desired_outcome_language: uniq(input.desired_outcome_language || []),
    common_objections: uniq(input.common_objections || []),
    trust_language: uniq(input.trust_language || []),
    purchase_questions: uniq(input.purchase_questions || []),
    evidence_state: clean(input.evidence_state, 20) || 'UNKNOWN'
  };
}

export function analyzeCompetitors(competitors = []) {
  return (competitors || []).map((c, index) => ({
    competitor_id: clean(c.competitor_id, 100) || `competitor-${index + 1}`,
    name: clean(c.name, 160) || `Competitor ${index + 1}`,
    positioning: clean(c.positioning, 300) || 'unknown',
    offers: clone(c.offers || []),
    pricing_patterns: clone(c.pricing_patterns || []),
    messaging: clone(c.messaging || []),
    channels: uniq(c.channels || []),
    SEO_structure: clone(c.SEO_structure || {}),
    trust_elements: uniq(c.trust_elements || []),
    CTAs: uniq(c.CTAs || []),
    reviews: clone(c.reviews || {}),
    strengths: uniq(c.strengths || []),
    weaknesses: uniq(c.weaknesses || []),
    synthetic: c.synthetic === true,
    asset_reuse_allowed: false
  }));
}

export function competitiveMap(competitors = []) {
  return (competitors || []).map((c) => ({
    competitor: c.name,
    positioning_axis: clean(c.positioning_axis || c.positioning, 180) || 'unknown',
    price_position: clean(c.price_position, 60) || 'unknown',
    trust_position: clean(c.trust_position, 60) || (c.trust_elements?.length ? 'evidence_present' : 'unknown'),
    specialization: clean(c.specialization, 120) || 'unknown',
    strength: c.strengths?.[0] || 'unknown',
    weakness: c.weaknesses?.[0] || 'unknown'
  }));
}

export function differentiationOpportunities(input = {}) {
  const gaps = uniq(input.market_gaps || []);
  const capabilities = uniq(input.business_capabilities || []);
  return gaps.map((gap, index) => {
    const supported = capabilities.some((cap) => gap.toLowerCase().includes(cap.toLowerCase()) || cap.toLowerCase().includes(gap.toLowerCase()));
    return {
      differentiator: gap,
      customer_value: clean(input.customer_values?.[index], 300) || 'requires_validation',
      defensibility: supported ? 'capability_backed' : 'unproven',
      proof_required: supported ? ['capability_proof', 'customer_proof_when_available'] : ['operational_validation', 'customer_proof'],
      risk: supported ? 'medium' : 'high',
      recommendation: supported ? 'candidate' : 'validate_before_claiming'
    };
  });
}

export function industryGrowthIntelligence(input = {}) {
  const data = input.data || {};
  return {
    schema: 'riosystems.industry-growth-intelligence.v1',
    industry: clean(input.industry, 120) || 'unknown',
    common_acquisition_channels: uniq(data.common_acquisition_channels || []),
    buying_triggers: uniq(data.buying_triggers || []),
    trust_requirements: uniq(data.trust_requirements || []),
    sales_cycle: clean(data.sales_cycle, 100) || 'unknown',
    local_relevance: clean(data.local_relevance, 40) || 'unknown',
    common_objections: uniq(data.common_objections || []),
    review_importance: clean(data.review_importance, 40) || 'unknown',
    SEO_patterns: uniq(data.SEO_patterns || []),
    evidence_state: input.synthetic ? 'ASSUMED' : input.evidence?.length ? 'KNOWN' : 'UNKNOWN'
  };
}

export function geographicIntelligence(input = {}) {
  return {
    schema: 'riosystems.geographic-intelligence.v1',
    country: clean(input.country, 80) || null,
    region: clean(input.region, 100) || null,
    city: clean(input.city, 100) || null,
    service_area: uniq(input.service_area || []),
    language: clean(input.language, 20) || 'de',
    market_scope: clean(input.market_scope, 80) || 'unspecified',
    evidence_state: clean(input.evidence_state, 20) || 'UNKNOWN'
  };
}

export function localizeStrategy(strategy = {}, context = {}) {
  const localizedTerms = context.terminology || {};
  return {
    ...clone(strategy),
    localization: {
      country: clean(context.country, 80) || null,
      region: clean(context.region, 100) || null,
      language: clean(context.language, 20) || 'de',
      culture_notes: uniq(context.culture_notes || []),
      search_behavior: uniq(context.search_behavior || []),
      trust_patterns: uniq(context.trust_patterns || []),
      channel_usage: uniq(context.channel_usage || []),
      terminology: clone(localizedTerms),
      evidence_state: clean(context.evidence_state, 20) || 'UNKNOWN'
    }
  };
}
