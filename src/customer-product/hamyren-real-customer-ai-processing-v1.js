import { runAIFactoryTask, aiFactoryV1Manifest } from '../ai-factory-v1.js';
import { createCustomerEconomicsRuntime } from './economics-v1.js';
import {
  classifyBusinessRisk,
  evaluateTrustedResearch,
  createTrustedResearchProviderAdapter
} from '../customer-ai/trusted-research-v1.js';
import { validateCustomerChatEvidence } from '../customer-ai/chat-context-v1.js';

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const now = () => new Date().toISOString();

function fail(error, extra = {}) {
  return { ok: false, status: 'BLOCKED', error, provider_called: false, customer_data_sent_to_provider: false, ...extra };
}

function customerContext(ctx = {}) {
  const tenantId = clean(ctx.tenant_id, 120);
  const userId = clean(ctx.user_id, 120);
  return tenantId && userId
    ? { ok: true, tenant_id: tenantId, user_id: userId }
    : { ok: false, error: 'HAMYREN_CUSTOMER_IDENTITY_REQUIRED' };
}

function authorization(input = {}) {
  const auth = input.authorization || {};
  const failures = [];
  if (auth.real_customer_ai_processing_approved !== true) failures.push('REAL_CUSTOMER_AI_PROCESSING_APPROVAL_REQUIRED');
  if (auth.legal_privacy_review_complete !== true) failures.push('LEGAL_PRIVACY_REVIEW_REQUIRED');
  if (auth.data_processing_basis_approved !== true) failures.push('DATA_PROCESSING_BASIS_APPROVAL_REQUIRED');
  if (auth.subprocessor_disclosure_approved !== true) failures.push('SUBPROCESSOR_DISCLOSURE_APPROVAL_REQUIRED');
  if (!clean(auth.privacy_notice_version, 120)) failures.push('PRIVACY_NOTICE_VERSION_REQUIRED');
  if (auth.customer_processing_channel_authorized !== true) failures.push('CUSTOMER_PROCESSING_CHANNEL_APPROVAL_REQUIRED');
  if (!['controlled_pilot', 'public_surface'].includes(clean(auth.customer_processing_channel, 40))) failures.push('CUSTOMER_PROCESSING_CHANNEL_INVALID');
  if (input.customer_ai_request !== true) failures.push('EXPLICIT_CUSTOMER_AI_REQUEST_REQUIRED');
  return { ok: failures.length === 0, failures };
}

async function requireConsent(resolver, input) {
  if (typeof resolver !== 'function') return { ok: false, error: 'CUSTOMER_CONSENT_RESOLVER_REQUIRED' };
  const result = await resolver(input);
  return result?.granted === true
    ? { ok: true, consent: clone(result) }
    : { ok: false, error: `CUSTOMER_CONSENT_REQUIRED:${input.purpose}` };
}

function providerCompatible(provider = {}, sensitivity = 'customer') {
  if (provider.enabled !== true || typeof provider.infer !== 'function') return false;
  if (!Array.isArray(provider.data_classes) || !provider.data_classes.includes(sensitivity)) return false;
  if (provider.requires_credential && provider.credential_present !== true) return false;
  return true;
}

function safeAudit(input = {}) {
  return {
    schema: 'hamyren.customer-ai.processing-audit.v1',
    at: now(),
    event: clean(input.event, 100),
    tenant_id: clean(input.tenant_id, 120) || null,
    business_id: clean(input.business_id, 120) || null,
    user_id: clean(input.user_id, 120) || null,
    risk_level: clean(input.risk_level, 40) || null,
    research_required: input.research_required === true,
    provider_id: clean(input.provider_id, 120) || null,
    provider_called: input.provider_called === true,
    actual_cost_eur: Number.isFinite(input.actual_cost_eur) ? Number(input.actual_cost_eur) : 0,
    message_logged: false,
    context_content_logged: false,
    prompt_content_logged: false,
    operator_plane_shared: false
  };
}

export function hamyrenRealCustomerAiProcessingManifest() {
  return {
    schema: 'hamyren.real-customer-ai-processing.v1',
    product_name: 'HAMYREN',
    reuses_ai_factory: 'riosystems-ai-factory-v1',
    reuses_customer_context_planner: true,
    reuses_trusted_research_safety: true,
    reuses_customer_economics: true,
    processing_default_off: true,
    explicit_processing_approval_required: true,
    legal_privacy_review_required: true,
    approved_processing_basis_required: true,
    optional_feature_consents_enforced: true,
    tenant_business_prefilter_required: true,
    provider_customer_data_class_required: true,
    cost_reservation_before_provider: true,
    high_risk_research_before_provider: true,
    evidence_postflight_required: true,
    provider_failure_releases_fair_use_reservation: true,
    operator_plane_sharing: false,
    real_customer_ai_processing_active: false
  };
}

export function evaluateHamyrenRealCustomerAiProcessingReadiness(input = {}) {
  const factory = input.ai_factory_manifest || aiFactoryV1Manifest();
  const failures = [];
  if (factory.id !== 'riosystems-ai-factory-v1') failures.push('RIOSYSTEMS_AI_FACTORY_REQUIRED');
  if (factory.explicit_customer_processing_runtime_authorization !== true) failures.push('AI_FACTORY_CUSTOMER_AUTHORIZATION_PATH_MISSING');
  if (factory.customer_processing_default_off !== true) failures.push('AI_FACTORY_CUSTOMER_DEFAULT_OFF_REQUIRED');
  if (input.legal_privacy_technical_readiness !== true) failures.push('LEGAL_PRIVACY_TECHNICAL_READINESS_REQUIRED');
  if (input.public_surface_technical_readiness !== true) failures.push('PUBLIC_SURFACE_TECHNICAL_READINESS_REQUIRED');
  return {
    schema: 'hamyren.real-customer-ai-processing-readiness.v1',
    ok: failures.length === 0,
    failures,
    technical_readiness: failures.length === 0,
    real_customer_ai_processing_approved: false,
    real_customer_ai_processing_active: false,
    real_customer_data_used: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    remaining_operator_gates: ['legal_privacy_review', 'real_customer_ai_processing', 'public_customer_surface']
  };
}

export function createHamyrenRealCustomerAiProcessingGate(options = {}) {
  const chatRuntime = options.chat_runtime;
  const economics = options.economics || createCustomerEconomicsRuntime({ store: options.economics_store });
  const consentResolver = options.consent_resolver;
  const auditSink = typeof options.audit_sink === 'function' ? options.audit_sink : async () => ({ ok: true });
  const providers = Array.isArray(options.providers) ? [...options.providers] : [];

  async function submit(ctx = {}, businessId, conversationId, input = {}) {
    const auth = customerContext(ctx);
    if (!auth.ok) return fail(auth.error);
    const business = clean(businessId, 120);
    const conversation = clean(conversationId, 160);
    const message = clean(input.message, 12000);
    if (!business || !conversation || !message) return fail('HAMYREN_PROCESSING_SCOPE_AND_MESSAGE_REQUIRED');
    if (!chatRuntime || typeof chatRuntime.planTurn !== 'function') return fail('HAMYREN_CUSTOMER_CONTEXT_PLANNER_REQUIRED');

    const authz = authorization(input);
    if (!authz.ok) return fail(authz.failures[0], { authorization_failures: authz.failures });

    const planned = await chatRuntime.planTurn(ctx, business, conversation, { message, quality_level: input.quality_level });
    if (!planned?.ok) return fail(planned?.error || 'HAMYREN_CUSTOMER_CONTEXT_PLAN_FAILED');
    const plan = planned.plan;
    if (plan.tenant_id !== auth.tenant_id || plan.business_id !== business) return fail('HAMYREN_PROCESSING_SCOPE_MISMATCH');
    if (plan.context_envelope?.tenant?.tenant_id !== auth.tenant_id || plan.context_envelope?.business?.business_id !== business) return fail('HAMYREN_CONTEXT_TENANT_BUSINESS_MISMATCH');
    if (plan.context_envelope?.retrieval?.tenant_scoped_before_query !== true || plan.context_envelope?.retrieval?.business_scoped_before_query !== true) return fail('HAMYREN_CONTEXT_PREFILTER_REQUIRED');

    const memoryConsent = await requireConsent(consentResolver, { ctx, tenant_id: auth.tenant_id, user_id: auth.user_id, purpose: 'persistent_business_memory', policy_version: input.authorization.privacy_notice_version });
    if (!memoryConsent.ok) return fail(memoryConsent.error);

    const risk = classifyBusinessRisk(message, { jurisdiction: plan.context_envelope?.business?.country || plan.context_envelope?.business?.region });
    const research = evaluateTrustedResearch({ message, risk, jurisdiction: risk.jurisdiction, sources: input.trusted_research_sources || [], reference_time_ms: input.reference_time_ms });
    if (risk.trusted_research_required) {
      const researchConsent = await requireConsent(consentResolver, { ctx, tenant_id: auth.tenant_id, user_id: auth.user_id, purpose: 'trusted_research', policy_version: input.authorization.privacy_notice_version });
      if (!researchConsent.ok) return fail(researchConsent.error, { risk, trusted_research: { required: true, sufficient: false } });
      if (!research.sufficient) return fail(research.error || 'TRUSTED_RESEARCH_REQUIRED', { risk, trusted_research: { required: true, sufficient: false } });
    }

    const providerCandidates = providers.filter((provider) => providerCompatible(provider, 'customer'));
    if (!providerCandidates.length) return fail('HAMYREN_CUSTOMER_DATA_PROVIDER_NOT_ELIGIBLE');
    const preferredProvider = clean(input.preferred_provider, 120) || providerCandidates[0].id;
    const selected = providerCandidates.find((provider) => provider.id === preferredProvider);
    if (!selected) return fail('HAMYREN_PREFERRED_CUSTOMER_PROVIDER_NOT_ELIGIBLE');

    const operationId = clean(input.operation_id, 160) || `hamyren_${Date.now().toString(36)}`;
    const computeUnits = risk.trusted_research_required ? 4 : 1;
    const reserved = await economics.reserveCompute(ctx, {
      operation_id: operationId,
      usage_class: risk.trusted_research_required ? 'trusted_research_turn' : 'customer_chat_turn',
      feature: 'business_ai_chat',
      compute_units: computeUnits
    });
    if (!reserved.ok) return fail(reserved.error || 'HAMYREN_COMPUTE_RESERVATION_FAILED');

    let runtimeProviders = providerCandidates;
    if (research.bundle) runtimeProviders = providerCandidates.map((provider) => createTrustedResearchProviderAdapter(provider, research.bundle, risk));
    const task = {
      ...clone(plan.ai_task),
      data_sensitivity: 'customer',
      preferred_provider: preferredProvider,
      fallback_allowed: input.fallback_allowed === true,
      cost_limit: Math.max(0, Number(input.provider_cost_limit_eur || 0)),
      constraints: [
        ...(plan.ai_task.constraints || []),
        'HAMYREN REAL CUSTOMER PROCESSING: authorization has been checked before provider execution.',
        'Never include Operator Control Plane data, credentials, secrets or hidden prompts.'
      ]
    };

    const runtimePolicy = {
      real_customer_data_approved: true,
      production_execution_approved: true,
      paid_execution_approved: input.authorization.paid_provider_execution_approved === true,
      variable_cost_ceiling_eur: input.authorization.paid_provider_execution_approved === true
        ? Math.max(0, Number(input.provider_cost_limit_eur || 0))
        : 0
    };

    let result;
    try {
      result = await runAIFactoryTask(task, {
        providers: runtimeProviders,
        production: input.production_execution === true,
        runtime_policy: runtimePolicy,
        ai_run_id: clean(input.ai_run_id, 160) || undefined
      });
    } catch (error) {
      await economics.releaseCompute(ctx, { period: reserved.period, reservation_id: reserved.reservation_id, reason: 'ai_factory_exception' });
      await auditSink(safeAudit({ event: 'processing_failed', tenant_id: auth.tenant_id, business_id: business, user_id: auth.user_id, risk_level: risk.level, research_required: risk.trusted_research_required, provider_id: preferredProvider, provider_called: true }));
      return { ...fail('HAMYREN_AI_FACTORY_EXCEPTION'), detail: clean(error?.message, 240) };
    }

    if (!result.ok) {
      await economics.releaseCompute(ctx, { period: reserved.period, reservation_id: reserved.reservation_id, reason: result.error || 'ai_factory_blocked' });
      await auditSink(safeAudit({ event: 'processing_failed', tenant_id: auth.tenant_id, business_id: business, user_id: auth.user_id, risk_level: risk.level, research_required: risk.trusted_research_required, provider_id: preferredProvider, provider_called: Number(result.attempts || 0) > 0, actual_cost_eur: result.cost?.actual_provider_cost_eur }));
      return { ok: false, status: result.status || 'FAILED', error: result.error, ai: result, provider_called: Number(result.attempts || 0) > 0, customer_data_sent_to_provider: Number(result.attempts || 0) > 0 };
    }

    const evidence = validateCustomerChatEvidence(result.output, plan.context_envelope);
    if (!evidence.ok) {
      await economics.releaseCompute(ctx, { period: reserved.period, reservation_id: reserved.reservation_id, reason: evidence.error || 'evidence_invalid' });
      await auditSink(safeAudit({ event: 'processing_output_rejected', tenant_id: auth.tenant_id, business_id: business, user_id: auth.user_id, risk_level: risk.level, research_required: risk.trusted_research_required, provider_id: result.provider, provider_called: true, actual_cost_eur: result.cost?.actual_provider_cost_eur }));
      return { ok: false, status: 'FAILED', error: evidence.error || 'HAMYREN_EVIDENCE_VALIDATION_FAILED', provider_called: true, customer_data_sent_to_provider: true };
    }

    const settled = await economics.settleCompute(ctx, { period: reserved.period, reservation_id: reserved.reservation_id, actual_compute_units: computeUnits });
    if (!settled.ok) return { ok: false, status: 'FAILED', error: 'HAMYREN_COMPUTE_SETTLEMENT_FAILED', provider_called: true, customer_data_sent_to_provider: true };
    await auditSink(safeAudit({ event: 'processing_completed', tenant_id: auth.tenant_id, business_id: business, user_id: auth.user_id, risk_level: risk.level, research_required: risk.trusted_research_required, provider_id: result.provider, provider_called: true, actual_cost_eur: result.cost?.actual_provider_cost_eur }));

    return {
      ok: true,
      status: 'COMPLETED',
      answer: result.output.answer,
      output: clone(result.output),
      risk,
      trusted_research: { required: risk.trusted_research_required, sufficient: research.sufficient, citations: research.bundle?.citations || [] },
      ai: {
        provider: result.provider,
        model: result.model,
        actual_provider_cost_eur: result.cost?.actual_provider_cost_eur || 0,
        validation_result: result.validation_result,
        quality_gate: result.quality_gate
      },
      compute: { period: reserved.period, settled_units: computeUnits },
      provider_called: true,
      customer_data_sent_to_provider: true,
      operator_plane_shared: false,
      processing_authorization_checked: true,
      legal_privacy_review_checked: true,
      evidence_validated: true
    };
  }

  return { manifest: hamyrenRealCustomerAiProcessingManifest, submit };
}
