import assert from 'node:assert/strict';
import { createMemoryRuntimeStore } from '../src/durable-runtime-store.js';
import { createCustomerAiFoundation } from '../src/customer-ai/foundation-v1.js';
import { createCustomerChatRuntime } from '../src/customer-ai/chat-runtime-v1.js';
import { createCustomerEconomicsRuntime } from '../src/customer-product/economics-v1.js';
import { runAIFactoryTask, aiFactoryV1Manifest } from '../src/ai-factory-v1.js';
import {
  createHamyrenRealCustomerAiProcessingGate,
  evaluateHamyrenRealCustomerAiProcessingReadiness,
  hamyrenRealCustomerAiProcessingManifest
} from '../src/customer-product/hamyren-real-customer-ai-processing-v1.js';

const output = (answer = 'Prüfe zuerst die wichtigsten Business-Hebel.', evidence = ['business:profile']) => ({
  answer,
  recommendations: [],
  follow_up_questions: [],
  memory_candidates: [],
  goal_proposals: [],
  decision_proposals: [],
  evidence_refs: evidence,
  needs_external_research: false,
  confidence: 0.9
});

function providerFactory(input = {}) {
  let calls = 0;
  const requests = [];
  const provider = {
    id: input.id || 'synthetic-customer-provider',
    enabled: input.enabled !== false,
    external: false,
    paid: false,
    capabilities: ['classification','extraction','summarization','generation','analysis','decision_support','rewriting','structured_planning'],
    data_classes: input.data_classes || ['customer'],
    logical_models: ['Luna','Terra','Sol'],
    latency_classes: ['interactive','standard','batch'],
    zero_cost_verified: true,
    requires_credential: false,
    credential_present: true,
    paid_execution_approved: false,
    estimateCost: () => ({ estimated_cost_eur: 0, pricing_source: 'synthetic_zero_cost' }),
    async infer(request) {
      calls += 1;
      requests.push(structuredClone(request));
      if (input.fail === true) return { ok: false, error: 'SYNTHETIC_PROVIDER_FAILURE', retryable: false, actual_cost_eur: 0 };
      const research = Array.isArray(request.task?.context) && request.task.context.some((item) => item?.schema === 'aurentara.customer-ai.trusted-research-bundle.v1');
      return {
        ok: true,
        provider: provider.id,
        provider_model: 'synthetic-v1',
        logical_model: request.route?.logical_model || 'Luna',
        output: research ? output('Aktuelle Mindestlohnangaben müssen anhand der offiziellen Quelle geprüft werden [R1].') : output(),
        usage: { input_tokens: 0, output_tokens: 0 },
        actual_cost_eur: 0
      };
    }
  };
  return { provider, calls: () => calls, requests };
}

const store = createMemoryRuntimeStore();
const foundation = createCustomerAiFoundation({ store });
const tenantA = { tenant_id: 'tenant-hamyren-a', user_id: 'user-hamyren-a' };
const tenantB = { tenant_id: 'tenant-hamyren-b', user_id: 'user-hamyren-b' };
assert.equal((await foundation.createTenant({ tenant_id: tenantA.tenant_id, owner_user_id: tenantA.user_id, name: 'Synthetic HAMYREN A' })).ok, true);
assert.equal((await foundation.createTenant({ tenant_id: tenantB.tenant_id, owner_user_id: tenantB.user_id, name: 'Synthetic HAMYREN B' })).ok, true);
assert.equal((await foundation.createBusiness(tenantA, { business_id: 'business-a', name: 'Synthetic Café A', country: 'DE', language: 'de', currency: 'EUR' })).ok, true);
assert.equal((await foundation.createBusiness(tenantB, { business_id: 'business-b', name: 'Synthetic Service B', country: 'DE', language: 'de', currency: 'EUR' })).ok, true);
assert.equal((await foundation.addConfirmedMemory(tenantA, 'business-a', { fact_key: 'team_size', subject: 'Teamgröße', value: 8, category: 'EMPLOYEE', source_type: 'synthetic_test', confirmed_by_user: true })).ok, true);
assert.equal((await foundation.addConfirmedMemory(tenantB, 'business-b', { fact_key: 'private_marker', subject: 'Private marker', value: 'TENANT_B_MUST_NEVER_LEAK', category: 'SYSTEM', source_type: 'synthetic_test', confirmed_by_user: true })).ok, true);
const chatRuntime = createCustomerChatRuntime({ foundation, store: createMemoryRuntimeStore() });
assert.equal((await chatRuntime.createConversation(tenantA, 'business-a', { conversation_id: 'conversation-a', data_sensitivity: 'customer' })).ok, true);
assert.equal((await chatRuntime.createConversation(tenantB, 'business-b', { conversation_id: 'conversation-b', data_sensitivity: 'customer' })).ok, true);

const authorization = {
  real_customer_ai_processing_approved: true,
  legal_privacy_review_complete: true,
  data_processing_basis_approved: true,
  subprocessor_disclosure_approved: true,
  privacy_notice_version: 'hamyren-privacy-review-v1',
  customer_processing_channel_authorized: true,
  customer_processing_channel: 'controlled_pilot',
  paid_provider_execution_approved: false
};
const consent = new Map([
  [`${tenantA.tenant_id}:persistent_business_memory`, true],
  [`${tenantA.tenant_id}:trusted_research`, true],
  [`${tenantB.tenant_id}:persistent_business_memory`, true],
  [`${tenantB.tenant_id}:trusted_research`, true]
]);
const consentResolver = async ({ tenant_id, purpose }) => ({ granted: consent.get(`${tenant_id}:${purpose}`) === true, policy_version: 'hamyren-privacy-review-v1' });
const auditRows = [];
const providerA = providerFactory();
const economics = createCustomerEconomicsRuntime({ store: createMemoryRuntimeStore() });
const gate = createHamyrenRealCustomerAiProcessingGate({
  chat_runtime: chatRuntime,
  economics,
  providers: [providerA.provider],
  consent_resolver: consentResolver,
  audit_sink: async (event) => { auditRows.push(event); return { ok: true }; }
});

assert.equal(hamyrenRealCustomerAiProcessingManifest().processing_default_off, true);
assert.equal(aiFactoryV1Manifest().explicit_customer_processing_runtime_authorization, true);
const readiness = evaluateHamyrenRealCustomerAiProcessingReadiness({ legal_privacy_technical_readiness: true, public_surface_technical_readiness: true });
assert.equal(readiness.ok, true, JSON.stringify(readiness.failures));
assert.equal(readiness.real_customer_ai_processing_approved, false);

const directCustomerTask = {
  project: 'tenant-hamyren-a:business-a', task_id: 'direct-customer-block', task_type: 'analysis', capability: 'business.summary',
  objective: 'Synthetic customer-data safety check.', input: { message: 'Synthetic customer request' }, context: [], constraints: [], quality_rules: [], semantic_constraints: {},
  expected_output_schema: { type: 'object', required: ['answer'], properties: { answer: { type: 'string', minLength: 1 } }, additionalProperties: false },
  quality_level: 'Luna', latency_class: 'interactive', cost_limit: 0, data_sensitivity: 'customer', preferred_provider: providerA.provider.id, fallback_allowed: false, max_attempts: 1
};
let result = await runAIFactoryTask(directCustomerTask, { providers: [providerA.provider], production: false });
assert.equal(result.error, 'REAL_CUSTOMER_DATA_DISABLED');
assert.equal(providerA.calls(), 0);
result = await runAIFactoryTask(directCustomerTask, { providers: [providerA.provider], production: true, runtime_policy: { real_customer_data_approved: true } });
assert.equal(result.error, 'PRODUCTION_EXECUTION_DISABLED');
assert.equal(providerA.calls(), 0);

const baseInput = { message: 'Wie kann ich meinen Frühstücksumsatz steigern?', customer_ai_request: true, authorization, operation_id: 'happy-path', production_execution: true };
result = await gate.submit(tenantA, 'business-a', 'conversation-a', { ...baseInput, authorization: { ...authorization, real_customer_ai_processing_approved: false } });
assert.equal(result.error, 'REAL_CUSTOMER_AI_PROCESSING_APPROVAL_REQUIRED');
assert.equal(providerA.calls(), 0);
result = await gate.submit(tenantA, 'business-a', 'conversation-a', { ...baseInput, authorization: { ...authorization, legal_privacy_review_complete: false } });
assert.equal(result.error, 'LEGAL_PRIVACY_REVIEW_REQUIRED');
assert.equal(providerA.calls(), 0);

consent.set(`${tenantA.tenant_id}:persistent_business_memory`, false);
result = await gate.submit(tenantA, 'business-a', 'conversation-a', { ...baseInput, operation_id: 'no-consent' });
assert.equal(result.error, 'CUSTOMER_CONSENT_REQUIRED:persistent_business_memory');
assert.equal(providerA.calls(), 0);
consent.set(`${tenantA.tenant_id}:persistent_business_memory`, true);

result = await gate.submit(tenantA, 'business-b', 'conversation-b', { ...baseInput, operation_id: 'cross-tenant' });
assert.equal(result.ok, false);
assert.equal(providerA.calls(), 0);

const ineligible = providerFactory({ id: 'synthetic-ineligible', data_classes: ['synthetic'] });
const ineligibleGate = createHamyrenRealCustomerAiProcessingGate({ chat_runtime: chatRuntime, economics: createCustomerEconomicsRuntime({ store: createMemoryRuntimeStore() }), providers: [ineligible.provider], consent_resolver: consentResolver });
result = await ineligibleGate.submit(tenantA, 'business-a', 'conversation-a', { ...baseInput, operation_id: 'provider-ineligible' });
assert.equal(result.error, 'HAMYREN_CUSTOMER_DATA_PROVIDER_NOT_ELIGIBLE');
assert.equal(ineligible.calls(), 0);

result = await gate.submit(tenantA, 'business-a', 'conversation-a', {
  ...baseInput,
  operation_id: 'high-risk-no-research',
  message: 'Was ist heute der aktuelle Mindestlohn und was muss ich arbeitsrechtlich beachten?'
});
assert.equal(result.ok, false);
assert.equal(result.provider_called, false);
assert.equal(providerA.calls(), 0);

const exhaustedEconomics = createCustomerEconomicsRuntime({ store: createMemoryRuntimeStore() });
await exhaustedEconomics.ensureDefaultEntitlement(tenantA);
const exhaustion = await exhaustedEconomics.reserveCompute(tenantA, { operation_id: 'exhaust-budget', usage_class: 'customer_chat_turn', feature: 'business_ai_chat', compute_units: 20 });
assert.equal(exhaustion.ok, true);
const exhaustedGate = createHamyrenRealCustomerAiProcessingGate({ chat_runtime: chatRuntime, economics: exhaustedEconomics, providers: [providerA.provider], consent_resolver: consentResolver });
result = await exhaustedGate.submit(tenantA, 'business-a', 'conversation-a', { ...baseInput, operation_id: 'budget-block' });
assert.equal(result.error, 'FAIR_USE_COMPUTE_BUDGET_EXCEEDED');
assert.equal(providerA.calls(), 0);

result = await gate.submit(tenantA, 'business-a', 'conversation-a', baseInput);
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.provider_called, true);
assert.equal(result.customer_data_sent_to_provider, true);
assert.equal(result.operator_plane_shared, false);
assert.equal(result.ai.actual_provider_cost_eur, 0);
assert.equal(providerA.calls(), 1);
const serializedRequest = JSON.stringify(providerA.requests[0]);
assert.ok(serializedRequest.includes('tenant-hamyren-a'));
assert.ok(serializedRequest.includes('business-a'));
assert.ok(!serializedRequest.includes('TENANT_B_MUST_NEVER_LEAK'));
assert.ok(!serializedRequest.toLowerCase().includes('operator control plane data'));
assert.equal(providerA.requests[0].task.data_sensitivity, 'customer');

const officialSource = {
  source_id: 'official-minimum-wage',
  url: 'https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/mindestlohn.html',
  title: 'Synthetic official minimum wage evidence',
  publisher: 'BMAS',
  retrieved_at: new Date().toISOString(),
  evidence_text: 'Synthetic test evidence from an official source for minimum wage rules.',
  jurisdiction: 'DE'
};
result = await gate.submit(tenantA, 'business-a', 'conversation-a', {
  ...baseInput,
  operation_id: 'high-risk-with-research',
  message: 'Was ist heute beim Mindestlohn arbeitsrechtlich zu beachten?',
  trusted_research_sources: [officialSource]
});
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.trusted_research.required, true);
assert.equal(result.trusted_research.sufficient, true);
assert.equal(providerA.calls(), 2);

const failingProvider = providerFactory({ id: 'synthetic-failing-provider', fail: true });
const failureEconomics = createCustomerEconomicsRuntime({ store: createMemoryRuntimeStore() });
const failureGate = createHamyrenRealCustomerAiProcessingGate({ chat_runtime: chatRuntime, economics: failureEconomics, providers: [failingProvider.provider], consent_resolver: consentResolver });
const before = await failureEconomics.usageSnapshot(tenantA);
result = await failureGate.submit(tenantA, 'business-a', 'conversation-a', { ...baseInput, operation_id: 'provider-failure', preferred_provider: failingProvider.provider.id });
assert.equal(result.ok, false);
assert.equal(failingProvider.calls(), 1);
const after = await failureEconomics.usageSnapshot(tenantA);
assert.equal(after.usage.remaining_compute_units, before.usage.remaining_compute_units);

assert.ok(auditRows.length >= 2);
for (const row of auditRows) {
  assert.equal(row.message_logged, false);
  assert.equal(row.context_content_logged, false);
  assert.equal(row.prompt_content_logged, false);
  assert.equal(row.operator_plane_shared, false);
  assert.ok(!('message' in row));
}

console.log(JSON.stringify({
  suite: 'HAMYREN REAL CUSTOMER AI PROCESSING READINESS V1',
  status: 'PASS',
  ai_factory_default_customer_block_verified: true,
  explicit_customer_runtime_authorization_verified: true,
  legal_gate_before_provider_verified: true,
  consent_gate_before_provider_verified: true,
  cross_tenant_provider_calls: 0,
  high_risk_without_research_provider_calls: 0,
  fair_use_exhaustion_provider_calls: 0,
  customer_data_class_provider_gate_verified: true,
  bounded_tenant_context_provider_execution_verified: true,
  trusted_research_preprovider_gate_verified: true,
  provider_failure_compute_release_verified: true,
  redacted_processing_audit_verified: true,
  synthetic_provider_calls: providerA.calls() + failingProvider.calls(),
  real_customer_data: false,
  paid_provider_calls: 0,
  variable_cost_eur: 0,
  real_customer_ai_processing_approved: false,
  public_customer_surface_active: false
}, null, 2));
