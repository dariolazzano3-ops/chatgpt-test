import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRuntimeStore } from '../src/durable-runtime-store.js';
import { createCustomerEconomicsRuntime, CUSTOMER_PLAN_CATALOG_V1, customerEconomicsManifest } from '../src/customer-product/economics-v1.js';
import {
  createBuildCreditEntitlementExtension,
  estimateBuildCreditsV1,
  evaluateBuildCreditEconomicsV1,
  customerSafeBuildCreditPresentationV1,
  classifyHamyrenFairUseV1,
  buildCreditEntitlementManifestV1,
  HAMYREN_BUILD_CREDIT_COMMERCIAL_WORKING_MODEL_V1
} from '../src/customer-product/build-credit-entitlement-v1.js';
import { prepareHamyrenBuildCreditJourneyV1, customerSafeHamyrenBuildCreditJourneyV1 } from '../src/customer-ai/build-credit-journey-integration-v1.js';
import { buildHamyrenCustomerJourneyV1 } from '../src/customer-ai/customer-journey-commercial-routing-v1.js';
import { createCustomerAiFoundation } from '../src/customer-ai/foundation-v1.js';
import { applyAurentaraDeliveryToHamyrenMemoryV1, aurentaraDeliveryMemoryFeedbackManifestV1 } from '../src/customer-ai/delivery-memory-feedback-v1.js';
import { compileMissionPackage, missionCompilerManifest } from '../src/mission-compiler.js';

function economicsHarness(suffix) {
  const store = createMemoryRuntimeStore();
  const economics = createCustomerEconomicsRuntime({ store });
  const credits = createBuildCreditEntitlementExtension({ store, economics });
  const ctx = { tenant_id: `synthetic-credit-${suffix}`, user_id: `owner-${suffix}`, business_id: `business-${suffix}` };
  return { store, economics, credits, ctx };
}
function lowWeb(extra = {}) {
  return estimateBuildCreditsV1({ activity: 'implementation', capability: 'web', complexity: 'low', risk_class: 'low', integration_count: 0, ...extra });
}
async function grantPurchased(h, credits, id) {
  const result = await h.credits.grantPurchasedBuildCredits(h.ctx, { credits, grant_id: id, source: 'synthetic_test' });
  assert.equal(result.ok, true);
  return result;
}
function change(fact_key, value, extra = {}) {
  return { operation: 'ADD', mutation_key: `ADD:${fact_key}`, fact_key, subject: fact_key, value, category: 'SYSTEM', verification_state: 'VERIFIED', approval_state: 'APPROVED', component_status: 'COMPLETED', ...extra };
}
function mission({ id, status = 'COMPLETED', tasks = [] }) {
  return { mission_id: id, orchestration_id: `orchestration-${id}`, prompt: 'Synthetic zero-cost acceptance delivery', project: 'synthetic-final-closing', status, tasks };
}
function task({ id, state = 'COMPLETED', changes = [], outputs = {}, capability = 'business_system_build', domain = 'business' }) {
  return { task_id: id, capability, domain, state, attempt: 1, outputs: { result: { synthetic: true }, business_state_changes: changes, ...outputs } };
}

// Commercial reconciliation and wallet grants.
test('Starter has zero included Build Credits', async () => {
  const h = economicsHarness('starter');
  assert.equal((await h.economics.ensureDefaultEntitlement(h.ctx)).ok, true);
  const grant = await h.credits.grantMonthlyIncludedBuildCredit(h.ctx, { period: '2026-09', subscription_id: 'starter-period', subscription_period_status: 'SUCCESSFUL', source: 'synthetic_test' });
  assert.equal(grant.ok, true); assert.equal(grant.granted, 0);
  const snapshot = await h.credits.buildCreditSnapshot(h.ctx);
  assert.equal(snapshot.credits.sources.INCLUDED.available, 0);
});

test('Pro compatibility receives one monthly included Credit, duplicate-safe, capped at three', async () => {
  const h = economicsHarness('pro');
  await h.economics.ensureDefaultEntitlement(h.ctx);
  assert.equal((await h.economics.assignPreviewPlan(h.ctx, CUSTOMER_PLAN_CATALOG_V1.PERSONAL_BUSINESS_AI_FOUNDER.plan_id, { source: 'synthetic_test' })).ok, true);
  for (const period of ['2026-09','2026-10','2026-11']) {
    const grant = await h.credits.grantMonthlyIncludedBuildCredit(h.ctx, { period, subscription_id: 'pro-sub', subscription_period_status: 'SUCCESSFUL', source: 'synthetic_test' });
    assert.equal(grant.granted, 1);
  }
  const duplicate = await h.credits.grantMonthlyIncludedBuildCredit(h.ctx, { period: '2026-11', subscription_id: 'pro-sub', subscription_period_status: 'SUCCESSFUL', source: 'synthetic_test' });
  assert.equal(duplicate.duplicate, true);
  const capped = await h.credits.grantMonthlyIncludedBuildCredit(h.ctx, { period: '2026-12', subscription_id: 'pro-sub', subscription_period_status: 'SUCCESSFUL', source: 'synthetic_test' });
  assert.equal(capped.granted, 0); assert.equal(capped.cap_reached, true);
  const snapshot = await h.credits.buildCreditSnapshot(h.ctx);
  assert.equal(snapshot.credits.sources.INCLUDED.available, 3);
});

test('Purchased wallet remains separate and is never lost at Included cap', async () => {
  const h = economicsHarness('sources');
  await h.economics.ensureDefaultEntitlement(h.ctx);
  await h.economics.assignPreviewPlan(h.ctx, CUSTOMER_PLAN_CATALOG_V1.PERSONAL_BUSINESS_AI_FOUNDER.plan_id, { source: 'synthetic_test' });
  for (const period of ['2026-09','2026-10','2026-11','2026-12']) await h.credits.grantMonthlyIncludedBuildCredit(h.ctx, { period, subscription_id: 'sub', subscription_period_status: 'SUCCESSFUL', source: 'synthetic_test' });
  await grantPurchased(h, 5, 'synthetic-pack-5');
  const snapshot = await h.credits.buildCreditSnapshot(h.ctx);
  assert.equal(snapshot.credits.sources.INCLUDED.available, 3);
  assert.equal(snapshot.credits.sources.PURCHASED.available, 5);
});

// Reservation / settlement / retry.
test('Successful 1-Credit build reserves then consumes exactly once and retry does not double-charge', async () => {
  const h = economicsHarness('success'); await h.economics.ensureDefaultEntitlement(h.ctx); await grantPurchased(h, 1, 'one');
  const estimate = lowWeb(); assert.equal(estimate.credit_estimate, 1);
  const first = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'op-success', estimate }); assert.equal(first.ok, true);
  const replay = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'op-success', estimate }); assert.equal(replay.duplicate, true);
  const retry = await h.credits.noteBuildCreditRetry(h.ctx, { reservation_id: first.reservation.reservation_id }); assert.equal(retry.additional_credits_charged, 0);
  const settled = await h.credits.settleBuildCredits(h.ctx, { reservation_id: first.reservation.reservation_id, outcome: 'SUCCESS', actual_direct_cost_eur: 4 });
  assert.equal(settled.reservation.consumed_credits, 1);
  const duplicateSettlement = await h.credits.settleBuildCredits(h.ctx, { reservation_id: first.reservation.reservation_id, outcome: 'SUCCESS' }); assert.equal(duplicateSettlement.duplicate, true);
  const snapshot = await h.credits.buildCreditSnapshot(h.ctx); assert.equal(snapshot.credits.consumed, 1); assert.equal(snapshot.credits.reserved, 0);
});

test('System failure restores reservation', async () => {
  const h = economicsHarness('failure'); await h.economics.ensureDefaultEntitlement(h.ctx); await grantPurchased(h, 1, 'one');
  const reserved = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'op-fail', estimate: lowWeb() });
  const settled = await h.credits.settleBuildCredits(h.ctx, { reservation_id: reserved.reservation.reservation_id, outcome: 'SYSTEM_FAILURE' });
  assert.equal(settled.reservation.restored_credits, 1);
  const snapshot = await h.credits.buildCreditSnapshot(h.ctx); assert.equal(snapshot.credits.available, 1); assert.equal(snapshot.credits.restored, 1); assert.equal(snapshot.credits.consumed, 0);
});

test('Partial modular build consumes successful portion and restores failed portion', async () => {
  const h = economicsHarness('partial'); await h.economics.ensureDefaultEntitlement(h.ctx); await grantPurchased(h, 3, 'three');
  const estimate = lowWeb({ module_credit_allocations: [1,2], modular: true }); assert.equal(estimate.credit_estimate, 3);
  const reserved = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'op-partial', estimate });
  const settled = await h.credits.settleBuildCredits(h.ctx, { reservation_id: reserved.reservation.reservation_id, outcome: 'PARTIAL', modules: [{ module: 'lead-form', credits: 1, status: 'SUCCESS' }, { module: 'crm-link', credits: 2, status: 'FAILED' }] });
  assert.equal(settled.reservation.consumed_credits, 1); assert.equal(settled.reservation.restored_credits, 2);
  const snapshot = await h.credits.buildCreditSnapshot(h.ctx); assert.equal(snapshot.credits.consumed, 1); assert.equal(snapshot.credits.available, 2);
});

test('Insufficient balance prevents reservation', async () => {
  const h = economicsHarness('insufficient'); await h.economics.ensureDefaultEntitlement(h.ctx);
  const result = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'op-none', estimate: lowWeb() });
  assert.equal(result.ok, false); assert.equal(result.error, 'INSUFFICIENT_BUILD_CREDITS');
});

// Policy and economic boundaries.
test('Enough Credits never bypass AURENTARA_REQUIRED policy and migration always escalates', async () => {
  const h = economicsHarness('policy'); await h.economics.ensureDefaultEntitlement(h.ctx); await grantPurchased(h, 5, 'five');
  const estimate = estimateBuildCreditsV1({ activity: 'implementation', capability: 'crm', complexity: 'high', migration_required: true, integration_count: 3, module_credit_allocations: [3] });
  assert.equal(estimate.aurentara_required, true);
  const result = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'op-migration', estimate });
  assert.equal(result.ok, false); assert.equal(result.error, 'AURENTARA_REQUIRED'); assert.equal(result.credits_bypassed_policy, false);
});

test('8 Credit estimate routes to AURENTARA_REQUIRED', () => {
  const estimate = lowWeb({ module_credit_allocations: [3,3,2], modular: true });
  assert.equal(estimate.credit_estimate, 8); assert.equal(estimate.aurentara_required, true);
});

test('6 to 7 Credit modular project triggers review before reservation', () => {
  for (const allocations of [[3,3],[3,3,1]]) {
    const estimate = lowWeb({ module_credit_allocations: allocations, modular: true });
    assert.ok(estimate.credit_estimate >= 6 && estimate.credit_estimate <= 7); assert.equal(estimate.review_required, true); assert.equal(estimate.aurentara_required, false);
  }
});

test('Three bounded standardized systems may remain candidate while tightly coupled systems escalate', () => {
  const bounded = estimateBuildCreditsV1({ activity: 'implementation', capability: 'web', required_capabilities: ['web','crm','automation'], system_count: 3, complexity: 'low', integration_count: 0, modular: true, standardized_template_available: true });
  assert.equal(bounded.bounded_system_count, 3); assert.equal(bounded.aurentara_required, false); assert.equal(bounded.self_service_candidate, true);
  const coupled = estimateBuildCreditsV1({ activity: 'implementation', capability: 'web', required_capabilities: ['web','crm','automation'], system_count: 3, complexity: 'low', integration_count: 0, modular: false, materially_interdependent_systems: true });
  assert.equal(coupled.aurentara_required, true); assert.ok(coupled.reason_codes.includes('MATERIALLY_INTERDEPENDENT_MULTI_SYSTEM'));
});

test('Projected direct cost above EUR 12 per Credit requires economic review', () => {
  const economics = evaluateBuildCreditEconomicsV1({ credits: 1, projected_direct_cost_eur: 12.01 });
  assert.equal(economics.review_required, true); assert.equal(economics.economic_status, 'MANDATORY_ECONOMIC_REVIEW'); assert.equal(economics.health, 'ECONOMIC_REVIEW');
});

test('Cross-tenant reservation access is rejected and cannot inspect another tenant wallet', async () => {
  const h = economicsHarness('tenant-a'); await h.economics.ensureDefaultEntitlement(h.ctx); await grantPurchased(h, 1, 'one');
  const reserved = await h.credits.reserveBuildCredits(h.ctx, { operation_id: 'tenant-a-op', estimate: lowWeb() });
  const forged = { tenant_id: 'synthetic-credit-tenant-b', user_id: 'owner-b', business_id: h.ctx.business_id };
  const otherSnapshot = await h.credits.buildCreditSnapshot(forged); assert.equal(otherSnapshot.credits.available, 0); assert.equal(otherSnapshot.reservations.length, 0);
  const attempted = await h.credits.settleBuildCredits(forged, { reservation_id: reserved.reservation.reservation_id, outcome: 'SUCCESS' });
  assert.equal(attempted.ok, false); assert.equal(attempted.error, 'BUILD_CREDIT_RESERVATION_NOT_FOUND');
});

test('Customer-safe response hides raw economics and internal risk details', () => {
  const estimate = lowWeb({ projected_direct_cost_eur: 4.5 });
  const safe = customerSafeBuildCreditPresentationV1(estimate), serialized = JSON.stringify(safe);
  assert.equal(safe.build_credits_required, 1); assert.equal(serialized.includes('projected_direct_cost'), false); assert.equal(serialized.includes('risk_class'), false); assert.equal(serialized.includes('provider'), false);
});

test('Fair use is diagnostic and creates no message quota or quality reduction', () => {
  assert.equal(classifyHamyrenFairUseV1({ repetitive_operations: 1 }).band, 'NORMAL');
  const heavy = classifyHamyrenFairUseV1({ machine_speed: true }); assert.equal(heavy.band, 'AUTOMATION_LIKE'); assert.equal(heavy.quota_created, false); assert.equal(heavy.quality_reduced, false);
});

test('No payment provider, checkout, billing or real purchase is activated', async () => {
  const manifest = buildCreditEntitlementManifestV1(), economics = customerEconomicsManifest();
  assert.equal(manifest.payment_provider_active, false); assert.equal(manifest.checkout_active, false); assert.equal(manifest.billing_active, false); assert.equal(manifest.real_transactions_active, false);
  assert.equal(economics.payment_provider_active, false); assert.equal(economics.stripe_active, false); assert.equal(HAMYREN_BUILD_CREDIT_COMMERCIAL_WORKING_MODEL_V1.public_pricing, false);
  const h = economicsHarness('real-purchase'); await h.economics.ensureDefaultEntitlement(h.ctx);
  const rejected = await h.credits.grantPurchasedBuildCredits(h.ctx, { credits: 1, grant_id: 'real', source: 'payment_confirmed' }); assert.equal(rejected.ok, false); assert.equal(rejected.error, 'BUILD_CREDIT_REAL_PURCHASE_NOT_ACTIVATED');
});

// Customer Journey integration.
test('Canonical Customer Journey is reused and customer presentation stays safe', () => {
  const integrated = prepareHamyrenBuildCreditJourneyV1({ tenant_id: 'journey-tenant', business_id: 'journey-business', activity: 'implementation', capability: 'web', customer_goal: 'Create a simple lead form', requirements: { complexity: 'low', integration_count: 0 } });
  assert.equal(integrated.canonical_customer_journey_reused, true); assert.equal(integrated.second_journey_created, false);
  assert.equal(integrated.journey.schema_version, 'hamyren-aurentara.customer-journey.v1'); assert.equal(integrated.customer_build_credit.build_credits_required, 1);
  const safe = customerSafeHamyrenBuildCreditJourneyV1(integrated), serialized = JSON.stringify(safe);
  assert.equal(serialized.includes('projected_direct_cost'), false); assert.equal(safe.billing_enabled, false); assert.equal(safe.production_deploy, false);
});

test('AURENTARA-required journey skips ordinary Self-Service Credit execution', () => {
  const integrated = prepareHamyrenBuildCreditJourneyV1({ tenant_id: 'journey-a', business_id: 'business-a', activity: 'implementation', capability: 'crm', customer_goal: 'Migrate legacy CRM', requirements: { complexity: 'high', migration_required: true, integration_count: 4 } });
  assert.equal(integrated.journey.outcome, 'AURENTARA_PROFESSIONAL'); assert.equal(integrated.customer_build_credit.route, 'AURENTARA_PROFESSIONAL'); assert.equal(integrated.customer_build_credit.build_credits_required, null);
});

// Final cross-system acceptance: memory -> journey -> policy/economics -> reservation -> mission -> delivery -> memory -> refreshed context.
test('HAMYREN standard project preserves canonical mission/delivery/memory flow and refreshes Business State', async () => {
  const memory = createCustomerAiFoundation();
  const ids = { tenant_id: 'final-loop-tenant', user_id: 'final-loop-owner', business_id: 'final-loop-business' };
  assert.equal((await memory.createTenant({ tenant_id: ids.tenant_id, owner_user_id: ids.user_id, name: 'Final Loop Tenant' })).ok, true);
  assert.equal((await memory.createBusiness(ids, { business_id: ids.business_id, name: 'Synthetic Final Business', country: 'DE' })).ok, true);
  assert.equal((await memory.addConfirmedMemory(ids, ids.business_id, { fact_key: 'lead_process', subject: 'Lead process', value: 'Manual inbound lead handling', category: 'OPERATIONS', source_type: 'user_statement', confirmed_by_user: true, confidence: 1 })).ok, true);
  const before = await memory.getRelevantContext(ids, ids.business_id, { query: 'lead process' }); assert.equal(before.ok, true); assert.ok(before.context.facts.some((fact) => fact.fact_key === 'lead_process'));

  const journeyInput = { tenant_id: ids.tenant_id, business_id: ids.business_id, activity: 'implementation', capability: 'business', customer_goal: 'Add a standardized lead notification workflow', business_context: { lead_process: 'Manual inbound lead handling' }, requirements: { complexity: 'low', integration_count: 0, standardized_template_available: true }, projected_direct_cost_eur: 4 };
  const integrated = prepareHamyrenBuildCreditJourneyV1(journeyInput);
  assert.equal(integrated.economic_preflight.aurentara_required, false); assert.equal(integrated.economic_preflight.credit_estimate, 1);

  const store = createMemoryRuntimeStore(), economics = createCustomerEconomicsRuntime({ store }), credits = createBuildCreditEntitlementExtension({ store, economics });
  await economics.ensureDefaultEntitlement(ids); await credits.grantPurchasedBuildCredits(ids, { credits: 1, grant_id: 'final-loop-credit', source: 'synthetic_test' });
  const reservation = await credits.reserveBuildCredits(ids, { operation_id: 'final-loop-build', estimate: integrated.economic_preflight, mission_id: 'final-loop-mission' });
  assert.equal(reservation.ok, true); assert.equal(reservation.execution_authorized, false); assert.equal(reservation.gates_preserved, true);

  const compiled = compileMissionPackage({ prompt: 'Build a simple CRM lead notification process without external writes', project: 'synthetic-final-loop' });
  assert.equal(compiled.ok, true); assert.equal(compiled.package.safeguards.production_deploy, false); assert.equal(compiled.package.approvals.automatic, false);
  const deliveredMission = mission({ id: 'final-loop-mission', tasks: [task({ id: 'lead-workflow', changes: [change('lead_notification_workflow', { status: 'configured', external_writes: false })], outputs: { raw_provider_logs: { should_not_be_memory: true } } })] });
  const feedback = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory, ctx: ids, journey: integrated.journey, mission: deliveredMission });
  assert.equal(feedback.ok, true); assert.ok(feedback.business_state.current_facts.some((fact) => fact.fact_key === 'lead_notification_workflow'));
  assert.equal(feedback.business_state.current_facts.some((fact) => /provider|raw_execution|log/i.test(fact.fact_key)), false);
  const settlement = await credits.settleBuildCredits(ids, { reservation_id: reservation.reservation.reservation_id, outcome: 'SUCCESS', actual_direct_cost_eur: 4 }); assert.equal(settlement.reservation.consumed_credits, 1);
  const refreshed = await memory.getRelevantContext(ids, ids.business_id, { query: 'lead notification workflow' }); assert.equal(refreshed.ok, true); assert.ok(refreshed.context.facts.some((fact) => fact.fact_key === 'lead_notification_workflow'));
  assert.equal(aurentaraDeliveryMemoryFeedbackManifestV1().raw_execution_logs_persisted, false); assert.equal(missionCompilerManifest().production_deploy, false);
});

test('Failed delivery creates no fake implemented state and restores Credit entitlement', async () => {
  const memory = createCustomerAiFoundation();
  const ids = { tenant_id: 'failed-loop-tenant', user_id: 'failed-loop-owner', business_id: 'failed-loop-business' };
  await memory.createTenant({ tenant_id: ids.tenant_id, owner_user_id: ids.user_id }); await memory.createBusiness(ids, { business_id: ids.business_id, name: 'Failed Loop' });
  const journey = buildHamyrenCustomerJourneyV1({ tenant_id: ids.tenant_id, business_id: ids.business_id, activity: 'implementation', capability: 'web', customer_goal: 'Build simple lead form', requirements: { complexity: 'low', integration_count: 0 } });
  const store = createMemoryRuntimeStore(), economics = createCustomerEconomicsRuntime({ store }), credits = createBuildCreditEntitlementExtension({ store, economics });
  await economics.ensureDefaultEntitlement(ids); await credits.grantPurchasedBuildCredits(ids, { credits: 1, grant_id: 'failed-loop-credit', source: 'synthetic_test' });
  const estimate = lowWeb(), reservation = await credits.reserveBuildCredits(ids, { operation_id: 'failed-loop-op', estimate });
  const failedMission = mission({ id: 'failed-loop-mission', status: 'FAILED', tasks: [task({ id: 'failed-task', state: 'FAILED', changes: [change('fake_live_form', { status: 'live' })] })] });
  const feedback = await applyAurentaraDeliveryToHamyrenMemoryV1({ memory, ctx: ids, journey, mission: failedMission }); assert.equal(feedback.ok, true); assert.equal(feedback.business_state.current_facts.some((fact) => fact.fact_key === 'fake_live_form'), false);
  await credits.settleBuildCredits(ids, { reservation_id: reservation.reservation.reservation_id, outcome: 'SYSTEM_FAILURE' });
  const snapshot = await credits.buildCreditSnapshot(ids); assert.equal(snapshot.credits.available, 1); assert.equal(snapshot.credits.consumed, 0);
});

test('Final seal invariants remain software-only and zero-cost', () => {
  const manifest = buildCreditEntitlementManifestV1();
  assert.equal(manifest.production_active, false); assert.equal(manifest.external_writes_active, false); assert.equal(manifest.paid_provider_inference_activated, false);
  assert.equal(manifest.payment_provider_active, false); assert.equal(manifest.real_transactions_active, false);
  assert.equal(customerEconomicsManifest().variable_paid_api_calls, false);
});
