import { growthFactoryManifest, compileNaturalLanguageGtm, normalizeGrowthMission, createEvidence, assertProjectScope, buildCampaignContract, buildContentBriefContract, buildContentCalendarContract, buildKeywordOpportunity, buildGoogleBusinessStrategy, buildExperimentContract, buildABContract, buildGrowthDeliveryManifest, buildUtmContract } from './contracts.js';
import { marketIntelligence, discoverCustomerSegments, buildICP, prioritizeICPs, buildJTBD, customerLanguage, analyzeCompetitors, competitiveMap, differentiationOpportunities, industryGrowthIntelligence, geographicIntelligence, localizeStrategy } from './market.js';
import { buildPositioning, positioningVariants, engineerOffer, validateOfferFit, pricingStrategy, valueProposition, messagingSystem, channelStrategy, acquisitionStrategy, planCampaignPortfolio, budgetAllocation, zeroBudgetGrowthMode, paidGrowthReadiness, opportunityScore, prioritizeGrowthRecommendations } from './strategy.js';
import { contentStrategy, classifySearchIntent, seoStrategy, buildTopicClusters, seoToWebContract, localGrowthStrategy, reputationStrategy, reviewOpportunity, socialProofInventory, funnelArchitecture, buildFunnelContract, landingPageStrategy, conversionReview, croOpportunities, leadMagnetOptions, referralStrategy, partnershipGrowth, outboundStrategy, salesEnablement } from './acquisition.js';
import { GROWTH_EVENT_TAXONOMY, KPI_REGISTRY, attribution, calculateKPIs, northStarMetric, funnelAnalytics, growthHealth, growthDiagnostic, bottleneckEngine, nextBestGrowthAction, unitEconomics, acquisitionEconomics, retentionGrowth, customerActivation, reactivationStrategy, upsellCrossSellOpportunity, referralLoop, channelDependencyRisk } from './analytics.js';
import { EXPERIMENT_TYPES, prioritizeExperiments, validateExperimentResult, growthLearningLoop, GrowthKnowledgeBase, StrategyVersionStore, changeImpactAnalysis, blastRadius, competitorChangeWatchContract, marketChangeWatchContract } from './experiments.js';
import { toAiFactory, toWebFactory, fromBusinessCrm, toAutomationFactory, fromAnalytics, crossFactoryCorrelation } from './cross-factory.js';
import { getGtmRecipe, compileGtmRecipe } from './recipes.js';
import { strategyQualityGate, gtmReadinessScore, growthRecommendation, operatorView, reputationRisk, productionSafetyGate } from './quality.js';

export {
  growthFactoryManifest, compileNaturalLanguageGtm, normalizeGrowthMission, createEvidence, assertProjectScope, buildCampaignContract, buildContentBriefContract, buildContentCalendarContract, buildKeywordOpportunity, buildGoogleBusinessStrategy, buildExperimentContract, buildABContract, buildGrowthDeliveryManifest, buildUtmContract,
  marketIntelligence, discoverCustomerSegments, buildICP, prioritizeICPs, buildJTBD, customerLanguage, analyzeCompetitors, competitiveMap, differentiationOpportunities, industryGrowthIntelligence, geographicIntelligence, localizeStrategy,
  buildPositioning, positioningVariants, engineerOffer, validateOfferFit, pricingStrategy, valueProposition, messagingSystem, channelStrategy, acquisitionStrategy, planCampaignPortfolio, budgetAllocation, zeroBudgetGrowthMode, paidGrowthReadiness, opportunityScore, prioritizeGrowthRecommendations,
  contentStrategy, classifySearchIntent, seoStrategy, buildTopicClusters, seoToWebContract, localGrowthStrategy, reputationStrategy, reviewOpportunity, socialProofInventory, funnelArchitecture, buildFunnelContract, landingPageStrategy, conversionReview, croOpportunities, leadMagnetOptions, referralStrategy, partnershipGrowth, outboundStrategy, salesEnablement,
  GROWTH_EVENT_TAXONOMY, KPI_REGISTRY, attribution, calculateKPIs, northStarMetric, funnelAnalytics, growthHealth, growthDiagnostic, bottleneckEngine, nextBestGrowthAction, unitEconomics, acquisitionEconomics, retentionGrowth, customerActivation, reactivationStrategy, upsellCrossSellOpportunity, referralLoop, channelDependencyRisk,
  EXPERIMENT_TYPES, prioritizeExperiments, validateExperimentResult, growthLearningLoop, GrowthKnowledgeBase, StrategyVersionStore, changeImpactAnalysis, blastRadius, competitorChangeWatchContract, marketChangeWatchContract,
  toAiFactory, toWebFactory, fromBusinessCrm, toAutomationFactory, fromAnalytics, crossFactoryCorrelation,
  getGtmRecipe, compileGtmRecipe,
  strategyQualityGate, gtmReadinessScore, growthRecommendation, operatorView, reputationRisk, productionSafetyGate
};

const pick = (value, fallback) => value == null ? fallback : value;

export function syntheticMarketData(input = {}) {
  return {
    schema: 'riosystems.synthetic-growth-fixture.v1',
    project_id: input.project_id,
    synthetic: true,
    market_data: {
      market_structure: pick(input.market_structure, ['synthetic_local_competition']),
      customer_segments: pick(input.customer_segments, ['synthetic_primary_segment']),
      market_maturity: pick(input.market_maturity, 'synthetic_unknown_to_mature'),
      demand_patterns: pick(input.demand_patterns, ['synthetic_intent_driven_demand']),
      common_offers: pick(input.common_offers, ['synthetic_service_package']),
      common_price_models: pick(input.common_price_models, ['fixed', 'package']),
      trust_factors: pick(input.trust_factors, ['reviews', 'clear_process']),
      buying_triggers: pick(input.buying_triggers, ['urgent_need', 'provider_dissatisfaction']),
      market_risks: pick(input.market_risks, ['low_differentiation']),
      opportunity_areas: pick(input.opportunity_areas, ['clear_local_specialization'])
    },
    competitors: input.competitors || [],
    reviews: input.reviews || [],
    funnels: input.funnels || {},
    campaigns: input.campaigns || []
  };
}

export function buildGrowthFactoryV1(input = {}) {
  const compiled = input.request ? compileNaturalLanguageGtm(input.request, input) : normalizeGrowthMission(input);
  if (!compiled.ok) return compiled;
  const mission = compiled.contract;
  const fixture = syntheticMarketData({ ...input, project_id: mission.project_id });
  const evidenceResult = createEvidence({ evidence_id: `${mission.project_id}:synthetic:evidence:1`, project_id: mission.project_id, source_type: 'synthetic_fixture', source_reference: 'growth-v1-synthetic-mode', retrieved_at: 'synthetic-clock', claim_supported: 'Synthetic fixture used for zero-cost strategy validation only.', confidence: 1, freshness: 'synthetic', evidence_state: 'ASSUMED', synthetic: true });
  const evidence = [evidenceResult.evidence];
  const market = marketIntelligence({ industry: mission.industry, geography: mission.geography, offer: mission.offer, business_stage: mission.business_stage, market_data: fixture.market_data, evidence, synthetic: true });
  const recipe = compileGtmRecipe({ request: input.request || `${mission.industry} ${mission.market}`, project_id: mission.project_id, business: mission.business, industry: mission.industry, geography: mission.geography, constraints: mission.constraints });
  const segmentCandidates = input.segment_candidates || [{ segment_id: 'primary', description: mission.target_customer?.description || 'Synthetic target segment', problem: input.primary_problem || 'Needs a more reliable solution', urgency: 4, buying_power: 3, reachability: 4, market_fit: 4, expected_value: 4, sales_complexity: 2, competition: 3, business_capability_fit: 4, basis: 'synthetic_fixture' }];
  const segments = discoverCustomerSegments({ segment_candidates: segmentCandidates, synthetic: true });
  const prioritized = prioritizeICPs(segments);
  const icpResult = buildICP(prioritized.recommended_primary_ICP, { business_type: prioritized.recommended_primary_ICP?.description, job_to_be_done: prioritized.recommended_primary_ICP?.problem, pain_points: [prioritized.recommended_primary_ICP?.problem], desired_outcomes: input.desired_outcomes || ['reliable outcome'], buying_triggers: fixture.market_data.buying_triggers, trust_requirements: fixture.market_data.trust_factors, preferred_channels: recipe.ok ? recipe.strategy_seed.channels : [], search_behavior: input.search_behavior || [] });
  const ICP = icpResult.ok ? icpResult.ICP : null;
  const JTBD = buildJTBD({ customer_situation: input.customer_situation || 'Synthetic business need exists', problem: input.primary_problem || prioritized.recommended_primary_ICP?.problem, desired_progress: input.desired_progress || 'Reach a reliable desired outcome', alternatives: input.alternatives || ['status quo'], switching_trigger: input.switching_trigger || 'need becomes urgent', anxieties: input.anxieties || ['trust', 'risk'], habit_inertia: input.habit_inertia || ['current provider or no action'] });
  const competitors = analyzeCompetitors(fixture.competitors);
  const compMap = competitiveMap(competitors);
  const differentiation = differentiationOpportunities({ market_gaps: input.market_gaps || ['local specialization'], business_capabilities: input.business_capabilities || ['local specialization'], customer_values: input.customer_values || ['clear relevance'] });
  const positioningResult = buildPositioning({ category: input.category || mission.industry, target_customer: ICP?.business_type || 'target customer', core_problem: JTBD.problem || 'business problem', unique_value: differentiation[0]?.differentiator || 'relevant specialization', why_us: input.why_us || 'capability-backed delivery', alternative: JTBD.alternatives?.[0], proof: input.proof || [], claims: input.claims || [] });
  const positioning = positioningResult.ok ? positioningResult.positioning : null;
  const offerResult = engineerOffer({ core_offer: mission.offer?.name || input.core_offer || `${mission.business} core offer`, target_outcome: input.target_outcome || JTBD.desired_progress, included_scope: input.included_scope || [], excluded_scope: input.excluded_scope || [], delivery_model: input.delivery_model || 'service', pricing_model: input.pricing_model || 'package', proof: input.proof || [], constraints: mission.constraints });
  const offer = offerResult.ok ? offerResult.offer : null;
  const pricing = pricingStrategy({ preferred_model: offer?.pricing_model, packaged_scope: offer?.pricing_model === 'package', price_evidence_available: false });
  const messaging = messagingSystem({ core_message: `${positioning?.unique_value || 'Clear value'} for ${positioning?.target_customer || 'the target customer'}.`, one_liner: `${mission.business}: ${positioning?.unique_value || 'clear value'}.`, elevator_pitch: `${mission.business} helps ${positioning?.target_customer || 'customers'} address ${positioning?.core_problem || 'their problem'} with ${positioning?.unique_value || 'a focused offer'}.`, headline_direction: positioning?.unique_value || 'Outcome-first headline', subheadline_direction: offer?.target_outcome || '', proof_points: input.proof || [], objections: {}, CTA_language: ['request_next_step'], WHAT: offer?.core_offer, WHY: offer?.target_outcome, WHY_NOW: JTBD.switching_trigger, WHY_US: positioning?.why_us, NEXT_STEP: 'request_next_step', forbidden_claims: positioning?.unsupported_claims || [] });
  const local = mission.market === 'local' || Boolean(mission.geography?.city || mission.geography?.service_area?.length);
  const channels = channelStrategy({ budget_class: mission.budget_class, local, channel_fit: input.channel_fit || {}, channels: mission.available_channels.length ? mission.available_channels : undefined });
  const acquisition = acquisitionStrategy({ acquisition_goal: mission.acquisition_goal || mission.growth_goal, ICP, channel: channels.primary_channels[0], offer, message: messaging, conversion_surface: 'landing_page', measurement: { events: GROWTH_EVENT_TAXONOMY } });
  const campaigns = planCampaignPortfolio({ project_id: mission.project_id, goal: mission.acquisition_goal || mission.growth_goal, ICP, offer, message: messaging, channel_strategy: channels, budget_class: mission.budget_class, CTA: 'request_next_step' });
  const content = contentStrategy({ ICP, offer, market, customer_questions: input.customer_questions || [], local, distribution_channels: channels.primary_channels, CTA: 'request_next_step' });
  const seo = seoStrategy({ topics: input.seo_topics || input.customer_questions || ['service information', ...(local && mission.geography?.city ? [`${mission.industry} ${mission.geography.city}`] : [])], pillars: content.content_pillars.slice(0, 3), synthetic: true });
  const googleBusiness = buildGoogleBusinessStrategy({ location: mission.geography, categories: input.google_business_categories || [], services: input.google_business_services || [] });
  const localGrowth = localGrowthStrategy({ location: mission.geography, service_area: mission.geography?.service_area || [], local_search_intent: seo.local_intent, local_competitors: competitors, reviews: {}, trust: input.proof || [], local_pages: input.local_pages || [], contact_path: { type: 'landing_page_or_direct_contact' }, google_business_strategy: googleBusiness });
  const reputation = reputationStrategy({ reviews: fixture.reviews, review_velocity: input.review_velocity, response_quality: input.review_response_quality, trust_signals: input.proof || [] });
  const landing = landingPageStrategy({ audience: ICP, offer, headline_direction: messaging.headline_direction, proof: input.proof || [], objections: messaging.objections ? Object.keys(messaging.objections) : [], CTA: 'request_next_step', conversion_events: ['landing_page.viewed','CTA.clicked','form.started','form.submitted','lead.created'] });
  const funnel = buildFunnelContract({ project_id: mission.project_id, funnel_id: `${mission.project_id}:primary`, entry_source: channels.primary_channels[0], ICP, offer, conversion_surface: 'landing_page', lead_capture: { event: 'form.submitted' }, qualification: { owner: 'business_crm_factory' }, handoff: { owner: 'business_crm_factory' }, followup: { owner: 'automation_factory' }, success_event: 'lead.qualified' });
  const analytics = funnelAnalytics(input.funnel_data || {});
  const nextAction = nextBestGrowthAction({ metrics: input.bottleneck_metrics || {} });
  const experiment = buildExperimentContract({ project_id: mission.project_id, experiment_id: `${mission.project_id}:exp:headline-1`, hypothesis: 'A clearer outcome-first headline may improve CTA progression.', target_metric: 'CTA_click_rate', baseline: null, variant: { type: 'headline' }, expected_direction: 'improve', sample_requirement: { status: 'must_be_defined_before_validation' }, start_condition: ['tracking_ready'], stop_condition: ['sample_requirement_met'] });
  const webContract = toWebFactory({ project_id: mission.project_id, correlation_id: mission.correlation_id, website_goal: 'lead_generation', ICP, positioning, offer, message: messaging, landing_page_strategy: landing, SEO_strategy: seo, CRO_requirements: [], experiment_requirements: [experiment.experiment] });
  const aiContract = toAiFactory({ project_id: mission.project_id, correlation_id: mission.correlation_id, requested_tasks: ['content_briefs','message_variants','SEO_clustering'], context: { ICP, positioning, offer } });
  const automationContract = toAutomationFactory({ project_id: mission.project_id, correlation_id: mission.correlation_id, candidate_type: 'lead_followup_candidate', payload: { funnel_id: funnel.funnel_id, synthetic: true } });
  const analyticsContract = fromAnalytics({ project_id: mission.project_id, correlation_id: mission.correlation_id, events: [], funnels: [analytics], experiments: [experiment.experiment], behavior: {} });
  const CRMContract = fromBusinessCrm({ project_id: mission.project_id, correlation_id: mission.correlation_id, lead: null, qualification: null, deal: null, customer: null, source: null, revenue: null });
  const quality = strategyQualityGate({ evidence, ICP, positioning, offer, messaging, channel_strategy: channels, measurement_ready: true, CRM_ready: true, website_ready: true, analytics_ready: true });
  const readiness = gtmReadinessScore({ offer_defined: Boolean(offer), ICP_defined: Boolean(ICP), positioning_defined: Boolean(positioning), message_defined: Boolean(messaging.core_message), channels_defined: channels.primary_channels.length > 0, tracking_defined: true, CRM_ready: true, landing_page_ready: true, followup_ready: true });
  const delivery = buildGrowthDeliveryManifest({ project_id: mission.project_id, market_summary: market, evidence, ICP, segments, JTBD, competitor_analysis: { competitors, map: compMap, differentiation }, positioning, offer, pricing_strategy: pricing, messaging, channel_strategy: channels, campaign_plan: campaigns, content_strategy: content, SEO_strategy: seo, local_growth_strategy: local ? localGrowth : null, reputation_strategy: reputation, funnels: [funnel], conversion_strategy: { landing, next_action: nextAction }, analytics_events: GROWTH_EVENT_TAXONOMY, KPIs: KPI_REGISTRY, experiments: [experiment.experiment], cross_factory_requirements: { web: webContract.contract, ai: aiContract.contract, automation: automationContract.contract, business_crm: CRMContract.input, analytics: analyticsContract.input }, risks: positioning?.unsupported_claims?.length ? ['unsupported_claims_present'] : [], assumptions: ['synthetic_market_data_used'], warnings: quality.status === 'PASS' ? [] : quality.failures, cost_class: 'zero_cost_development' });
  const safety = productionSafetyGate({ production: false, real_customer_data: false, variable_cost_eur: 0, paid_campaign_activation: false, mass_email: false, public_publish: false, money_movement: false });

  return {
    ok: quality.status !== 'BLOCK' && safety.ok,
    status: quality.status === 'BLOCK' ? 'GROWTH_V1_BLOCKED' : 'GROWTH_V1_STRATEGY_READY',
    manifest: growthFactoryManifest(),
    mission,
    recipe: recipe.ok ? recipe.strategy_seed : null,
    market,
    evidence,
    segments,
    ICP,
    JTBD,
    competitors: { analysis: competitors, map: compMap, differentiation },
    positioning,
    offer,
    pricing,
    messaging,
    channels,
    acquisition,
    campaigns,
    content,
    SEO: seo,
    local_growth: local ? localGrowth : null,
    reputation,
    funnels: [funnel],
    analytics,
    experiments: [experiment.experiment],
    cross_factory: delivery.cross_factory_requirements,
    next_best_growth_action: nextAction,
    quality,
    readiness,
    safety,
    delivery,
    synthetic: true,
    external_side_effects: false,
    estimated_variable_cost_eur: 0,
    production: false
  };
}
