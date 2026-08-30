const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);

function base(input = {}, schema) {
  if (!input.project_id) return { ok: false, error: 'CROSS_FACTORY_PROJECT_ID_REQUIRED' };
  return { schema, project_id: clean(input.project_id, 80), correlation_id: clean(input.correlation_id, 120) || `${clean(input.project_id, 80)}:growth`, campaign_id: clean(input.campaign_id, 120) || null, lead_id: clean(input.lead_id, 120) || null, experiment_id: clean(input.experiment_id, 120) || null, production: false };
}

export function toAiFactory(input = {}) {
  const envelope = base(input, 'riosystems.growth-ai-contract.v1');
  if (envelope.ok === false) return envelope;
  return { ok: true, contract: { ...envelope, requested_tasks: input.requested_tasks || ['market_analysis','content_briefs','message_variants','review_analysis','competitor_summaries','SEO_clustering','experiment_interpretation'], context: clone(input.context || {}), inference_owner: 'ai_factory', growth_semantics_owner: 'growth_factory' } };
}

export function toWebFactory(input = {}) {
  const envelope = base(input, 'riosystems.growth-web-contract.v1');
  if (envelope.ok === false) return envelope;
  return { ok: true, contract: { ...envelope, website_goal: input.website_goal || 'conversion', ICP: clone(input.ICP || null), positioning: clone(input.positioning || null), offer: clone(input.offer || null), message: clone(input.message || null), landing_page_strategy: clone(input.landing_page_strategy || null), SEO_strategy: clone(input.SEO_strategy || null), CRO_requirements: clone(input.CRO_requirements || []), experiment_requirements: clone(input.experiment_requirements || []), implementation_owner: 'web_factory' } };
}

export function fromBusinessCrm(input = {}) {
  const envelope = base(input, 'riosystems.crm-growth-input.v1');
  if (envelope.ok === false) return envelope;
  return { ok: true, input: { ...envelope, lead: clone(input.lead || null), qualification: clone(input.qualification || null), deal: clone(input.deal || null), customer: clone(input.customer || null), source: clone(input.source || null), revenue: Number.isFinite(Number(input.revenue)) ? Number(input.revenue) : null, CRM_state_owner: 'business_crm_factory', CRM_mutation_allowed: false } };
}

export function toAutomationFactory(input = {}) {
  const envelope = base(input, 'riosystems.growth-automation-candidate.v1');
  if (envelope.ok === false) return envelope;
  const allowed = ['review_request_candidate','lead_followup_candidate','campaign_followup_candidate','referral_candidate'];
  const candidate_type = clean(input.candidate_type, 100);
  if (!allowed.includes(candidate_type)) return { ok: false, error: 'AUTOMATION_CANDIDATE_TYPE_UNSUPPORTED' };
  return { ok: true, contract: { ...envelope, candidate_type, payload: clone(input.payload || {}), execution_owner: 'automation_factory', execution_allowed_by_growth: false } };
}

export function fromAnalytics(input = {}) {
  const envelope = base(input, 'riosystems.analytics-growth-input.v1');
  if (envelope.ok === false) return envelope;
  return { ok: true, input: { ...envelope, events: clone(input.events || []), funnels: clone(input.funnels || []), conversion: clone(input.conversion || null), experiments: clone(input.experiments || []), behavior: clone(input.behavior || {}), pii_policy: 'no_unnecessary_pii', analytics_state_owner: 'analytics_provider' } };
}

export function crossFactoryCorrelation(input = {}) {
  return { project_id: clean(input.project_id, 80), correlation_id: clean(input.correlation_id, 120) || null, campaign_id: clean(input.campaign_id, 120) || null, lead_id: clean(input.lead_id, 120) || null, experiment_id: clean(input.experiment_id, 120) || null };
}
