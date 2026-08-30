const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const uniq = (a = []) => [...new Set((Array.isArray(a) ? a : []).map((v) => clean(v)).filter(Boolean))];

export function contentStrategy(input = {}) {
  const questions = uniq(input.customer_questions || []);
  const defaultPillars = ['education', 'proof', 'authority', 'problem awareness', 'comparison', 'objection handling', 'customer stories'];
  if (input.local === true) defaultPillars.push('local relevance');
  const pillars = uniq(input.content_pillars?.length ? input.content_pillars : defaultPillars);
  return {
    schema: 'riosystems.content-strategy.v1',
    content_pillars: pillars,
    customer_questions: questions,
    funnel_stage: clone(input.funnel_stage || {}),
    content_types: uniq(input.content_types || ['landing_page', 'article', 'proof_asset']),
    distribution_channels: uniq(input.distribution_channels || ['website']),
    CTA: clean(input.CTA, 160) || 'next_step',
    reuse_plan: clone(input.reuse_plan || { atomize: true, public_publish: false }),
    basis: { ICP: clone(input.ICP || null), offer: clone(input.offer || null), market: clone(input.market || null) }
  };
}

export function classifySearchIntent(term = '') {
  const text = clean(term, 300).toLowerCase();
  if (!text) return 'informational';
  if (/near me|in der nähe|saarbrücken|berlin|hamburg|münchen|lokal|vor ort/.test(text)) return 'local';
  if (/kaufen|buchen|termin|angebot|preis|kosten|bestellen|demo/.test(text)) return 'transactional';
  if (/vs\b|vergleich|beste|anbieter|alternative|bewertung/.test(text)) return 'commercial';
  if (/login|kontakt|impressum|homepage|website/.test(text)) return 'navigational';
  return 'informational';
}

export function seoStrategy(input = {}) {
  const topics = uniq(input.topics || input.customer_questions || []);
  const keywordUniverse = topics.map((topic) => ({ topic, intent: classifySearchIntent(topic), search_volume: null, evidence_status: input.synthetic ? 'ASSUMED' : 'UNKNOWN' }));
  const grouped = keywordUniverse.reduce((acc, item) => { (acc[item.intent] ||= []).push(item.topic); return acc; }, {});
  const commercial = grouped.commercial || [];
  const transactional = grouped.transactional || [];
  const local = grouped.local || [];
  return {
    schema: 'riosystems.seo-strategy.v1',
    keyword_universe: keywordUniverse,
    topic_clusters: buildTopicClusters(input.pillars || [], topics),
    commercial_intent: commercial,
    informational_intent: grouped.informational || [],
    local_intent: local,
    landing_page_opportunities: uniq([...(transactional || []), ...commercial, ...local]).map((topic) => ({ topic, intent: classifySearchIntent(topic), page_type: 'landing_page' })),
    content_opportunities: (grouped.informational || []).map((topic) => ({ topic, page_type: 'content' })),
    internal_linking_strategy: 'link_supporting_topics_to_relevant_pillar_and_conversion_surface',
    fabricated_search_volume: false
  };
}

export function buildTopicClusters(pillars = [], supporting = []) {
  const normalized = uniq(pillars);
  if (!normalized.length && supporting.length) normalized.push(supporting[0]);
  return normalized.map((pillar, index) => ({
    pillar_topic: pillar,
    supporting_topics: uniq(supporting.filter((_, i) => i % Math.max(1, normalized.length) === index)),
    landing_pages: [],
    internal_links: ['supporting_to_pillar', 'pillar_to_conversion_surface'],
    funnel_stage: 'consideration'
  }));
}

export function seoToWebContract(input = {}) {
  if (!input.project_id || !input.page_opportunity) return { ok: false, error: 'SEO_WEB_CONTRACT_INVALID' };
  return { ok: true, contract: { schema: 'riosystems.growth-web-seo.v1', project_id: clean(input.project_id, 80), page_opportunity: clone(input.page_opportunity), keyword_intent: clean(input.keyword_intent, 40), ICP: clone(input.ICP || null), content_brief: clone(input.content_brief || null), CTA: clean(input.CTA, 160), internal_links: clone(input.internal_links || []), structured_data_intent: clean(input.structured_data_intent, 100) || 'none', implementation_owner: 'web_factory' } };
}

export function localGrowthStrategy(input = {}) {
  return {
    schema: 'riosystems.local-growth.v1',
    location: clone(input.location || null),
    service_area: uniq(input.service_area || []),
    local_search_intent: uniq(input.local_search_intent || []),
    local_competitors: clone(input.local_competitors || []),
    reviews: clone(input.reviews || {}),
    trust: uniq(input.trust || []),
    local_pages: (input.local_pages || []).filter((page) => page.unique_intent && page.unique_service_relevance && page.location_relevance && page.content_uniqueness),
    rejected_thin_pages: (input.local_pages || []).filter((page) => !(page.unique_intent && page.unique_service_relevance && page.location_relevance && page.content_uniqueness)).map((page) => page.location || page.slug || 'unknown'),
    contact_path: clone(input.contact_path || { type: 'direct' }),
    google_business_strategy: clone(input.google_business_strategy || null),
    mass_location_page_generation: false
  };
}

export function reputationStrategy(input = {}) {
  const reviews = input.reviews || [];
  const numeric = reviews.filter((r) => Number.isFinite(Number(r.rating)));
  const avg = numeric.length ? numeric.reduce((sum, r) => sum + Number(r.rating), 0) / numeric.length : null;
  const themes = {};
  for (const review of reviews) for (const theme of review.themes || []) themes[theme] = (themes[theme] || 0) + 1;
  const negativeThemes = Object.entries(themes).filter(([theme]) => /slow|late|dirty|price|rude|schlecht|langsam|teuer/i.test(theme)).sort((a, b) => b[1] - a[1]);
  return {
    schema: 'riosystems.reputation-strategy.v1',
    review_volume: reviews.length,
    review_velocity: input.review_velocity ?? null,
    rating: avg == null ? null : Number(avg.toFixed(2)),
    themes,
    sentiment: clone(input.sentiment || null),
    response_quality: clean(input.response_quality, 60) || 'unknown',
    trust_signals: uniq(input.trust_signals || []),
    risk_signals: negativeThemes.map(([theme, count]) => ({ signal: 'negative_theme', theme, evidence: count, recommended_action: 'investigate_and_address_root_cause' })),
    fake_reviews_allowed: false,
    incentivized_deceptive_reviews_allowed: false
  };
}

export function reviewOpportunity(input = {}) {
  const eligible = input.event === 'service.completed' && input.customer_satisfaction === 'positive';
  return { schema: 'riosystems.review-opportunity.v1', review_request_candidate: eligible, reason: eligible ? 'positive_service_completion_event' : 'eligibility_not_met', execution_owner: 'automation_factory', automatic_request_allowed: false };
}

export function socialProofInventory(input = {}) {
  const verified = (input.assets || []).filter((asset) => asset.verified === true);
  return { schema: 'riosystems.social-proof.v1', testimonials: verified.filter((a) => a.type === 'testimonial'), reviews: verified.filter((a) => a.type === 'review'), case_studies: verified.filter((a) => a.type === 'case_study'), credentials: verified.filter((a) => a.type === 'credential'), statistics: verified.filter((a) => a.type === 'statistic'), client_logos: verified.filter((a) => a.type === 'client_logo'), results: verified.filter((a) => a.type === 'result'), rejected_unverified_count: (input.assets || []).length - verified.length };
}

export function funnelArchitecture(input = {}) {
  const requested = uniq(input.stages || ['awareness', 'consideration', 'conversion', 'activation', 'retention', 'referral']);
  return { schema: 'riosystems.funnel-architecture.v1', stages: requested, note: 'stages_are_business_specific_not_mandatory' };
}

export function buildFunnelContract(input = {}) {
  return { schema: 'riosystems.funnel.v1', project_id: clean(input.project_id, 80), funnel_id: clean(input.funnel_id, 120), entry_source: clean(input.entry_source, 100), ICP: clone(input.ICP || null), offer: clone(input.offer || null), conversion_surface: clean(input.conversion_surface, 120), lead_capture: clone(input.lead_capture || null), qualification: clone(input.qualification || null), handoff: clone(input.handoff || null), followup: clone(input.followup || null), success_event: clean(input.success_event, 100) || 'lead.created' };
}

export function landingPageStrategy(input = {}) {
  return { schema: 'riosystems.landing-page-strategy.v1', audience: clone(input.audience || null), offer: clone(input.offer || null), headline_direction: clean(input.headline_direction, 260), proof: uniq(input.proof || []), objections: uniq(input.objections || []), CTA: clean(input.CTA, 160), form_strategy: clone(input.form_strategy || { fields: 'minimum_required' }), conversion_events: uniq(input.conversion_events || ['landing_page.viewed', 'CTA.clicked', 'form.started', 'form.submitted']), implementation_owner: 'web_factory' };
}

export function conversionReview(input = {}) {
  const dimensions = ['message_clarity', 'offer_clarity', 'trust', 'CTA', 'friction', 'form_length', 'proof', 'urgency', 'objection_coverage', 'mobile_path'];
  const findings = dimensions.map((key) => ({ dimension: key, status: clean(input[key], 20) || 'unknown' }));
  return { schema: 'riosystems.conversion-review.v1', findings, problems: findings.filter((f) => ['weak', 'poor', 'high', 'missing'].includes(f.status)).map((f) => f.dimension) };
}

export function croOpportunities(problems = []) {
  return (problems || []).map((problem, index) => ({ problem: clean(problem.problem || problem, 240), evidence: clone(problem.evidence || null), hypothesis: clean(problem.hypothesis, 400) || `Reducing ${clean(problem.problem || problem, 180)} may improve the next funnel step.`, expected_effect: 'directional_only', risk: clean(problem.risk, 40) || 'low', priority: Number(problem.priority || index + 1), measurement_plan: clone(problem.measurement_plan || { compare_conversion_step: true }), guaranteed_effect: false }));
}

export function leadMagnetOptions(input = {}) {
  const types = ['guide', 'checklist', 'calculator', 'audit', 'template', 'assessment', 'demo', 'consultation'];
  return types.map((type, index) => ({ type, ICP_fit: input.fit?.[type] ?? (index < 3 ? 4 : 3), value: input.value?.[type] ?? 3, production_effort: input.effort?.[type] ?? 3, lead_quality: input.lead_quality?.[type] ?? 3, followup_potential: input.followup?.[type] ?? 3 }));
}

export function referralStrategy(input = {}) {
  return { schema: 'riosystems.referral-strategy.v1', customer_referrals: clone(input.customer_referrals || { enabled: true }), partner_referrals: clone(input.partner_referrals || { enabled: true }), affiliate_like_partnerships: clone(input.affiliate_like_partnerships || { enabled: false }), payment_execution_allowed: false, automation_execution_allowed: false };
}

export function partnershipGrowth(input = {}) {
  const types = input.partner_types || ['complementary businesses', 'associations', 'local networks', 'platforms', 'suppliers', 'agencies'];
  return types.map((partner_type, index) => ({ partner_type, value_exchange: input.value_exchange?.[partner_type] || 'mutual_relevance', lead_potential: input.lead_potential?.[partner_type] ?? 'unknown', risk: input.risk?.[partner_type] || 'medium', priority: index + 1 }));
}

export function outboundStrategy(input = {}) {
  return { schema: 'riosystems.outbound-strategy.v1', ICP_list_criteria: clone(input.ICP_list_criteria || {}), message_framework: clone(input.message_framework || {}), offer: clone(input.offer || null), sequence_strategy: clone(input.sequence_strategy || { steps: [] }), qualification: clone(input.qualification || {}), handoff: clone(input.handoff || { owner: 'business_crm_factory' }), execution_allowed: false, mass_email_allowed: false };
}

export function salesEnablement(input = {}) {
  return { schema: 'riosystems.sales-enablement.v1', ICP_summary: clone(input.ICP_summary || null), positioning: clone(input.positioning || null), offer: clone(input.offer || null), objections: clone(input.objections || {}), proof: uniq(input.proof || []), discovery_questions: uniq(input.discovery_questions || []), qualification_criteria: clone(input.qualification_criteria || {}), followup_message_direction: clean(input.followup_message_direction, 300), sales_state_owner: 'business_crm_factory' };
}
