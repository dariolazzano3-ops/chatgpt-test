import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerAiFoundation } from '../src/customer-ai/foundation-v1.js';
import { buildHamyrenCustomerJourneyV1 } from '../src/customer-ai/customer-journey-commercial-routing-v1.js';
import { applyAurentaraDeliveryToHamyrenMemoryV1 } from '../src/customer-ai/delivery-memory-feedback-v1.js';

async function setup(scope = 'a') {
  const memory = createCustomerAiFoundation();
  const tenant_id = `synthetic-tenant-${scope}`;
  const business_id = `synthetic-business-${scope}`;
  const user_id = `synthetic-owner-${scope}`;
  const ctx = { tenant_id, user_id };
  assert.equal((await memory.createTenant({ tenant_id, owner_user_id: user_id, name: `Synthetic Tenant ${scope}` })).ok, true);
  assert.equal((await memory.createBusiness(ctx, { business_id, name: `Synthetic Business ${scope}`, country: 'DE' })).ok, true);
  return { memory, tenant_id, business_id, user_id, ctx };
}

function journeyFor({ tenant_id, business_id, capability = 'crm', goal = 'Implement the approved system.', success_criteria = ['Synthetic target stays measurable'] } = {}) {
  return buildHamyrenCustomerJourneyV1({
    tenant_id,
    business_id,
    activity: 'implementation',
    capability,
    customer_goal: goal,
    problem_statement: 'Synthetic implementation acceptance fixture.',
    requirements: { complexity: 'high', migration_required: true, integration_count: 3, business_critical: true },
    success_criteria
  });
}

function change({ operation = 'ADD', fact_key, value, category = 'SYSTEM', mutation_key, ...rest } = {}) {
  return { operation, mutation_key: mutation_key || `${operation}:${fact_key}`, fact_key, subject: fact_key, value, category,
    verification_state: 'VERIFIED', approval_state: 'APPROVED', component_status: 'COMPLETED', ...rest };
}
function task({ task_id, domain = 'business', capability = 'business_system_build', state = 'COMPLETED', changes = [], outputs = {} } = {}) {
  return { task_id, capability, domain, state, attempt: 1,
    outputs: { result: { synthetic: true }, business_state_changes: changes, ...outputs } };
}
function mission({ mission_id, project = 'synthetic-project', status = 'COMPLETED', tasks = [] } = {}) {
  return { mission_id, orchestration_id: `orchestration-${mission_id}`, prompt: 'Synthetic AURENTARA implementation delivery', project, status, tasks };
}
async function seed(memory, ctx, business_id, fact_key, value, category = 'SYSTEM') {
  const created = await memory.addConfirmedMemory(ctx, business_id, { fact_key, subject: fact_key, value, category,
    source_type: 'user_statement', confirmed_by_user: true, confidence: 1 });
  assert.equal(created.ok, true);
  return created.fact;
}
function currentFact(result, factKey) { return result.business_state.current_facts.find((fact) => fact.fact_key === factKey); }

test('CASE 1 successful CRM implementation becomes current business state with pipeline and integrations', async () => {
  const s = await setup('case1');
  const oldCrm = await seed(s.memory, s.ctx, s.business_id, 'current_crm', { name: 'Synthetic Legacy CRM', status: 'active' });
  const journey = journeyFor({ ...s, capability: 'crm', goal: 'Replace the legacy CRM with the approved CRM.' });
  const m = mission({ mission_id: 'mission-case1-crm', tasks: [task({ task_id: 'crm-delivery', changes: [
    change({ operation: 'REPLACE', fact_key: 'current_crm', expected_previous_value: oldCrm.value, value: { name: 'Synthetic CRM V2', status: 'active' } }),
    change({ fact_key: 'crm_pipeline', value: ['new', 'qualified', 'proposal', 'won'], category: 'OPERATIONS' }),
    change({ fact_key: 'crm_integrations', value: ['synthetic-email', 'synthetic-erp'] })
  ] })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(currentFact(result, 'current_crm').value.name, 'Synthetic CRM V2');
  assert.equal(currentFact(result, 'current_crm').supersedes, oldCrm.memory_id);
  assert.deepEqual(currentFact(result, 'crm_pipeline').value, ['new', 'qualified', 'proposal', 'won']);
  assert.deepEqual(currentFact(result, 'crm_integrations').value, ['synthetic-email', 'synthetic-erp']);
});

test('CASE 2 successfully replaced website is current and predecessor is traceable', async () => {
  const s = await setup('case2');
  const oldWebsite = await seed(s.memory, s.ctx, s.business_id, 'active_website', { stack: 'synthetic-legacy', status: 'active' });
  const journey = journeyFor({ ...s, capability: 'web', goal: 'Replace the website.' });
  const m = mission({ mission_id: 'mission-case2-web', tasks: [task({ task_id: 'web-delivery', domain: 'web', capability: 'website_build',
    changes: [change({ operation: 'REPLACE', fact_key: 'active_website', expected_previous_value: oldWebsite.value,
      value: { stack: 'synthetic-v2', status: 'active' } })], outputs: { project_slug: 'synthetic-v2', qa_status: 'PASSED' } })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(currentFact(result, 'active_website').value.stack, 'synthetic-v2');
  assert.equal(currentFact(result, 'active_website').supersedes, oldWebsite.memory_id);
});

test('CASE 3 failed automation cannot become a completed business fact', async () => {
  const s = await setup('case3');
  const journey = journeyFor({ ...s, capability: 'automation', goal: 'Add the approved automation.' });
  const m = mission({ mission_id: 'mission-case3-failed', status: 'FAILED', tasks: [task({ task_id: 'automation-failed', domain: 'automation',
    capability: 'automation_build', state: 'FAILED', changes: [change({ fact_key: 'lead_followup_automation', value: { status: 'live' }, category: 'OPERATIONS' })] })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(result.applied.length, 0);
  assert.equal(currentFact(result, 'lead_followup_automation'), undefined);
  assert.equal(result.current_state, 'IMPLEMENTATION_IN_PROGRESS');
});

test('CASE 4 partial implementation persists only verified completed components', async () => {
  const s = await setup('case4');
  const journey = journeyFor({ ...s, goal: 'Implement CRM and automation.' });
  const m = mission({ mission_id: 'mission-case4-partial', status: 'PARTIAL', tasks: [
    task({ task_id: 'crm-complete', changes: [change({ fact_key: 'crm_reporting', value: { status: 'active' } })] }),
    task({ task_id: 'automation-failed', domain: 'automation', state: 'FAILED', changes: [change({ fact_key: 'failed_automation', value: { status: 'active' }, category: 'OPERATIONS' })] })
  ] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(currentFact(result, 'crm_reporting').value.status, 'active');
  assert.equal(currentFact(result, 'failed_automation'), undefined);
  assert.equal(result.current_state, 'IMPLEMENTATION_IN_PROGRESS');
});

test('CASE 5 processing the same delivery twice is idempotent', async () => {
  const s = await setup('case5');
  const journey = journeyFor({ ...s });
  const m = mission({ mission_id: 'mission-case5-retry', tasks: [task({ task_id: 'retry-delivery',
    changes: [change({ fact_key: 'implemented_capability:crm', value: { available: true } })] })] });
  const first = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  const second = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.applied.length, 0);
  assert.ok(second.deduplicated.some((item) => item.reason === 'IDEMPOTENT_REPLAY'));
  const found = await s.memory.searchMemory(s.ctx, s.business_id, { query: 'implemented_capability:crm', include_historical: true });
  assert.equal(found.facts.filter((fact) => fact.fact_key === 'implemented_capability:crm').length, 1);
});

test('CASE 6 monitoring targets persist as pending measurement without fake performance outcome', async () => {
  const s = await setup('case6');
  const success = ['Synthetic lead response time below 10 minutes'];
  const journey = journeyFor({ ...s, goal: 'Implement CRM response workflow.', success_criteria: success });
  const m = mission({ mission_id: 'mission-case6-monitoring', project: 'project-case6', tasks: [task({ task_id: 'monitorable-delivery',
    changes: [change({ fact_key: 'lead_response_workflow', value: { status: 'active' }, category: 'OPERATIONS' })] })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(result.monitoring.memory.measurement_state, 'PENDING_MEASUREMENT');
  const monitoringFact = currentFact(result, 'implementation_monitoring:mission-case6-monitoring');
  assert.equal(monitoringFact.value.project_id, 'project-case6');
  assert.deepEqual(monitoringFact.value.monitoring_targets, success);
  assert.equal(monitoringFact.value.performance_outcome, null);
  assert.equal(result.monitoring.performance_outcome_recorded, false);
});

test('CASE 7 conflicting canonical state requires review instead of silent overwrite', async () => {
  const s = await setup('case7');
  await seed(s.memory, s.ctx, s.business_id, 'current_erp', { name: 'Synthetic ERP A', status: 'active' });
  const journey = journeyFor({ ...s, capability: 'crm', goal: 'Change connected ERP reference.' });
  const m = mission({ mission_id: 'mission-case7-conflict', tasks: [task({ task_id: 'erp-change',
    changes: [change({ operation: 'REPLACE', fact_key: 'current_erp', value: { name: 'Synthetic ERP B', status: 'active' } })] })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(result.applied.length, 0);
  assert.equal(result.review_required[0].reason, 'UPDATE_REQUIRES_REVIEW');
  assert.equal(currentFact(result, 'current_erp').value.name, 'Synthetic ERP A');
});

test('CASE 8 different tenants remain strictly isolated', async () => {
  const memory = createCustomerAiFoundation();
  const a = { tenant_id: 'synthetic-tenant-case8-a', business_id: 'synthetic-business-case8-a', user_id: 'owner-a' };
  const b = { tenant_id: 'synthetic-tenant-case8-b', business_id: 'synthetic-business-case8-b', user_id: 'owner-b' };
  for (const scope of [a, b]) {
    assert.equal((await memory.createTenant({ tenant_id: scope.tenant_id, owner_user_id: scope.user_id })).ok, true);
    assert.equal((await memory.createBusiness({ tenant_id: scope.tenant_id, user_id: scope.user_id }, { business_id: scope.business_id, name: scope.business_id })).ok, true);
  }
  const journeyA = journeyFor({ ...a });
  const deliveryA = mission({ mission_id: 'mission-case8-a', tasks: [task({ task_id: 'tenant-a-delivery', changes: [change({ fact_key: 'tenant_specific_system', value: 'A' })] })] });
  const forged = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory, ctx: { tenant_id: b.tenant_id, user_id: b.user_id }, journey: journeyA, mission: deliveryA });
  assert.equal(forged.ok, false);
  assert.equal(forged.error, 'TENANT_SCOPE_MISMATCH');
  const appliedA = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory, ctx: { tenant_id: a.tenant_id, user_id: a.user_id }, journey: journeyA, mission: deliveryA });
  assert.equal(appliedA.ok, true);
  const searchB = await memory.searchMemory({ tenant_id: b.tenant_id, user_id: b.user_id }, b.business_id, { query: 'tenant_specific_system' });
  assert.equal(searchB.ok, true);
  assert.equal(searchB.facts.length, 0);
});

test('CASE 9 completed AURENTARA_REQUIRED project refreshes HAMYREN context from implemented state', async () => {
  const s = await setup('case9');
  const journey = journeyFor({ ...s, capability: 'crm', goal: 'Migrate complex CRM and integrations.' });
  assert.equal(journey.outcome, 'AURENTARA_PROFESSIONAL');
  assert.equal(journey.capability_path.decision.implementation_execution_class, 'AURENTARA_REQUIRED');
  const m = mission({ mission_id: 'mission-case9-aurentara', tasks: [task({ task_id: 'aurentara-delivery',
    changes: [change({ fact_key: 'operating_crm', value: { name: 'Synthetic AURENTARA CRM', status: 'active' } })] })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(currentFact(result, 'operating_crm').value.name, 'Synthetic AURENTARA CRM');
  assert.ok(result.hamyren_context.relevant_facts.some((fact) => fact.fact_key === 'operating_crm'));
  assert.equal(result.new_mission_triggered, false);
});

test('CASE 10 raw execution noise is excluded and unverified observations are rejected', async () => {
  const s = await setup('case10');
  const journey = journeyFor({ ...s, capability: 'automation', goal: 'Implement customer-relevant automation.' });
  const m = mission({ mission_id: 'mission-case10-noise', tasks: [task({ task_id: 'noise-filter-delivery', domain: 'automation', capability: 'automation_build', changes: [
    change({ fact_key: 'customer_relevant_automation', value: { status: 'active' }, category: 'OPERATIONS' }),
    change({ fact_key: 'unverified_observation', value: 'must-not-persist', category: 'OTHER', verification_state: 'PROPOSED', approval_state: 'PENDING' }),
    change({ fact_key: 'raw_execution_log', value: { raw: 'must-not-persist-even-if-marked-verified' }, category: 'OTHER' })
  ], outputs: { automation_trace: [{ internal: 'RAW_INTERNAL_TRACE_SHOULD_NOT_ENTER_MEMORY', provider_response: 'synthetic-provider-noise' }],
    provider_response: { raw: 'RAW_PROVIDER_RESPONSE_SHOULD_NOT_ENTER_MEMORY' } } })] });
  const result = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory: s.memory, ctx: s.ctx, journey, mission: m });
  assert.equal(result.ok, true);
  assert.equal(currentFact(result, 'customer_relevant_automation').value.status, 'active');
  assert.equal(currentFact(result, 'unverified_observation'), undefined);
  assert.equal(currentFact(result, 'raw_execution_log'), undefined);
  assert.ok(result.rejected.some((item) => item.error === 'DELIVERY_CHANGE_NOT_VERIFIED'));
  assert.ok(result.rejected.some((item) => item.error === 'RAW_EXECUTION_NOISE_NOT_MEMORY'));
  const raw = await s.memory.searchMemory(s.ctx, s.business_id, { query: 'RAW_INTERNAL_TRACE_SHOULD_NOT_ENTER_MEMORY', include_historical: true });
  const provider = await s.memory.searchMemory(s.ctx, s.business_id, { query: 'RAW_PROVIDER_RESPONSE_SHOULD_NOT_ENTER_MEMORY', include_historical: true });
  assert.equal(raw.facts.length, 0);
  assert.equal(provider.facts.length, 0);
});
