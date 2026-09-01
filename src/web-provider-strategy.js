import { isFramerStagingConnected } from './framer-staging-connection-evidence-v1.js';
import { remainingProviderResolution } from './remaining-provider-fast-lane-evidence-v1.js';

const clone = (value) => structuredClone(value ?? null);
const VERIFIED_AT = '2026-09-01';
const FRAMER_CONNECTED = isFramerStagingConnected();
const LOVABLE_RESOLUTION = remainingProviderResolution('lovable-github');
const WEBFLOW_RESOLUTION = remainingProviderResolution('webflow-api');

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
    availability: 'intentional_supervised_only',
    account_connection_required: false,
    central_connection_required: false,
    final_classification: LOVABLE_RESOLUTION.final_classification,
    code_ownership: 'github_two_way_sync',
    hosting_lock_in: false,
    automation_fit: 'medium_high_supervised',
    cost_mode: 'credit_based_free_grant_available',
    paid_plan_required: 'usage_dependent',
    external_write: true,
    production_deploy: false,
    stable_read_only_central_provider_api: false,
    routing_scope: 'mission_specific_supervised_builder',
    evidence: LOVABLE_RESOLUTION
  }),
  Object.freeze({
    id: 'framer-server-api',
    role: 'optional_visual_platform',
    category: 'visual_builder',
    capabilities: ['web.design.visual','web.cms.visual','web.publish.platform'],
    availability: FRAMER_CONNECTED ? 'connected_staging_read_only' : 'not_connected',
    account_connection_required: true,
    code_ownership: 'platform_managed_site',
    hosting_lock_in: true,
    automation_fit: 'high',
    cost_mode: 'site_plan',
    paid_plan_required: 'production_features_dependent',
    external_write: true,
    staging_write_verified: false,
    publish_verified: false,
    routing_scope: 'specialist_only_mutations_approval_gated',
    production_deploy: false,
    evidence: 'src/framer-staging-connection-evidence-v1.js'
  }),
  Object.freeze({
    id: 'webflow-api',
    role: 'optional_client_editable_cms',
    category: 'visual_cms_builder',
    capabilities: ['web.design.visual','web.cms.manage','web.publish.platform','web.export.static-code'],
    availability: 'operator_gate',
    account_connection_required: true,
    central_connection_required: true,
    final_classification: WEBFLOW_RESOLUTION.final_classification,
    code_ownership: 'partial_export_with_cms_limits',
    hosting_lock_in: 'cms_dependent',
    automation_fit: 'high',
    cost_mode: 'free_starter_read_only_api_possible_paid_features_separate',
    paid_plan_required: false,
    paid_plan_required_for_production_features: 'feature_dependent',
    external_write: true,
    production_deploy: false,
    operator_gate: WEBFLOW_RESOLUTION.operator_gate,
    evidence: WEBFLOW_RESOLUTION
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
    reasons.splice(0, reasons.length, 'fast_visual_iteration','github_two_way_sync','repository_handoff_preserved','supervised_only');
  } else if (mode === 'visual_platform') {
    selectedId = 'framer-server-api';
    reasons.splice(0, reasons.length, 'visual_editor_priority','server_api_automation','connected_staging_read_only');
  } else if (mode === 'client_editable_cms') {
    selectedId = 'webflow-api';
    reasons.splice(0, reasons.length, 'client_editor_priority','cms_and_designer_api','operator_connection_gate');
  }

  const provider = getWebProvider(selectedId);
  if (!provider) return { ok: false, error: 'WEB_PROVIDER_NOT_FOUND', production_deploy: false };

  if (provider.central_connection_required !== false && provider.account_connection_required && !connected.has(provider.id) && provider.id !== 'cloudflare-workers-free') {
    blockers.push({ code: 'WEB_PROVIDER_CONNECTION_REQUIRED', provider_id: provider.id });
  }
  if (provider.id === 'lovable-github') blockers.push({ code: 'SUPERVISED_BUILDER_ONLY', provider_id: provider.id });
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
    framer_connected_staging: FRAMER_CONNECTED,
    lovable_central_connection_required: false,
    webflow_operator_connection_gate: true,
    provider_choice_complete_for_web_factory_v1: true,
    activation_is_separate_from_selection: true,
    production_deploy: false
  };
}
