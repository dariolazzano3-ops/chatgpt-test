import { createMemoryRuntimeStore } from '../durable-runtime-store.js';
import { createCostLedger, reserveCost, settleCost, releaseCost, costLedgerSnapshot } from '../runtime-cost-ledger.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const now = () => new Date().toISOString();

export const CUSTOMER_PLAN_CATALOG_V1 = Object.freeze({
  FREE_STARTER: Object.freeze({
    plan_id: 'free-starter-v1',
    label: 'Free · Starter',
    status: 'ACTIVE_PREVIEW',
    price_eur_month: 0,
    billing_interval: null,
    payment_required: false,
    monthly_compute_units: 20,
    features: Object.freeze([
      'business_ai_chat', 'conversation_history', 'memory_view', 'memory_correction', 'goals_view', 'decisions_view'
    ]),
    public_launch_candidate: true
  }),
  PERSONAL_BUSINESS_AI_FOUNDER: Object.freeze({
    plan_id: 'personal-business-ai-founder-v1',
    label: 'Personal Business AI · Founder',
    status: 'PLANNED_LAUNCH',
    price_eur_month: 19.90,
    billing_interval: 'month',
    payment_required: true,
    monthly_compute_units: 400,
    features: Object.freeze([
      'business_ai_chat', 'conversation_history', 'memory_view', 'memory_correction', 'goals_view', 'decisions_view',
      'longitudinal_memory', 'trusted_research_eligibility', 'priority_context'
    ]),
    public_launch_candidate: true
  }),
  PERSONAL_BUSINESS_AI_STANDARD_CANDIDATE: Object.freeze({
    plan_id: 'personal-business-ai-standard-candidate-v1',
    label: 'Personal Business AI',
    status: 'PRICE_CANDIDATE',
    price_eur_month: 24.90,
    billing_interval: 'month',
    payment_required: true,
    monthly_compute_units: 500,
    features: Object.freeze([
      'business_ai_chat', 'conversation_history', 'memory_view', 'memory_correction', 'goals_view', 'decisions_view',
      'longitudinal_memory', 'trusted_research_eligibility', 'priority_context'
    ]),
    public_launch_candidate: false
  })
});

export const CUSTOMER_COMPUTE_WEIGHTS_V1 = Object.freeze({
  customer_chat_turn: 1,
  trusted_research_turn: 4,
  context_refresh: 0.25,
  memory_operation: 0
});

const plans = Object.freeze(Object.values(CUSTOMER_PLAN_CATALOG_V1));

function getPlan(planId) {
  return plans.find((plan) => plan.plan_id === clean(planId, 120)) || null;
}

function periodKey(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function tenantContext(ctx = {}) {
  const tenantId = clean(ctx.tenant_id, 120);
  const userId = clean(ctx.user_id, 120);
  if (!tenantId || !userId) return { ok: false, error: 'ENTITLEMENT_TENANT_CONTEXT_REQUIRED' };
  return { ok: true, tenant_id: tenantId, user_id: userId };
}

function safePlan(plan = {}) {
  return {
    plan_id: plan.plan_id,
    label: plan.label,
    status: plan.status,
    price_eur_month: plan.price_eur_month,
    billing_interval: plan.billing_interval,
    payment_required: plan.payment_required,
    monthly_compute_units: plan.monthly_compute_units,
    features: [...(plan.features || [])],
    public_launch_candidate: plan.public_launch_candidate === true,
    unlimited_compute: false
  };
}

export function customerEconomicsManifest() {
  return {
    version: 'aurentara.personal-business-ai.economics.v1',
    source_of_truth_cost_engine: 'riosystems.cost-ledger.v1',
    entitlement_scope: 'tenant',
    fair_use_scope: 'tenant_month',
    unlimited_compute: false,
    plans: plans.map(safePlan),
    payment_provider_active: false,
    stripe_active: false,
    billing_collection_active: false,
    production_active: false,
    variable_paid_api_calls: false
  };
}

export function listCustomerPlans() {
  return plans.map(safePlan);
}

export function createCustomerEconomicsRuntime(options = {}) {
  const store = options.store || createMemoryRuntimeStore();
  const scope = (tenantId) => `tenant:${tenantId}:customer-economics`;

  async function readEntitlement(tenantId) {
    const record = await store.get(scope(tenantId), 'entitlements', 'current');
    return record?.value ? clone(record.value) : null;
  }

  async function writeEntitlement(tenantId, value) {
    const written = await store.put(scope(tenantId), 'entitlements', 'current', value);
    return written.ok ? { ok: true, entitlement: clone(written.value) } : written;
  }

  async function ensureDefaultEntitlement(ctx = {}) {
    const auth = tenantContext(ctx);
    if (!auth.ok) return auth;
    const existing = await readEntitlement(auth.tenant_id);
    if (existing) return { ok: true, entitlement: existing, created: false };
    const plan = CUSTOMER_PLAN_CATALOG_V1.FREE_STARTER;
    const entitlement = {
      schema: 'aurentara.customer.entitlement.v1',
      tenant_id: auth.tenant_id,
      plan_id: plan.plan_id,
      status: 'ACTIVE',
      source: 'default_free',
      payment_verified: false,
      starts_at: now(),
      ends_at: null,
      created_at: now(),
      updated_at: now(),
      production_billing_active: false
    };
    const written = await writeEntitlement(auth.tenant_id, entitlement);
    return written.ok ? { ...written, created: true } : written;
  }

  async function assignPreviewPlan(ctx = {}, planId, input = {}) {
    const auth = tenantContext(ctx);
    if (!auth.ok) return auth;
    const plan = getPlan(planId);
    if (!plan) return { ok: false, error: 'ENTITLEMENT_PLAN_NOT_FOUND' };
    const source = clean(input.source, 80);
    if (!['synthetic_test', 'manual_preview'].includes(source)) return { ok: false, error: 'ENTITLEMENT_PAYMENT_ACTIVATION_NOT_ALLOWED' };
    const entitlement = {
      schema: 'aurentara.customer.entitlement.v1',
      tenant_id: auth.tenant_id,
      plan_id: plan.plan_id,
      status: 'ACTIVE_PREVIEW',
      source,
      payment_verified: false,
      starts_at: input.starts_at || now(),
      ends_at: input.ends_at || null,
      created_at: now(),
      updated_at: now(),
      production_billing_active: false
    };
    return writeEntitlement(auth.tenant_id, entitlement);
  }

  async function getEntitlement(ctx = {}) {
    const ensured = await ensureDefaultEntitlement(ctx);
    if (!ensured.ok) return ensured;
    const plan = getPlan(ensured.entitlement.plan_id);
    if (!plan) return { ok: false, error: 'ENTITLEMENT_PLAN_CONFIGURATION_INVALID' };
    return { ok: true, entitlement: clone(ensured.entitlement), plan: safePlan(plan) };
  }

  async function authorizeFeature(ctx = {}, feature) {
    const current = await getEntitlement(ctx);
    if (!current.ok) return current;
    const featureId = clean(feature, 120);
    const allowed = current.plan.features.includes(featureId);
    return {
      ok: allowed,
      error: allowed ? null : 'ENTITLEMENT_FEATURE_NOT_AVAILABLE',
      feature: featureId,
      entitlement: current.entitlement,
      plan: current.plan
    };
  }

  async function readUsage(tenantId, period, plan) {
    const record = await store.get(scope(tenantId), 'usage', period);
    if (record?.value) return clone(record.value);
    const created = createCostLedger({ customer_id: tenantId, project_id: `fair-use:${period}`, limit_cost_units: plan.monthly_compute_units });
    if (!created.ok) return null;
    return {
      schema: 'aurentara.customer.compute-usage.v1',
      tenant_id: tenantId,
      period,
      plan_id: plan.plan_id,
      compute_unit_budget: plan.monthly_compute_units,
      ledger: created.ledger,
      operation_attribution: {},
      updated_at: now()
    };
  }

  async function writeUsage(tenantId, period, usage) {
    const written = await store.put(scope(tenantId), 'usage', period, usage);
    return written.ok ? { ok: true, usage: clone(written.value) } : written;
  }

  async function reserveCompute(ctx = {}, input = {}) {
    const auth = tenantContext(ctx);
    if (!auth.ok) return auth;
    const current = await getEntitlement(ctx);
    if (!current.ok) return current;
    const usageClass = clean(input.usage_class || 'customer_chat_turn', 120);
    const feature = clean(input.feature || 'business_ai_chat', 120);
    const featureGate = await authorizeFeature(ctx, feature);
    if (!featureGate.ok) return featureGate;
    const period = periodKey(input.at || new Date());
    const usage = await readUsage(auth.tenant_id, period, current.plan);
    if (!usage) return { ok: false, error: 'COMPUTE_USAGE_LEDGER_INIT_FAILED' };
    if (usage.plan_id !== current.plan.plan_id) {
      const recreated = createCostLedger({ customer_id: auth.tenant_id, project_id: `fair-use:${period}`, limit_cost_units: current.plan.monthly_compute_units });
      if (!recreated.ok) return recreated;
      usage.plan_id = current.plan.plan_id;
      usage.compute_unit_budget = current.plan.monthly_compute_units;
      usage.ledger = recreated.ledger;
      usage.operation_attribution = {};
    }
    const operationId = clean(input.operation_id, 160);
    if (!operationId) return { ok: false, error: 'COMPUTE_OPERATION_ID_REQUIRED' };
    const requested = Math.max(0, Number(input.compute_units ?? CUSTOMER_COMPUTE_WEIGHTS_V1[usageClass] ?? 1));
    const reservationId = `${period}:${operationId}`;
    const reserved = reserveCost(usage.ledger, {
      reservation_id: reservationId,
      cost_units: requested,
      provider_id: 'customer-entitlement',
      capability: usageClass,
      task_id: operationId
    });
    if (!reserved.ok) {
      return {
        ok: false,
        error: reserved.error === 'PROJECT_BUDGET_EXCEEDED' ? 'FAIR_USE_COMPUTE_BUDGET_EXCEEDED' : reserved.error,
        remaining_compute_units: reserved.remaining_cost_units ?? reserved.ledger?.remaining_cost_units ?? 0,
        plan: current.plan
      };
    }
    usage.ledger = reserved.ledger;
    usage.operation_attribution[reservationId] = {
      operation_id: operationId,
      usage_class: usageClass,
      feature,
      reserved_compute_units: requested,
      actual_compute_units: null,
      status: 'RESERVED',
      created_at: now()
    };
    usage.updated_at = now();
    const persisted = await writeUsage(auth.tenant_id, period, usage);
    if (!persisted.ok) return persisted;
    return { ok: true, reservation_id: reservationId, period, reserved_compute_units: requested, usage: persisted.usage, plan: current.plan };
  }

  async function settleCompute(ctx = {}, input = {}) {
    const auth = tenantContext(ctx);
    if (!auth.ok) return auth;
    const period = clean(input.period, 16);
    const reservationId = clean(input.reservation_id, 200);
    if (!period || !reservationId) return { ok: false, error: 'COMPUTE_RESERVATION_CONTEXT_REQUIRED' };
    const current = await getEntitlement(ctx);
    if (!current.ok) return current;
    const usage = await readUsage(auth.tenant_id, period, current.plan);
    const attribution = usage?.operation_attribution?.[reservationId];
    if (!usage || !attribution) return { ok: false, error: 'COMPUTE_RESERVATION_NOT_FOUND' };
    if (attribution.status === 'SETTLED') return { ok: true, duplicate: true, reservation_id: reservationId, usage };
    if (attribution.status === 'RELEASED') return { ok: false, error: 'COMPUTE_RESERVATION_ALREADY_RELEASED' };
    const actual = Math.max(0, Number(input.actual_compute_units ?? attribution.reserved_compute_units));
    const settled = settleCost(usage.ledger, { reservation_id: reservationId, actual_cost_units: actual });
    if (!settled.ok) return settled;
    usage.ledger = settled.ledger;
    attribution.actual_compute_units = actual;
    attribution.status = 'SETTLED';
    attribution.settled_at = now();
    usage.updated_at = now();
    const persisted = await writeUsage(auth.tenant_id, period, usage);
    return persisted.ok ? { ok: true, reservation_id: reservationId, actual_compute_units: actual, usage: persisted.usage } : persisted;
  }

  async function releaseCompute(ctx = {}, input = {}) {
    const auth = tenantContext(ctx);
    if (!auth.ok) return auth;
    const period = clean(input.period, 16);
    const reservationId = clean(input.reservation_id, 200);
    if (!period || !reservationId) return { ok: false, error: 'COMPUTE_RESERVATION_CONTEXT_REQUIRED' };
    const current = await getEntitlement(ctx);
    if (!current.ok) return current;
    const usage = await readUsage(auth.tenant_id, period, current.plan);
    const attribution = usage?.operation_attribution?.[reservationId];
    if (!usage || !attribution) return { ok: false, error: 'COMPUTE_RESERVATION_NOT_FOUND' };
    if (attribution.status === 'RELEASED') return { ok: true, duplicate: true, reservation_id: reservationId, usage };
    if (attribution.status === 'SETTLED') return { ok: false, error: 'COMPUTE_RESERVATION_ALREADY_SETTLED' };
    const released = releaseCost(usage.ledger, { reservation_id: reservationId, reason: clean(input.reason, 240) || 'turn_not_completed' });
    if (!released.ok) return released;
    usage.ledger = released.ledger;
    attribution.status = 'RELEASED';
    attribution.released_at = now();
    attribution.release_reason = clean(input.reason, 240) || 'turn_not_completed';
    usage.updated_at = now();
    const persisted = await writeUsage(auth.tenant_id, period, usage);
    return persisted.ok ? { ok: true, reservation_id: reservationId, usage: persisted.usage } : persisted;
  }

  async function usageSnapshot(ctx = {}, input = {}) {
    const auth = tenantContext(ctx);
    if (!auth.ok) return auth;
    const current = await getEntitlement(ctx);
    if (!current.ok) return current;
    const period = periodKey(input.at || new Date());
    const usage = await readUsage(auth.tenant_id, period, current.plan);
    if (!usage) return { ok: false, error: 'COMPUTE_USAGE_LEDGER_INIT_FAILED' };
    const ledger = costLedgerSnapshot(usage.ledger);
    return {
      ok: true,
      entitlement: current.entitlement,
      plan: current.plan,
      usage: {
        period,
        compute_unit_budget: usage.compute_unit_budget,
        reserved_compute_units: ledger.reserved_cost_units,
        spent_compute_units: ledger.spent_cost_units,
        remaining_compute_units: ledger.remaining_cost_units,
        operations: Object.values(usage.operation_attribution || {}).map(clone),
        unlimited_compute: false
      },
      payment: {
        provider_active: false,
        billing_collection_active: false,
        upgrade_checkout_active: false
      }
    };
  }

  return {
    manifest: customerEconomicsManifest,
    listPlans: listCustomerPlans,
    ensureDefaultEntitlement,
    assignPreviewPlan,
    getEntitlement,
    authorizeFeature,
    reserveCompute,
    settleCompute,
    releaseCompute,
    usageSnapshot
  };
}
