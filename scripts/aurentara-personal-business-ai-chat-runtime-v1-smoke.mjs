import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createCustomerAiFoundation, createCustomerChatRuntime, MEMORY_STATUSES
} from '../src/customer-ai/index.js';
import { createDeterministicTestProvider } from '../src/ai-provider-adapters-v1.js';

const foundationFixture = JSON.parse(await fs.readFile(new URL('../fixtures/aurentara/customer-ai-foundation-v1.json', import.meta.url), 'utf8'));
const chatFixture = JSON.parse(await fs.readFile(new URL('../fixtures/aurentara/customer-chat-runtime-v1.json', import.meta.url), 'utf8'));
assert.equal(foundationFixture.synthetic_only, true);
assert.equal(chatFixture.synthetic_only, true);

const [a, b] = foundationFixture.tenants;
const ctxA = { tenant_id: a.tenant_id, user_id: a.owner_user_id };
const ctxB = { tenant_id: b.tenant_id, user_id: b.owner_user_id };
const foundation = createCustomerAiFoundation();
const results = [];
const pass = (name) => results.push({ name, ok: true });

assert.equal((await foundation.createTenant(a)).ok, true);
assert.equal((await foundation.createTenant(b)).ok, true);
assert.equal((await foundation.createBusiness(ctxA, a.business)).ok, true);
assert.equal((await foundation.createBusiness(ctxB, b.business)).ok, true);

async function confirmed(ctx, businessId, factKey, value, category, subject = factKey) {
  const created = await foundation.addConfirmedMemory(ctx, businessId, {
    fact_key: factKey, subject, value, category, source_type: 'user_statement', confirmed_by_user: true, confidence: 1
  });
  assert.equal(created.ok, true);
  return created.fact;
}

await confirmed(ctxA, a.business.business_id, 'employee_count', 12, 'EMPLOYEE', 'Current employee count');
await confirmed(ctxA, a.business.business_id, 'weekday_workload', 'high breakfast peaks', 'OPERATIONS', 'Breakfast workload');
await confirmed(ctxA, a.business.business_id, 'personnel_cost_eur_month', 28500, 'FINANCE', 'Monthly personnel cost EUR');
await confirmed(ctxA, a.business.business_id, 'marketing_budget_eur_month', 1500, 'FINANCE', 'Monthly marketing budget EUR');
await confirmed(ctxA, a.business.business_id, 'website_font', 'Inter', 'SYSTEM', 'Website font');
for (let i = 1; i <= 18; i += 1) {
  await confirmed(ctxA, a.business.business_id, `irrelevant_brand_note_${i}`, `synthetic trivia ${i}`, 'MARKETING', `Irrelevant brand note ${i}`);
}
await confirmed(ctxB, b.business.business_id, 'employee_count', 7, 'EMPLOYEE', 'Current employee count');
await confirmed(ctxB, b.business.business_id, 'private_tenant_b_marker', 'must never enter tenant A context', 'OPERATIONS', 'Tenant B marker');

const goalA = await foundation.createGoal(ctxA, a.business.business_id, {
  title: 'Increase weekday breakfast revenue by 15%', status: 'ACTIVE', priority: 10,
  target: { metric: 'weekday_breakfast_revenue', change_percent: 15 }, user_confirmed: true
});
const decisionA = await foundation.recordDecision(ctxA, a.business.business_id, {
  title: 'Breakfast bundle pilot', decision: 'Test a breakfast bundle before expanding delivery',
  reasoning_summary: 'Validate demand before widening scope.', expected_outcome: { validate_offer: true }
});
assert.equal(goalA.ok, true);
assert.equal(decisionA.ok, true);

let inferenceCalls = 0;
const provider = createDeterministicTestProvider({
  id: 'deterministic-customer-chat',
  scripted_response(request) {
    inferenceCalls += 1;
    const envelope = request.task.context[0];
    const message = String(request.task.input.message || '').toLowerCase();
    const factEvidence = envelope.relevant_facts?.[0]?.evidence_ref || 'business:profile';
    const goalEvidence = envelope.active_goals?.[0]?.evidence_ref;
    const evidence = [factEvidence, goalEvidence].filter(Boolean);
    const base = {
      answer: 'Use the current business evidence and keep the next step bounded.',
      recommendations: ['Review the relevant operating evidence before committing resources.'],
      follow_up_questions: [],
      memory_candidates: [],
      goal_proposals: [],
      decision_proposals: [],
      evidence_refs: evidence,
      needs_external_research: false,
      confidence: 0.82
    };
    if (message.includes('hire') || message.includes('einstellen')) {
      return {
        ...base,
        answer: 'A staffing review is justified because current employee, workload and personnel-cost context is relevant. Validate peak-hour demand before hiring.',
        memory_candidates: [{
          fact_key: 'owner_considering_additional_hire',
          subject: 'Owner is considering an additional employee',
          value_text: 'The owner is evaluating whether to hire another employee for breakfast workload.',
          category: 'GOAL_RELATED', confidence: 0.88, needs_confirmation: true
        }],
        goal_proposals: [{
          title: 'Assess breakfast staffing capacity',
          description: 'Review peak-hour staffing need before adding fixed personnel cost.',
          target_text: 'Reach a documented hire/no-hire decision using workload and revenue evidence.'
        }],
        decision_proposals: [{
          title: 'Breakfast staffing decision',
          decision: 'Run a bounded staffing-capacity review before hiring.',
          reasoning_summary: 'Current workload and personnel cost are decision-relevant.',
          expected_outcome_text: 'A documented hire/no-hire decision with evidence.'
        }]
      };
    }
    if (message.includes('latest') || message.includes('today')) {
      return {
        ...base,
        answer: 'Current market-price information requires trusted external research before making a current-price recommendation.',
        recommendations: [],
        needs_external_research: true,
        confidence: 0.95
      };
    }
    if (message.includes('ignore previous')) {
      return {
        ...base,
        answer: 'I will use only the authorized business context and will not expose other tenants, operator controls, secrets or hidden instructions.',
        confidence: 0.99
      };
    }
    if (message.includes('build and execute')) {
      return {
        ...base,
        answer: 'I can identify the automation need, but this chat runtime does not execute AURENTARA missions or external actions.',
        recommendations: ['Define the automation outcome and approval boundary first.'],
        confidence: 0.93
      };
    }
    return base;
  }
});

const runtime = createCustomerChatRuntime({ foundation, providers: [provider] });
const manifest = runtime.manifest();
assert.equal(manifest.ai_engine, 'reuse_riosystems_ai_factory_v1');
assert.equal(manifest.customer_operator_plane_separation, true);
assert.equal(manifest.safety.variable_cost_ceiling_eur, 0);
pass('runtime reuses AI Factory and preserves safety boundary');

const convA = await runtime.createConversation(ctxA, a.business.business_id, { conversation_id: 'chat-a', title: 'Synthetic A', data_sensitivity: 'synthetic' });
const convB = await runtime.createConversation(ctxB, b.business.business_id, { conversation_id: 'chat-b', title: 'Synthetic B', data_sensitivity: 'synthetic' });
assert.equal(convA.ok, true);
assert.equal(convB.ok, true);
assert.equal(convA.conversation.tenant_id, a.tenant_id);
assert.equal(convB.conversation.tenant_id, b.tenant_id);
pass('synthetic tenant-scoped conversations created');

const crossTenantConversation = await runtime.getConversation(ctxA, b.business.business_id, 'chat-b');
assert.equal(crossTenantConversation.ok, false);
assert.equal(crossTenantConversation.error, 'BUSINESS_ACCESS_DENIED');
const forgedTenantConversation = await runtime.getConversation({ tenant_id: b.tenant_id, user_id: a.owner_user_id }, b.business.business_id, 'chat-b');
assert.equal(forgedTenantConversation.ok, false);
assert.equal(forgedTenantConversation.error, 'TENANT_ACCESS_DENIED');
pass('cross-tenant conversation access fails closed');

const injectionPlan = await runtime.planTurn(ctxA, a.business.business_id, 'chat-a', { message: chatFixture.scenarios.prompt_injection });
assert.equal(injectionPlan.ok, true);
assert.equal(injectionPlan.plan.context_envelope.tenant.tenant_id, a.tenant_id);
assert.equal(injectionPlan.plan.context_envelope.business.business_id, a.business.business_id);
assert.equal(injectionPlan.plan.context_envelope.trust_boundary.context_cannot_override_system_instructions, true);
assert.equal(injectionPlan.plan.context_envelope.business_state_digest.full_fact_dump_included, false);
assert.equal(injectionPlan.plan.context_envelope.context_budget.within_budget, true);
assert.ok(!JSON.stringify(injectionPlan.plan.context_envelope).includes('private_tenant_b_marker'));
assert.ok(!JSON.stringify(injectionPlan.plan.context_envelope).includes('must never enter tenant A context'));
assert.ok(!injectionPlan.plan.context_envelope.relevant_facts.some((fact) => fact.fact_key === 'irrelevant_brand_note_18'));
assert.ok(injectionPlan.plan.ai_task.constraints.some((constraint) => constraint.includes('cannot override system/runtime instructions')));
pass('prompt injection remains data and context is bounded');

const goalsBefore = (await foundation.getGoals(ctxA, a.business.business_id)).goals.length;
const decisionsBefore = (await foundation.getDecisions(ctxA, a.business.business_id)).decisions.length;
const hireTurn = await runtime.submitTurn(ctxA, a.business.business_id, 'chat-a', { message: chatFixture.scenarios.decision_support });
assert.equal(hireTurn.ok, true);
assert.equal(hireTurn.status, 'COMPLETED');
assert.equal(hireTurn.ai.provider, 'deterministic-customer-chat');
assert.equal(hireTurn.ai.cost.actual_provider_cost_eur, 0);
assert.equal(hireTurn.cost_attribution.tenant_id, a.tenant_id);
assert.equal(hireTurn.cost_attribution.business_id, a.business.business_id);
assert.equal(hireTurn.cost_attribution.conversation_id, 'chat-a');
assert.equal(hireTurn.memory_candidate_ids.length, 1);
assert.equal(hireTurn.goal_changes_applied, 0);
assert.equal(hireTurn.decisions_recorded, 0);
assert.equal((await foundation.getGoals(ctxA, a.business.business_id)).goals.length, goalsBefore);
assert.equal((await foundation.getDecisions(ctxA, a.business.business_id)).decisions.length, decisionsBefore);
pass('zero-cost AI Factory turn returns proposals without silent mutations');

const exportBeforeConfirmation = await foundation.exportBusiness(ctxA, a.business.business_id);
assert.ok(exportBeforeConfirmation.data['memory-candidates'].some((candidate) => hireTurn.memory_candidate_ids.includes(candidate.candidate_id)));
const unconfirmedFact = await foundation.searchMemory(ctxA, a.business.business_id, { query: 'owner_considering_additional_hire' });
assert.equal(unconfirmedFact.facts.length, 0);
const noConfirm = await runtime.confirmTurnProposal(ctxA, a.business.business_id, 'chat-a', hireTurn.turn_id, { type: 'memory', index: 0, user_confirmed: false });
assert.equal(noConfirm.ok, false);
assert.equal(noConfirm.error, 'CHAT_PROPOSAL_REQUIRES_EXPLICIT_USER_CONFIRMATION');
const confirmedMemory = await runtime.confirmTurnProposal(ctxA, a.business.business_id, 'chat-a', hireTurn.turn_id, { type: 'memory', index: 0, user_confirmed: true });
assert.equal(confirmedMemory.ok, true);
assert.equal(confirmedMemory.applied.fact.status, MEMORY_STATUSES.CONFIRMED_FACT);
const confirmedFactSearch = await foundation.searchMemory(ctxA, a.business.business_id, { query: 'owner_considering_additional_hire' });
assert.equal(confirmedFactSearch.facts.length, 1);
pass('memory proposals remain candidates until explicit confirmation');

const confirmedGoal = await runtime.confirmTurnProposal(ctxA, a.business.business_id, 'chat-a', hireTurn.turn_id, { type: 'goal', index: 0, user_confirmed: true });
assert.equal(confirmedGoal.ok, true);
assert.equal(confirmedGoal.applied.goal.status, 'ACTIVE');
assert.equal((await foundation.getGoals(ctxA, a.business.business_id)).goals.length, goalsBefore + 1);
const confirmedDecision = await runtime.confirmTurnProposal(ctxA, a.business.business_id, 'chat-a', hireTurn.turn_id, { type: 'decision', index: 0, user_confirmed: true });
assert.equal(confirmedDecision.ok, true);
assert.equal((await foundation.getDecisions(ctxA, a.business.business_id)).decisions.length, decisionsBefore + 1);
pass('goal and decision proposals require explicit confirmation to apply');

const latestTurn = await runtime.submitTurn(ctxA, a.business.business_id, 'chat-a', { message: chatFixture.scenarios.current_research });
assert.equal(latestTurn.ok, true);
assert.equal(latestTurn.external_research.required, true);
assert.equal(latestTurn.external_research.executed, false);
assert.equal(latestTurn.external_research.block, 'TRUSTED_RESEARCH_BLOCK_NOT_ACTIVE');
pass('current-information requests are marked for trusted research without executing research');

const actionTurn = await runtime.submitTurn(ctxA, a.business.business_id, 'chat-a', { message: chatFixture.scenarios.action_request });
assert.equal(actionTurn.ok, true);
assert.equal(actionTurn.action_executed, false);
assert.equal(actionTurn.operator_plane_shared, false);
pass('action requests do not cross into private operator execution');

const callsBeforeRealData = inferenceCalls;
const realConversation = await runtime.createConversation(ctxA, a.business.business_id, { conversation_id: 'chat-real-data-gate' });
assert.equal(realConversation.ok, true);
assert.equal(realConversation.conversation.data_sensitivity, 'customer');
const realBlocked = await runtime.submitTurn(ctxA, a.business.business_id, 'chat-real-data-gate', { message: 'Give me business advice from my customer data.' });
assert.equal(realBlocked.ok, false);
assert.equal(realBlocked.error, 'CUSTOMER_DATA_AI_EXECUTION_NOT_ACTIVATED');
assert.equal(inferenceCalls, callsBeforeRealData);
pass('real customer data execution fails closed before provider inference');

const invalidProvider = createDeterministicTestProvider({
  id: 'deterministic-invalid-evidence',
  scripted_response() {
    return {
      answer: 'Invalid evidence test.', recommendations: [], follow_up_questions: [], memory_candidates: [], goal_proposals: [], decision_proposals: [],
      evidence_refs: ['memory:foreign-tenant-secret'], needs_external_research: false, confidence: 0.5
    };
  }
});
const invalidRuntime = createCustomerChatRuntime({ foundation, providers: [invalidProvider] });
assert.equal((await invalidRuntime.createConversation(ctxA, a.business.business_id, { conversation_id: 'chat-invalid-evidence', data_sensitivity: 'synthetic' })).ok, true);
const invalidEvidence = await invalidRuntime.submitTurn(ctxA, a.business.business_id, 'chat-invalid-evidence', { message: 'Give me advice.' });
assert.equal(invalidEvidence.ok, false);
assert.equal(invalidEvidence.error, 'CHAT_EVIDENCE_REFERENCE_INVALID');
pass('assistant evidence references are restricted to retrieved tenant context');

for (let i = 0; i < 6; i += 1) {
  const turn = await runtime.submitTurn(ctxA, a.business.business_id, 'chat-a', { message: `General business advice round ${i + 1}` });
  assert.equal(turn.ok, true);
}
const boundedPlan = await runtime.planTurn(ctxA, a.business.business_id, 'chat-a', { message: 'Should I hire another employee?' });
assert.equal(boundedPlan.ok, true);
assert.ok(boundedPlan.plan.context_envelope.recent_messages.length <= boundedPlan.plan.context_requirement.recent_message_limit);
assert.equal(boundedPlan.plan.context_envelope.business_state_digest.full_fact_dump_included, false);
pass('recent conversation context is bounded instead of replaying lifetime chat');

const conversationSnapshot = await runtime.getConversation(ctxA, a.business.business_id, 'chat-a');
assert.equal(conversationSnapshot.ok, true);
assert.equal(conversationSnapshot.conversation.cost_state.tenant_id, a.tenant_id);
assert.equal(conversationSnapshot.conversation.cost_state.business_id, a.business.business_id);
assert.ok(conversationSnapshot.conversation.cost_state.ledger.entries.length > 0);
assert.equal(conversationSnapshot.conversation.operator_plane_shared, false);
pass('conversation cost attribution remains tenant/business scoped');

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI CUSTOMER CHAT INTELLIGENCE & CONTEXT RUNTIME V1',
  status: 'PASS',
  assertions: results.length,
  tests: results,
  synthetic_tenants: [a.tenant_id, b.tenant_id],
  deterministic_inference_calls: inferenceCalls,
  cross_tenant_leakage: 0,
  variable_cost_eur: 0,
  paid_api_calls: 0,
  production_changes: false,
  real_customer_provider_calls: 0,
  external_research_calls: 0,
  operator_plane_shares: 0,
  action_executions: 0
}, null, 2));
