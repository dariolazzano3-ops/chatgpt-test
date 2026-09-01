import assert from 'node:assert/strict';
import { createDeterministicTestProvider } from '../src/ai-provider-adapters-v1.js';
import {
  CUSTOMER_PLAN_CATALOG_V1,
  createCustomerEconomicsRuntime,
  customerEconomicsManifest,
  listCustomerPlans
} from '../src/customer-product/economics-v1.js';
import { createCustomerProductSurface } from '../src/customer-product/surface-v1.js';

const manifest = customerEconomicsManifest();
assert.equal(manifest.source_of_truth_cost_engine, 'riosystems.cost-ledger.v1');
assert.equal(manifest.stripe_active, false);
assert.equal(manifest.payment_provider_active, false);
assert.equal(manifest.unlimited_compute, false);

const plans = listCustomerPlans();
const free = plans.find((plan) => plan.plan_id === 'free-starter-v1');
const founder = plans.find((plan) => plan.plan_id === 'personal-business-ai-founder-v1');
const standard = plans.find((plan) => plan.plan_id === 'personal-business-ai-standard-candidate-v1');
assert.equal(free.price_eur_month, 0);
assert.equal(founder.price_eur_month, 19.90);
assert.equal(standard.price_eur_month, 24.90);
assert.equal(founder.unlimited_compute, false);
assert.equal(standard.public_launch_candidate, false);

const economics = createCustomerEconomicsRuntime();
const ctxA = { tenant_id: 'synthetic-economics-a', user_id: 'owner-a' };
const ctxB = { tenant_id: 'synthetic-economics-b', user_id: 'owner-b' };

const defaultA = await economics.ensureDefaultEntitlement(ctxA);
const defaultB = await economics.ensureDefaultEntitlement(ctxB);
assert.equal(defaultA.ok, true);
assert.equal(defaultB.ok, true);
assert.equal(defaultA.entitlement.plan_id, CUSTOMER_PLAN_CATALOG_V1.FREE_STARTER.plan_id);
assert.equal((await economics.getEntitlement(ctxA)).plan.monthly_compute_units, 20);

const freeResearchGate = await economics.authorizeFeature(ctxA, 'trusted_research_eligibility');
assert.equal(freeResearchGate.ok, false);
assert.equal(freeResearchGate.error, 'ENTITLEMENT_FEATURE_NOT_AVAILABLE');

const illegalPaidActivation = await economics.assignPreviewPlan(ctxA, founder.plan_id, { source: 'payment_confirmed' });
assert.equal(illegalPaidActivation.ok, false);
assert.equal(illegalPaidActivation.error, 'ENTITLEMENT_PAYMENT_ACTIVATION_NOT_ALLOWED');

const founderPreview = await economics.assignPreviewPlan(ctxA, founder.plan_id, { source: 'manual_preview' });
assert.equal(founderPreview.ok, true);
const founderCurrent = await economics.getEntitlement(ctxA);
assert.equal(founderCurrent.plan.price_eur_month, 19.90);
assert.equal(founderCurrent.entitlement.payment_verified, false);
assert.equal((await economics.authorizeFeature(ctxA, 'trusted_research_eligibility')).ok, true);

const released = await economics.reserveCompute(ctxA, {
  operation_id: 'released-turn', usage_class: 'customer_chat_turn', feature: 'business_ai_chat', compute_units: 1,
  at: '2026-09-01T01:00:00Z'
});
assert.equal(released.ok, true);
assert.equal((await economics.releaseCompute(ctxA, { period: released.period, reservation_id: released.reservation_id, reason: 'safety_block' })).ok, true);
const afterRelease = await economics.usageSnapshot(ctxA, { at: '2026-09-01T01:00:00Z' });
assert.equal(afterRelease.usage.spent_compute_units, 0);
assert.equal(afterRelease.usage.reserved_compute_units, 0);

const settled = await economics.reserveCompute(ctxA, {
  operation_id: 'settled-turn', usage_class: 'customer_chat_turn', feature: 'business_ai_chat', compute_units: 1,
  at: '2026-09-01T01:00:00Z'
});
assert.equal(settled.ok, true);
const settledResult = await economics.settleCompute(ctxA, { period: settled.period, reservation_id: settled.reservation_id, actual_compute_units: 1 });
assert.equal(settledResult.ok, true);
const settledDuplicate = await economics.settleCompute(ctxA, { period: settled.period, reservation_id: settled.reservation_id, actual_compute_units: 1 });
assert.equal(settledDuplicate.ok, true);
assert.equal(settledDuplicate.duplicate, true);
const founderUsage = await economics.usageSnapshot(ctxA, { at: '2026-09-01T01:00:00Z' });
assert.equal(founderUsage.usage.spent_compute_units, 1);
assert.equal(founderUsage.usage.remaining_compute_units, 399);

for (let i = 0; i < 20; i += 1) {
  const reservation = await economics.reserveCompute(ctxB, {
    operation_id: `free-turn-${i + 1}`,
    usage_class: 'customer_chat_turn', feature: 'business_ai_chat', compute_units: 1,
    at: '2026-09-01T01:00:00Z'
  });
  assert.equal(reservation.ok, true);
  const completion = await economics.settleCompute(ctxB, { period: reservation.period, reservation_id: reservation.reservation_id, actual_compute_units: 1 });
  assert.equal(completion.ok, true);
}
const exhausted = await economics.reserveCompute(ctxB, {
  operation_id: 'free-turn-over-budget', usage_class: 'customer_chat_turn', feature: 'business_ai_chat', compute_units: 1,
  at: '2026-09-01T01:00:00Z'
});
assert.equal(exhausted.ok, false);
assert.equal(exhausted.error, 'FAIR_USE_COMPUTE_BUDGET_EXCEEDED');
assert.equal(exhausted.remaining_compute_units, 0);
const usageB = await economics.usageSnapshot(ctxB, { at: '2026-09-01T01:00:00Z' });
assert.equal(usageB.usage.spent_compute_units, 20);
assert.equal(usageB.usage.unlimited_compute, false);
assert.equal((await economics.usageSnapshot(ctxA, { at: '2026-09-01T01:00:00Z' })).usage.spent_compute_units, 1);

let inferenceCalls = 0;
const provider = createDeterministicTestProvider({
  id: 'economics-surface-provider',
  scripted_response() {
    inferenceCalls += 1;
    return {
      answer: 'Run one bounded synthetic business experiment.',
      recommendations: [], follow_up_questions: [], memory_candidates: [], goal_proposals: [], decision_proposals: [],
      evidence_refs: [], needs_external_research: false, confidence: 0.9
    };
  }
});
const surface = createCustomerProductSurface({ force_synthetic: true, providers: [provider] });
const base = 'https://economics-surface.test';
const req = (path, options = {}) => new Request(`${base}${path}`, options);
const guestResponse = await surface.handle(req('/customer/api/guest-session', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: '{}'
}), {});
assert.equal(guestResponse.status, 201);
const cookie = String(guestResponse.headers.get('set-cookie')).split(';')[0];

const planListResponse = await surface.handle(req('/customer/api/plans'), {});
const planList = await planListResponse.json();
assert.equal(planList.payment_provider_active, false);
assert.equal(planList.checkout_active, false);
assert.ok(planList.plans.some((plan) => plan.price_eur_month === 19.90));

const entitlementResponse = await surface.handle(req('/customer/api/entitlement', { headers: { cookie } }), {});
const entitlement = await entitlementResponse.json();
assert.equal(entitlement.plan.plan_id, 'free-starter-v1');

const beforeSurfaceUsage = await (await surface.handle(req('/customer/api/usage', { headers: { cookie } }), {})).json();
assert.equal(beforeSurfaceUsage.usage.spent_compute_units, 0);
assert.equal(beforeSurfaceUsage.usage.remaining_compute_units, 20);

const chatResponse = await surface.handle(req('/customer/api/chat', {
  method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ message: 'How can I improve my synthetic breakfast offer?' })
}), {});
assert.equal(chatResponse.status, 200);
assert.equal(inferenceCalls, 1);
const afterSuccessfulChat = await (await surface.handle(req('/customer/api/usage', { headers: { cookie } }), {})).json();
assert.equal(afterSuccessfulChat.usage.spent_compute_units, 1);
assert.equal(afterSuccessfulChat.usage.remaining_compute_units, 19);
assert.equal(afterSuccessfulChat.usage.variable_cost_eur, 0);

const callsBeforeBlocked = inferenceCalls;
const blockedResponse = await surface.handle(req('/customer/api/chat', {
  method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ message: 'What is the current Mindestlohn and what must I pay?' })
}), {});
assert.equal(blockedResponse.status, 409);
assert.equal(inferenceCalls, callsBeforeBlocked);
const afterBlocked = await (await surface.handle(req('/customer/api/usage', { headers: { cookie } }), {})).json();
assert.equal(afterBlocked.usage.spent_compute_units, 1);
assert.equal(afterBlocked.usage.reserved_compute_units, 0);
assert.equal(afterBlocked.usage.remaining_compute_units, 19);

const upgradeResponse = await surface.handle(req('/customer/api/upgrade', {
  method: 'POST', headers: { cookie, 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ plan_id: founder.plan_id })
}), {});
assert.equal(upgradeResponse.status, 501);
const upgrade = await upgradeResponse.json();
assert.equal(upgrade.error, 'PAYMENT_PROVIDER_NOT_ACTIVATED');
assert.equal(upgrade.stripe_active, false);
assert.equal(upgrade.checkout_active, false);
assert.equal(upgrade.operator_gate_required, true);

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI SUBSCRIPTIONS ENTITLEMENTS ECONOMICS V1',
  status: 'PASS',
  free_price_eur_month: 0,
  founder_reference_price_eur_month: 19.90,
  standard_candidate_price_eur_month: 24.90,
  free_monthly_compute_units: 20,
  founder_monthly_compute_units: 400,
  unlimited_compute: false,
  fair_use_exhaustion_verified: true,
  failed_turn_compute_release_verified: true,
  tenant_usage_isolation_verified: true,
  source_of_truth_cost_engine_reused: true,
  payment_provider_active: false,
  stripe_active: false,
  checkout_active: false,
  variable_cost_eur: 0,
  paid_api_calls: 0,
  production_changes: false
}, null, 2));
