const clone = (value) => structuredClone(value ?? null);
const VERIFIED_AT = '2026-08-29';

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'riosystems-native-business',
    role: 'primary_business_control',
    category: 'repository_native',
    availability: 'ready',
    capabilities: ['business.model','business.crm.schema','business.pipeline','business.offer','business.audit'],
    account_connection_required: false,
    data_ownership: 'riosystems_schema_and_contracts',
    cost_mode: 'no_platform_fee',
    external_write: false,
    production_deploy: false
  }),
  Object.freeze({
    id: 'supabase-free',
    role: 'primary_business_backend',
    category: 'postgres_backend',
    availability: 'connected_read_only',
    capabilities: ['business.crm.store','business.customer.store','business.pipeline.store','business.auth','business.storage','business.realtime'],
    account_connection_required: true,
    data_ownership: 'postgres_portable',
    cost_mode: 'free_tier_hard_cap',
    free_limits: { database_mb_per_project: 500, mau: 50000, storage_gb: 1, egress_gb: 5 },
    paid_plan_reference_usd_month: 25,
    external_write: true,
    automatic_paid_overflow: false,
    production_deploy: false,
    evidence: 'https://supabase.com/pricing'
  }),
  Object.freeze({
    id: 'posthog-free',
    role: 'primary_business_analytics',
    category: 'product_and_web_analytics',
    availability: 'connected_read_only',
    capabilities: ['business.analytics','web.analytics','business.funnel','business.events','business.replay'],
    account_connection_required: true,
    data_ownership: 'exportable_analytics_events',
    cost_mode: 'usage_based_with_free_tiers',
    free_limits: { product_events_per_month: 1000000, session_recordings_per_month: 5000 },
    external_write: true,
    automatic_paid_overflow: false,
    production_deploy: false,
    evidence: 'https://posthog.com/'
  })
]);

export function businessProviderStrategy() {
  return {
    schema: 'riosystems.business-provider-strategy.v1',
    verified_at: VERIFIED_AT,
    primary_control: 'riosystems-native-business',
    primary_backend: 'supabase-free',
    primary_analytics: 'posthog-free',
    crm_posture: 'riosystems_owned_crm_model_on_portable_postgres',
    principles: [
      'riosystems_owns_business_schema_and_workflows',
      'portable_postgres_before_crm_saas_lock_in',
      'analytics_is_separate_from_source_of_truth',
      'customer_project_isolation_required',
      'external_writes_require_explicit_approval',
      'no_automatic_paid_overflow',
      'production_requires_separate_explicit_approval'
    ],
    providers: clone(PROVIDERS),
    production_deploy: false
  };
}

export function getBusinessProvider(providerId) {
  return clone(PROVIDERS.find((item) => item.id === providerId) || null);
}

export function evaluateBusinessProviderReadiness(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const connected = new Set(Array.isArray(input.connected_providers) ? input.connected_providers : []);
  const providers = ['supabase-free','posthog-free'].map(getBusinessProvider);
  const blockers = [];
  for (const provider of providers) {
    if (provider.account_connection_required && !connected.has(provider.id)) blockers.push({ code: 'BUSINESS_PROVIDER_CONNECTION_REQUIRED', provider_id: provider.id });
  }
  if (input.execute_external_writes === true && input.external_write_approved !== true) blockers.push({ code: 'BUSINESS_EXTERNAL_WRITE_APPROVAL_REQUIRED' });
  if (input.execute_external_writes === true && input.customer_project_isolated !== true) blockers.push({ code: 'CUSTOMER_PROJECT_ISOLATION_REQUIRED' });
  return {
    ok: true,
    ready: blockers.length === 0,
    providers,
    blockers,
    external_write: input.execute_external_writes === true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function businessProviderDecisionManifest() {
  return {
    version: 'riosystems.business-provider-decision.v1',
    primary_business_control: 'riosystems-native-business',
    primary_crm_backend: 'supabase-free',
    primary_analytics: 'posthog-free',
    standalone_crm_saas_required_for_v1: false,
    provider_choice_complete_for_business_factory_v1: true,
    activation_is_separate_from_selection: true,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
