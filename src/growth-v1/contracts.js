const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const uniq = (items = []) => [...new Set((Array.isArray(items) ? items : []).map((v) => clean(v)).filter(Boolean))];
const clone = (value) => structuredClone(value ?? null);

export const GROWTH_SAFETY = Object.freeze({
  production: false,
  real_customer_data: false,
  automatic_paid_ads: false,
  automatic_paid_provider_usage: false,
  automatic_paid_overflow: false,
  real_ad_spend: false,
  real_campaign_activation: false,
  mass_email: false,
  cold_outreach_execution: false,
  money_movement: false,
  fake_reviews: false,
  review_manipulation: false,
  false_marketing_claims: false,
  unlicensed_competitor_asset_reuse: false,
  cross_project_data_access: false,
  secrets_in_repo: false,
  automatic_production_experiment: false,
  automatic_public_publishing: false,
  variable_development_cost_ceiling_eur: 0
});

export const EVIDENCE_STATES = Object.freeze(['KNOWN', 'INFERRED', 'ASSUMED', 'UNKNOWN']);

export function normalizeGrowthMission(input = {}) {
  const projectId = clean(input.project_id, 80);
  const business = clean(input.business, 160);
  if (!projectId) return { ok: false, error: 'GROWTH_PROJECT_ID_REQUIRED' };
  if (!business) return { ok: false, error: 'GROWTH_BUSINESS_REQUIRED' };

  const geography = input.geography && typeof input.geography === 'object'
    ? {
        country: clean(input.geography.country || input.country, 80) || null,
        region: clean(input.geography.region, 100) || null,
        city: clean(input.geography.city, 100) || null,
        service_area: uniq(input.geography.service_area || [])
      }
    : { country: clean(input.country, 80) || null, region: null, city: null, service_area: [] };

  const contract = {
    schema: 'riosystems.gtm-mission.v1',
    project_id: projectId,
    correlation_id: clean(input.correlation_id, 120) || `${projectId}:growth-v1`,
    business,
    industry: clean(input.industry, 120) || 'unknown',
    market: clean(input.market, 160) || 'unspecified',
    geography,
    language: clean(input.language, 20) || 'de',
    business_stage: clean(input.business_stage, 60) || 'unknown',
    offer: clone(input.offer || null),
    target_customer: clone(input.target_customer || null),
    growth_goal: clean(input.growth_goal, 240) || clean(input.request, 240) || 'define_growth_strategy',
    acquisition_goal: clean(input.acquisition_goal, 200) || null,
    revenue_goal: Number.isFinite(Number(input.revenue_goal)) ? Number(input.revenue_goal) : null,
    available_channels: uniq(input.available_channels || []),
    budget_class: clean(input.budget_class, 40) || 'unknown',
    constraints: uniq(input.constraints || []),
    brand_context: clone(input.brand_context || {}),
    website_context: clone(input.website_context || {}),
    CRM_context: clone(input.CRM_context || input.crm_context || {}),
    analytics_context: clone(input.analytics_context || {}),
    quality_level: clean(input.quality_level, 40) || 'standard',
    safety: clone(GROWTH_SAFETY)
  };

  return { ok: true, contract };
}

export function compileNaturalLanguageGtm(request, context = {}) {
  const text = clean(request, 1200);
  if (!text) return { ok: false, error: 'GTM_REQUEST_REQUIRED' };
  const lower = text.toLowerCase();
  const budgetClass = /0\s?€|null.?budget|zero.?budget|kein.?budget|niedrig/.test(lower) ? 'zero_or_low' : clean(context.budget_class, 40) || 'unknown';
  const local = /lokal|local|saarbrücken|stadt|region|umkreis/.test(lower);
  const acquisition = /kunden|leads|kundengewinn|acquisition|nachfrage/.test(lower);
  const conversion = /conversion|konvert|zu wenige leads|website.*leads/.test(lower);
  const growthGoal = conversion ? 'diagnose_and_improve_conversion' : acquisition ? 'increase_customer_acquisition' : 'build_go_to_market_plan';
  return normalizeGrowthMission({
    ...context,
    request: text,
    growth_goal: context.growth_goal || growthGoal,
    market: context.market || (local ? 'local' : 'unspecified'),
    constraints: uniq([...(context.constraints || []), ...(budgetClass === 'zero_or_low' ? ['prefer_zero_cost_channels'] : [])]),
    budget_class: budgetClass
  });
}

export function createEvidence(input = {}) {
  const evidenceId = clean(input.evidence_id, 120);
  const claim = clean(input.claim_supported, 500);
  if (!evidenceId || !claim) return { ok: false, error: 'GROWTH_EVIDENCE_INVALID' };
  const confidence = Number(input.confidence);
  return {
    ok: true,
    evidence: {
      schema: 'riosystems.market-evidence.v1',
      evidence_id: evidenceId,
      project_id: clean(input.project_id, 80) || null,
      source_type: clean(input.source_type, 80) || 'unknown',
      source_reference: clean(input.source_reference, 500) || null,
      retrieved_at: clean(input.retrieved_at, 80) || null,
      claim_supported: claim,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
      freshness: clean(input.freshness, 80) || 'unknown',
      evidence_state: EVIDENCE_STATES.includes(input.evidence_state) ? input.evidence_state : 'UNKNOWN',
      synthetic: input.synthetic === true
    }
  };
}

export function assertProjectScope(projectId, records = []) {
  const foreign = (records || []).filter((record) => record?.project_id && record.project_id !== projectId);
  return { ok: foreign.length === 0, project_id: projectId, foreign_records: foreign.map((r) => r.id || r.evidence_id || 'unknown') };
}

export function buildUtmContract(input = {}) {
  const campaign = clean(input.campaign, 100);
  if (!campaign) return { ok: false, error: 'UTM_CAMPAIGN_REQUIRED' };
  const slug = (value) => clean(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    ok: true,
    contract: {
      schema: 'riosystems.growth-utm.v1',
      source: slug(input.source || 'unknown'),
      medium: slug(input.medium || 'unknown'),
      campaign: slug(campaign),
      content: slug(input.content || ''),
      term: slug(input.term || ''),
      naming_rules: ['lowercase', 'kebab-case', 'stable-campaign-id', 'no-pii']
    }
  };
}

export function buildCampaignContract(input = {}) {
  if (!input.project_id || !input.campaign_id || !input.goal || !input.channel) return { ok: false, error: 'CAMPAIGN_CONTRACT_INVALID' };
  return {
    ok: true,
    campaign: {
      schema: 'riosystems.growth-campaign.v1',
      project_id: clean(input.project_id, 80),
      campaign_id: clean(input.campaign_id, 120),
      correlation_id: clean(input.correlation_id, 120) || null,
      goal: clean(input.goal, 220),
      ICP: clone(input.ICP || null),
      offer: clone(input.offer || null),
      message: clone(input.message || null),
      channel: clean(input.channel, 80),
      creative_requirements: clone(input.creative_requirements || []),
      landing_page_requirements: clone(input.landing_page_requirements || {}),
      CTA: clean(input.CTA, 160) || null,
      budget_class: clean(input.budget_class, 50) || 'unknown',
      start_conditions: clone(input.start_conditions || []),
      KPIs: uniq(input.KPIs || []),
      attribution: clean(input.attribution, 40) || 'first_touch',
      status: 'planned',
      activation_allowed: false,
      production: false
    }
  };
}

export function buildContentBriefContract(input = {}) {
  if (!input.project_id || !input.topic || !input.goal) return { ok: false, error: 'CONTENT_BRIEF_INVALID' };
  return { ok: true, brief: { schema: 'riosystems.growth-content-brief.v1', project_id: clean(input.project_id, 80), topic: clean(input.topic, 220), target_ICP: clone(input.target_ICP || null), search_intent: clean(input.search_intent, 40) || 'informational', goal: clean(input.goal, 200), message: clone(input.message || null), required_proof: clone(input.required_proof || []), CTA: clean(input.CTA, 160) || null, channel: clean(input.channel, 80) || 'website', format: clean(input.format, 80) || 'article' } };
}

export function buildContentCalendarContract(items = []) {
  return { schema: 'riosystems.growth-content-calendar.v1', items: (items || []).map((item, i) => ({ priority: Number(item.priority || i + 1), cadence: clean(item.cadence, 60) || 'planned', channel: clean(item.channel, 60), content_type: clean(item.content_type, 80), campaign: clean(item.campaign, 120) || null, owner: clean(item.owner, 80) || 'operator', status: clean(item.status, 40) || 'planned' })), publishing_allowed: false };
}

export function buildKeywordOpportunity(input = {}) {
  if (!input.topic) return { ok: false, error: 'KEYWORD_TOPIC_REQUIRED' };
  return { ok: true, opportunity: { schema: 'riosystems.keyword-opportunity.v1', topic: clean(input.topic, 220), intent: clean(input.intent, 40) || 'informational', relevance: clean(input.relevance, 40) || 'medium', business_value: clean(input.business_value, 40) || 'unknown', difficulty_class: clean(input.difficulty_class, 40) || 'unknown', required_page_type: clean(input.required_page_type, 80) || 'content', priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : null, evidence_status: EVIDENCE_STATES.includes(input.evidence_status) ? input.evidence_status : 'UNKNOWN', search_volume: null } };
}

export function buildGoogleBusinessStrategy(input = {}) {
  return { schema: 'riosystems.google-business-strategy.v1', location: clone(input.location || null), profile_completeness: clone(input.profile_completeness || []), categories: uniq(input.categories || []), services: uniq(input.services || []), photos: clone(input.photos || { strategy: 'use_real_business_assets_only' }), posts: clone(input.posts || { strategy: 'planned_not_published' }), QandA: clone(input.QandA || []), reviews: clone(input.reviews || { strategy: 'ethical_review_requests_only' }), NAP_consistency: input.NAP_consistency ?? 'unknown', external_writes: false };
}

export function buildExperimentContract(input = {}) {
  if (!input.project_id || !input.experiment_id || !input.hypothesis || !input.target_metric) return { ok: false, error: 'EXPERIMENT_CONTRACT_INVALID' };
  return { ok: true, experiment: { schema: 'riosystems.growth-experiment.v1', project_id: clean(input.project_id, 80), experiment_id: clean(input.experiment_id, 120), hypothesis: clean(input.hypothesis, 500), target_metric: clean(input.target_metric, 100), baseline: clone(input.baseline ?? null), variant: clone(input.variant ?? null), expected_direction: clean(input.expected_direction, 40) || 'improve', sample_requirement: clone(input.sample_requirement || { status: 'must_be_defined_before_validation' }), start_condition: clone(input.start_condition || []), stop_condition: clone(input.stop_condition || []), status: 'planned', production_execution_allowed: false } };
}

export function buildABContract(input = {}) {
  return { schema: 'riosystems.growth-ab.v1', control: clone(input.control || null), variant: clone(input.variant || null), traffic_split_intent: clone(input.traffic_split_intent || { control: 50, variant: 50 }), metric: clean(input.metric, 100), guardrail_metrics: uniq(input.guardrail_metrics || []), result: clean(input.result, 40) || 'insufficient_data', production_execution_allowed: false };
}

export function buildGrowthDeliveryManifest(input = {}) {
  return {
    schema: 'riosystems.growth-delivery-manifest.v1',
    project_id: clean(input.project_id, 80),
    market_summary: clone(input.market_summary || {}),
    evidence: clone(input.evidence || []),
    ICP: clone(input.ICP || null),
    segments: clone(input.segments || []),
    JTBD: clone(input.JTBD || null),
    competitor_analysis: clone(input.competitor_analysis || []),
    positioning: clone(input.positioning || null),
    offer: clone(input.offer || null),
    pricing_strategy: clone(input.pricing_strategy || null),
    messaging: clone(input.messaging || null),
    channel_strategy: clone(input.channel_strategy || null),
    campaign_plan: clone(input.campaign_plan || []),
    content_strategy: clone(input.content_strategy || null),
    SEO_strategy: clone(input.SEO_strategy || null),
    local_growth_strategy: clone(input.local_growth_strategy || null),
    reputation_strategy: clone(input.reputation_strategy || null),
    funnels: clone(input.funnels || []),
    conversion_strategy: clone(input.conversion_strategy || null),
    analytics_events: clone(input.analytics_events || []),
    KPIs: clone(input.KPIs || []),
    experiments: clone(input.experiments || []),
    cross_factory_requirements: clone(input.cross_factory_requirements || {}),
    risks: uniq(input.risks || []),
    assumptions: uniq(input.assumptions || []),
    warnings: uniq(input.warnings || []),
    cost_class: clean(input.cost_class, 40) || 'zero_cost_development',
    production_status: 'DISABLED',
    external_writes: false,
    safety: clone(GROWTH_SAFETY)
  };
}

export function growthFactoryManifest() {
  return {
    schema: 'riosystems.growth-gtm-factory.v1',
    role: 'strategic_growth_intelligence',
    provider_neutral: true,
    owns: ['market_intelligence','ICP','positioning','offer','messaging','channel_strategy','campaign_strategy','content_strategy','SEO_strategy','local_growth','reputation','acquisition','conversion','experiments','attribution','analytics_interpretation','optimization_recommendations'],
    does_not_own: ['website_implementation','ai_inference','automation_execution','crm_state','analytics_event_storage','paid_media_activation'],
    safety: clone(GROWTH_SAFETY)
  };
}
