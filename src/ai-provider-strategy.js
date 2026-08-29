const clone = (value) => structuredClone(value ?? null);
const VERIFIED_AT = '2026-08-29';

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'openai-api',
    role: 'primary_intelligence_provider',
    category: 'frontier_ai_api',
    availability: 'credential_required',
    account_connection_required: true,
    capabilities: ['ai.generate','ai.reason','ai.extract','ai.classify','ai.structured-output','ai.code'],
    models: {
      economy: 'gpt-5.6-luna',
      balanced: 'gpt-5.6-terra',
      frontier: 'gpt-5.6-sol'
    },
    current_standard_pricing_usd_per_million_tokens: {
      economy: { input: 0.20, output: 1.20 },
      balanced: { input: 2.00, output: 12.00 },
      frontier: { input: 4.00, output: 20.00 }
    },
    budget_fit: 'primary_variable_spend',
    paid_external_call: true,
    automatic_paid_overflow: false,
    production_deploy: false,
    evidence: 'https://openai.com/api/'
  }),
  Object.freeze({
    id: 'cloudflare-workers-ai-free',
    role: 'free_staging_and_economy_fallback',
    category: 'edge_ai_api',
    availability: 'connected_binding_required',
    account_connection_required: true,
    capabilities: ['ai.generate','ai.classify','ai.extract','ai.embeddings','ai.image'],
    default_free_model: '@cf/zai-org/glm-4.7-flash',
    free_allocation: '10000_neurons_per_day',
    paid_rate_above_free_usd_per_1000_neurons: 0.011,
    free_plan_overage_behavior: 'hard_fail',
    budget_fit: 'zero_cost_first_pass_and_fallback',
    paid_external_call: false,
    automatic_paid_overflow: false,
    production_deploy: false,
    evidence: 'https://developers.cloudflare.com/workers-ai/platform/pricing/'
  }),
  Object.freeze({
    id: 'riosystems-ai-local-policy',
    role: 'control_router',
    category: 'repository_native',
    availability: 'ready',
    account_connection_required: false,
    capabilities: ['ai.route','ai.retry','ai.validate','ai.budget','ai.audit'],
    budget_fit: 'no_provider_fee',
    paid_external_call: false,
    automatic_paid_overflow: false,
    production_deploy: false,
    evidence: ['src/ai-provider-registry.js','src/ai-runtime.js','src/ai-retry-policy.js']
  })
]);

export function aiProviderStrategy() {
  return {
    schema: 'riosystems.ai-provider-strategy.v1',
    verified_at: VERIFIED_AT,
    control_router: 'riosystems-ai-local-policy',
    primary_provider: 'openai-api',
    free_staging_fallback: 'cloudflare-workers-ai-free',
    default_model_tier: 'economy',
    escalation_order: ['economy','balanced','frontier'],
    principles: [
      'use_cheapest_model_that_meets_quality_requirement',
      'free_staging_before_paid_execution_when_suitable',
      'budget_estimate_before_paid_call',
      'explicit_paid_execution_approval',
      'no_automatic_paid_overflow',
      'model_and_provider_are_replaceable',
      'production_requires_separate_explicit_approval'
    ],
    providers: clone(PROVIDERS),
    production_deploy: false
  };
}

export function getAIProviderStrategyEntry(providerId) {
  return clone(PROVIDERS.find((item) => item.id === providerId) || null);
}

export function selectAIProviderTier(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const connected = new Set(Array.isArray(input.connected_providers) ? input.connected_providers : []);
  const mode = String(input.mode || 'auto').trim().toLowerCase();
  const quality = String(input.quality || 'economy').trim().toLowerCase();
  const paidApproved = input.paid_execution_approved === true;
  const budgetEur = Number(input.mission_budget_eur ?? 0);
  const blockers = [];
  let providerId;
  let modelTier = ['economy','balanced','frontier'].includes(quality) ? quality : 'economy';

  if (mode === 'free' || (!paidApproved && mode === 'auto')) {
    providerId = 'cloudflare-workers-ai-free';
    modelTier = 'free';
  } else {
    providerId = 'openai-api';
  }

  const provider = getAIProviderStrategyEntry(providerId);
  if (!provider) return { ok: false, error: 'AI_PROVIDER_NOT_FOUND', production_deploy: false };
  if (provider.account_connection_required && !connected.has(provider.id)) blockers.push({ code: 'AI_PROVIDER_CONNECTION_REQUIRED', provider_id: provider.id });
  if (provider.paid_external_call && !paidApproved) blockers.push({ code: 'PAID_AI_EXECUTION_APPROVAL_REQUIRED', provider_id: provider.id });
  if (provider.paid_external_call && (!Number.isFinite(budgetEur) || budgetEur <= 0)) blockers.push({ code: 'MISSION_AI_BUDGET_REQUIRED', provider_id: provider.id });

  const model = providerId === 'openai-api' ? provider.models[modelTier] : provider.default_free_model;
  return {
    ok: true,
    provider,
    model,
    model_tier: modelTier,
    ready: blockers.length === 0,
    blockers,
    mission_budget_eur: Number.isFinite(budgetEur) ? Math.max(0, budgetEur) : 0,
    paid_execution: provider.paid_external_call === true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function aiProviderDecisionManifest() {
  return {
    version: 'riosystems.ai-provider-decision.v1',
    primary_intelligence_provider: 'openai-api',
    default_openai_model: 'gpt-5.6-luna',
    escalation_models: ['gpt-5.6-terra','gpt-5.6-sol'],
    free_staging_provider: 'cloudflare-workers-ai-free',
    free_staging_model: '@cf/zai-org/glm-4.7-flash',
    provider_choice_complete_for_ai_factory_v1: true,
    activation_is_separate_from_selection: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
