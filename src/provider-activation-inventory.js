import { openAiStagingConnectionEvidence, isOpenAiStagingConnected } from './openai-staging-connection-evidence-v1.js';
import { framerStagingConnectionEvidence, isFramerStagingConnected } from './framer-staging-connection-evidence-v1.js';
import { webflowStagingConnectionEvidence, isWebflowStagingConnected } from './webflow-staging-connection-evidence-v1.js';
import { activepiecesStagingConnectionEvidence, isActivepiecesStagingConnected } from './activepieces-staging-connection-evidence-v1.js';
import { remainingProviderResolution } from './remaining-provider-fast-lane-evidence-v1.js';

const clone = (value) => structuredClone(value ?? null);

const VERIFIED_AT = '2026-08-28';
const OPENAI_CONNECTION_EVIDENCE = openAiStagingConnectionEvidence();
const OPENAI_CONNECTED_STAGING = isOpenAiStagingConnected();
const FRAMER_CONNECTION_EVIDENCE = framerStagingConnectionEvidence();
const FRAMER_CONNECTED_STAGING = isFramerStagingConnected();
const WEBFLOW_CONNECTION_EVIDENCE = webflowStagingConnectionEvidence();
const WEBFLOW_CONNECTED_STAGING = isWebflowStagingConnected();
const ACTIVEPIECES_CONNECTION_EVIDENCE = activepiecesStagingConnectionEvidence();
const ACTIVEPIECES_CONNECTED_STAGING = isActivepiecesStagingConnected();
const BASE44_RESOLUTION = remainingProviderResolution('base44');
const LOVABLE_RESOLUTION = remainingProviderResolution('lovable-github');
const WEBFLOW_RESOLUTION = remainingProviderResolution('webflow-api');
const ACTIVEPIECES_RESOLUTION = remainingProviderResolution('activepieces-cloud-free');
const N8N_RESOLUTION = remainingProviderResolution('n8n-client-owned');

const strategic = (input = {}) => ({
  strategic_state: 'SELECTED',
  availability: 'AVAILABLE',
  verification: 'NOT_CONNECTED',
  restrictions: ['NO_RUNTIME_EVIDENCE', 'NO_PAID_ACTIVATION_DURING_CATALOG_BUILD'],
  runtime_eligible: false,
  external_write: false,
  credentials_required: true,
  account_binding_required: true,
  cost_mode: 'pricing_reverification_required',
  free_tier_confirmed: false,
  pricing_evidence: null,
  verified_at: null,
  ...input
});

const truthState = (value, fallback = 'NOT_VERIFIED') => String(value || fallback).trim().toUpperCase();

export function providerRuntimeTruth(providerOrId, options = {}) {
  const provider = typeof providerOrId === 'string'
    ? PROVIDERS.find((item) => item.id === providerOrId)
    : providerOrId;
  if (!provider) return null;

  const currentRuntimeVerified = new Set(Array.isArray(options.current_runtime_verified_provider_ids)
    ? options.current_runtime_verified_provider_ids
    : []);
  const runtimeVerified = currentRuntimeVerified.has(provider.id);
  const restrictions = new Set(provider.restrictions || []);
  const routingEligibility = provider.runtime_eligible === false || provider.routing_ready === false
    ? 'NOT_ROUTING_ELIGIBLE'
    : provider.routing_scope === 'specialist_only' || restrictions.has('SPECIALIST_ONLY')
      ? 'SPECIALIST_ONLY'
      : 'ELIGIBLE_FOR_ROUTE_EVALUATION';
  const historicalExecutionEvidence = provider.inference_verified === true
    || provider.flow_execution_verified === true
    || provider.staging_write_verified === true
    || provider.publish_verified === true;

  return {
    schema: 'riosystems.provider-runtime-truth.v1',
    provider_id: provider.id,
    strategic_selection: provider.strategic_state === 'SELECTED' ? 'SELECTED' : 'NOT_SELECTED',
    connection: truthState(provider.connection_state, provider.verification === 'NOT_CONNECTED' ? 'NOT_CONNECTED' : 'NOT_VERIFIED'),
    credential: provider.credentials_required === false ? 'NOT_REQUIRED' : truthState(provider.credential_state),
    verification: truthState(provider.verification),
    routing_eligibility: routingEligibility,
    execution_readiness: runtimeVerified
      ? 'CURRENT_RUNTIME_VERIFIED'
      : historicalExecutionEvidence
        ? 'HISTORICAL_EXECUTION_EVIDENCE_REVALIDATION_REQUIRED'
        : provider.runtime_eligible === true
          ? 'EXECUTOR_NOT_CURRENTLY_VERIFIED'
          : 'NOT_EXECUTION_READY',
    actual_executor_availability: runtimeVerified ? 'CURRENT_RUNTIME_VERIFIED' : 'NOT_CURRENTLY_VERIFIED',
    production_eligibility: provider.production_eligible === true ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
    evidence_freshness: provider.verified_at ? 'HISTORICAL_EVIDENCE_REVALIDATION_REQUIRED' : 'NOT_VERIFIED',
    verified_at: provider.verified_at || null,
    current_runtime_verified: runtimeVerified,
    requires_runtime_revalidation: !runtimeVerified,
    production_deploy: false
  };
}

const PROVIDERS = [
  {
    id: 'framer-server-api',
    name: 'Framer',
    category: 'web_design',
    role: 'PRIMARY VISUAL DESIGN / EXPERIENCE',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: FRAMER_CONNECTED_STAGING ? 'CONNECTION_VERIFIED_STAGING' : 'NOT_CONNECTED',
    connection_state: FRAMER_CONNECTED_STAGING ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
    account_state: FRAMER_CONNECTED_STAGING ? 'READY' : 'NOT_VERIFIED',
    project_binding_state: FRAMER_CONNECTED_STAGING ? 'PRESENT' : 'NOT_VERIFIED',
    credential_state: FRAMER_CONNECTED_STAGING ? 'PRESENT_VALID' : 'NOT_VERIFIED',
    restrictions: ['SPECIALIST_ONLY', 'MUTATING_EXECUTION_APPROVAL_REQUIRED', 'STAGING_WRITE_NOT_VERIFIED', 'PUBLISH_NOT_VERIFIED', 'PRODUCTION_DISABLED'],
    runtime_eligible: FRAMER_CONNECTED_STAGING,
    roles: ['visual_design', 'web_experience'],
    capabilities: ['web.design', 'web.experience', 'web.publish'],
    external_write: true,
    credentials_required: true,
    account_binding_required: true,
    cost_mode: 'pricing_reverification_required',
    free_tier_confirmed: true,
    connection_evidence: FRAMER_CONNECTION_EVIDENCE,
    staging_write_verified: false,
    publish_verified: false,
    routing_scope: 'specialist_only',
    mutating_execution_approval_required: true,
    automatic_paid_actions: false,
    production_eligible: false,
    pricing_evidence: 'https://www.framer.com/developers/server-api-faq',
    verified_at: '2026-09-01'
  },
  strategic({
    id: 'base44',
    name: 'Base44',
    category: 'web_app',
    role: 'FULL-STACK APP / PORTAL SPECIALIST',
    roles: ['full_stack_app', 'portal_specialist'],
    capabilities: ['app.build', 'portal.build', 'web.full_stack'],
    connection_state: 'NOT_CONNECTED',
    maturity_level: BASE44_RESOLUTION.maturity_level,
    final_classification: BASE44_RESOLUTION.final_classification,
    central_connection_required: BASE44_RESOLUTION.central_connection_required,
    account_state: BASE44_RESOLUTION.account_state,
    credential_state: BASE44_RESOLUTION.credential_state,
    routing_ready: false,
    runtime_eligible: false,
    free_tier_confirmed: true,
    cost_mode: 'free_credits_usage_limited',
    restrictions: ['SPECIALIST_ONLY', 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED', 'EXTERNAL_SERVICE_ROLE_UNAVAILABLE', 'PRODUCTION_DISABLED'],
    resolution_evidence: BASE44_RESOLUTION,
    verified_at: '2026-09-01'
  }),
  strategic({
    id: 'lovable-github',
    name: 'Lovable',
    category: 'web_app',
    role: 'RAPID BUILD ACCELERATOR',
    roles: ['rapid_build', 'web_acceleration'],
    capabilities: ['web.build', 'app.prototype'],
    connection_state: 'NOT_CONNECTED',
    maturity_level: LOVABLE_RESOLUTION.maturity_level,
    final_classification: LOVABLE_RESOLUTION.final_classification,
    central_connection_required: LOVABLE_RESOLUTION.central_connection_required,
    account_state: LOVABLE_RESOLUTION.account_state,
    credential_state: LOVABLE_RESOLUTION.credential_state,
    routing_ready: false,
    runtime_eligible: false,
    free_tier_confirmed: true,
    cost_mode: 'credit_based_free_grant_available',
    restrictions: ['SPECIALIST_ONLY', 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED', 'WRITE_ORIENTED_BUILD_API', 'MCP_RESEARCH_PREVIEW', 'PRODUCTION_DISABLED'],
    resolution_evidence: LOVABLE_RESOLUTION,
    verified_at: '2026-09-01'
  }),
  strategic({
    id: 'webflow-api',
    name: 'Webflow',
    category: 'web_design',
    role: 'WEB SPECIALIST',
    roles: ['web_specialist'],
    capabilities: ['web.design', 'web.cms', 'web.publish'],
    verification: WEBFLOW_CONNECTED_STAGING ? 'CONNECTION_VERIFIED_STAGING' : 'NOT_CONNECTED',
    connection_state: WEBFLOW_CONNECTED_STAGING ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
    maturity_level: WEBFLOW_CONNECTED_STAGING ? 'L3' : WEBFLOW_RESOLUTION.maturity_level,
    final_classification: WEBFLOW_CONNECTED_STAGING ? 'CONNECTED_STAGING' : WEBFLOW_RESOLUTION.final_classification,
    central_connection_required: true,
    account_state: WEBFLOW_CONNECTED_STAGING ? 'READY' : WEBFLOW_RESOLUTION.account_state,
    credential_state: WEBFLOW_CONNECTED_STAGING ? 'PRESENT_VALID' : WEBFLOW_RESOLUTION.credential_state,
    site_binding_state: WEBFLOW_CONNECTED_STAGING ? 'ACCESSIBLE' : 'NOT_VERIFIED',
    routing_ready: false,
    runtime_eligible: false,
    free_tier_confirmed: true,
    cost_mode: 'free_starter_read_only_api_possible_paid_features_separate',
    restrictions: ['SPECIALIST_ONLY', 'CONNECTED_READ_ONLY', 'STAGING_WRITE_NOT_VERIFIED', 'PUBLISH_NOT_VERIFIED', 'PRODUCTION_DISABLED'],
    operator_gate: null,
    connection_evidence: WEBFLOW_CONNECTION_EVIDENCE,
    resolution_evidence: WEBFLOW_RESOLUTION,
    staging_write_verified: false,
    publish_verified: false,
    routing_scope: 'specialist_only',
    production_eligible: false,
    verified_at: '2026-09-02'
  }),
  {
    id: 'cloudflare-workers-free',
    name: 'Cloudflare',
    category: 'deployment_edge_runtime',
    role: 'DEPLOYMENT / EDGE / RUNTIME',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: 'EVIDENCE_DRIVEN',
    restrictions: ['PRODUCTION_DISABLED', 'EXTERNAL_WRITE_APPROVAL_REQUIRED'],
    runtime_eligible: true,
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
    id: 'make-core',
    name: 'Make',
    category: 'automation',
    role: 'PRIMARY AUTOMATION',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: 'EVIDENCE_DRIVEN',
    restrictions: ['STAGING_ONLY_UNLESS_SEPARATELY_APPROVED', 'EXTERNAL_WRITE_APPROVAL_REQUIRED'],
    runtime_eligible: true,
    roles: ['primary_automation'],
    capabilities: ['automation.run', 'automation.orchestrate'],
    cost_mode: 'pricing_reverification_required',
    free_tier_confirmed: false,
    external_write: true,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: null,
    verified_at: null
  },
  strategic({
    id: 'activepieces-cloud-free',
    name: 'Activepieces',
    category: 'automation',
    role: 'SECONDARY AUTOMATION',
    roles: ['secondary_automation'],
    capabilities: ['automation.run', 'automation.orchestrate'],
    external_write: true,
    verification: ACTIVEPIECES_CONNECTED_STAGING ? 'CONNECTION_VERIFIED_STAGING' : 'NOT_CONNECTED',
    connection_state: ACTIVEPIECES_CONNECTED_STAGING ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
    maturity_level: ACTIVEPIECES_CONNECTED_STAGING ? 'L3' : ACTIVEPIECES_RESOLUTION.maturity_level,
    final_classification: ACTIVEPIECES_CONNECTED_STAGING ? 'CONNECTED_STAGING' : ACTIVEPIECES_RESOLUTION.final_classification,
    central_connection_required: true,
    account_state: ACTIVEPIECES_CONNECTED_STAGING ? 'READY' : ACTIVEPIECES_RESOLUTION.account_state,
    credential_state: ACTIVEPIECES_CONNECTED_STAGING ? 'PRESENT_VALID' : ACTIVEPIECES_RESOLUTION.credential_state,
    api_accessible: ACTIVEPIECES_CONNECTED_STAGING,
    routing_ready: false,
    runtime_eligible: false,
    free_tier_confirmed: true,
    cost_mode: 'free_daily_credits_hard_cap',
    restrictions: ['SECONDARY_ONLY', 'CONNECTED_READ_ONLY', 'FLOW_EXECUTION_NOT_VERIFIED', 'MUTATING_EXECUTION_APPROVAL_REQUIRED', 'PRODUCTION_DISABLED'],
    operator_gate: ACTIVEPIECES_CONNECTED_STAGING ? null : ACTIVEPIECES_RESOLUTION.operator_gate,
    connection_evidence: ACTIVEPIECES_CONNECTION_EVIDENCE,
    resolution_evidence: ACTIVEPIECES_RESOLUTION,
    flow_execution_verified: false,
    routing_scope: 'secondary_only',
    production_eligible: false,
    verified_at: '2026-09-02'
  }),
  strategic({
    id: 'n8n-client-owned',
    name: 'n8n',
    category: 'automation',
    role: 'SPECIALIST / SELF-HOSTED AUTOMATION',
    roles: ['specialist_automation', 'self_hosted_automation'],
    capabilities: ['automation.run', 'automation.self_hosted'],
    external_write: true,
    connection_state: 'NOT_CONNECTED',
    maturity_level: N8N_RESOLUTION.maturity_level,
    final_classification: N8N_RESOLUTION.final_classification,
    central_connection_required: N8N_RESOLUTION.central_connection_required,
    customer_owned_strategy: true,
    account_state: N8N_RESOLUTION.account_state,
    credential_state: N8N_RESOLUTION.credential_state,
    routing_ready: false,
    runtime_eligible: false,
    cost_mode: 'customer_or_instance_specific',
    restrictions: ['CLIENT_OWNED_INSTANCE_REQUIRED', 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED', 'LICENSE_BOUNDARY_PRESERVED', 'PRODUCTION_DISABLED'],
    resolution_evidence: N8N_RESOLUTION,
    verified_at: '2026-09-01'
  }),
  {
    id: 'cloudflare-workers-ai-free',
    name: 'Cloudflare Workers AI',
    category: 'ai',
    role: 'LOW-COST / STAGING AI',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: 'EVIDENCE_DRIVEN',
    restrictions: ['STAGING_ONLY', 'PAID_FALLBACK_DISABLED'],
    runtime_eligible: true,
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
    id: 'openai-api',
    name: 'OpenAI',
    category: 'ai',
    role: 'PRIMARY QUALITY AI',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: OPENAI_CONNECTED_STAGING ? 'CONNECTION_VERIFIED_STAGING' : 'NOT_CONNECTED',
    connection_state: OPENAI_CONNECTED_STAGING ? 'CONNECTED_STAGING' : 'NOT_CONNECTED',
    credential_state: OPENAI_CONNECTED_STAGING ? 'PRESENT_VALID' : 'NOT_VERIFIED',
    restrictions: ['BUDGET_GATE', 'PAID_EXECUTION_APPROVAL_REQUIRED', 'OPERATOR_AI_BOUNDED_STAGING_ONLY', 'PRODUCTION_DISABLED'],
    runtime_eligible: true,
    roles: ['premium_ai'],
    capabilities: ['ai.generate','ai.analyze','ai.classify','ai.extract'],
    cost_mode: 'paid_usage',
    free_tier_confirmed: false,
    external_write: false,
    credentials_required: true,
    account_binding_required: true,
    inference_verified: true,
    token_generation_verified: true,
    routing_ready: true,
    paid_execution_approved: false,
    automatic_paid_overflow: false,
    production_eligible: false,
    connection_evidence: OPENAI_CONNECTION_EVIDENCE,
    pricing_evidence: 'https://openai.com/api/',
    verified_at: '2026-09-01'
  },
  {
    id: 'supabase-free',
    name: 'Supabase',
    category: 'business',
    role: 'PRIMARY BUSINESS BACKEND / CRM',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: 'EVIDENCE_DRIVEN',
    restrictions: ['EXTERNAL_WRITE_APPROVAL_REQUIRED', 'PRODUCTION_DISABLED'],
    runtime_eligible: true,
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
    name: 'PostHog',
    category: 'business_analytics',
    role: 'PRIMARY ANALYTICS',
    strategic_state: 'SELECTED',
    availability: 'AVAILABLE',
    verification: 'EVIDENCE_DRIVEN',
    restrictions: ['SYNTHETIC_EVENT_APPROVAL_REQUIRED', 'PRODUCTION_DISABLED'],
    runtime_eligible: true,
    roles: ['analytics','observability'],
    capabilities: ['web.analytics','business.analytics'],
    cost_mode: 'free_tier_hard_fail',
    free_tier_confirmed: true,
    external_write: true,
    credentials_required: true,
    account_binding_required: true,
    pricing_evidence: 'https://posthog.com/',
    verified_at: VERIFIED_AT
  }
];

export function providerActivationInventory(options = {}) {
  return {
    schema: 'riosystems.provider-activation-inventory.v1',
    verified_at: VERIFIED_AT,
    providers: PROVIDERS.map((provider) => ({ ...clone(provider), runtime_truth: providerRuntimeTruth(provider, options) })),
    strategic_selection_is_not_runtime_connection: true,
    historical_evidence_is_not_current_runtime: true,
    pricing_must_be_reverified_before_activation: true,
    secrets_embedded: false,
    production_deploy: false
  };
}

export function candidatesForCapability(capability, options = {}) {
  const includeStrategicOnly = options.include_strategic_only === true;
  const candidates = PROVIDERS.filter((item) => item.capabilities.includes(capability))
    .filter((item) => includeStrategicOnly || item.runtime_eligible !== false);
  const filtered = options.zero_cost_only === true
    ? candidates.filter((item) => item.free_tier_confirmed === true && item.cost_mode === 'free_tier_hard_fail')
    : candidates;
  return clone(filtered);
}

export function evaluateProviderActivationInventory(input = {}) {
  const required = [...new Set(Array.isArray(input.required_capabilities) ? input.required_capabilities : [])];
  const accountBindings = new Set(Array.isArray(input.account_bindings) ? input.account_bindings : []);
  const credentialRefs = new Set(Array.isArray(input.credential_refs) ? input.credential_refs : []);
  const currentRuntimeVerified = new Set(Array.isArray(input.current_runtime_verified_provider_ids) ? input.current_runtime_verified_provider_ids : []);
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
    const runtimeTruth = providerRuntimeTruth(selected, { current_runtime_verified_provider_ids: [...currentRuntimeVerified] });
    if (runtimeTruth?.current_runtime_verified !== true) {
      blockers.push({ code: 'PROVIDER_CURRENT_RUNTIME_VERIFICATION_REQUIRED', provider_id: selected.id, capability });
    }
    plan.push({
      capability,
      provider_id: selected.id,
      account_bound: accountBound,
      credential_reference_ready: credentialReady,
      external_write: selected.external_write,
      cost_mode: selected.cost_mode,
      runtime_truth: runtimeTruth,
      automatic_paid_overflow: false
    });
  }

  return {
    ok: true,
    zero_cost_path_available: !blockers.some((item) => item.code === 'ZERO_COST_PROVIDER_NOT_AVAILABLE'),
    ready_for_route_resolution: !blockers.some((item) => ['ZERO_COST_PROVIDER_NOT_AVAILABLE','PROVIDER_ACCOUNT_BINDING_REQUIRED','PROVIDER_CREDENTIAL_REFERENCE_REQUIRED','EXTERNAL_WRITE_APPROVAL_REQUIRED'].includes(item.code)),
    ready_for_real_staging: blockers.length === 0,
    ready_for_execution: blockers.length === 0,
    readiness_scope: 'CURRENT_RUNTIME_EXECUTOR_REQUIRED',
    plan,
    blockers,
    user_action_required: blockers.some((item) => ['PROVIDER_ACCOUNT_BINDING_REQUIRED','PROVIDER_CREDENTIAL_REFERENCE_REQUIRED','EXTERNAL_WRITE_APPROVAL_REQUIRED','PROVIDER_CURRENT_RUNTIME_VERIFICATION_REQUIRED'].includes(item.code)),
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

export function providerActivationInventoryManifest() {
  return {
    version: 'riosystems.provider-activation-inventory.v1',
    provider_ecosystem_catalog: true,
    strategic_selection_is_not_runtime_connection: true,
    historical_evidence_is_not_current_runtime: true,
    current_runtime_executor_verification_required: true,
    zero_cost_first: true,
    pricing_reverification_required: true,
    paid_overflow_disabled: true,
    secrets_embedded: false,
    production_deploy: false
  };
}
