const clone = (v) => structuredClone(v ?? null);
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const clamp = (n, min = 0, max = 5) => Math.max(min, Math.min(max, Number(n) || 0));

export const EXPERIMENT_TYPES = Object.freeze(['headline','CTA','offer','pricing presentation','form length','social proof','landing page','channel','message','audience','content format']);

export function prioritizeExperiments(experiments = []) {
  return (experiments || []).map((experiment) => {
    const factors = { expected_impact: clamp(experiment.expected_impact), confidence: clamp(experiment.confidence), effort: clamp(experiment.effort), risk: clamp(experiment.risk) };
    const score = factors.expected_impact + factors.confidence - 0.6 * factors.effort - 0.8 * factors.risk;
    return { ...clone(experiment), priority_score: Number(score.toFixed(2)), factors };
  }).sort((a, b) => b.priority_score - a.priority_score);
}

export function validateExperimentResult(input = {}) {
  const sample = Number(input.sample_size);
  const required = Number(input.required_sample_size);
  const confidence = Number(input.confidence);
  if (!Number.isFinite(sample) || !Number.isFinite(required) || sample < required) return { status: 'insufficient_data', reason: 'sample_requirement_not_met' };
  if (!Number.isFinite(confidence) || confidence < Number(input.candidate_confidence_threshold ?? 0.8)) return { status: 'inconclusive', reason: 'confidence_below_candidate_threshold' };
  if (confidence < Number(input.validated_confidence_threshold ?? 0.95)) return { status: 'candidate_winner', reason: 'directional_signal_requires_more_evidence' };
  return { status: 'validated_winner', reason: 'supplied_sample_and_confidence_thresholds_met', production_rollout_allowed: false };
}

export function growthLearningLoop(input = {}) {
  return {
    schema: 'riosystems.growth-learning-loop.v1',
    PLAN: clone(input.plan || {}),
    EXECUTE: clone(input.execute || { mode: 'synthetic_or_external_factory_only' }),
    MEASURE: clone(input.measure || {}),
    LEARN: clone(input.learn || {}),
    RECOMMEND: clone(input.recommend || {}),
    execution_owner: 'external_factories_or_operator'
  };
}

export class GrowthKnowledgeBase {
  constructor(projectId) {
    this.project_id = clean(projectId, 80);
    this.records = [];
  }
  add(input = {}) {
    if (clean(input.project_id, 80) !== this.project_id) return { ok: false, error: 'CROSS_PROJECT_WRITE_BLOCKED' };
    const record = {
      version: this.records.length + 1,
      project_id: this.project_id,
      what_worked: clone(input.what_worked || []),
      what_failed: clone(input.what_failed || []),
      audience_learning: clone(input.audience_learning || []),
      message_learning: clone(input.message_learning || []),
      channel_learning: clone(input.channel_learning || []),
      offer_learning: clone(input.offer_learning || [])
    };
    this.records.push(record);
    return { ok: true, record: clone(record) };
  }
  list(projectId) {
    if (clean(projectId, 80) !== this.project_id) return { ok: false, error: 'CROSS_PROJECT_READ_BLOCKED', records: [] };
    return { ok: true, records: clone(this.records) };
  }
}

export class StrategyVersionStore {
  constructor(projectId) { this.project_id = clean(projectId, 80); this.versions = []; }
  commit(input = {}) {
    if (clean(input.project_id, 80) !== this.project_id) return { ok: false, error: 'CROSS_PROJECT_WRITE_BLOCKED' };
    const record = { project_id: this.project_id, version: this.versions.length + 1, ICP: clone(input.ICP || null), positioning: clone(input.positioning || null), offer: clone(input.offer || null), messaging: clone(input.messaging || null), channel_plan: clone(input.channel_plan || null), campaigns: clone(input.campaigns || []), SEO_strategy: clone(input.SEO_strategy || null), experiments: clone(input.experiments || []) };
    this.versions.push(record);
    return { ok: true, record: clone(record) };
  }
}

export function changeImpactAnalysis(change = {}) {
  const type = clean(change.type, 80);
  const map = {
    primary_ICP: ['website_copy','SEO_pages','campaigns','messaging','CRM_qualification','AI_tasks','automation_followups'],
    positioning: ['website_copy','campaigns','SEO_pages','sales_enablement','AI_prompts','automation_followups'],
    offer: ['website_copy','campaigns','sales_enablement','CRM_qualification','automation_followups'],
    messaging: ['website_copy','campaigns','content','sales_enablement','AI_prompts'],
    channel_plan: ['campaigns','analytics','automation_followups']
  };
  return { change_type: type || 'unknown', affected_assets: map[type] || [], rationale: 'deterministic_strategy_dependency_map' };
}

export function blastRadius(input = {}) {
  const impact = changeImpactAnalysis(input.change || {});
  return {
    schema: 'riosystems.growth-blast-radius.v1',
    affected_assets: impact.affected_assets,
    affected_factories: (input.affected_factories || ['web_factory','ai_factory','automation_factory','business_crm_factory','analytics']).filter((v, i, a) => a.indexOf(v) === i),
    affected_campaigns: clone(input.affected_campaigns || []),
    affected_metrics: clone(input.affected_metrics || []),
    affected_experiments: clone(input.affected_experiments || []),
    requires_operator_review: impact.affected_assets.length > 0
  };
}

export function competitorChangeWatchContract(input = {}) {
  return { schema: 'riosystems.competitor-change-watch.v1', competitor: clean(input.competitor, 160), change: clone(input.change || null), detected_at: clean(input.detected_at, 80) || null, impact: clean(input.impact, 240) || 'unknown', recommended_response: clean(input.recommended_response, 300) || 'review', monitoring_active: false };
}

export function marketChangeWatchContract(input = {}) {
  return { schema: 'riosystems.market-change-watch.v1', search_trend: clone(input.search_trend || null), pricing_shift: clone(input.pricing_shift || null), new_competitor: clone(input.new_competitor || null), channel_change: clone(input.channel_change || null), monitoring_active: false };
}
