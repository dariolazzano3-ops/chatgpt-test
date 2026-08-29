import { webProviderDecisionManifest } from './web-provider-strategy.js';
import { automationProviderDecisionManifest } from './automation-provider-strategy.js';
import { aiProviderDecisionManifest } from './ai-provider-strategy.js';
import { businessProviderDecisionManifest } from './business-provider-strategy.js';
import { listExecutionAdapters } from './execution-adapters.js';

const clone = (value) => structuredClone(value ?? null);
const ACTIVE_FACTORY_KEYS = Object.freeze(['web','automation','ai','business']);

export function providerStackV1() {
  const adapters = listExecutionAdapters();
  const byEngine = new Map(adapters.map((item) => [item.engine, item]));
  const factories = {
    web: {
      decision: webProviderDecisionManifest(),
      adapter: clone(byEngine.get('web')),
      primary_path: ['riosystems-native-web','cloudflare-workers-free'],
      optional_specialists: ['lovable-github','framer-server-api','webflow-api']
    },
    automation: {
      decision: automationProviderDecisionManifest(),
      adapter: clone(byEngine.get('automation')),
      primary_path: ['riosystems-native-automation','activepieces-cloud-free'],
      fallback_path: ['riosystems-native-automation','make-core'],
      specialist_paths: ['activepieces-community','n8n-client-owned','cloudflare-workers-free']
    },
    ai: {
      decision: aiProviderDecisionManifest(),
      adapter: clone(byEngine.get('ai')),
      primary_path: ['riosystems-ai-local-policy','openai-api'],
      free_staging_path: ['riosystems-ai-local-policy','cloudflare-workers-ai-free'],
      model_ladder: ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol']
    },
    business: {
      decision: businessProviderDecisionManifest(),
      adapter: clone(byEngine.get('business')),
      primary_path: ['riosystems-native-business','supabase-free','posthog-free'],
      standalone_crm_saas_required: false
    }
  };

  const selected = ACTIVE_FACTORY_KEYS.every((key) => factories[key]?.decision?.provider_choice_complete_for_web_factory_v1 === true
    || factories[key]?.decision?.provider_choice_complete_for_automation_factory_v1 === true
    || factories[key]?.decision?.provider_choice_complete_for_ai_factory_v1 === true
    || factories[key]?.decision?.provider_choice_complete_for_business_factory_v1 === true);
  const providerRouted = ACTIVE_FACTORY_KEYS.every((key) => factories[key]?.adapter?.mode === 'provider_routed');

  return {
    schema: 'riosystems.provider-stack.v1',
    status: selected && providerRouted ? 'PROVIDER_SELECTION_COMPLETE' : 'PROVIDER_SELECTION_INCOMPLETE',
    source_of_truth: 'github_repository',
    active_factories: [...ACTIVE_FACTORY_KEYS],
    factories,
    activation_policy: {
      provider_selection_is_not_execution_authorization: true,
      runtime_connections_discovered_separately: true,
      external_writes_require_explicit_approval: true,
      paid_execution_requires_explicit_approval: true,
      custom_domains_require_separate_approval: true,
      customer_project_isolation_required: true,
      supervised_execution_required: true,
      automatic_paid_overflow: false,
      production_deploy: false
    },
    app_factory: {
      status: byEngine.get('app')?.available === true ? 'AVAILABLE' : 'PLANNED',
      provider_selection_complete: false,
      reason: 'not_required_for_current_business-building-v1-core'
    }
  };
}

export function providerActivationMatrix() {
  return {
    schema: 'riosystems.provider-activation-matrix.v1',
    providers: [
      { id: 'cloudflare-workers-free', selection: 'selected', activation: 'runtime_discovery_required', real_write: 'approval_required' },
      { id: 'cloudflare-workers-ai-free', selection: 'selected', activation: 'binding_validation_required', paid_fallback: 'disabled' },
      { id: 'supabase-free', selection: 'selected', activation: 'runtime_discovery_required', real_write: 'approval_required' },
      { id: 'posthog-free', selection: 'selected', activation: 'runtime_discovery_required', real_write: 'approval_required' },
      { id: 'openai-api', selection: 'selected', activation: 'credential_and_budget_gate_required', paid_execution: 'approval_required' },
      { id: 'activepieces-cloud-free', selection: 'selected', activation: 'account_connection_required', real_write: 'approval_required' },
      { id: 'lovable-github', selection: 'optional_specialist', activation: 'only_if_mission_requires' },
      { id: 'framer-server-api', selection: 'optional_specialist', activation: 'only_if_mission_requires' },
      { id: 'webflow-api', selection: 'optional_specialist', activation: 'only_if_mission_requires' },
      { id: 'make-core', selection: 'paid_fallback', activation: 'only_if_primary_insufficient' },
      { id: 'n8n-client-owned', selection: 'client_owned_specialist', activation: 'only_if_client_instance_exists' }
    ],
    secrets_embedded: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function planProviderStackMission(input = {}) {
  if (input.production_deploy === true) return { ok: false, error: 'PRODUCTION_DEPLOY_REJECTED', production_deploy: false };
  const stack = providerStackV1();
  if (stack.status !== 'PROVIDER_SELECTION_COMPLETE') return { ok: false, error: 'PROVIDER_SELECTION_INCOMPLETE', production_deploy: false };
  const project = String(input.project || '').trim().slice(0, 160);
  if (!project) return { ok: false, error: 'PROJECT_REQUIRED', production_deploy: false };
  return {
    ok: true,
    schema: 'riosystems.provider-stack-mission-plan.v1',
    project,
    routes: {
      web: [...stack.factories.web.primary_path],
      automation: [...stack.factories.automation.primary_path],
      ai: [...stack.factories.ai.free_staging_path],
      business: [...stack.factories.business.primary_path]
    },
    execution_authorized: false,
    external_writes: false,
    paid_execution: false,
    automatic_paid_overflow: false,
    production_deploy: false,
    next_gate: 'RUNTIME_PROVIDER_ACTIVATION_AND_STAGING_APPROVAL'
  };
}
