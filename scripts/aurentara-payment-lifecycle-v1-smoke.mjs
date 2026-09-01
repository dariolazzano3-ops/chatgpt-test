import assert from 'node:assert/strict';
import { createMemoryRuntimeStore } from '../src/durable-runtime-store.js';
import { CUSTOMER_PLAN_CATALOG_V1 } from '../src/customer-product/economics-v1.js';
import {
  paymentLifecycleManifest,
  createPaymentLifecycleAdapter
} from '../src/customer-product/payment-lifecycle-v1.js';
import { evaluateControlledLaunchReadiness, CONTROLLED_LAUNCH_PROFILES_V1 } from '../src/customer-product/launch-readiness-v1.js';

const founder = CUSTOMER_PLAN_CATALOG_V1.PERSONAL_BUSINESS_AI_FOUNDER;
const free = CUSTOMER_PLAN_CATALOG_V1.FREE_STARTER;
const manifest = paymentLifecycleManifest();
assert.equal(manifest.payment_adapter_contract_ready, true);
assert.equal(manifest.founder_price_eur_month, 19.90);
assert.equal(manifest.currency, 'EUR');
assert.equal(manifest.payment_provider_active, false);
assert.equal(manifest.stripe_active, false);
assert.equal(manifest.checkout_active, false);
assert.equal(manifest.webhook_active, false);
assert.equal(manifest.real_money_moved, false);
assert.equal(manifest.paid_entitlement_requires_verified_event, true);
assert.equal(manifest.resumable_received_events, true);

function verifiedEvent(input = {}) {
  return {
    event_id: input.event_id,
    tenant_id: input.tenant_id,
    provider_customer_id: input.provider_customer_id || `pc_${input.tenant_id}`,
    subscription_id: input.subscription_id || `sub_${input.tenant_id}`,
    plan_id: input.plan_id || founder.plan_id,
    type: input.type,
    sequence: input.sequence,
    currency: input.currency ?? 'EUR',
    amount_eur: input.amount_eur,
    occurred_at: input.occurred_at || `2026-09-01T01:${String(input.sequence ?? 0).padStart(2, '0')}:00Z`,
    provider_event_verified: input.provider_event_verified !== false,
    synthetic: true
  };
}

const verifier = async (raw = {}) => {
  if (raw.signature_valid !== true) return { ok: false, error: 'SYNTHETIC_SIGNATURE_INVALID' };
  return { ok: true, event: verifiedEvent(raw) };
};

const inactive = createPaymentLifecycleAdapter({ verify_event: verifier });
assert.equal((await inactive.ingest({ provider_event: { signature_valid: true } })).error, 'PAYMENT_PROVIDER_ACTIVATION_REQUIRED');

const payments = createPaymentLifecycleAdapter({ verify_event: verifier, synthetic_fixture: true });
const noneA = await payments.getEntitlementProjection('tenant-a');
assert.equal(noneA.entitlement_projection.effective_plan_id, free.plan_id);
assert.equal(noneA.entitlement_projection.payment_verified, false);

const badSignature = await payments.ingest({ provider_event: {
  signature_valid: false, event_id: 'evt-bad', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 19.90
}});
assert.equal(badSignature.error, 'SYNTHETIC_SIGNATURE_INVALID');

const verifierWithoutProof = createPaymentLifecycleAdapter({
  synthetic_fixture: true,
  verify_event: async (raw) => ({ ok: true, event: verifiedEvent({ ...raw, provider_event_verified: false }) })
});
assert.equal((await verifierWithoutProof.ingest({ provider_event: {
  event_id: 'evt-unverified', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 19.90
}})).error, 'PAYMENT_EVENT_VERIFICATION_REQUIRED');

const tenantMismatch = await payments.ingest({
  expected_tenant_id: 'tenant-b',
  provider_event: { signature_valid: true, event_id: 'evt-mismatch', tenant_id: 'tenant-a', type: 'CHECKOUT_STARTED', sequence: 1 }
});
assert.equal(tenantMismatch.error, 'PAYMENT_EVENT_TENANT_MISMATCH');

const wrongPlan = await payments.ingest({ provider_event: {
  signature_valid: true, event_id: 'evt-plan', tenant_id: 'tenant-a', plan_id: 'personal-business-ai-standard-candidate-v1', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 24.90
}});
assert.equal(wrongPlan.error, 'PAYMENT_PLAN_NOT_ALLOWED');
const wrongCurrency = await payments.ingest({ provider_event: {
  signature_valid: true, event_id: 'evt-currency', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 19.90, currency: 'USD'
}});
assert.equal(wrongCurrency.error, 'PAYMENT_CURRENCY_MISMATCH');
const wrongAmount = await payments.ingest({ provider_event: {
  signature_valid: true, event_id: 'evt-amount', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 9.90
}});
assert.equal(wrongAmount.error, 'PAYMENT_AMOUNT_MISMATCH');

const pendingEvent = { signature_valid: true, event_id: 'evt-a-1', tenant_id: 'tenant-a', type: 'CHECKOUT_STARTED', sequence: 1 };
const pending = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: pendingEvent });
assert.equal(pending.ok, true);
assert.equal(pending.subscription.state, 'PENDING');
assert.equal(pending.entitlement_projection.effective_plan_id, free.plan_id);
assert.equal(pending.entitlement_projection.paid_access_active, false);

const pendingDuplicate = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: pendingEvent });
assert.equal(pendingDuplicate.ok, true);
assert.equal(pendingDuplicate.duplicate, true);
const replayConflict = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  ...pendingEvent, type: 'SUBSCRIPTION_ACTIVE', amount_eur: 19.90
}});
assert.equal(replayConflict.error, 'PAYMENT_EVENT_REPLAY_CONFLICT');

const active = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-2', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_ACTIVE', sequence: 2, amount_eur: 19.90
}});
assert.equal(active.ok, true);
assert.equal(active.subscription.state, 'ACTIVE');
assert.equal(active.entitlement_projection.effective_plan_id, founder.plan_id);
assert.equal(active.entitlement_projection.payment_verified, true);
assert.equal(active.entitlement_projection.paid_access_active, true);

const secondSubscriptionConflict = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-other', tenant_id: 'tenant-a', subscription_id: 'sub_other', type: 'CHECKOUT_STARTED', sequence: 1
}});
assert.equal(secondSubscriptionConflict.error, 'PAYMENT_TENANT_SUBSCRIPTION_CONFLICT');

const outOfOrder = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-old', tenant_id: 'tenant-a', type: 'CHECKOUT_STARTED', sequence: 1
}});
assert.equal(outOfOrder.ok, true);
assert.equal(outOfOrder.ignored, true);
assert.equal(outOfOrder.reason, 'PAYMENT_EVENT_OUT_OF_ORDER');
assert.equal((await payments.getEntitlementProjection('tenant-a')).entitlement_projection.effective_plan_id, founder.plan_id);

const pastDue = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-3', tenant_id: 'tenant-a', type: 'PAYMENT_FAILED', sequence: 3
}});
assert.equal(pastDue.subscription.state, 'PAST_DUE');
assert.equal(pastDue.entitlement_projection.effective_plan_id, free.plan_id);
assert.equal(pastDue.entitlement_projection.restriction_reason, 'PAYMENT_PAST_DUE');
assert.equal(pastDue.entitlement_projection.payment_verified, false);

const recoveredPayment = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-4', tenant_id: 'tenant-a', type: 'INVOICE_PAID', sequence: 4, amount_eur: 19.90
}});
assert.equal(recoveredPayment.subscription.state, 'ACTIVE');
assert.equal(recoveredPayment.entitlement_projection.effective_plan_id, founder.plan_id);

const canceled = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-5', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_CANCELED', sequence: 5
}});
assert.equal(canceled.subscription.state, 'CANCELED');
assert.equal(canceled.entitlement_projection.effective_plan_id, free.plan_id);
assert.equal(canceled.entitlement_projection.restriction_reason, 'SUBSCRIPTION_CANCELED');

const terminal = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-6', tenant_id: 'tenant-a', type: 'SUBSCRIPTION_ACTIVE', sequence: 6, amount_eur: 19.90
}});
assert.equal(terminal.error, 'PAYMENT_SUBSCRIPTION_TERMINAL');

const newSubscriptionPending = await payments.ingest({ expected_tenant_id: 'tenant-a', provider_event: {
  signature_valid: true, event_id: 'evt-a-new-1', tenant_id: 'tenant-a', subscription_id: 'sub_a_new', type: 'CHECKOUT_STARTED', sequence: 1
}});
assert.equal(newSubscriptionPending.ok, true);
assert.equal(newSubscriptionPending.subscription.state, 'PENDING');

const tenantBActive = await payments.ingest({ expected_tenant_id: 'tenant-b', provider_event: {
  signature_valid: true, event_id: 'evt-b-1', tenant_id: 'tenant-b', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 19.90
}});
assert.equal(tenantBActive.ok, true);
assert.equal(tenantBActive.entitlement_projection.effective_plan_id, founder.plan_id);
assert.equal((await payments.getEntitlementProjection('tenant-a')).entitlement_projection.subscription_id, 'sub_a_new');
assert.equal((await payments.getEntitlementProjection('tenant-b')).entitlement_projection.subscription_id, 'sub_tenant-b');

const baseStore = createMemoryRuntimeStore();
let failProjectionOnce = true;
const flakyStore = {
  get: (...args) => baseStore.get(...args),
  list: (...args) => baseStore.list(...args),
  async put(scope, collection, id, value, options) {
    if (collection === 'projection' && failProjectionOnce) {
      failProjectionOnce = false;
      return { ok: false, error: 'SYNTHETIC_PROJECTION_WRITE_FAILURE' };
    }
    return baseStore.put(scope, collection, id, value, options);
  }
};
const recoveryAdapter = createPaymentLifecycleAdapter({ store: flakyStore, verify_event: verifier, synthetic_fixture: true });
const recoveryEvent = { signature_valid: true, event_id: 'evt-recover-1', tenant_id: 'tenant-recover', type: 'SUBSCRIPTION_ACTIVE', sequence: 1, amount_eur: 19.90 };
const failedProjection = await recoveryAdapter.ingest({ provider_event: recoveryEvent });
assert.equal(failedProjection.error, 'SYNTHETIC_PROJECTION_WRITE_FAILURE');
const resumed = await recoveryAdapter.ingest({ provider_event: recoveryEvent });
assert.equal(resumed.ok, true);
assert.equal(resumed.duplicate, true);
assert.equal(resumed.recovered, true);
assert.equal(resumed.entitlement_projection.effective_plan_id, founder.plan_id);

const freeReadiness = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT,
  red_team_passed: true,
  red_team_passed_cases: 22
});
assert.equal(freeReadiness.preproduction_required_ids.length, 0);
assert.equal(freeReadiness.next_state, 'OPERATOR_ACTIVATION_REQUIRED');

const paidReadiness = evaluateControlledLaunchReadiness({
  profile: CONTROLLED_LAUNCH_PROFILES_V1.PAID_FOUNDER_LAUNCH,
  red_team_passed: true,
  red_team_passed_cases: 22
});
assert.equal(paidReadiness.preproduction_required_ids.length, 0);
assert.equal(paidReadiness.next_state, 'OPERATOR_ACTIVATION_REQUIRED');
assert.ok(paidReadiness.operator_gate_ids.includes('payment_provider'));

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI PAYMENT LIFECYCLE ADAPTER CONTRACT V1',
  status: 'PASS',
  founder_plan_id: founder.plan_id,
  founder_price_eur_month: founder.price_eur_month,
  verified_event_required: true,
  replay_idempotency_verified: true,
  replay_conflict_verified: true,
  event_ordering_verified: true,
  partial_failure_recovery_verified: true,
  one_live_subscription_per_tenant_verified: true,
  cross_tenant_isolation_verified: true,
  past_due_free_restriction_verified: true,
  canceled_free_restriction_verified: true,
  canceled_terminal_verified: true,
  payment_provider_active: false,
  stripe_active: false,
  checkout_active: false,
  real_money_moved: false,
  free_preproduction_remaining: freeReadiness.preproduction_required_ids,
  paid_preproduction_remaining: paidReadiness.preproduction_required_ids,
  paid_next_state: paidReadiness.next_state,
  production_changes: false,
  paid_api_calls: 0,
  variable_cost_eur: 0
}, null, 2));
