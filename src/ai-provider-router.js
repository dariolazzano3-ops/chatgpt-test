import { getAIProviderStrategyEntry, selectAIProviderTier } from './ai-provider-strategy.js';

const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function planAIProviderRoute(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const selection = selectAIProviderTier(input);
  if (!selection.ok) return selection;
  const control = getAIProviderStrategyEntry('riosystems-ai-local-policy');
  const sourceRevision = clean(input.source_revision, 120);
  const blockers = [...selection.blockers];
  if (!sourceRevision) blockers.push({ code: 'SOURCE_REVISION_REQUIRED' });
  if (input.execute === true && input.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_AI_EXECUTION_APPROVAL_REQUIRED', provider_id: selection.provider.id });
  const unique = blockers.filter((item, index, list) => list.findIndex((other) => other.code === item.code && other.provider_id === item.provider_id) === index);
  return {
    ok: true,
    schema: 'riosystems.ai-provider-route.v1',
    capability: clean(input.capability, 120) || 'ai.generate',
    source_revision: sourceRevision || null,
    control_router: control,
    inference_provider: selection.provider,
    model: selection.model,
    model_tier: selection.model_tier,
    route: [control.id, selection.provider.id],
    state: unique.length === 0 ? (input.execute === true ? 'AI_EXECUTION_APPROVED' : 'ROUTE_READY') : 'ROUTE_BLOCKED',
    blockers: unique,
    mission_budget_eur: selection.mission_budget_eur,
    paid_execution: selection.paid_execution,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
