const clone = (value) => structuredClone(value ?? null);
const VERIFIED_AT = '2026-08-29';

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'riosystems-native-web',
    role: 'primary_builder',
    category: 'repository_native',
    capabilities: ['web.build.marketing-site','web.edit','web.qa','web.export.code'],
    availability: 'ready',
    account_connection_required: false,
    code_ownership: 'full_repository_ownership',
    hosting_lock_in: false,
    automation_fit: 'native',
    cost_mode: 'variable_ai_only',
    paid_plan_required: false,
    external_write: false,
    production_deploy: false,
    evidence: ['src/builder.js','src/generator.js','src/materializer.js','src/preview.js']
  }),
  Object.freeze({
    id: 'cloudflare-workers-free',
    role: 'primary_host',
    category: 'hosting_edge',
    capabilities: ['web.preview.host','web.deploy.staging'],
    availability: 'connected',
    account_connection_required: true,
    code_ownership: 'full_repository_ownership',
    hosting_lock_in: false,
    automation_fit: 'high',
    cost_mode: 'free_tier_hard_fail',
    paid_plan_required: false,
    external_write: true,
    production_deploy: false,
    pricing_evidence: 'https://developers.cloudflare.com/workers/platform/pricing/'
  }),
  Object.freeze({
    id: 'lovable-github',
    role: 'optional_visual_accelerator',
    category: 'ai_builder',
    capabilities: ['web.build.prototype','web.design.accelerate','web.export.github'],
    availability: 'connection_optional',
    account_connection_required: true,
    code_ownership: 'github_two_way_sync',
    hosting_lock_in: false,
    automation_fit: 'medium_high',
    cost_mode: 'credit_based',
    paid_plan_required: 'usage_dependent',
    external_write: true,
    production_deploy: false,
    evidence: 'https://docs.lovable.dev/integrations/github'
  }),
  Object.freeze({
    id: 'framer-server-api',
    role: 'optional_visual_platform',
    category: 'visual_builder',
    capabilities: ['web.design.visual','web.cms.visual','web.publish.platform'],
    availability: 'not_connected',
    account_connection_required: true,
    code_ownership: 'platform_managed_site',
    hosting_lock_in: true,
    automation_fit: 'high',
    cost_mode: 'site_plan',
    paid_plan_required: 'production_features_dependent',
    external_write: true,
    production_deploy: false,
    evidence: 'https://www.framer.com/developers/server-api-introduction'
  }),
  Object.freeze({
    id: 'webflow-api',
    role: 'optional_client_editable_cms',
    category: 'visual_cms_builder',
    capabilities: ['web.design.visual','web.cms.manage','web.publish.platform','web.export.static-code'],
    availability: 'not_connected',
    account_connection_required: true,
    code_ownership: 'partial_export_with_cms_limits',
    hosting_lock_in: 'cms_dependent',
    automation_fit: 'high',
    cost_mode: 'workspace_and_site_plans',
    paid_plan_required: true,
    external_write: true,
    production_deploy: false,
    evidence: 'https://developers.webflow.com/reference'
  })
]);

export function webProviderStrategy() {
  return {
    schema: 'riosystems.web-provider-strategy.v1',
    verified_at: VERIFIED_AT,
    default_builder: 'riosystems-native-web',
    default_host: 'cloudflare-workers-free',
    optional_accelerator: 'lovable-github',
    optional_visual_platform: 'framer-server-api',
    optional_client_editable_cms: 'webflow-api',
    principles: [
      'repository_is_source_of_truth',
      'full_code_ownership_by_default',
      'zero_fixed_cost_when_practical',
      'provider_abstraction_over_vendor_lock_in',
      'staging_before_production',
      'paid_actions_require_operator_approval',
      'production_requires_separate_explicit_approval'
    ],
    providers: clone(PROVIDERS),
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function getWebProvider(providerId) {
  return clone(PROVIDERS.find((item) => item.id === providerId) || null);
}

export function selectWebBuildProvider(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };

  const connected = new Set(Array.isArray(input.connected_providers) ? input.connected_providers : []);
  const mode = String(input.mode || 'default').trim().toLowerCase();
  let selectedId = 'riosystems-native-web';
  const reasons = ['repository_source_of_truth','full_code_ownership','lowest_lock_in','native_factory_integration'];
  const blockers = [];

  if (mode === 'visual_accelerator') {
    selectedId = 'lovable-github';
    reasons.splice(0, reasons.length, 'fast_visual_iteration','github_two_way_sync','repository_handoff_preserved');
  } else if (mode === 'visual_platform') {
    selectedId = 'framer-server-api';
    reasons.splice(0, reasons.length, 'visual_editor_priority','server_api_automation');
  } else if (mode === 'client_editable_cms') {
    selectedId = 'webflow-api';
    reasons.splice(0, reasons.length, 'client_editor_priority','cms_and_designer_api');
  }

  const provider = getWebProvider(selectedId);
  if (!provider) return { ok: false, error: 'WEB_PROVIDER_NOT_FOUND', production_deploy: false };

  if (provider.account_connection_required && !connected.has(provider.id) && provider.id !== 'cloudflare-workers-free') {
    blockers.push({ code: 'WEB_PROVIDER_CONNECTION_REQUIRED', provider_id: provider.id });
  }
  if (provider.paid_plan_required === true && input.paid_provider_approved !== true) {
    blockers.push({ code: 'PAID_PROVIDER_APPROVAL_REQUIRED', provider_id: provider.id });
  }
  if (provider.hosting_lock_in === true && input.platform_hosting_accepted !== true) {
    blockers.push({ code: 'PLATFORM_HOSTING_ACCEPTANCE_REQUIRED', provider_id: provider.id });
  }

  return {
    ok: true,
    provider,
    reasons,
    ready: blockers.length === 0,
    blockers,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function webProviderDecisionManifest() {
  return {
    version: 'riosystems.web-provider-decision.v1',
    primary_build_engine: 'riosystems-native-web',
    primary_staging_host: 'cloudflare-workers-free',
    first_optional_external_builder: 'lovable-github',
    visual_platform_specialist: 'framer-server-api',
    client_editable_cms_specialist: 'webflow-api',
    provider_choice_complete_for_web_factory_v1: true,
    activation_is_separate_from_selection: true,
    production_deploy: false
  };
}
