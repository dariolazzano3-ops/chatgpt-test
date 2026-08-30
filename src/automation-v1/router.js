const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

const PROVIDERS = Object.freeze({
  'riosystems-native-automation': Object.freeze({
    role: 'native_deterministic_execution',
    cost_mode: 'zero_variable_cost',
    capabilities: ['transform','condition','output','database_read','file_processing','schedule'],
    external_side_effect_semantics: 'none',
    production: false
  }),
  'make-core': Object.freeze({
    role: 'primary_external_runtime',
    cost_mode: 'paid_provider_locked_for_execution',
    capabilities: ['webhook','schedule','http','database_read','database_write','email','analytics','ai_call','file_processing','crm_event'],
    external_side_effect_semantics: 'connector_workflow',
    production: false
  }),
  'activepieces-cloud-free': Object.freeze({
    role: 'secondary_external_runtime',
    cost_mode: 'free_tier_or_plan_dependent',
    capabilities: ['webhook','schedule','http','database_read','database_write','email','analytics','ai_call','file_processing','crm_event'],
    external_side_effect_semantics: 'connector_workflow',
    production: false
  }),
  'n8n-client-owned': Object.freeze({
    role: 'technical_specialist_runtime',
    cost_mode: 'client_owned_or_license_dependent',
    capabilities: ['webhook','schedule','http','database_read','database_write','email','analytics','ai_call','file_processing','crm_event'],
    external_side_effect_semantics: 'connector_workflow',
    production: false
  }),
  'cloudflare-workers-free': Object.freeze({
    role: 'small_code_webhook_runtime',
    cost_mode: 'free_tier_hard_cap',
    capabilities: ['webhook','http','analytics','file_processing','transform','condition','output'],
    external_side_effect_semantics: 'http_or_event',
    production: false
  })
});

export function automationProviderCatalog() {
  return Object.entries(PROVIDERS).map(([id, provider]) => ({ id, ...clone(provider) }));
}

export function providerSupports(providerId, actionType) {
  return Boolean(PROVIDERS[providerId]?.capabilities.includes(clean(actionType, 80).toLowerCase()));
}

function preferredProvider(node, plan) {
  const explicit = clean(node.config?.provider || node.config?.provider_id, 120);
  if (explicit) return explicit;
  if (['transform','condition','output'].includes(node.type)) return 'riosystems-native-automation';
  if (node.type === 'file_processing' && node.config?.small_code === true) return 'cloudflare-workers-free';
  if (node.config?.technical_specialist === true) return 'n8n-client-owned';
  if (node.config?.secondary_runtime === true) return 'activepieces-cloud-free';
  if (node.config?.micro_runtime === true) return 'cloudflare-workers-free';
  if (node.type === 'database_read' && !plan.mission.systems.some((item) => /make/i.test(item))) return 'riosystems-native-automation';
  return 'make-core';
}

function fallbackCandidates(primary, actionType) {
  const ordered = primary === 'make-core'
    ? ['activepieces-cloud-free','n8n-client-owned']
    : ['make-core','activepieces-cloud-free','n8n-client-owned','cloudflare-workers-free'];
  return ordered.filter((id) => id !== primary && providerSupports(id, actionType));
}

export function routeWorkflowPlan(plan = {}) {
  if (!plan.ok || !Array.isArray(plan.nodes)) return { ok: false, error: 'WORKFLOW_PLAN_REQUIRED', production: false };
  const errors = [];
  const routedNodes = plan.nodes.map((node) => {
    const providerId = preferredProvider(node, plan);
    if (!PROVIDERS[providerId]) errors.push(`PROVIDER_UNKNOWN:${providerId}`);
    if (PROVIDERS[providerId] && !providerSupports(providerId, node.type)) errors.push(`PROVIDER_CAPABILITY_MISMATCH:${providerId}:${node.type}`);
    const provider = PROVIDERS[providerId] || null;
    return {
      ...clone(node),
      provider_id: providerId,
      provider_role: provider?.role || null,
      provider_cost_mode: provider?.cost_mode || null,
      fallback_candidates: fallbackCandidates(providerId, node.type),
      provider_execution: providerId === 'riosystems-native-automation' ? 'synthetic_deterministic' : 'provider_plan_only_in_v1',
      external_provider_call_authorized: false,
      paid_execution_authorized: false,
      variable_cost_ceiling_eur: 0,
      production: false
    };
  });
  return {
    ok: errors.length === 0,
    errors,
    schema: 'riosystems.automation-routed-plan.v1',
    ...clone(plan),
    nodes: routedNodes,
    provider_hierarchy: {
      primary: 'make-core',
      secondary: 'activepieces-cloud-free',
      specialist: 'n8n-client-owned',
      small_code: 'cloudflare-workers-free',
      deterministic: 'riosystems-native-automation'
    },
    automatic_paid_fallback: false,
    variable_cost_ceiling_eur: 0,
    production: false
  };
}

export function validateFallback({ from_provider, to_provider, action_type, variable_cost_eur = 0, approval = false, side_effect_semantics_match = false } = {}) {
  const errors = [];
  if (!providerSupports(to_provider, action_type)) errors.push('FALLBACK_CAPABILITY_MISMATCH');
  if (Number(variable_cost_eur) !== 0) errors.push('FALLBACK_COST_LIMIT_EXCEEDED');
  if (side_effect_semantics_match !== true) errors.push('FALLBACK_SIDE_EFFECT_SEMANTICS_MISMATCH');
  if (approval !== true) errors.push('FALLBACK_APPROVAL_REQUIRED');
  if (from_provider === to_provider) errors.push('FALLBACK_PROVIDER_MUST_DIFFER');
  return { ok: errors.length === 0, errors, automatic_paid_fallback: false, production: false };
}
