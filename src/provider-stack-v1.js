import { webProviderDecisionManifest } from './web-provider-strategy.js';
import { automationProviderDecisionManifest } from './automation-provider-strategy.js';
import { aiProviderDecisionManifest } from './ai-provider-strategy.js';
import { businessProviderDecisionManifest } from './business-provider-strategy.js';
import { listExecutionAdapters } from './execution-adapters.js';
import { isMakeLiveStagingVerified, makeLiveStagingActivationEvidence } from './make-live-staging-evidence.js';
import { cloudflareLiveReadEvidence, isCloudflareAiReadVerified, isCloudflareWebReadVerified } from './cloudflare-live-read-evidence.js';
import { cloudflarePagesStagingEvidence, isCloudflarePagesStagingVerified } from './cloudflare-pages-staging-evidence.js';
import { businessLiveReadEvidence, isBusinessLiveReadVerified } from './business-live-read-evidence.js';

const clone = (value) => structuredClone(value ?? null);
const ACTIVE_FACTORY_KEYS = Object.freeze(['web','automation','ai','business']);

export function providerStackV1() {
  const adapters = listExecutionAdapters();
  const byEngine = new Map(adapters.map((item) => [item.engine, item]));
  const cloudflareEvidence = cloudflareLiveReadEvidence();
  const cloudflarePagesEvidence = cloudflarePagesStagingEvidence();
  const makeEvidence = makeLiveStagingActivationEvidence();
  const businessEvidence = businessLiveReadEvidence();
  const factories = {
    web: {
      decision: webProviderDecisionManifest(),
      adapter: clone(byEngine.get('web')),
      primary_path: ['riosystems-native-web','cloudflare-workers-free'],
      optional_specialists: ['lovable-github','framer-server-api','webflow-api'],
      provider_read_verified: isCloudflareWebReadVerified(),
      provider_read_evidence: cloudflareEvidence,
      staging_deploy_verified: isCloudflarePagesStagingVerified(),
      staging_deploy_evidence: cloudflarePagesEvidence
    },
    automation: {
      decision: automationProviderDecisionManifest(),
      adapter: clone(byEngine.get('automation')),
      primary_path: ['riosystems-native-automation','make-core'],
      secondary_path: ['riosystems-native-automation','activepieces-cloud-free'],
      specialist_paths: ['n8n-client-owned','activepieces-community','cloudflare-workers-free'],
      staging_activation_verified: isMakeLiveStagingVerified(),
      staging_activation_evidence: makeEvidence
    },
    ai: {
      decision: aiProviderDecisionManifest(),
      adapter: clone(byEngine.get('ai')),
      primary_path: ['riosystems-ai-local-policy','openai-api'],
      free_staging_path: ['riosystems-ai-local-policy','cloudflare-workers-ai-free'],
      model_ladder: ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol'],
      cloudflare_ai_read_verified: isCloudflareAiReadVerified(),
      cloudflare_ai_blocker: isCloudflareAiReadVerified() ? null : 'CLOUDFLARE_WORKERS_AI_PERMISSION_REQUIRED'
    },
    business: {
      decision: businessProviderDecisionManifest(),
      adapter: clone(byEngine.get('business')),
      primary_path: ['riosystems-native-business','supabase-free','posthog-free'],
      standalone_crm_saas_required: false,
      provider_read_verified: isBusinessLiveReadVerified(),
      provider_read_evidence: businessEvidence,
      staging_write_verified: false
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
    source_of_truth: 'github_repository_evidence',
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
  const cf = cloudflareLiveReadEvidence();
  const pages = cloudflarePagesStagingEvidence();
  const make = makeLiveStagingActivationEvidence();
  const business = businessLiveReadEvidence();
  const webStagingVerified = isCloudflarePagesStagingVerified();
  const makeStagingVerified = isMakeLiveStagingVerified();
  return {
    schema: 'riosystems.provider-activation-matrix.v1',
    providers: [
      {
        id: 'cloudflare-workers-free',
        selection: 'selected',
        activation: webStagingVerified ? 'live_read_and_staging_deploy_verified' : 'live_read_verified_staging_deploy_zero_cost_confirmation_required',
        workers_scripts_read: cf.capabilities.workers_scripts_read,
        pages_projects_read: cf.capabilities.pages_projects_read,
        evidence_run_id: cf.github_actions_run_id,
        staging_deploy_verified: webStagingVerified,
        staging_evidence_run_id: pages.github_actions_run_id,
        staging_deploy_evidence: pages,
        real_write: 'explicit_staging_approval_required_per_new_deployment'
      },
      {
        id: 'cloudflare-workers-ai-free',
        selection: 'selected',
        activation: 'permission_required',
        workers_ai_read: cf.capabilities.workers_ai_read,
        paid_fallback: 'disabled'
      },
      {
        id: 'supabase-free',
        selection: 'selected',
        activation: 'live_read_verified_staging_write_not_authorized',
        project_status: business.supabase.project_status,
        schema_read: business.supabase.public_schema_read_verified === true ? 'verified' : 'unverified',
        real_write: 'isolated_staging_and_explicit_approval_required'
      },
      {
        id: 'posthog-free',
        selection: 'selected',
        activation: 'live_read_verified_event_ingestion_observed',
        project_read: business.posthog.project_read_verified === true ? 'verified' : 'unverified',
        event_ingestion_observed: business.posthog.ingested_event_observed,
        real_write: 'synthetic_event_approval_required'
      },
      { id: 'openai-api', selection: 'selected', activation: 'credential_and_budget_gate_required', paid_execution: 'approval_required' },
      {
        id: 'make-core',
        selection: 'primary_automation_runtime',
        activation: makeStagingVerified ? 'live_staging_verified' : 'staging_verification_incomplete',
        read_only_preflight: make.verification.read_only_preflight === true ? 'verified' : 'unverified',
        scenario_create: make.verification.scenario_create === true ? 'verified_inactive_staging_only' : 'unverified',
        scenario_run_once: make.verification.scenario_run_once === true && make.verification.scenario_restored_inactive === true
          ? 'verified_synthetic_supervised_and_restored_inactive'
          : 'unverified',
        evidence_run_id: make.execution.github_actions_run_id,
        scenario_id: make.scenario.scenario_id,
        real_write: 'approval_required_per_execution',
        production_activation: make.authorization_posture.production_authorized === true ? 'authorized' : 'not_authorized',
        automatic_extra_credit_purchase: make.authorization_posture.automatic_paid_overflow === true
      },
      { id: 'activepieces-cloud-free', selection: 'strategic_secondary_runtime', activation: 'only_if_secondary_path_needed', real_write: 'approval_required' },
      { id: 'n8n-client-owned', selection: 'technical_specialist', activation: 'only_if_complex_workflow_and_client_instance_exists' },
      { id: 'activepieces-community', selection: 'future_self_hosted_option', activation: 'only_if_self_hosting_is_intentional' },
      { id: 'lovable-github', selection: 'optional_specialist', activation: 'only_if_mission_requires' },
      { id: 'framer-server-api', selection: 'optional_specialist', activation: 'only_if_mission_requires' },
      { id: 'webflow-api', selection: 'optional_specialist', activation: 'only_if_mission_requires' }
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

  const nextGate = stack.factories.web.staging_deploy_verified !== true
    ? 'CLOUDFLARE_ZERO_COST_CONFIRMATION_REQUIRED'
    : stack.factories.business.staging_write_verified !== true
      ? 'BUSINESS_STAGING_WRITE_APPROVAL_REQUIRED'
      : stack.factories.ai.cloudflare_ai_read_verified !== true
        ? 'CLOUDFLARE_WORKERS_AI_PERMISSION_REQUIRED'
        : 'STAGING_EXECUTION_APPROVAL_REQUIRED';

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
    activation_status: {
      automation_make_staging_verified: stack.factories.automation.staging_activation_verified === true,
      web_cloudflare_read_verified: stack.factories.web.provider_read_verified === true,
      web_staging_deploy_verified: stack.factories.web.staging_deploy_verified === true,
      ai_cloudflare_runtime_verified: stack.factories.ai.cloudflare_ai_read_verified === true,
      business_runtime_read_verified: stack.factories.business.provider_read_verified === true,
      business_staging_write_verified: stack.factories.business.staging_write_verified === true
    },
    activation_evidence: {
      web_staging_deploy: clone(stack.factories.web.staging_deploy_evidence),
      automation_make_staging: clone(stack.factories.automation.staging_activation_evidence),
      business_runtime_read: clone(stack.factories.business.provider_read_evidence)
    },
    execution_authorized: false,
    external_writes: false,
    paid_execution: false,
    automatic_paid_overflow: false,
    production_deploy: false,
    next_gate: nextGate
  };
}
