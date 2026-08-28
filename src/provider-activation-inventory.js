const clone = (value) => structuredClone(value ?? null);

const VERIFIED_AT = '2026-08-28';

const PROVIDERS = [
  {
    id: 'cloudflare-workers-free',
    roles: ['staging_compute','web_host','automation_runtime'],
    capabilities: ['web.deploy','automation.run'],
    cost_mode: 'free_tier_hard_fail',
    free_tier_confirmed: true,
    external_write: true,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: 'https://developers.cloudflare.com/workers/platform/pricing/',
    verified_at: VERIFIED_AT
  },
  {
    id: 'cloudflare-workers-ai-free',
    roles: ['staging_ai'],
    capabilities: ['ai.generate','ai.analyze','ai.classify','ai.extract'],
    cost_mode: 'free_tier_hard_fail',
    free_tier_confirmed: true,
    external_write: false,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: 'https://developers.cloudflare.com/workers-ai/platform/pricing/',
    verified_at: VERIFIED_AT
  },
  {
    id: 'supabase-free',
    roles: ['database','business_backend','crm_store'],
    capabilities: ['business.configure','business.crm.write','storage.data'],
    cost_mode: 'free_tier_hard_fail',
    free_tier_confirmed: true,
    external_write: true,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: 'https://supabase.com/pricing',
    verified_at: VERIFIED_AT
  },
  {
    id: 'posthog-free',
    roles: ['analytics','observability'],
    capabilities: ['web.analytics','business.analytics'],
    cost_mode: 'free_tier_hard_fail',
    free_tier_confirmed: true,
    external_write: true,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: 'https://posthog.com/',
    verified_at: VERIFIED_AT
  },
  {
    id: 'openai-api',
    roles: ['premium_ai'],
    capabilities: ['ai.generate','ai.analyze','ai.classify','ai.extract'],
    cost_mode: 'paid_usage',
    free_tier_confirmed: false,
    external_write: false,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: 'https://openai.com/api/',
    verified_at: VERIFIED_AT
  }
];

export function providerActivationInventory() {
  return {
    schema: 'riosystems.provider-activation-inventory.v1',
    verified_at: VERIFIED_AT,
    providers: clone(PROVIDERS),
    pricing_must_be_reverified_before_activation: true,
    secrets_embedded: false,
    production_deploy: false
  };
}

export function candidatesForCapability(capability, options = {}) {
  const candidates = PROVIDERS.filter((item) => item.capabilities.includes(capability));
  const filtered = options.zero_cost_only === true
    ? candidates.filter((item) => item.free_tier_confirmed === true && item.cost_mode === 'free_tier_hard_fail')
    : candidates;
  return clone(filtered);
}

export function evaluateProviderActivationInventory(input = {}) {
  const required = [...new Set(Array.isArray(input.required_capabilities) ? input.required_capabilities : [])];
  const accountBindings = new Set(Array.isArray(input.account_bindings) ? input.account_bindings : []);
  const credentialRefs = new Set(Array.isArray(input.credential_refs) ? input.credential_refs : []);
  const blockers = [];
  const plan = [];

  for (const capability of required) {
    const candidates = candidatesForCapability(capability, { zero_cost_only: input.zero_cost_only !== false });
    if (!candidates.length) {
      blockers.push({ code: 'ZERO_COST_PROVIDER_NOT_AVAILABLE', capability });
      continue;
    }
    const selected = candidates[0];
    const accountBound = !selected.account_binding_required || accountBindings.has(selected.id);
    const credentialReady = !selected.credentials_required || credentialRefs.has(selected.id);
    if (!accountBound) blockers.push({ code: 'PROVIDER_ACCOUNT_BINDING_REQUIRED', provider_id: selected.id, capability });
    if (!credentialReady) blockers.push({ code: 'PROVIDER_CREDENTIAL_REFERENCE_REQUIRED', provider_id: selected.id, capability });
    if (selected.external_write && input.external_write_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_APPROVAL_REQUIRED', provider_id: selected.id, capability });
    plan.push({
      capability,
      provider_id: selected.id,
      account_bound: accountBound,
      credential_reference_ready: credentialReady,
      external_write: selected.external_write,
      cost_mode: selected.cost_mode,
      automatic_paid_overflow: false
    });
  }

  return {
    ok: true,
    zero_cost_path_available: !blockers.some((item) => item.code === 'ZERO_COST_PROVIDER_NOT_AVAILABLE'),
    ready_for_real_staging: blockers.length === 0,
    plan,
    blockers,
    user_action_required: blockers.some((item) => ['PROVIDER_ACCOUNT_BINDING_REQUIRED','PROVIDER_CREDENTIAL_REFERENCE_REQUIRED','EXTERNAL_WRITE_APPROVAL_REQUIRED'].includes(item.code)),
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function providerActivationInventoryManifest() {
  return {
    version: 'riosystems.provider-activation-inventory.v1',
    zero_cost_first: true,
    pricing_reverification_required: true,
    paid_overflow_disabled: true,
    secrets_embedded: false,
    production_deploy: false
  };
}
