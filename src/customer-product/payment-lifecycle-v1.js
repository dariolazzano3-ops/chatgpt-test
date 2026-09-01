import { createMemoryRuntimeStore } from '../durable-runtime-store.js';
import { CUSTOMER_PLAN_CATALOG_V1 } from './economics-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const now = () => new Date().toISOString();

export const PAYMENT_EVENT_TYPES_V1 = Object.freeze([
  'CHECKOUT_STARTED',
  'SUBSCRIPTION_ACTIVE',
  'INVOICE_PAID',
  'PAYMENT_FAILED',
  'SUBSCRIPTION_CANCELED'
]);

export const PAYMENT_SUBSCRIPTION_STATES_V1 = Object.freeze([
  'PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED'
]);

const FOUNDER_PLAN = CUSTOMER_PLAN_CATALOG_V1.PERSONAL_BUSINESS_AI_FOUNDER;
const FREE_PLAN = CUSTOMER_PLAN_CATALOG_V1.FREE_STARTER;

function providerInvocationAllowed(options, verify) {
  return Boolean(verify) && (options.provider_active === true || options.synthetic_fixture === true);
}

function tenantScope(tenantId) {
  return `tenant:${tenantId}:customer-payment-lifecycle`;
}

function fingerprint(event = {}) {
  return JSON.stringify({
    event_id: event.event_id,
    tenant_id: event.tenant_id,
    provider_customer_id: event.provider_customer_id,
    subscription_id: event.subscription_id,
    plan_id: event.plan_id,
    type: event.type,
    sequence: event.sequence,
    currency: event.currency,
    amount_eur: event.amount_eur,
    occurred_at: event.occurred_at
  });
}

function normalizeVerifiedEvent(verified = {}) {
  const type = clean(verified.type, 80).toUpperCase();
  const sequence = Number(verified.sequence);
  const amount = verified.amount_eur === null || verified.amount_eur === undefined ? null : Number(verified.amount_eur);
  return {
    schema: 'aurentara.customer.payment-event.v1',
    event_id: clean(verified.event_id, 180),
    tenant_id: clean(verified.tenant_id, 120),
    provider_customer_id: clean(verified.provider_customer_id, 180),
    subscription_id: clean(verified.subscription_id, 180),
    plan_id: clean(verified.plan_id, 140),
    type,
    sequence: Number.isInteger(sequence) && sequence >= 0 ? sequence : null,
    currency: clean(verified.currency || 'EUR', 8).toUpperCase(),
    amount_eur: Number.isFinite(amount) ? amount : null,
    occurred_at: verified.occurred_at || now(),
    provider_event_verified: verified.provider_event_verified === true,
    synthetic: verified.synthetic === true,
    raw_provider_payload_persisted: false
  };
}

function validateEvent(event = {}) {
  if (!event.provider_event_verified) return 'PAYMENT_EVENT_VERIFICATION_REQUIRED';
  if (!event.event_id) return 'PAYMENT_EVENT_ID_REQUIRED';
  if (!event.tenant_id) return 'PAYMENT_EVENT_TENANT_REQUIRED';
  if (!event.provider_customer_id) return 'PAYMENT_PROVIDER_CUSTOMER_REQUIRED';
  if (!event.subscription_id) return 'PAYMENT_SUBSCRIPTION_ID_REQUIRED';
  if (!PAYMENT_EVENT_TYPES_V1.includes(event.type)) return 'PAYMENT_EVENT_TYPE_UNSUPPORTED';
  if (event.sequence === null) return 'PAYMENT_EVENT_SEQUENCE_REQUIRED';
  if (event.plan_id !== FOUNDER_PLAN.plan_id) return 'PAYMENT_PLAN_NOT_ALLOWED';
  if (['SUBSCRIPTION_ACTIVE', 'INVOICE_PAID'].includes(event.type)) {
    if (event.currency !== 'EUR') return 'PAYMENT_CURRENCY_MISMATCH';
    if (event.amount_eur !== FOUNDER_PLAN.price_eur_month) return 'PAYMENT_AMOUNT_MISMATCH';
  }
  return null;
}

function targetState(type) {
  if (type === 'CHECKOUT_STARTED') return 'PENDING';
  if (type === 'SUBSCRIPTION_ACTIVE' || type === 'INVOICE_PAID') return 'ACTIVE';
  if (type === 'PAYMENT_FAILED') return 'PAST_DUE';
  if (type === 'SUBSCRIPTION_CANCELED') return 'CANCELED';
  return null;
}

function transitionAllowed(from, to) {
  if (!from) return ['PENDING', 'ACTIVE'].includes(to);
  if (from === 'PENDING') return ['PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED'].includes(to);
  if (from === 'ACTIVE') return ['ACTIVE', 'PAST_DUE', 'CANCELED'].includes(to);
  if (from === 'PAST_DUE') return ['PAST_DUE', 'ACTIVE', 'CANCELED'].includes(to);
  if (from === 'CANCELED') return to === 'CANCELED';
  return false;
}

function projectEntitlement(subscription = {}) {
  const paidActive = subscription.state === 'ACTIVE';
  return {
    schema: 'aurentara.customer.billing-entitlement-projection.v1',
    tenant_id: subscription.tenant_id,
    subscription_id: subscription.subscription_id,
    billing_state: subscription.state,
    effective_plan_id: paidActive ? FOUNDER_PLAN.plan_id : FREE_PLAN.plan_id,
    intended_paid_plan_id: FOUNDER_PLAN.plan_id,
    payment_verified: paidActive,
    paid_access_active: paidActive,
    restriction_reason: subscription.state === 'PAST_DUE' ? 'PAYMENT_PAST_DUE' : subscription.state === 'CANCELED' ? 'SUBSCRIPTION_CANCELED' : subscription.state === 'PENDING' ? 'PAYMENT_PENDING' : null,
    founder_price_eur_month: FOUNDER_PLAN.price_eur_month,
    currency: 'EUR',
    production_billing_active: false,
    projected_at: now()
  };
}

export function paymentLifecycleManifest() {
  return {
    version: 'aurentara.personal-business-ai.payment-lifecycle.v1',
    payment_adapter_contract_ready: true,
    provider_neutral: true,
    founder_plan_id: FOUNDER_PLAN.plan_id,
    founder_price_eur_month: FOUNDER_PLAN.price_eur_month,
    currency: 'EUR',
    allowed_event_types: [...PAYMENT_EVENT_TYPES_V1],
    idempotent_event_ids: true,
    resumable_received_events: true,
    ordered_event_sequences: true,
    one_live_subscription_per_tenant_v1: true,
    tenant_bound_verified_events: true,
    paid_entitlement_requires_verified_event: true,
    past_due_restricts_to_free: true,
    canceled_restricts_to_free: true,
    canceled_subscription_terminal: true,
    raw_provider_payload_persisted: false,
    payment_provider_active: false,
    stripe_active: false,
    checkout_active: false,
    webhook_active: false,
    production_active: false,
    real_money_moved: false
  };
}

export function createPaymentLifecycleAdapter(options = {}) {
  const store = options.store || createMemoryRuntimeStore();
  const verify = typeof options.verify_event === 'function' ? options.verify_event : null;

  async function read(scope, collection, id) {
    const record = await store.get(scope, collection, id);
    return record?.value ? clone(record.value) : null;
  }

  async function write(scope, collection, id, value) {
    const result = await store.put(scope, collection, id, value);
    return result.ok ? { ok: true, value: clone(result.value) } : result;
  }

  async function finalizeRecoveredEvent(scope, event, current) {
    const projection = projectEntitlement(current);
    const projectionWrite = await write(scope, 'projection', 'current', projection);
    if (!projectionWrite.ok) return projectionWrite;
    const finalRecord = { event, fingerprint: fingerprint(event), disposition: 'APPLIED', subscription_snapshot: clone(current), recorded_at: now(), recovered: true };
    const eventWrite = await write(scope, 'events', event.event_id, finalRecord);
    if (!eventWrite.ok) return eventWrite;
    return { ok: true, duplicate: true, recovered: true, event, subscription: current, entitlement_projection: projection };
  }

  async function ingest(input = {}) {
    if (!verify) return { ok: false, error: 'PAYMENT_PROVIDER_VERIFIER_NOT_CONFIGURED' };
    if (!providerInvocationAllowed(options, verify)) return { ok: false, error: 'PAYMENT_PROVIDER_ACTIVATION_REQUIRED' };
    const verified = await verify(clone(input.provider_event));
    if (!verified?.ok) return { ok: false, error: verified?.error || 'PAYMENT_EVENT_VERIFICATION_FAILED' };
    const event = normalizeVerifiedEvent(verified.event || verified);
    const validationError = validateEvent(event);
    if (validationError) return { ok: false, error: validationError };
    const expectedTenant = clean(input.expected_tenant_id, 120);
    if (expectedTenant && expectedTenant !== event.tenant_id) return { ok: false, error: 'PAYMENT_EVENT_TENANT_MISMATCH' };

    const scope = tenantScope(event.tenant_id);
    const existingEvent = await read(scope, 'events', event.event_id);
    if (existingEvent) {
      if (existingEvent.fingerprint !== fingerprint(event)) return { ok: false, error: 'PAYMENT_EVENT_REPLAY_CONFLICT', event_id: event.event_id };
      if (existingEvent.disposition === 'APPLIED') {
        return { ok: true, duplicate: true, event: clone(existingEvent.event), subscription: clone(existingEvent.subscription_snapshot), entitlement_projection: await read(scope, 'projection', 'current') };
      }
      if (existingEvent.disposition === 'IGNORED_OUT_OF_ORDER') {
        return { ok: true, duplicate: true, ignored: true, reason: 'PAYMENT_EVENT_OUT_OF_ORDER', event: clone(existingEvent.event), subscription: clone(existingEvent.subscription_snapshot), entitlement_projection: await read(scope, 'projection', 'current') };
      }
    }

    const currentProjection = await read(scope, 'projection', 'current');
    if (currentProjection?.subscription_id && currentProjection.subscription_id !== event.subscription_id && !['CANCELED', 'NONE'].includes(currentProjection.billing_state)) {
      return { ok: false, error: 'PAYMENT_TENANT_SUBSCRIPTION_CONFLICT', active_subscription_id: currentProjection.subscription_id };
    }

    const current = await read(scope, 'subscriptions', event.subscription_id);
    if (current && current.tenant_id !== event.tenant_id) return { ok: false, error: 'PAYMENT_SUBSCRIPTION_TENANT_MISMATCH' };
    if (current && current.provider_customer_id !== event.provider_customer_id) return { ok: false, error: 'PAYMENT_PROVIDER_CUSTOMER_MISMATCH' };
    if (current && current.plan_id !== event.plan_id) return { ok: false, error: 'PAYMENT_SUBSCRIPTION_PLAN_MISMATCH' };
    if (current && current.last_event_id === event.event_id && event.sequence === Number(current.last_sequence)) {
      return finalizeRecoveredEvent(scope, event, current);
    }
    if (current && event.sequence < Number(current.last_sequence)) {
      const ignored = { event, fingerprint: fingerprint(event), disposition: 'IGNORED_OUT_OF_ORDER', subscription_snapshot: clone(current), recorded_at: now() };
      await write(scope, 'events', event.event_id, ignored);
      return { ok: true, ignored: true, reason: 'PAYMENT_EVENT_OUT_OF_ORDER', event, subscription: current, entitlement_projection: await read(scope, 'projection', 'current') };
    }
    if (current && event.sequence === Number(current.last_sequence)) return { ok: false, error: 'PAYMENT_EVENT_SEQUENCE_CONFLICT' };

    const nextState = targetState(event.type);
    if (!transitionAllowed(current?.state || null, nextState)) {
      return { ok: false, error: current?.state === 'CANCELED' ? 'PAYMENT_SUBSCRIPTION_TERMINAL' : 'PAYMENT_SUBSCRIPTION_TRANSITION_INVALID', from_state: current?.state || null, to_state: nextState };
    }

    if (!existingEvent) {
      const received = await write(scope, 'events', event.event_id, { event, fingerprint: fingerprint(event), disposition: 'RECEIVED', subscription_snapshot: clone(current), recorded_at: now() });
      if (!received.ok) return received;
    }

    const subscription = {
      schema: 'aurentara.customer.payment-subscription.v1',
      tenant_id: event.tenant_id,
      provider_customer_id: event.provider_customer_id,
      subscription_id: event.subscription_id,
      plan_id: event.plan_id,
      state: nextState,
      last_event_id: event.event_id,
      last_event_type: event.type,
      last_sequence: event.sequence,
      started_at: current?.started_at || event.occurred_at,
      activated_at: nextState === 'ACTIVE' ? (current?.activated_at || event.occurred_at) : (current?.activated_at || null),
      past_due_at: nextState === 'PAST_DUE' ? event.occurred_at : (current?.past_due_at || null),
      canceled_at: nextState === 'CANCELED' ? event.occurred_at : null,
      updated_at: now(),
      synthetic: event.synthetic === true,
      production_billing_active: false
    };
    const projection = projectEntitlement(subscription);
    const writtenSubscription = await write(scope, 'subscriptions', event.subscription_id, subscription);
    if (!writtenSubscription.ok) return writtenSubscription;
    const writtenProjection = await write(scope, 'projection', 'current', projection);
    if (!writtenProjection.ok) return writtenProjection;
    const writtenEvent = await write(scope, 'events', event.event_id, { event, fingerprint: fingerprint(event), disposition: 'APPLIED', subscription_snapshot: clone(subscription), recorded_at: now() });
    if (!writtenEvent.ok) return writtenEvent;
    return { ok: true, duplicate: false, event, subscription, entitlement_projection: projection };
  }

  async function getSubscription(tenantId, subscriptionId) {
    const tenant = clean(tenantId, 120), subscription = clean(subscriptionId, 180);
    if (!tenant || !subscription) return { ok: false, error: 'PAYMENT_SUBSCRIPTION_SCOPE_REQUIRED' };
    const value = await read(tenantScope(tenant), 'subscriptions', subscription);
    return value ? { ok: true, subscription: value } : { ok: false, error: 'PAYMENT_SUBSCRIPTION_NOT_FOUND' };
  }

  async function getEntitlementProjection(tenantId) {
    const tenant = clean(tenantId, 120);
    if (!tenant) return { ok: false, error: 'PAYMENT_TENANT_REQUIRED' };
    const projection = await read(tenantScope(tenant), 'projection', 'current');
    if (projection) return { ok: true, entitlement_projection: projection };
    return {
      ok: true,
      entitlement_projection: {
        schema: 'aurentara.customer.billing-entitlement-projection.v1',
        tenant_id: tenant,
        subscription_id: null,
        billing_state: 'NONE',
        effective_plan_id: FREE_PLAN.plan_id,
        intended_paid_plan_id: FOUNDER_PLAN.plan_id,
        payment_verified: false,
        paid_access_active: false,
        restriction_reason: 'NO_VERIFIED_PAYMENT',
        founder_price_eur_month: FOUNDER_PLAN.price_eur_month,
        currency: 'EUR',
        production_billing_active: false,
        projected_at: now()
      }
    };
  }

  return {
    manifest: paymentLifecycleManifest,
    ingest,
    getSubscription,
    getEntitlementProjection
  };
}
