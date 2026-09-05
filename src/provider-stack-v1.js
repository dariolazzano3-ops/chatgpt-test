import { webProviderDecisionManifest } from './web-provider-strategy.js';
import { automationProviderDecisionManifest } from './automation-provider-strategy.js';
import { aiProviderDecisionManifest } from './ai-provider-strategy.js';
import { businessProviderDecisionManifest } from './business-provider-strategy.js';
import { listExecutionAdapters } from './execution-adapters.js';
import { isMakeLiveStagingVerified, makeLiveStagingActivationEvidence } from './make-live-staging-evidence.js';
import { cloudflareLiveReadEvidence, isCloudflareAiReadVerified, isCloudflareWebReadVerified } from './cloudflare-live-read-evidence.js';
import { cloudflarePagesStagingEvidence, isCloudflarePagesStagingVerified } from './cloudflare-pages-staging-evidence.js';
import { cloudflareWorkersAiStagingEvidence, isCloudflareWorkersAiStagingVerified } from './cloudflare-workers-ai-staging-evidence.js';
import { openAiStagingConnectionEvidence, isOpenAiStagingConnected } from './openai-staging-connection-evidence-v1.js';
import { framerStagingConnectionEvidence, isFramerStagingConnected } from './framer-staging-connection-evidence-v1.js';
import { webflowStagingConnectionEvidence, isWebflowStagingConnected } from './webflow-staging-connection-evidence-v1.js';
import { activepiecesStagingConnectionEvidence, isActivepiecesStagingConnected } from './activepieces-staging-connection-evidence-v1.js';
import { remainingProviderResolution } from './remaining-provider-fast-lane-evidence-v1.js';
import { supabaseStagingWriteManifest } from './business-staging-write-plan.js';
import { businessStagingWriteEvidence, isBusinessStagingWriteVerified } from './business-staging-write-evidence.js';
import { businessLiveReadEvidence, isBusinessLiveReadVerified } from './business-live-read-evidence.js';
import { posthogStagingEventEvidence, isPostHogStagingAnalyticsVerified } from './posthog-staging-event-evidence.js';
import { providerActivationInventory } from './provider-activation-inventory.js';

const clone = (value) => structuredClone(value ?? null);
const ACTIVE_FACTORY_KEYS = Object.freeze(['web','automation','ai','business']);

export function providerStackV1() {
  const adapters = listExecutionAdapters();
  const byEngine = new Map(adapters.map((item) => [item.engine, item]));
  const cloudflareEvidence = cloudflareLiveReadEvidence();
  const cloudflarePagesEvidence = cloudflarePagesStagingEvidence();
  const cloudflareAiEvidence = cloudflareWorkersAiStagingEvidence();
  const openAiEvidence = openAiStagingConnectionEvidence();
  const framerEvidence = framerStagingConnectionEvidence();
  const webflowEvidence = webflowStagingConnectionEvidence();
  const activepiecesEvidence = activepiecesStagingConnectionEvidence();
  const makeEvidence = makeLiveStagingActivationEvidence();
  const businessEvidence = businessLiveReadEvidence();
  const businessWriteRunner = supabaseStagingWriteManifest();
  const businessWriteEvidence = businessStagingWriteEvidence();
  const posthogStagingEvidence = posthogStagingEventEvidence();
  const factories = {
    web: {
      decision: webProviderDecisionManifest(),
      adapter: clone(byEngine.get('web')),
      primary_path: ['riosystems-native-web','cloudflare-workers-free'],
      optional_specialists: ['lovable-github','framer-server-api','webflow-api'],
      provider_read_verified: isCloudflareWebReadVerified(),
      provider_read_evidence: cloudflareEvidence,
      staging_deploy_verified: isCloudflarePagesStagingVerified(),
      staging_deploy_evidence: cloudflarePagesEvidence,
      framer_connected_staging: isFramerStagingConnected(),
      framer_connection_evidence: framerEvidence,
      framer_staging_write_verified: false,
      framer_publish_verified: false,
      framer_routing_scope: 'specialist_only',
      webflow_connected_staging: isWebflowStagingConnected(),
      webflow_connection_evidence: webflowEvidence,
      webflow_staging_write_verified: false,
      webflow_publish_verified: false,
      webflow_routing_scope: 'specialist_only',
      lovable_resolution: remainingProviderResolution('lovable-github'),
      webflow_resolution: remainingProviderResolution('webflow-api'),
      base44_resolution: remainingProviderResolution('base44')
    },
    automation: {
      decision: automationProviderDecisionManifest(),
      adapter: clone(byEngine.get('automation')),
      primary_path: ['riosystems-native-automation','make-core'],
      secondary_path: ['riosystems-native-automation','activepieces-cloud-free'],
      specialist_paths: ['n8n-client-owned','activepieces-community','cloudflare-workers-free'],
      staging_activation_verified: isMakeLiveStagingVerified(),
      staging_activation_evidence: makeEvidence,
      activepieces_connected_staging: isActivepiecesStagingConnected(),
      activepieces_connection_evidence: activepiecesEvidence,
      activepieces_flow_execution_verified: false,
      activepieces_routing_scope: 'secondary_only',
      activepieces_resolution: remainingProviderResolution('activepieces-cloud-free'),
      n8n_resolution: remainingProviderResolution('n8n-client-owned')
    },
    ai: {
      decision: aiProviderDecisionManifest(),
      adapter: clone(byEngine.get('ai')),
      primary_path: ['riosystems-ai-local-policy','openai-api'],
      free_staging_path: ['riosystems-ai-local-policy','cloudflare-workers-ai-free'],
      model_ladder: ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol'],
      cloudflare_ai_read_verified: isCloudflareAiReadVerified(),
      cloudflare_ai_runtime_verified: isCloudflareWorkersAiStagingVerified(),
      cloudflare_ai_runtime_evidence: cloudflareAiEvidence,
      cloudflare_ai_blocker: isCloudflareWorkersAiStagingVerified() ? null : 'CLOUDFLARE_WORKERS_AI_PERMISSION_REQUIRED',
      openai_connected_staging: isOpenAiStagingConnected(),
      openai_connection_evidence: openAiEvidence,
      openai_inference_verified: openAiEvidence.execution?.inference_verified === true,
      openai_routing_ready: openAiEvidence.execution?.routing_ready === true,
      openai_paid_execution_approved: false
    },
    business: {
      decision: businessProviderDecisionManifest(),
      adapter: clone(byEngine.get('business')),
      primary_path: ['riosystems-native-business','supabase-free','posthog-free'],
      standalone_crm_saas_required: false,
      provider_read_verified: isBusinessLiveReadVerified(),
      provider_read_evidence: businessEvidence,
      staging_write_plan_ready: businessWriteRunner.explicit_external_write_execution_approval_required === true
        && businessWriteRunner.exact_scope_approval_required === true
        && businessWriteRunner.zero_cost_confirmation_required === true,
      staging_write_plan: businessWriteRunner,
      staging_write_verified: isBusinessStagingWriteVerified(),
      staging_write_evidence: businessWriteEvidence,
      analytics_staging_verified: isPostHogStagingAnalyticsVerified(),
      analytics_staging_evidence: posthogStagingEvidence
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
    evidence_scope: 'HISTORICAL_REPOSITORY_EVIDENCE',
    historical_evidence_is_not_current_runtime: true,
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
  const cloudflareAi = cloudflareWorkersAiStagingEvidence();
  const openAi = openAiStagingConnectionEvidence();
  const framer = framerStagingConnectionEvidence();
  const activepiecesConnectionEvidence = activepiecesStagingConnectionEvidence();
  const make = makeLiveStagingActivationEvidence();
  const business = businessLiveReadEvidence();
  const businessWrite = businessStagingWriteEvidence();
  const posthogStaging = posthogStagingEventEvidence();
  const webStagingVerified = isCloudflarePagesStagingVerified();
  const cloudflareAiStagingVerified = isCloudflareWorkersAiStagingVerified();
  const openAiConnectedStaging = isOpenAiStagingConnected();
  const framerConnectedStaging = isFramerStagingConnected();
  const webflowConnectedStaging = isWebflowStagingConnected();
  const activepiecesConnectedStaging = isActivepiecesStagingConnected();
  const webflowConnectionEvidence = webflowStagingConnectionEvidence();
  const makeStagingVerified = isMakeLiveStagingVerified();
  const businessStagingWriteVerified = isBusinessStagingWriteVerified();
  const posthogStagingVerified = isPostHogStagingAnalyticsVerified();
  const base44 = remainingProviderResolution('base44');
  const activepieces = remainingProviderResolution('activepieces-cloud-free');
  const webflow = remainingProviderResolution('webflow-api');
  const lovable = remainingProviderResolution('lovable-github');
  const n8n = remainingProviderResolution('n8n-client-owned');
  const providers = [
      {
        id: 'cloudflare-workers-free', selection: 'selected',
        activation: webStagingVerified ? 'historical_read_and_staging_deploy_evidence' : 'historical_read_evidence_staging_deploy_revalidation_required',
        workers_scripts_read: cf.capabilities.workers_scripts_read, pages_projects_read: cf.capabilities.pages_projects_read,
        evidence_run_id: cf.github_actions_run_id, staging_deploy_verified: webStagingVerified,
        staging_evidence_run_id: pages.github_actions_run_id, staging_deploy_evidence: pages,
        real_write: 'explicit_staging_approval_required_per_new_deployment'
      },
      {
        id: 'cloudflare-workers-ai-free', selection: 'selected',
        activation: cloudflareAiStagingVerified ? 'historical_staging_inference_evidence' : 'permission_required',
        historical_workers_ai_models_read: cf.capabilities.workers_ai_read,
        staging_inference_verified: cloudflareAiStagingVerified, staging_inference_evidence: cloudflareAi,
        zero_cost_verified: cloudflareAi.cost_guard.zero_cost_verified === true,
        real_inference: 'synthetic_staging_and_explicit_approval_required_per_execution', paid_fallback: 'disabled'
      },
      {
        id: 'supabase-free', selection: 'selected',
        activation: businessStagingWriteVerified ? 'historical_read_and_staging_write_evidence' : 'historical_read_evidence_staging_write_revalidation_required',
        project_status: business.supabase.project_status,
        schema_read: business.supabase.public_schema_read_verified === true ? 'verified' : 'unverified',
        staging_write_plan_ready: true, staging_write_verified: businessStagingWriteVerified,
        staging_write_evidence: businessWrite, real_write: 'isolated_staging_and_explicit_approval_required_per_execution'
      },
      {
        id: 'posthog-free', selection: 'selected',
        activation: posthogStagingVerified ? 'historical_read_and_staging_analytics_evidence' : 'historical_read_and_event_ingestion_evidence',
        project_read: business.posthog.project_read_verified === true ? 'verified' : 'unverified',
        event_ingestion_observed: business.posthog.ingested_event_observed,
        staging_analytics_verified: posthogStagingVerified, staging_analytics_evidence: posthogStaging,
        real_write: 'synthetic_event_approval_required_per_execution'
      },
      {
        id: 'openai-api', selection: 'selected',
        connection_state: openAiConnectedStaging ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
        activation: openAiConnectedStaging ? 'historical_connected_staging_evidence_budget_gate' : 'credential_and_budget_gate_required',
        credential: openAiConnectedStaging ? 'present_valid' : 'not_verified', connection_evidence: openAi,
        inference_verified: openAi.execution?.inference_verified === true, routing_ready: openAi.execution?.routing_ready === true, paid_execution: 'approval_required',
        paid_execution_approved: false, automatic_paid_overflow: false, production_eligible: false
      },
      {
        id: 'make-core', selection: 'primary_automation_runtime',
        activation: makeStagingVerified ? 'historical_staging_execution_evidence' : 'staging_verification_incomplete',
        read_only_preflight: make.verification.read_only_preflight === true ? 'verified' : 'unverified',
        scenario_create: make.verification.scenario_create === true ? 'verified_inactive_staging_only' : 'unverified',
        scenario_run_once: make.verification.scenario_run_once === true && make.verification.scenario_restored_inactive === true
          ? 'verified_synthetic_supervised_and_restored_inactive' : 'unverified',
        evidence_run_id: make.execution.github_actions_run_id, scenario_id: make.scenario.scenario_id,
        real_write: 'approval_required_per_execution',
        production_activation: make.authorization_posture.production_authorized === true ? 'authorized' : 'not_authorized',
        automatic_extra_credit_purchase: make.authorization_posture.automatic_paid_overflow === true
      },
      {
        id: 'base44', selection: 'app_portal_specialist', connection_state: 'NOT_CONNECTED',
        activation: 'intentionally_not_centrally_connected', maturity_level: base44.maturity_level,
        final_classification: base44.final_classification, central_connection_required: false,
        routing_eligibility: 'mission_specific_supervised_only', provider_requests: 0, provider_writes: 0,
        production_eligible: false, resolution_evidence: base44
      },
      {
        id: 'activepieces-cloud-free', selection: 'strategic_secondary_runtime',
        connection_state: activepiecesConnectedStaging ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
        activation: activepiecesConnectedStaging ? 'historical_read_only_connection_evidence' : 'operator_gate_account_api_key_required',
        maturity_level: activepiecesConnectedStaging ? 'L3' : activepieces.maturity_level,
        final_classification: activepiecesConnectedStaging ? 'CONNECTED_STAGING' : activepieces.final_classification,
        account: activepiecesConnectedStaging ? 'ready' : 'not_verified',
        credential: activepiecesConnectedStaging ? 'present_valid' : 'not_verified',
        authenticated: activepiecesConnectedStaging,
        api_accessible: activepiecesConnectedStaging,
        connected_staging: activepiecesConnectedStaging,
        operator_gate: activepiecesConnectedStaging ? null : activepieces.operator_gate,
        routing_eligibility: 'secondary_only_flow_execution_not_verified',
        connection_evidence: activepiecesConnectionEvidence,
        flow_execution_verified: false,
        real_write: 'not_verified_approval_required',
        provider_requests: activepiecesConnectedStaging ? 1 : 0,
        provider_writes: 0,
        production_eligible: false,
        resolution_evidence: activepieces
      },
      {
        id: 'n8n-client-owned', selection: 'technical_specialist', connection_state: 'NOT_CONNECTED',
        activation: 'intentionally_customer_owned_per_instance', maturity_level: n8n.maturity_level,
        final_classification: n8n.final_classification, central_connection_required: false,
        customer_owned_strategy: true, routing_eligibility: 'per_customer_instance_when_mission_requires',
        provider_requests: 0, provider_writes: 0, production_eligible: false, resolution_evidence: n8n
      },
      { id: 'activepieces-community', selection: 'future_self_hosted_option', activation: 'only_if_self_hosting_is_intentional' },
      {
        id: 'lovable-github', selection: 'optional_specialist', connection_state: 'NOT_CONNECTED',
        activation: 'intentionally_not_centrally_connected_supervised_builder', maturity_level: lovable.maturity_level,
        final_classification: lovable.final_classification, central_connection_required: false,
        routing_eligibility: 'mission_specific_supervised_github_handoff', provider_requests: 0,
        provider_writes: 0, production_eligible: false, resolution_evidence: lovable
      },
      {
        id: 'framer-server-api', selection: 'optional_specialist',
        connection_state: framerConnectedStaging ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
        activation: framerConnectedStaging ? 'historical_read_only_connection_evidence' : 'only_if_mission_requires',
        account: framerConnectedStaging ? 'ready' : 'not_verified', project_binding: framerConnectedStaging ? 'present' : 'not_verified',
        credential: framerConnectedStaging ? 'present_valid' : 'not_verified', connection_evidence: framer,
        project_metadata_read: framerConnectedStaging, provider_writes: 0, staging_write_verified: false,
        publish_verified: false, publish_performed: false, deploy_performed: false,
        routing_eligibility: 'specialist_only_mutations_approval_gated', production_eligible: false
      },
      {
        id: 'webflow-api', selection: 'optional_specialist',
        connection_state: webflowConnectedStaging ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
        activation: webflowConnectedStaging ? 'historical_read_only_connection_evidence' : 'operator_gate_read_only_site_token_required',
        maturity_level: webflowConnectedStaging ? 'L3' : webflow.maturity_level,
        final_classification: webflowConnectedStaging ? 'CONNECTED_STAGING' : webflow.final_classification,
        account: webflowConnectedStaging ? 'ready' : 'not_verified',
        credential: webflowConnectedStaging ? 'present_valid' : 'not_verified',
        site_metadata_read: webflowConnectedStaging,
        connection_evidence: webflowConnectionEvidence,
        operator_gate: webflowConnectedStaging ? null : webflow.operator_gate,
        routing_eligibility: 'specialist_only_not_routing_ready_at_l3',
        provider_requests: webflowConnectedStaging ? 1 : 0,
        provider_writes: 0,
        staging_write_verified: false,
        publish_verified: false,
        publish_performed: false,
        production_eligible: false,
        resolution_evidence: webflow
      }
  ];
  const truthById = new Map(providerActivationInventory().providers.map((provider) => [provider.id, provider.runtime_truth]));
  return {
    schema: 'riosystems.provider-activation-matrix.v1',
    evidence_scope: 'HISTORICAL_REPOSITORY_EVIDENCE',
    historical_evidence_is_not_current_runtime: true,
    providers: providers.map((provider) => ({
      ...provider,
      runtime_truth: clone(truthById.get(provider.id) || null),
      current_runtime_verified: false
    })),
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
      : stack.factories.business.analytics_staging_verified !== true
        ? 'POSTHOG_STAGING_ANALYTICS_APPROVAL_REQUIRED'
        : stack.factories.ai.cloudflare_ai_runtime_verified !== true
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
      web_framer_connected_staging: stack.factories.web.framer_connected_staging === true,
      web_framer_staging_write_verified: stack.factories.web.framer_staging_write_verified === true,
      web_framer_publish_verified: stack.factories.web.framer_publish_verified === true,
      ai_cloudflare_runtime_verified: stack.factories.ai.cloudflare_ai_runtime_verified === true,
      ai_openai_connected_staging: stack.factories.ai.openai_connected_staging === true,
      ai_openai_inference_verified: stack.factories.ai.openai_inference_verified === true,
      ai_openai_routing_ready: stack.factories.ai.openai_routing_ready === true,
      business_runtime_read_verified: stack.factories.business.provider_read_verified === true,
      business_staging_write_verified: stack.factories.business.staging_write_verified === true,
      business_posthog_staging_analytics_verified: stack.factories.business.analytics_staging_verified === true
    },
    activation_evidence: {
      web_staging_deploy: clone(stack.factories.web.staging_deploy_evidence),
      web_framer_connection: clone(stack.factories.web.framer_connection_evidence),
      web_lovable_resolution: clone(stack.factories.web.lovable_resolution),
      web_webflow_resolution: clone(stack.factories.web.webflow_resolution),
      web_base44_resolution: clone(stack.factories.web.base44_resolution),
      automation_make_staging: clone(stack.factories.automation.staging_activation_evidence),
      automation_activepieces_resolution: clone(stack.factories.automation.activepieces_resolution),
      automation_n8n_resolution: clone(stack.factories.automation.n8n_resolution),
      ai_cloudflare_staging_runtime: clone(stack.factories.ai.cloudflare_ai_runtime_evidence),
      ai_openai_connection: clone(stack.factories.ai.openai_connection_evidence),
      business_runtime_read: clone(stack.factories.business.provider_read_evidence),
      business_staging_write: clone(stack.factories.business.staging_write_evidence),
      business_posthog_staging_analytics: clone(stack.factories.business.analytics_staging_evidence)
    },
    execution_authorized: false,
    external_writes: false,
    paid_execution: false,
    automatic_paid_overflow: false,
    production_deploy: false,
    next_gate: nextGate
  };
}
