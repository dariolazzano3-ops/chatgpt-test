import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createCustomerAiFoundation,
  createTrustedBusinessAiRuntime,
  classifyBusinessRisk,
  evaluateTrustedResearch
} from '../src/customer-ai/index.js';
import { createDeterministicTestProvider } from '../src/ai-provider-adapters-v1.js';

const foundationFixture = JSON.parse(await fs.readFile(new URL('../fixtures/aurentara/customer-ai-foundation-v1.json', import.meta.url), 'utf8'));
const researchFixture = JSON.parse(await fs.readFile(new URL('../fixtures/aurentara/trusted-research-v1.json', import.meta.url), 'utf8'));
assert.equal(foundationFixture.synthetic_only, true);
assert.equal(researchFixture.synthetic_only, true);
const a = foundationFixture.tenants[0];
const b = foundationFixture.tenants[1];
const ctxA = { tenant_id: a.tenant_id, user_id: a.owner_user_id };
const ctxB = { tenant_id: b.tenant_id, user_id: b.owner_user_id };
const foundation = createCustomerAiFoundation();
assert.equal((await foundation.createTenant(a)).ok, true);
assert.equal((await foundation.createTenant(b)).ok, true);
assert.equal((await foundation.createBusiness(ctxA, a.business)).ok, true);
assert.equal((await foundation.createBusiness(ctxB, b.business)).ok, true);

let inferenceCalls = 0;
let lastResearchBundle = null;
const provider = createDeterministicTestProvider({
  id: 'trusted-research-deterministic',
  scripted_response(request) {
    inferenceCalls += 1;
    lastResearchBundle = request.task.context.find((item) => item?.schema === 'aurentara.customer-ai.trusted-research-bundle.v1') || null;
    const needsResearch = Boolean(lastResearchBundle);
    return {
      answer: needsResearch
        ? 'Use the current official evidence [R1]. This is business guidance, not a substitute for qualified professional verification.'
        : 'Use the current tenant-scoped business context for this low-risk decision.',
      recommendations: [],
      follow_up_questions: [],
      memory_candidates: [],
      goal_proposals: [],
      decision_proposals: [],
      evidence_refs: [],
      needs_external_research: false,
      confidence: 0.9
    };
  }
});

const runtime = createTrustedBusinessAiRuntime({ foundation, providers: [provider] });
assert.equal(runtime.manifest().live_retrieval_provider_active, false);
assert.equal(runtime.manifest().risk_classification_before_inference, true);

assert.equal((await runtime.createConversation(ctxA, a.business.business_id, { conversation_id: 'trusted-a', data_sensitivity: 'synthetic' })).ok, true);
assert.equal((await runtime.createConversation(ctxB, b.business.business_id, { conversation_id: 'trusted-b', data_sensitivity: 'synthetic' })).ok, true);

const lowRisk = classifyBusinessRisk('How should I improve our breakfast offer?', { jurisdiction: 'DE' });
assert.equal(lowRisk.level, 'LOW');
assert.equal(lowRisk.trusted_research_required, false);
const lowTurn = await runtime.submitTrustedTurn(ctxA, a.business.business_id, 'trusted-a', { message: 'How should I improve our breakfast offer?' });
assert.equal(lowTurn.ok, true);
assert.equal(lowTurn.trusted_research.required, false);
assert.equal(lastResearchBundle, null);

const callsBeforeMissing = inferenceCalls;
const missing = await runtime.submitTrustedTurn(ctxA, a.business.business_id, 'trusted-a', { message: 'What is the current Mindestlohn and what should I pay a new employee?' });
assert.equal(missing.ok, false);
assert.equal(missing.status, 'BLOCKED');
assert.equal(missing.provider_inference_executed, false);
assert.equal(inferenceCalls, callsBeforeMissing);
assert.equal(missing.risk_classification.level, 'HIGH');

const stale = evaluateTrustedResearch({
  message: 'What is the current Mindestlohn?',
  risk: classifyBusinessRisk('What is the current Mindestlohn?', { jurisdiction: 'DE' }),
  sources: [researchFixture.sources.stale_official],
  reference_time_ms: Date.parse('2026-09-01T01:00:00Z')
});
assert.equal(stale.ok, false);
assert.equal(stale.usable_source_count, 0);

const weakCritical = evaluateTrustedResearch({
  message: 'What food safety shelf life rule applies?',
  risk: classifyBusinessRisk('What food safety shelf life rule applies?', { jurisdiction: 'DE' }),
  sources: [researchFixture.sources.weak_blog],
  reference_time_ms: Date.parse('2026-09-01T01:00:00Z')
});
assert.equal(weakCritical.ok, false);
assert.equal(weakCritical.error, 'CRITICAL_TOPIC_OFFICIAL_SOURCE_REQUIRED');

const trustedTurn = await runtime.submitTrustedTurn(ctxA, a.business.business_id, 'trusted-a', {
  message: 'What is the current Mindestlohn and what should I pay a new employee?',
  research_sources: [researchFixture.sources.german_minimum_wage_official],
  reference_time_ms: Date.parse('2026-09-01T01:00:00Z')
});
assert.equal(trustedTurn.ok, true);
assert.equal(trustedTurn.risk_classification.level, 'HIGH');
assert.equal(trustedTurn.trusted_research.sufficient, true);
assert.deepEqual(trustedTurn.trusted_research.citation_check.cited_ids, ['R1']);
assert.equal(trustedTurn.professional_escalation_required, true);
assert.equal(lastResearchBundle.sources.length, 1);
assert.equal(lastResearchBundle.sources[0].verified_official, true);

const maliciousSourceTurn = await runtime.submitTrustedTurn(ctxA, a.business.business_id, 'trusted-a', {
  message: 'What food safety shelf life rule applies to temperature-sensitive food?',
  research_sources: [researchFixture.sources.food_safety_official],
  reference_time_ms: Date.parse('2026-09-01T01:00:00Z')
});
assert.equal(maliciousSourceTurn.ok, true);
assert.equal(maliciousSourceTurn.risk_classification.level, 'CRITICAL');
assert.equal(lastResearchBundle.trust_boundary.malicious_source_text_detected, true);
assert.equal(lastResearchBundle.trust_boundary.source_instructions_never_override_runtime, true);

const currentMissing = await runtime.submitTrustedTurn(ctxA, a.business.business_id, 'trusted-a', { message: 'What are the latest market prices today?' });
assert.equal(currentMissing.ok, false);
assert.equal(currentMissing.risk_classification.currentness_required, true);

const crossTenant = await runtime.planTrustedTurn(ctxA, b.business.business_id, 'trusted-b', { message: 'What is the current Mindestlohn?' });
assert.equal(crossTenant.ok, false);
assert.equal(crossTenant.error, 'BUSINESS_ACCESS_DENIED');

const realConversation = await runtime.createConversation(ctxA, a.business.business_id, { conversation_id: 'trusted-real' });
assert.equal(realConversation.ok, true);
const callsBeforeReal = inferenceCalls;
const realBlocked = await runtime.submitTrustedTurn(ctxA, a.business.business_id, 'trusted-real', {
  message: 'What is the current Mindestlohn?',
  research_sources: [researchFixture.sources.german_minimum_wage_official],
  reference_time_ms: Date.parse('2026-09-01T01:00:00Z')
});
assert.equal(realBlocked.ok, false);
assert.equal(realBlocked.error, 'CUSTOMER_DATA_AI_EXECUTION_NOT_ACTIVATED');
assert.equal(inferenceCalls, callsBeforeReal);

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI TRUSTED RESEARCH & SAFETY RUNTIME V1',
  status: 'PASS',
  risk_classes_verified: ['LOW', 'HIGH', 'CRITICAL'],
  trusted_research_missing_blocks_before_inference: true,
  official_source_requirement_verified: true,
  stale_source_rejected: true,
  malicious_source_instruction_treated_as_data: true,
  citation_validation_verified: true,
  professional_escalation_metadata_verified: true,
  cross_tenant_leakage: 0,
  real_customer_provider_calls: 0,
  live_research_calls: 0,
  paid_api_calls: 0,
  variable_cost_eur: 0,
  production_changes: false
}, null, 2));
