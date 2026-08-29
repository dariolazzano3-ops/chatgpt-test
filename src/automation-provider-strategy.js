const clone = (value) => structuredClone(value ?? null);
const VERIFIED_AT = '2026-08-29';

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'riosystems-native-automation',
    role: 'primary_orchestrator',
    category: 'repository_native',
    capabilities: ['automation.plan','automation.validate','automation.supervise','automation.audit'],
    availability: 'ready',
    account_connection_required: false,
    source_ownership: 'full_repository_ownership',
    automation_fit: 'native',
    cost_mode: 'no_platform_fee',
    paid_plan_required: false,
    external_write: false,
    production_deploy: false,
    evidence: ['src/automation-factory.js','src/automation-executor.js','src/automation-external-actions.js']
  }),
  Object.freeze({
    id: 'activepieces-cloud-free',
    role: 'primary_external_runtime',
    category: 'workflow_automation_cloud',
    capabilities: ['automation.flow.create','automation.flow.run','automation.webhook','automation.api'],
    availability: 'connection_required',
    account_connection_required: true,
    source_ownership: 'provider_flow_definition',
    automation_fit: 'high',
    cost_mode: 'free_daily_credits_hard_cap',
    paid_plan_required: false,
    external_write: true,
    production_deploy: false,
    license_posture: 'cloud_service_api_access',
    evidence: 'https://www.activepieces.com/pricing'
  }),
  Object.freeze({
    id: 'activepieces-community',
    role: 'future_self_hosted_runtime',
    category: 'workflow_automation_self_hosted',
    capabilities: ['automation.flow.run','automation.webhook','automation.http_piece'],
    availability: 'not_deployed',
    account_connection_required: false,
    source_ownership: 'mit_core_self_hosted',
    automation_fit: 'medium_high',
    cost_mode: 'infrastructure_only',
    paid_plan_required: false,
    external_write: true,
    production_deploy: false,
    limitation: 'community_edition_does_not_include_platform_api_access',
    license_posture: 'MIT_core_enterprise_features_commercial',
    evidence: 'https://www.activepieces.com/docs/about/license'
  }),
  Object.freeze({
    id: 'make-core',
    role: 'fallback_connector_runtime',
    category: 'workflow_automation_saas',
    capabilities: ['automation.flow.create','automation.flow.run','automation.webhook','automation.api'],
    availability: 'not_connected',
    account_connection_required: true,
    source_ownership: 'provider_blueprint',
    automation_fit: 'high',
    cost_mode: 'paid_credits',
    paid_plan_required: true,
    external_write: true,
    production_deploy: false,
    evidence: 'https://www.make.com/en/pricing'
  }),
  Object.freeze({
    id: 'n8n-client-owned',
    role: 'client_owned_specialist',
    category: 'workflow_automation',
    capabilities: ['automation.flow.run','automation.webhook','automation.integrations'],
    availability: 'client_instance_required',
    account_connection_required: true,
    source_ownership: 'client_instance',
    automation_fit: 'high',
    cost_mode: 'client_or_commercial_license',
    paid_plan_required: 'use_case_dependent',
    external_write: true,
    production_deploy: false,
    license_posture: 'commercial_license_may_be_required_for_hosting_client_workflows',
    evidence: 'https://support.n8n.io/article/can-i-use-your-license-for-my-use-case'
  }),
  Object.freeze({
    id: 'cloudflare-workers-free',
    role: 'micro_automation_runtime',
    category: 'serverless_runtime',
    capabilities: ['automation.webhook.lightweight','automation.event.transform'],
    availability: 'connected',
    account_connection_required: true,
    source_ownership: 'full_repository_ownership',
    automation_fit: 'high_for_small_code_flows',
    cost_mode: 'free_tier_hard_fail',
    paid_plan_required: false,
    external_write: true,
    production_deploy: false,
    evidence: 'https://developers.cloudflare.com/workers/platform/pricing/'
  })
]);

export function automationProviderStrategy() {
  return {
    schema: 'riosystems.automation-provider-strategy.v1',
    verified_at: VERIFIED_AT,
    primary_orchestrator: 'riosystems-native-automation',
    primary_external_runtime: 'activepieces-cloud-free',
    future_self_hosted_runtime: 'activepieces-community',
    fallback_connector_runtime: 'make-core',
    client_owned_specialist: 'n8n-client-owned',
    micro_automation_runtime: 'cloudflare-workers-free',
    principles: [
      'lean_keeps_workflow_intent_and_policy',
      'external_runtime_is_replaceable',
      'free_hard_cap_before_paid_overflow',
      'client_credentials_are_never_embedded',
      'external_writes_require_supervision',
      'production_requires_separate_explicit_approval'
    ],
    providers: clone(PROVIDERS),
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function getAutomationProvider(providerId) {
  return clone(PROVIDERS.find((item) => item.id === providerId) || null);
}

export function selectAutomationRuntime(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const mode = String(input.mode || 'default').trim().toLowerCase();
  const connected = new Set(Array.isArray(input.connected_providers) ? input.connected_providers : []);
  let selectedId = 'activepieces-cloud-free';
  const blockers = [];
  const reasons = ['api_access_on_free_cloud','hard_cap_instead_of_paid_overflow','broad_workflow_coverage','future_mit_self_host_path'];

  if (mode === 'micro') {
    selectedId = 'cloudflare-workers-free';
    reasons.splice(0, reasons.length, 'small_code_flow','repository_owned','already_connected_edge_runtime');
  } else if (mode === 'connector_fallback') {
    selectedId = 'make-core';
    reasons.splice(0, reasons.length, 'broad_connector_catalog','scenario_api');
  } else if (mode === 'client_owned_n8n') {
    selectedId = 'n8n-client-owned';
    reasons.splice(0, reasons.length, 'client_owned_instance','avoid_hosted_client_workflow_license_risk');
  } else if (mode === 'self_hosted') {
    selectedId = 'activepieces-community';
    reasons.splice(0, reasons.length, 'mit_core','self_host_control','unlimited_community_runs');
  }

  const provider = getAutomationProvider(selectedId);
  if (!provider) return { ok: false, error: 'AUTOMATION_PROVIDER_NOT_FOUND', production_deploy: false };
  if (provider.account_connection_required && !connected.has(provider.id)) blockers.push({ code: 'AUTOMATION_PROVIDER_CONNECTION_REQUIRED', provider_id: provider.id });
  if (provider.paid_plan_required === true && input.paid_provider_approved !== true) blockers.push({ code: 'PAID_PROVIDER_APPROVAL_REQUIRED', provider_id: provider.id });
  if (provider.availability === 'not_deployed') blockers.push({ code: 'SELF_HOSTED_RUNTIME_NOT_DEPLOYED', provider_id: provider.id });
  if (provider.availability === 'client_instance_required' && input.client_instance_approved !== true) blockers.push({ code: 'CLIENT_INSTANCE_REQUIRED', provider_id: provider.id });

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

export function automationProviderDecisionManifest() {
  return {
    version: 'riosystems.automation-provider-decision.v1',
    primary_control_engine: 'riosystems-native-automation',
    primary_external_runtime: 'activepieces-cloud-free',
    fallback_external_runtime: 'make-core',
    client_owned_n8n_only_by_default: true,
    micro_runtime: 'cloudflare-workers-free',
    provider_choice_complete_for_automation_factory_v1: true,
    activation_is_separate_from_selection: true,
    production_deploy: false
  };
}
