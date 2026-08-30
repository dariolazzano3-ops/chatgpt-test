const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const uniq = (a = []) => [...new Set((Array.isArray(a) ? a : []).map((v) => clean(v)).filter(Boolean))];
const safeRatio = (a, b) => Number.isFinite(Number(a)) && Number(b) > 0 ? Number(a) / Number(b) : null;

export const GROWTH_EVENT_TAXONOMY = Object.freeze([
  'visitor.acquired','landing_page.viewed','CTA.clicked','form.started','form.submitted','lead.created','lead.qualified','meeting.booked','deal.created','deal.won','customer.activated','review.received','referral.created'
]);

export const KPI_REGISTRY = Object.freeze([
  'traffic','qualified_leads','conversion_rate','cost_per_lead','cost_per_qualified_lead','meeting_rate','deal_conversion','customer_acquisition_cost','pipeline_value','revenue_attributed','review_velocity','referral_rate'
]);

export function attribution(input = {}) {
  const touches = Array.isArray(input.touches) ? input.touches.filter((t) => t && t.source) : [];
  const model = ['first_touch', 'last_touch', 'multi_touch'].includes(input.model) ? input.model : 'first_touch';
  if (!touches.length) return { model, status: 'insufficient_data', attributed: null, data_quality: 'missing_touches' };
  if (model === 'first_touch') return { model, status: 'computed', attributed: clone(touches[0]), data_quality: 'touches_supplied' };
  if (model === 'last_touch') return { model, status: 'computed', attributed: clone(touches[touches.length - 1]), data_quality: 'touches_supplied' };
  return { model, status: 'computed', attributed: touches.map((t) => ({ ...clone(t), weight: Number((1 / touches.length).toFixed(4)) })), data_quality: 'simplified_equal_weight_multi_touch' };
}

export function calculateKPIs(data = {}) {
  const result = {};
  if (Number.isFinite(Number(data.traffic))) result.traffic = Number(data.traffic);
  if (Number.isFinite(Number(data.qualified_leads))) result.qualified_leads = Number(data.qualified_leads);
  const conversions = safeRatio(data.leads, data.traffic);
  if (conversions != null) result.conversion_rate = conversions;
  const cpl = safeRatio(data.cost, data.leads);
  if (cpl != null) result.cost_per_lead = cpl;
  const cpql = safeRatio(data.cost, data.qualified_leads);
  if (cpql != null) result.cost_per_qualified_lead = cpql;
  const meetingRate = safeRatio(data.meetings, data.qualified_leads);
  if (meetingRate != null) result.meeting_rate = meetingRate;
  const dealConversion = safeRatio(data.won_deals, data.deals);
  if (dealConversion != null) result.deal_conversion = dealConversion;
  const cac = safeRatio(data.acquisition_cost, data.new_customers);
  if (cac != null) result.customer_acquisition_cost = cac;
  if (Number.isFinite(Number(data.pipeline_value))) result.pipeline_value = Number(data.pipeline_value);
  if (Number.isFinite(Number(data.revenue_attributed))) result.revenue_attributed = Number(data.revenue_attributed);
  if (Number.isFinite(Number(data.review_velocity))) result.review_velocity = Number(data.review_velocity);
  const referralRate = safeRatio(data.referrals, data.customers);
  if (referralRate != null) result.referral_rate = referralRate;
  return { schema: 'riosystems.growth-kpis.v1', values: result, unavailable: KPI_REGISTRY.filter((k) => !(k in result)) };
}

export function northStarMetric(input = {}) {
  const allowed = ['qualified_leads', 'booked_appointments', 'paid_customers', 'customer_activated', 'retained_customers', 'revenue'];
  const requested = clean(input.metric, 80);
  return { schema: 'riosystems.north-star.v1', metric: allowed.includes(requested) ? requested : (input.business_model === 'appointment' ? 'booked_appointments' : 'qualified_leads'), rationale: clean(input.rationale, 300) || 'selected_from_business_goal_not_forced_to_revenue' };
}

export function funnelAnalytics(data = {}) {
  const steps = [
    ['visit_to_CTA', data.CTA_clicks, data.visits],
    ['CTA_to_form', data.forms_started ?? data.forms, data.CTA_clicks],
    ['form_to_lead', data.leads, data.forms_started ?? data.forms],
    ['lead_to_qualified', data.qualified, data.leads],
    ['qualified_to_deal', data.deals, data.qualified],
    ['deal_to_won', data.won, data.deals]
  ];
  const rates = {};
  for (const [name, numerator, denominator] of steps) rates[name] = safeRatio(numerator, denominator);
  return { schema: 'riosystems.funnel-analytics.v1', counts: clone(data), rates, data_status: Object.values(rates).some((x) => x != null) ? 'partial_or_complete' : 'insufficient_data' };
}

export function growthHealth(input = {}) {
  const signals = [];
  const add = (condition, signal, evidence, severity = 'medium') => condition && signals.push({ signal, evidence, severity, recommended_investigation: `investigate_${signal}` });
  add(Number(input.traffic_change_pct) <= -20, 'traffic_drop', { change_pct: input.traffic_change_pct });
  add(Number(input.lead_change_pct) <= -20, 'lead_drop', { change_pct: input.lead_change_pct });
  add(Number(input.conversion_change_pct) <= -20, 'conversion_drop', { change_pct: input.conversion_change_pct }, 'high');
  add(Number(input.qualification_change_pct) <= -20, 'qualification_drop', { change_pct: input.qualification_change_pct });
  add(Number(input.pipeline_change_pct) <= -20, 'pipeline_drop', { change_pct: input.pipeline_change_pct });
  add(Number(input.top_channel_share) >= 0.8, 'channel_dependency', { top_channel_share: input.top_channel_share }, 'high');
  add(Number.isFinite(Number(input.CAC)) && Number.isFinite(Number(input.target_CAC)) && Number(input.CAC) > Number(input.target_CAC), 'high_CAC', { CAC: input.CAC, target_CAC: input.target_CAC });
  add(Number.isFinite(Number(input.review_velocity)) && Number(input.review_velocity) < Number(input.review_velocity_floor || 1), 'low_review_velocity', { review_velocity: input.review_velocity });
  add(Number.isFinite(Number(input.referral_rate)) && Number(input.referral_rate) < Number(input.referral_rate_floor || 0.05), 'low_referral_rate', { referral_rate: input.referral_rate });
  return { schema: 'riosystems.growth-health.v1', signals, status: signals.some((s) => s.severity === 'high') ? 'WARN' : 'PASS' };
}

export function growthDiagnostic(input = {}) {
  const data = input.data || {};
  const tree = [
    { area: 'traffic', observed: data.traffic ?? null, question: 'Is enough qualified demand reaching the business?' },
    { area: 'offer', observed: data.offer_fit ?? null, question: 'Is the offer aligned with the ICP problem and desired outcome?' },
    { area: 'ICP', observed: data.ICP_clarity ?? null, question: 'Is the target customer defined and reachable?' },
    { area: 'messaging', observed: data.message_clarity ?? null, question: 'Does the audience understand value and proof?' },
    { area: 'conversion', observed: data.conversion_rate ?? null, question: 'Do visits progress to a lead?' },
    { area: 'qualification', observed: data.qualification_rate ?? null, question: 'Are leads relevant?' },
    { area: 'sales', observed: data.sales_conversion ?? null, question: 'Do qualified leads become customers?' },
    { area: 'retention', observed: data.retention ?? null, question: 'Do customers activate and remain valuable?' },
    { area: 'measurement', observed: data.tracking_ready ?? null, question: 'Can the bottleneck be measured reliably?' }
  ];
  const likely = tree.filter((node) => node.observed === 'weak' || (typeof node.observed === 'number' && node.observed < 0.05)).map((node) => node.area);
  const missing = tree.filter((node) => node.observed == null).map((node) => node.area);
  return { schema: 'riosystems.growth-diagnostic.v1', diagnostic_tree: tree, likely_causes: likely, missing_data: missing, recommended_tests: likely.map((area) => `test_${area}_hypothesis`) };
}

export function bottleneckEngine(input = {}) {
  const stages = [
    { stage: 'market', value: input.market_fit },
    { stage: 'acquisition', value: input.acquisition_rate },
    { stage: 'landing', value: input.landing_conversion },
    { stage: 'lead', value: input.lead_rate },
    { stage: 'qualification', value: input.qualification_rate },
    { stage: 'sales', value: input.sales_conversion },
    { stage: 'customer', value: input.activation_rate }
  ].filter((s) => Number.isFinite(Number(s.value)));
  if (!stages.length) return { bottleneck: null, status: 'insufficient_data' };
  stages.sort((a, b) => Number(a.value) - Number(b.value));
  return { bottleneck: stages[0], ranked: stages, status: 'identified_from_supplied_metrics' };
}

export function nextBestGrowthAction(input = {}) {
  const bottleneck = bottleneckEngine(input.metrics || {});
  if (!bottleneck.bottleneck) return { recommended_action: 'improve_measurement', why: 'No reliable funnel metrics are available.', evidence: [], expected_effect: 'enable_diagnosis', cost_class: 'low', effort: 'low', risk: 'low', dependencies: ['analytics'] };
  const actionMap = {
    market: 'validate_ICP_and_offer', acquisition: 'improve_channel_reach', landing: 'run_conversion_review', lead: 'reduce_lead_capture_friction', qualification: 'tighten_targeting_and_qualification', sales: 'improve_sales_enablement', customer: 'improve_activation_and_time_to_value'
  };
  return { recommended_action: actionMap[bottleneck.bottleneck.stage], why: `The weakest supplied stage is ${bottleneck.bottleneck.stage}.`, evidence: [bottleneck.bottleneck], expected_effect: 'directional_only', cost_class: 'unknown', effort: 'unknown', risk: 'controlled_test', dependencies: [] };
}

export function unitEconomics(input = {}) {
  const keys = ['CAC', 'LTV', 'gross_margin', 'payback_period', 'conversion_rate'];
  const values = {};
  for (const key of keys) if (Number.isFinite(Number(input[key]))) values[key] = Number(input[key]);
  return { schema: 'riosystems.unit-economics.v1', values, missing: keys.filter((k) => !(k in values)), complete: keys.every((k) => k in values) };
}

export function acquisitionEconomics(input = {}) {
  if (!Number.isFinite(Number(input.LTV)) || !Number.isFinite(Number(input.gross_margin))) return { status: 'insufficient_data', max_CAC: null, target_CAC: null, channel_viability: 'unknown' };
  const contribution = Number(input.LTV) * Number(input.gross_margin);
  const maxCAC = contribution;
  const targetCAC = contribution * Number(input.target_share ?? 0.33);
  return { status: 'computed_from_business_inputs', max_CAC: Number(maxCAC.toFixed(2)), target_CAC: Number(targetCAC.toFixed(2)), channel_viability: Number.isFinite(Number(input.channel_CAC)) ? (Number(input.channel_CAC) <= targetCAC ? 'viable_candidate' : 'not_viable_at_target') : 'unknown' };
}

export function retentionGrowth(input = {}) {
  return { schema: 'riosystems.retention-growth.v1', activation: clone(input.activation || {}), retention: clone(input.retention || {}), upsell: clone(input.upsell || {}), cross_sell: clone(input.cross_sell || {}), reactivation: clone(input.reactivation || {}), referrals: clone(input.referrals || {}), state_owner: 'business_crm_factory' };
}

export function customerActivation(input = {}) {
  return { schema: 'riosystems.customer-activation.v1', activation_event: clean(input.activation_event, 120), time_to_value: clean(input.time_to_value, 100) || 'unknown', activation_steps: uniq(input.activation_steps || []), activation_failure_signals: uniq(input.activation_failure_signals || []) };
}

export function reactivationStrategy(input = {}) {
  const allowed = ['inactive_customer', 'lost_lead', 'lost_deal', 'old_customer'];
  const state = clean(input.state, 60);
  return { reactivation_candidate: allowed.includes(state), reason: allowed.includes(state) ? state : 'state_not_eligible', strategy: clone(input.strategy || { revalidate_need: true, offer_context: 'current' }), automatic_communication: false };
}

export function upsellCrossSellOpportunity(input = {}) {
  const candidates = (input.next_offers || []).filter((offer) => offer && offer !== input.current_offer);
  return { customer: clean(input.customer, 160) || null, current_offer: clean(input.current_offer, 160) || null, history: clone(input.history || []), potential_next_offer: candidates[0] || null, candidates, execution: 'strategic_suggestion_only' };
}

export function referralLoop(input = {}) {
  const candidate = input.customer_success_event === true;
  return { referral_candidate: candidate, automation_contract_needed: candidate, automatic_request: false, success_event: clean(input.event, 120) || null };
}

export function channelDependencyRisk(input = {}) {
  const shares = input.channel_shares || {};
  const entries = Object.entries(shares).sort((a, b) => Number(b[1]) - Number(a[1]));
  const top = entries[0];
  if (!top) return { risk: 'unknown', evidence: null, diversification_options: [] };
  return { risk: Number(top[1]) >= 0.8 ? 'high' : Number(top[1]) >= 0.6 ? 'medium' : 'low', evidence: { channel: top[0], share: Number(top[1]) }, diversification_options: uniq(input.diversification_options || []).filter((c) => c !== top[0]) };
}
