import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCustomerAiFoundation, MEMORY_STATUSES } from '../src/customer-ai/index.js';
import { createCustomerCostAttribution, reserveCustomerCost, settleCustomerCost } from '../src/customer-ai/cost-attribution-v1.js';

const fixture = JSON.parse(await fs.readFile(new URL('../fixtures/aurentara/customer-ai-foundation-v1.json', import.meta.url), 'utf8'));
assert.equal(fixture.synthetic_only, true, 'fixture must be explicitly synthetic');

const api = createCustomerAiFoundation();
const [a, b] = fixture.tenants;
const ctxA = { tenant_id: a.tenant_id, user_id: a.owner_user_id };
const ctxB = { tenant_id: b.tenant_id, user_id: b.owner_user_id };
const results = [];
const pass = (name) => results.push({ name, ok: true });

const tenantA = await api.createTenant(a);
const tenantB = await api.createTenant(b);
assert.equal(tenantA.ok, true);
assert.equal(tenantB.ok, true);
const businessA = await api.createBusiness(ctxA, a.business);
const businessB = await api.createBusiness(ctxB, b.business);
assert.equal(businessA.ok, true);
assert.equal(businessB.ok, true);

async function confirmed(ctx, businessId, factKey, value, category, subject = factKey) {
  const created = await api.addConfirmedMemory(ctx, businessId, {
    fact_key: factKey,
    subject,
    value,
    category,
    source_type: 'user_statement',
    confirmed_by_user: true,
    confidence: 1
  });
  assert.equal(created.ok, true, `confirmed fact ${factKey} should be created`);
  return created.fact;
}

const aEmployee = await confirmed(ctxA, a.business.business_id, 'employee_count', a.facts.employee_count, 'EMPLOYEE', 'Current employee count');
const aBudgetOld = await confirmed(ctxA, a.business.business_id, 'marketing_budget_eur_month', a.facts.marketing_budget_eur_month, 'FINANCE', 'Monthly marketing budget EUR');
await confirmed(ctxA, a.business.business_id, 'weekday_workload', a.facts.weekday_workload, 'OPERATIONS', 'Weekday workload and breakfast peak');
await confirmed(ctxA, a.business.business_id, 'personnel_cost_eur_month', a.facts.personnel_cost_eur_month, 'FINANCE', 'Monthly personnel cost EUR');
await confirmed(ctxA, a.business.business_id, 'logo_color', a.facts.logo_color, 'MARKETING', 'Logo color');
await confirmed(ctxA, a.business.business_id, 'website_font', a.facts.website_font, 'SYSTEM', 'Website font');

await confirmed(ctxB, b.business.business_id, 'employee_count', b.facts.employee_count, 'EMPLOYEE', 'Current employee count');
await confirmed(ctxB, b.business.business_id, 'marketing_budget_eur_month', b.facts.marketing_budget_eur_month, 'FINANCE', 'Monthly marketing budget EUR');
await confirmed(ctxB, b.business.business_id, 'second_location', b.facts.second_location, 'BUSINESS_PROFILE', 'Has second location');

const goalA = await api.createGoal(ctxA, a.business.business_id, {
  title: a.goal, status: 'ACTIVE', priority: 10, target: { metric: 'weekday_breakfast_revenue', change_percent: 15 }, user_confirmed: true
});
const goalB = await api.createGoal(ctxB, b.business.business_id, {
  title: b.goal, status: 'ACTIVE', priority: 10, target: { metric: 'lead_response_time', direction: 'reduce' }, user_confirmed: true
});
assert.equal(goalA.ok, true);
assert.equal(goalB.ok, true);

const decisionA = await api.recordDecision(ctxA, a.business.business_id, {
  title: 'Breakfast bundle pilot', decision: a.decision,
  reasoning_summary: 'Validate breakfast demand before widening delivery scope.', expected_outcome: { validate_offer: true }
});
const decisionB = await api.recordDecision(ctxB, b.business.business_id, {
  title: 'Lead qualification standard', decision: b.decision,
  reasoning_summary: 'Reduce time lost on unqualified enquiries.', expected_outcome: { response_time: 'lower' }
});
assert.equal(decisionA.ok, true);
assert.equal(decisionB.ok, true);

// TEST 1 / 2: each tenant retrieves its own memory.
const ownA = await api.searchMemory(ctxA, a.business.business_id, {});
const ownB = await api.searchMemory(ctxB, b.business.business_id, {});
assert.equal(ownA.ok, true);
assert.equal(ownB.ok, true);
assert.ok(ownA.facts.length >= 6);
assert.ok(ownB.facts.length >= 3);
assert.ok(ownA.facts.every((fact) => fact.tenant_id === a.tenant_id));
assert.ok(ownB.facts.every((fact) => fact.tenant_id === b.tenant_id));
pass('1-2 own-tenant memory retrieval');

// TEST 3 / 4: cross-tenant memory access fails closed.
const aReadsB = await api.searchMemory(ctxA, b.business.business_id, {});
const bReadsA = await api.searchMemory(ctxB, a.business.business_id, {});
assert.equal(aReadsB.ok, false);
assert.equal(aReadsB.error, 'BUSINESS_ACCESS_DENIED');
assert.equal(bReadsA.ok, false);
assert.equal(bReadsA.error, 'BUSINESS_ACCESS_DENIED');
const forgedTenant = await api.searchMemory({ tenant_id: b.tenant_id, user_id: a.owner_user_id }, b.business.business_id, {});
assert.equal(forgedTenant.ok, false);
assert.equal(forgedTenant.error, 'TENANT_ACCESS_DENIED');
pass('3-4 cross-tenant memory denied');

// TEST 5: Tenant A cannot access Tenant B goals.
const foreignGoals = await api.getGoals(ctxA, b.business.business_id);
assert.equal(foreignGoals.ok, false);
assert.equal(foreignGoals.error, 'BUSINESS_ACCESS_DENIED');
pass('5 cross-tenant goals denied');

// TEST 6: Tenant A cannot access Tenant B decisions.
const foreignDecisions = await api.getDecisions(ctxA, b.business.business_id);
assert.equal(foreignDecisions.ok, false);
assert.equal(foreignDecisions.error, 'BUSINESS_ACCESS_DENIED');
pass('6 cross-tenant decisions denied');

// TEST 7: context is tenant/business scoped and cannot contain foreign facts.
const contextA = await api.getRelevantContext(ctxA, a.business.business_id, { query: 'employee breakfast marketing budget', max_facts: 8 });
assert.equal(contextA.ok, true);
assert.equal(contextA.context.tenant.tenant_id, a.tenant_id);
assert.equal(contextA.context.business.business_id, a.business.business_id);
assert.ok(contextA.context.relevant_facts.every((fact) => fact.tenant_id === a.tenant_id && fact.business_id === a.business.business_id));
assert.ok(!JSON.stringify(contextA.context).includes(b.business.name));
pass('7 tenant-scoped context package');

// TEST 8: semantic retrieval contract requires scope before/during retrieval.
const semantic = api.semanticRetrievalContract({ tenant_id: a.tenant_id, business_id: a.business.business_id });
const semanticMissing = api.semanticRetrievalContract({ business_id: a.business.business_id });
assert.equal(semantic.ok, true);
assert.equal(semantic.pre_filter_required, true);
assert.equal(semantic.forbidden_pattern, 'GLOBAL_SEARCH_THEN_POST_FILTER');
assert.deepEqual(semantic.allowed_query_scope, { tenant_id: a.tenant_id, business_id: a.business.business_id });
assert.equal(semanticMissing.ok, false);
assert.equal(semanticMissing.error, 'TENANT_SCOPE_REQUIRED');
pass('8 tenant-scoped semantic retrieval contract');

// TEST 9: customer cost entries cannot be attributed across tenant scope and reuse core ledger.
let costA = createCustomerCostAttribution({ tenant_id: a.tenant_id, business_id: a.business.business_id, limit_cost_units: 10 });
assert.equal(costA.ok, true);
assert.equal(costA.state.ledger.customer_id, a.tenant_id);
assert.equal(costA.state.ledger.project_id, a.business.business_id);
let reservedA = reserveCustomerCost(costA.state, {
  tenant_id: a.tenant_id, business_id: a.business.business_id, user_id: a.owner_user_id,
  reservation_id: 'synthetic-cost-a-1', provider_id: 'mock', model_id: 'mock-zero-cost', usage_class: 'customer_ai_test', estimated_cost_units: 1.2,
  conversation_id: 'synthetic-conversation-a', operation_id: 'synthetic-operation-a'
});
assert.equal(reservedA.ok, true);
const wrongCostScope = reserveCustomerCost(reservedA.state, {
  tenant_id: b.tenant_id, business_id: b.business.business_id, reservation_id: 'bad-cross-tenant', estimated_cost_units: 1
});
assert.equal(wrongCostScope.ok, false);
assert.equal(wrongCostScope.error, 'COST_SCOPE_MISMATCH');
const settledA = settleCustomerCost(reservedA.state, { tenant_id: a.tenant_id, business_id: a.business.business_id, reservation_id: 'synthetic-cost-a-1', actual_cost_units: 0 });
assert.equal(settledA.ok, true);
assert.equal(settledA.state.attribution['synthetic-cost-a-1'].tenant_id, a.tenant_id);
assert.equal(settledA.state.attribution['synthetic-cost-a-1'].actual_cost_units, 0);
pass('9 tenant-aware cost attribution reuses core ledger');

// TEST 10 / 11 / 13: correction supersedes current truth but keeps history traceable.
const correctedBudget = await api.correctMemory(ctxA, a.business.business_id, aBudgetOld.memory_id, { value: 1500, confirmed_by_user: true });
assert.equal(correctedBudget.ok, true);
assert.equal(correctedBudget.previous.status, MEMORY_STATUSES.HISTORICAL_FACT);
assert.equal(correctedBudget.previous.superseded_by, correctedBudget.current.memory_id);
assert.equal(correctedBudget.current.supersedes, aBudgetOld.memory_id);
const currentBudget = await api.searchMemory(ctxA, a.business.business_id, { query: 'marketing_budget_eur_month' });
assert.equal(currentBudget.facts.length, 1);
assert.equal(currentBudget.facts[0].value, 1500);
const historicalBudget = await api.searchMemory(ctxA, a.business.business_id, { query: 'marketing_budget_eur_month', include_historical: true });
assert.equal(historicalBudget.facts.length, 2);
assert.ok(historicalBudget.facts.some((fact) => fact.value === 1000 && fact.status === MEMORY_STATUSES.HISTORICAL_FACT));
assert.ok(historicalBudget.facts.some((fact) => fact.value === 1500 && fact.status === MEMORY_STATUSES.CONFIRMED_FACT));
pass('10-11-13 supersession, historical retrieval, corrected truth preference');

// TEST 12: inference never silently becomes a confirmed fact.
const inferred = await api.addInferredMemory(ctxA, a.business.business_id, {
  fact_key: 'estimated_weekend_customers', subject: 'Estimated weekend customers', value: 500, category: 'CUSTOMER', confidence: 0.55
});
assert.equal(inferred.ok, true);
assert.equal(inferred.fact.status, MEMORY_STATUSES.INFERRED_INFORMATION);
const illegalPromotion = await api.addConfirmedMemory(ctxA, a.business.business_id, {
  fact_key: 'estimated_weekend_customers', value: 500, category: 'CUSTOMER'
});
assert.equal(illegalPromotion.ok, false);
assert.equal(illegalPromotion.error, 'CONFIRMED_FACT_REQUIRES_EXPLICIT_CONFIRMATION');
const candidate = await api.createMemoryCandidate(ctxA, a.business.business_id, {
  fact_key: 'possible_supplier_discount', subject: 'Possible supplier discount', value: '5%', category: 'OPERATIONS', source_type: 'ai_inference', confidence: 0.6
});
assert.equal(candidate.ok, true);
const acceptedWithoutConfirmation = await api.acceptMemoryCandidate(ctxA, a.business.business_id, candidate.candidate.candidate_id, { confirmed_by_user: false });
assert.equal(acceptedWithoutConfirmation.ok, true);
assert.equal(acceptedWithoutConfirmation.fact.status, MEMORY_STATUSES.INFERRED_INFORMATION);
pass('12 inference cannot silently promote to confirmed fact');

// Conflict resolution: confirmed user fact outranks a conflicting inference with the same key.
const inferredEmployee = await api.addInferredMemory(ctxB, b.business.business_id, {
  fact_key: 'employee_count', subject: 'AI inferred employee count', value: 10, category: 'EMPLOYEE', confidence: 0.7
});
assert.equal(inferredEmployee.ok, true);
const stateB = await api.getBusinessState(ctxB, b.business.business_id);
assert.equal(stateB.ok, true);
const employeeTruthB = stateB.snapshot.current_facts.find((fact) => fact.fact_key === 'employee_count');
assert.equal(employeeTruthB.value, 7);
assert.equal(employeeTruthB.status, MEMORY_STATUSES.CONFIRMED_FACT);
pass('conflicting confirmed fact outranks AI inference');

// TEST 14: deleted memory disappears from normal retrieval/context.
const deletable = await confirmed(ctxA, a.business.business_id, 'temporary_campaign_note', 'retire this note', 'MARKETING');
const deleted = await api.deleteMemory(ctxA, a.business.business_id, deletable.memory_id, { reason: 'synthetic deletion test' });
assert.equal(deleted.ok, true);
const deletedSearch = await api.searchMemory(ctxA, a.business.business_id, { query: 'temporary_campaign_note', include_historical: true });
assert.equal(deletedSearch.facts.length, 0);
const deletedContext = await api.getRelevantContext(ctxA, a.business.business_id, { query: 'temporary campaign note', max_facts: 20, include_historical: true });
assert.ok(!deletedContext.context.relevant_facts.some((fact) => fact.memory_id === deletable.memory_id));
pass('14 deleted active memory excluded from normal retrieval');

// TEST 15: unauthorized cross-business access is rejected.
const crossBusinessState = await api.getBusinessState(ctxA, b.business.business_id);
assert.equal(crossBusinessState.ok, false);
assert.equal(crossBusinessState.error, 'BUSINESS_ACCESS_DENIED');
pass('15 unauthorized cross-business access rejected');

// Relevance test: employee/hiring context wins over visual-brand trivia when bounded.
const relevance = await api.getRelevantContext(ctxA, a.business.business_id, {
  query: 'Should I hire another employee because staff workload and personnel cost are high?', max_facts: 4, max_goals: 3, max_decisions: 3
});
assert.equal(relevance.ok, true);
const selectedKeys = relevance.context.relevant_facts.map((fact) => fact.fact_key);
assert.ok(selectedKeys.includes('employee_count'));
assert.ok(selectedKeys.includes('weekday_workload'));
assert.ok(selectedKeys.includes('personnel_cost_eur_month'));
assert.ok(!selectedKeys.includes('logo_color'));
assert.ok(!selectedKeys.includes('website_font'));
assert.ok(relevance.context.relevant_facts.length <= 4);
pass('bounded deterministic memory relevance selection');

// Business state snapshot test: current truth + goals + decisions, no superseded fact as current.
const stateA = await api.getBusinessState(ctxA, a.business.business_id);
assert.equal(stateA.ok, true);
assert.equal(stateA.snapshot.tenant_id, a.tenant_id);
assert.equal(stateA.snapshot.business.business_id, a.business.business_id);
const stateBudget = stateA.snapshot.current_facts.find((fact) => fact.fact_key === 'marketing_budget_eur_month');
assert.equal(stateBudget.value, 1500);
assert.ok(!stateA.snapshot.current_facts.some((fact) => fact.memory_id === aBudgetOld.memory_id));
assert.ok(stateA.snapshot.active_goals.some((goal) => goal.goal_id === goalA.goal.goal_id));
assert.ok(stateA.snapshot.decisions.some((decision) => decision.decision_id === decisionA.decision.decision_id));
assert.ok(stateA.snapshot.provenance_refs.some((ref) => ref.memory_id === stateBudget.memory_id));
pass('current business state snapshot with provenance');

// Goal integrity: meaningful goal changes require explicit user confirmation and are audited.
const silentGoalChange = await api.updateGoal(ctxA, a.business.business_id, goalA.goal.goal_id, { target: { metric: 'weekday_breakfast_revenue', change_percent: 30 } });
assert.equal(silentGoalChange.ok, false);
assert.equal(silentGoalChange.error, 'GOAL_CHANGE_REQUIRES_USER_CONFIRMATION');
const confirmedGoalChange = await api.updateGoal(ctxA, a.business.business_id, goalA.goal.goal_id, { target: { metric: 'weekday_breakfast_revenue', change_percent: 18 }, user_confirmed: true });
assert.equal(confirmedGoalChange.ok, true);
pass('goal changes are explicit and auditable');

// Decision outcomes store concise outcome, not model chain-of-thought.
const outcome = await api.recordDecisionOutcome(ctxA, a.business.business_id, decisionA.decision.decision_id, { actual_outcome: { breakfast_bundle_conversion_percent: 12 } });
assert.equal(outcome.ok, true);
assert.equal(outcome.decision.status, 'OUTCOME_RECORDED');
pass('decision outcome memory');

// Audit, export and deletion readiness remain scoped.
const auditA = await api.getAudit(ctxA, a.business.business_id);
assert.equal(auditA.ok, true);
assert.ok(auditA.events.length > 0);
assert.ok(auditA.events.every((event) => event.tenant_id === a.tenant_id && event.business_id === a.business.business_id));
assert.ok(auditA.events.some((event) => event.action === 'memory.corrected'));
assert.ok(auditA.events.some((event) => event.action === 'memory.deleted'));
assert.ok(auditA.events.some((event) => event.action === 'goal.changed'));
const exportA = await api.exportBusiness(ctxA, a.business.business_id);
assert.equal(exportA.ok, true);
assert.equal(exportA.tenant_id, a.tenant_id);
assert.ok(!JSON.stringify(exportA).includes(b.business.name));
const deletionPlan = await api.buildDeletionPlan(ctxA, a.business.business_id);
assert.equal(deletionPlan.ok, true);
assert.deepEqual(deletionPlan.plan.vector_index_scope, { tenant_id: a.tenant_id, business_id: a.business.business_id });
assert.equal(deletionPlan.plan.cache_scope_prefix, `${a.tenant_id}:${a.business.business_id}:`);
assert.equal(deletionPlan.plan.production_executor_implemented, false);
pass('tenant-scoped audit, export and deletion readiness');

const manifest = api.manifest();
assert.equal(manifest.customer_data_plane, 'separate_from_operator_control_plane');
assert.equal(manifest.operator_credentials_reused, false);
assert.equal(manifest.paid_provider_required, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI FOUNDATION V1',
  status: 'PASS',
  assertions: results.length,
  tests: results,
  synthetic_tenants: [a.tenant_id, b.tenant_id],
  cross_tenant_leakage: 0,
  paid_api_calls: 0,
  production_changes: false,
  real_customer_data: false,
  vector_infrastructure_activated: false,
  customer_operator_plane_separation: true
}, null, 2));
