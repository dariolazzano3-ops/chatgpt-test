import assert from 'node:assert/strict';
import {
  growthFactoryManifest, compileNaturalLanguageGtm, createEvidence, assertProjectScope, buildCampaignContract, buildContentBriefContract, buildKeywordOpportunity, buildGoogleBusinessStrategy, buildExperimentContract, buildABContract, buildUtmContract,
  marketIntelligence, discoverCustomerSegments, buildICP, prioritizeICPs, buildJTBD, customerLanguage, analyzeCompetitors, competitiveMap, differentiationOpportunities, industryGrowthIntelligence, geographicIntelligence, localizeStrategy,
  buildPositioning, positioningVariants, engineerOffer, validateOfferFit, pricingStrategy, valueProposition, messagingSystem, channelStrategy, acquisitionStrategy, planCampaignPortfolio, budgetAllocation, zeroBudgetGrowthMode, paidGrowthReadiness, opportunityScore, prioritizeGrowthRecommendations,
  contentStrategy, classifySearchIntent, seoStrategy, buildTopicClusters, seoToWebContract, localGrowthStrategy, reputationStrategy, reviewOpportunity, socialProofInventory, funnelArchitecture, buildFunnelContract, landingPageStrategy, conversionReview, croOpportunities, leadMagnetOptions, referralStrategy, partnershipGrowth, outboundStrategy, salesEnablement,
  GROWTH_EVENT_TAXONOMY, KPI_REGISTRY, attribution, calculateKPIs, northStarMetric, funnelAnalytics, growthHealth, growthDiagnostic, bottleneckEngine, nextBestGrowthAction, unitEconomics, acquisitionEconomics, retentionGrowth, customerActivation, reactivationStrategy, upsellCrossSellOpportunity, referralLoop, channelDependencyRisk,
  EXPERIMENT_TYPES, prioritizeExperiments, validateExperimentResult, growthLearningLoop, GrowthKnowledgeBase, StrategyVersionStore, changeImpactAnalysis, blastRadius, competitorChangeWatchContract, marketChangeWatchContract,
  toAiFactory, toWebFactory, fromBusinessCrm, toAutomationFactory, fromAnalytics, crossFactoryCorrelation,
  getGtmRecipe, compileGtmRecipe, strategyQualityGate, gtmReadinessScore, growthRecommendation, operatorView, reputationRisk, productionSafetyGate,
  syntheticMarketData, buildGrowthFactoryV1
} from '../src/growth-v1/index.js';

const ok = (v, msg) => assert.equal(Boolean(v), true, msg);
const project = 'growth-v1-smoke';

console.log('Growth/GTM Factory V1 zero-cost synthetic acceptance');

const compiled = compileNaturalLanguageGtm('Baue einen lokalen Kundengewinnungsmotor mit niedrigem Budget.', { project_id: project, business: 'Synthetic Bakery', industry: 'bakery', geography: { country: 'DE', city: 'Synthetic City' } });
ok(compiled.ok, 'compiler');
assert.equal(compiled.contract.budget_class, 'zero_or_low');
assert.equal(compiled.contract.safety.variable_development_cost_ceiling_eur, 0);

const evidence = createEvidence({ evidence_id: `${project}:e1`, project_id: project, source_type: 'synthetic_fixture', claim_supported: 'Synthetic claim only.', evidence_state: 'ASSUMED', confidence: 1, synthetic: true });
ok(evidence.ok, 'evidence');
const fixture = syntheticMarketData({ project_id: project });
assert.equal(marketIntelligence({ industry: 'bakery', market_data: fixture.market_data, evidence: [evidence.evidence], synthetic: true }).market_structure.evidence_state, 'ASSUMED');

const segments = discoverCustomerSegments({ synthetic: true, segment_candidates: [
  { segment_id: 'a', description: 'Local households', problem: 'Need reliable nearby service', urgency: 3, buying_power: 3, reachability: 5, market_fit: 5, expected_value: 3, sales_complexity: 1, competition: 4, business_capability_fit: 5 },
  { segment_id: 'b', description: 'Local offices', problem: 'Need reliable recurring supply', urgency: 4, buying_power: 5, reachability: 3, market_fit: 4, expected_value: 5, sales_complexity: 3, competition: 2, business_capability_fit: 4 }
] });
const prioritized = prioritizeICPs(segments);
ok(prioritized.recommended_primary_ICP?.score_factors, 'transparent ICP');
const icp = buildICP(prioritized.recommended_primary_ICP, { desired_outcomes: ['reliable outcome'], trust_requirements: ['reviews'] });
ok(icp.ok, 'ICP');
assert.equal(buildJTBD({ problem: 'unreliable option', desired_progress: 'reliable outcome' }).problem, 'unreliable option');
assert.equal(customerLanguage({ terms_customers_use: ['reliable'], evidence_state: 'ASSUMED' }).evidence_state, 'ASSUMED');

const competitors = analyzeCompetitors([
  { name: 'Synthetic A', positioning: 'cheap', strengths: ['price'], weaknesses: ['generic'], synthetic: true },
  { name: 'Synthetic B', positioning: 'premium', strengths: ['presentation'], weaknesses: ['slow'], synthetic: true },
  { name: 'Synthetic C', positioning: 'local', strengths: ['trust'], weaknesses: ['unclear offer'], synthetic: true }
]);
assert.equal(competitiveMap(competitors).length, 3);
assert.equal(competitors.every((c) => c.asset_reuse_allowed === false), true);
const diff = differentiationOpportunities({ market_gaps: ['fast local response'], business_capabilities: ['fast local response'] });
assert.equal(diff[0].defensibility, 'capability_backed');
const pos = buildPositioning({ category: 'local service', target_customer: 'local offices', core_problem: 'unreliable supply', unique_value: 'reliable local response', proof: ['process'] });
ok(pos.ok, 'positioning');
assert.equal(positioningVariants(pos.positioning, ['local','speed']).length, 8);
const offer = engineerOffer({ core_offer: 'Service package', target_outcome: 'Reliable outcome', pricing_model: 'package' });
ok(offer.ok, 'offer');
assert.equal(validateOfferFit({ ICP_fit: true, problem_fit: true, operational_feasibility: true, margin_logic: 'unknown', trust_requirement: true, positioning_consistency: true, delivery_complexity: 'manageable' }).status, 'PASS');
assert.equal(pricingStrategy({ preferred_model: 'package', price_evidence_available: false }).recommended_price, null);
ok(valueProposition({ primary_value_proposition: 'Reliable outcome' }).primary_value_proposition, 'value proposition');
const msg = messagingSystem({ core_message: 'Reliable local service.', one_liner: 'Reliable service.', headline_direction: 'Reliability first', WHAT: 'Service package', WHY: 'Reliability', NEXT_STEP: 'Request quote' });
assert.equal(msg.hierarchy.WHAT, 'Service package');

const channels = channelStrategy({ budget_class: 'zero_or_low', local: true });
ok(channels.not_recommended_channels.some((x) => x.channel === 'paid search'), 'paid blocked in zero budget');
assert.equal(acquisitionStrategy({ acquisition_goal: 'leads', channel: channels.primary_channels[0] }).traffic_purchase_allowed, false);
ok(planCampaignPortfolio({ project_id: project, goal: 'leads', channel_strategy: channels }).length > 0, 'campaign planner');
assert.equal(buildCampaignContract({ project_id: project, campaign_id: 'c1', goal: 'leads', channel: 'Local SEO' }).campaign.activation_allowed, false);
assert.equal(budgetAllocation({ channels: ['SEO'], budget_class: 'zero' })[0].spend_allowed, false);
assert.equal(zeroBudgetGrowthMode({ local: true }).paid_channels.length, 0);
assert.equal(paidGrowthReadiness({ offer_proven: true, landing_page_ready: false, tracking_ready: false, CRM_ready: false, followup_ready: false, budget_defined: true, unit_economics_known: false }).status, 'PAID_GROWTH_NOT_READY');

const content = contentStrategy({ ICP: icp.ICP, offer: offer.offer, customer_questions: ['service preis'], local: true });
ok(content.content_pillars.includes('local relevance'), 'content pillars');
assert.equal(classifySearchIntent('service preis'), 'transactional');
assert.equal(classifySearchIntent('service Saarbrücken'), 'local');
const seo = seoStrategy({ topics: ['service Saarbrücken','service preis','how service works','service vergleich'], pillars: ['service'], synthetic: true });
ok(seo.topic_clusters.length && seo.landing_page_opportunities.length, 'SEO strategy');
assert.equal(seo.keyword_universe.every((k) => k.search_volume === null), true);
ok(buildTopicClusters(['service'], ['service preis']).length, 'topic cluster');
ok(seoToWebContract({ project_id: project, page_opportunity: { topic: 'service preis' }, keyword_intent: 'transactional' }).ok, 'SEO web contract');
assert.equal(buildKeywordOpportunity({ topic: 'service preis', evidence_status: 'ASSUMED' }).opportunity.search_volume, null);
assert.equal(buildGoogleBusinessStrategy({ location: { city: 'Synthetic City' } }).external_writes, false);
const local = localGrowthStrategy({ local_pages: [{ slug: 'good', unique_intent: true, unique_service_relevance: true, location_relevance: true, content_uniqueness: true }, { slug: 'thin' }] });
assert.equal(local.local_pages.length, 1);
assert.equal(local.rejected_thin_pages.length, 1);
const rep = reputationStrategy({ reviews: [{ rating: 2, themes: ['slow'] }, { rating: 3, themes: ['slow'] }], response_quality: 'slow' });
ok(rep.risk_signals.length, 'reputation');
assert.equal(reviewOpportunity({ event: 'service.completed', customer_satisfaction: 'positive' }).automatic_request_allowed, false);
assert.equal(socialProofInventory({ assets: [{ type: 'review', verified: true }, { type: 'result', verified: false }] }).rejected_unverified_count, 1);

ok(funnelArchitecture({}).stages.includes('conversion'), 'funnel architecture');
const funnel = buildFunnelContract({ project_id: project, funnel_id: 'f1', entry_source: 'SEO', conversion_surface: 'landing_page' });
assert.equal(funnel.project_id, project);
const landing = landingPageStrategy({ audience: icp.ICP, offer: offer.offer, CTA: 'request quote' });
assert.equal(landing.implementation_owner, 'web_factory');
assert.equal(conversionReview({ message_clarity: 'weak', trust: 'missing' }).problems.length, 2);
assert.equal(croOpportunities([{ problem: 'form friction' }])[0].guaranteed_effect, false);
assert.equal(leadMagnetOptions({}).length, 8);
assert.equal(referralStrategy({}).payment_execution_allowed, false);
assert.equal(partnershipGrowth({}).length, 6);
assert.equal(outboundStrategy({}).mass_email_allowed, false);
assert.equal(salesEnablement({}).sales_state_owner, 'business_crm_factory');

assert.ok(GROWTH_EVENT_TAXONOMY.includes('lead.qualified'));
assert.ok(KPI_REGISTRY.includes('customer_acquisition_cost'));
assert.equal(attribution({ model: 'first_touch', touches: [] }).status, 'insufficient_data');
assert.equal(attribution({ model: 'last_touch', touches: [{ source: 'SEO' }, { source: 'referral' }] }).attributed.source, 'referral');
const kpis = calculateKPIs({ traffic: 1000, leads: 50, qualified_leads: 10, cost: 0 });
assert.equal(kpis.values.conversion_rate, 0.05);
assert.equal(northStarMetric({ business_model: 'appointment' }).metric, 'booked_appointments');
const weakFunnel = funnelAnalytics({ visits: 10000, CTA_clicks: 500, forms_started: 40, leads: 40, qualified: 10 });
assert.equal(weakFunnel.rates.CTA_to_form, 0.08);
ok(growthHealth({ conversion_change_pct: -30 }).signals.some((x) => x.signal === 'conversion_drop'), 'growth health');
ok(growthDiagnostic({ data: { conversion_rate: 0.01 } }).likely_causes.includes('conversion'), 'diagnostic');
assert.equal(bottleneckEngine({ market_fit: 0.8, acquisition_rate: 0.5, landing_conversion: 0.08, lead_rate: 1, qualification_rate: 0.25, sales_conversion: 0.2 }).bottleneck.stage, 'landing');
assert.equal(nextBestGrowthAction({ metrics: { landing_conversion: 0.08, sales_conversion: 0.2 } }).recommended_action, 'run_conversion_review');
assert.equal(unitEconomics({ CAC: 10 }).complete, false);
assert.equal(acquisitionEconomics({}).status, 'insufficient_data');
assert.equal(retentionGrowth({}).state_owner, 'business_crm_factory');
assert.equal(customerActivation({ activation_event: 'customer.activated' }).activation_event, 'customer.activated');
assert.equal(reactivationStrategy({ state: 'lost_lead' }).automatic_communication, false);
assert.equal(upsellCrossSellOpportunity({ current_offer: 'a', next_offers: ['a','b'] }).potential_next_offer, 'b');
assert.equal(referralLoop({ customer_success_event: true }).automatic_request, false);
assert.equal(channelDependencyRisk({ channel_shares: { SEO: 0.9, referral: 0.1 } }).risk, 'high');

assert.ok(EXPERIMENT_TYPES.includes('headline'));
const exp = buildExperimentContract({ project_id: project, experiment_id: 'e1', hypothesis: 'Clearer headline may help.', target_metric: 'CTA_rate' });
ok(exp.ok, 'experiment contract');
assert.equal(exp.experiment.production_execution_allowed, false);
assert.equal(buildABContract({ metric: 'CTA_rate' }).production_execution_allowed, false);
assert.equal(prioritizeExperiments([{ experiment_id: 'a', expected_impact: 5, confidence: 5, effort: 1, risk: 1 }, { experiment_id: 'b', expected_impact: 2, confidence: 2, effort: 4, risk: 4 }])[0].experiment_id, 'a');
assert.equal(validateExperimentResult({ sample_size: 100, required_sample_size: 1000, confidence: 0.99 }).status, 'insufficient_data');
assert.equal(validateExperimentResult({ sample_size: 1000, required_sample_size: 1000, confidence: 0.9 }).status, 'candidate_winner');
assert.equal(validateExperimentResult({ sample_size: 1000, required_sample_size: 1000, confidence: 0.97 }).status, 'validated_winner');
assert.equal(growthLearningLoop({}).execution_owner, 'external_factories_or_operator');
const kb = new GrowthKnowledgeBase(project);
ok(kb.add({ project_id: project, what_worked: ['SEO'] }).ok, 'KB add');
assert.equal(kb.add({ project_id: 'foreign' }).error, 'CROSS_PROJECT_WRITE_BLOCKED');
assert.equal(kb.list('foreign').error, 'CROSS_PROJECT_READ_BLOCKED');
const versions = new StrategyVersionStore(project);
assert.equal(versions.commit({ project_id: project, ICP: icp.ICP }).record.version, 1);
assert.equal(versions.commit({ project_id: project, positioning: pos.positioning }).record.version, 2);
ok(changeImpactAnalysis({ type: 'primary_ICP' }).affected_assets.includes('CRM_qualification'), 'impact');
ok(blastRadius({ change: { type: 'primary_ICP' } }).affected_factories.includes('web_factory'), 'blast radius');
assert.equal(competitorChangeWatchContract({ competitor: 'Synthetic A' }).monitoring_active, false);
assert.equal(marketChangeWatchContract({}).monitoring_active, false);

ok(toAiFactory({ project_id: project }).ok, 'AI contract');
ok(toWebFactory({ project_id: project, landing_page_strategy: landing }).ok, 'Web contract');
assert.equal(fromBusinessCrm({ project_id: project, lead: { id: 'l1' } }).input.CRM_mutation_allowed, false);
assert.equal(toAutomationFactory({ project_id: project, candidate_type: 'review_request_candidate' }).contract.execution_allowed_by_growth, false);
assert.equal(toAutomationFactory({ project_id: project, candidate_type: 'send_mass_email' }).ok, false);
ok(fromAnalytics({ project_id: project, funnels: [weakFunnel] }).ok, 'Analytics input');
assert.equal(crossFactoryCorrelation({ project_id: project, lead_id: 'l1' }).lead_id, 'l1');
assert.equal(assertProjectScope(project, [{ project_id: project }, { project_id: 'foreign', id: 'x' }]).ok, false);

for (const r of ['local_service','consulting','agency','restaurant','real_estate','SaaS','professional_services','hospitality','ecommerce_light']) ok(getGtmRecipe(r).ok, `recipe ${r}`);
ok(compileGtmRecipe({ request: 'Go-to-Market für lokale Gebäudereinigung', project_id: project, business: 'Synthetic Cleaning', industry: 'cleaning' }).ok, 'recipe compiler');
assert.equal(industryGrowthIntelligence({ industry: 'cleaning', data: { common_acquisition_channels: ['Local SEO'] }, synthetic: true }).evidence_state, 'ASSUMED');
assert.equal(geographicIntelligence({ country: 'DE', city: 'Synthetic City', evidence_state: 'ASSUMED' }).city, 'Synthetic City');
assert.equal(localizeStrategy({}, { language: 'de', terminology: { quote: 'Angebot' }, evidence_state: 'ASSUMED' }).localization.terminology.quote, 'Angebot');

ok(Number.isFinite(opportunityScore({ market_fit: 5, business_value: 5, cost: 1, effort: 1, confidence: 5, risk: 1 }).score), 'opportunity score');
assert.equal(prioritizeGrowthRecommendations([{ id: 'a', market_fit: 5, business_impact: 5, cost: 1, effort: 1, evidence: 5, risk: 1 }, { id: 'b', market_fit: 2, business_impact: 2, cost: 4, effort: 4, evidence: 2, risk: 4 }])[0].id, 'a');
const quality = strategyQualityGate({ evidence: [evidence.evidence], ICP: icp.ICP, positioning: pos.positioning, offer: offer.offer, messaging: msg, channel_strategy: channels, measurement_ready: true, CRM_ready: true, website_ready: true, analytics_ready: true });
assert.equal(quality.status, 'PASS');
assert.equal(gtmReadinessScore({ offer_defined: true, ICP_defined: true, positioning_defined: true, message_defined: true, channels_defined: true, tracking_defined: true, CRM_ready: true, landing_page_ready: true, followup_ready: true }).percentage, 100);
assert.equal(growthRecommendation({ recommended_action: 'fix conversion', why: 'bottleneck' }).effect_guaranteed, false);
assert.equal(operatorView({ primary_growth_goal: 'leads' }).schema, 'riosystems.growth-operator-view.v1');
assert.equal(reputationRisk({ rating_change: -0.5, negative_themes: ['slow'], response_quality: 'slow' }).status, 'WARN');
assert.equal(productionSafetyGate({ production: true }).status, 'BLOCK');

// Reference A: local bakery GTM.
const A = buildGrowthFactoryV1({ request: 'Baue für Bäckerei Müller einen lokalen Kundengewinnungsmotor. Budget ist niedrig.', project_id: 'ref-a', business: 'Bäckerei Müller', industry: 'bakery', geography: { country: 'DE', city: 'Synthetic City', service_area: ['Synthetic City'] }, target_customer: { description: 'local customers' }, primary_problem: 'Need trusted nearby bakery' });
ok(A.ok && A.production === false && A.estimated_variable_cost_eur === 0, 'Reference A');
// Reference B: consulting GTM.
const B = buildGrowthFactoryV1({ request: 'Build GTM for consulting with qualified B2B leads.', project_id: 'ref-b', business: 'Synthetic Consulting', industry: 'consulting', market: 'B2B', target_customer: { description: 'SME decision makers' }, primary_problem: 'Need specialist advice', customer_questions: ['consulting provider comparison'], available_channels: ['SEO','content','outbound','referrals'] });
ok(B.ok && B.cross_factory.business_crm, 'Reference B');
// Reference C: competitor differentiation.
assert.equal(diff[0].defensibility, 'capability_backed');
// Reference D: weak conversion.
assert.equal(bottleneckEngine({ market_fit: 0.8, acquisition_rate: 0.5, landing_conversion: weakFunnel.rates.CTA_to_form, lead_rate: 1, qualification_rate: 0.25, sales_conversion: 0.2 }).bottleneck.stage, 'landing');
// Reference E: channel strategy.
ok(channelStrategy({ local: true, budget_class: 'low', channels: ['SEO','paid search','organic social','referrals'] }).primary_channels.length, 'Reference E');
// Reference F: zero budget.
assert.equal(zeroBudgetGrowthMode({ local: true }).paid_channels.length, 0);
// Reference G: paid readiness.
assert.equal(paidGrowthReadiness({ offer_proven: true, landing_page_ready: false, tracking_ready: false, CRM_ready: false, followup_ready: false, budget_defined: true, unit_economics_known: false }).status, 'PAID_GROWTH_NOT_READY');
// Reference H: reputation.
assert.equal(reputationRisk({ rating_change: -0.5, review_velocity_change: -0.5, negative_themes: ['slow responses'], response_quality: 'slow' }).status, 'WARN');
// Reference I: SEO cluster.
ok(seo.topic_clusters.length && seo.landing_page_opportunities.length && seo.keyword_universe.every((k) => k.search_volume === null), 'Reference I');
// Reference J: cross-factory flow.
ok(toWebFactory({ project_id: 'ref-j', landing_page_strategy: landing }).ok && fromBusinessCrm({ project_id: 'ref-j', lead: { id: 'l1' } }).ok && toAiFactory({ project_id: 'ref-j' }).ok && toAutomationFactory({ project_id: 'ref-j', candidate_type: 'lead_followup_candidate' }).ok && fromAnalytics({ project_id: 'ref-j', funnels: [weakFunnel] }).ok, 'Reference J');
// Reference K: experiment.
assert.equal(exp.experiment.production_execution_allowed, false);
// Reference L: blast radius.
const L = blastRadius({ change: { type: 'primary_ICP' } });
for (const required of ['website_copy','SEO_pages','campaigns','messaging','CRM_qualification','AI_tasks','automation_followups']) ok(L.affected_assets.includes(required), `Reference L ${required}`);

const utm = buildUtmContract({ source: 'Google Business', medium: 'Organic Local', campaign: 'Local Launch' });
assert.equal(utm.contract.campaign, 'local-launch');
assert.equal(buildContentBriefContract({ project_id: project, topic: 'service', goal: 'lead support' }).ok, true);

const manifest = growthFactoryManifest();
assert.equal(manifest.provider_neutral, true);
assert.equal(manifest.safety.variable_development_cost_ceiling_eur, 0);

console.log(JSON.stringify({
  ok: true,
  status: 'GROWTH_GTM_FACTORY_V1_ACCEPTANCE_PASSED',
  reference_scenarios: 12,
  project_isolation: 'passed',
  provider_neutral: true,
  external_writes: false,
  paid_activation: false,
  production: false,
  variable_cost_eur: 0
}, null, 2));
