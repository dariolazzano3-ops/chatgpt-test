import { classifyHamyrenCapabilityRequest, HAMYREN_EXECUTION_CLASSES } from '../capability-router.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const now = () => new Date().toISOString();
const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export const BUILD_CREDIT_SOURCES_V1 = Object.freeze({ INCLUDED: 'INCLUDED', PURCHASED: 'PURCHASED' });
export const BUILD_CREDIT_HEALTH_STATES_V1 = Object.freeze(['HEALTHY', 'WATCH', 'ECONOMIC_REVIEW', 'SELF_SERVICE_SUSPENSION_RECOMMENDED']);

// Internal working values only. This module never publishes pricing or activates payment/billing.
export const HAMYREN_BUILD_CREDIT_COMMERCIAL_WORKING_MODEL_V1 = Object.freeze({
  status: 'INTERNAL_WORKING_NOT_ACTIVATED',
  public_pricing: false,
  payment_provider_active: false,
  checkout_active: false,
  starter: Object.freeze({ working_price_eur_month: 29, included_monthly_credits: 0, included_credit_cap: 0 }),
  pro: Object.freeze({ working_price_eur_month: 59, included_monthly_credits: 1, included_credit_cap: 3 }),
  purchased_packs: Object.freeze({
    starter: Object.freeze({ status: 'PROPOSED_NOT_ACTIVATED_CONFIGURABLE', 1: 59, 3: 159, 5: 249 }),
    pro: Object.freeze({ status: 'PROPOSED_NOT_ACTIVATED_CONFIGURABLE', 1: 49, 3: 135, 5: 209 })
  })
});

// Compatibility mapping over the canonical Customer Economics plan IDs. This is not a second plan catalog.
export const BUILD_CREDIT_PLAN_RECONCILIATION_V1 = Object.freeze({
  'free-starter-v1': Object.freeze({ working_tier: 'STARTER', included_monthly_credits: 0, included_credit_cap: 0, compatibility: 'LEGACY_FREE_STARTER' }),
  'personal-business-ai-founder-v1': Object.freeze({ working_tier: 'PRO', included_monthly_credits: 1, included_credit_cap: 3, compatibility: 'LEGACY_FOUNDER_TO_PRO' }),
  'personal-business-ai-standard-candidate-v1': Object.freeze({ working_tier: 'PRO', included_monthly_credits: 1, included_credit_cap: 3, compatibility: 'LEGACY_STANDARD_TO_PRO' })
});

export const BUILD_CREDIT_ECONOMIC_GUARD_V1 = Object.freeze({
  target_direct_cost_eur_per_credit: 5,
  soft_warning_eur_per_credit: 8,
  mandatory_review_above_eur_per_credit: 12
});

const HARD_ESCALATION_FLAGS = Object.freeze([
  ['migration_required', 'MIGRATION'],
  ['legacy_system_replacement', 'LEGACY_SYSTEM_REPLACEMENT'],
  ['erp_required', 'ERP'],
  ['bespoke_backend', 'BESPOKE_BACKEND'],
  ['custom_authentication_required', 'CUSTOM_AUTHORIZATION_ARCHITECTURE'],
  ['complex_authentication_required', 'CUSTOM_AUTHORIZATION_ARCHITECTURE'],
  ['security_sensitive', 'SECURITY_CRITICAL_ARCHITECTURE'],
  ['large_data_transformation', 'LARGE_DATA_TRANSFORMATION'],
  ['complex_ecommerce', 'COMPLEX_ECOMMERCE'],
  ['business_critical', 'BUSINESS_CRITICAL_OPERATION'],
  ['irreversible_bulk_changes', 'IRREVERSIBLE_BULK_CHANGES'],
  ['custom_code_required', 'CUSTOM_SOFTWARE_DEVELOPMENT'],
  ['complex_multi_agent_system', 'COMPLEX_CUSTOM_MULTI_AGENT'],
  ['regulated_sensitive_implementation', 'REGULATED_OR_SENSITIVE_IMPLEMENTATION'],
  ['unknown_rollback', 'UNKNOWN_ROLLBACK'],
  ['unclear_failure_ownership', 'UNCLEAR_FAILURE_OWNERSHIP'],
  ['high_implementation_uncertainty', 'HIGH_IMPLEMENTATION_UNCERTAINTY'],
  ['infrastructure_redesign', 'COMPLEX_INFRASTRUCTURE_REDESIGN'],
  ['custom_production_architecture', 'CUSTOM_PRODUCTION_ARCHITECTURE'],
  ['non_modular_work', 'NON_MODULAR_WORK'],
  ['materially_interdependent_systems', 'MATERIALLY_INTERDEPENDENT_MULTI_SYSTEM']
]);

function normalizedRequirements(input = {}) {
  return { ...object(input), ...object(input.requirements) };
}

function supportEnvelopeFor(credits) {
  if (credits <= 1) return { band: 'CREDIT_1', target_human_minutes: { min: 0, max: 10 }, mandatory_review: false };
  if (credits <= 3) return { band: 'CREDIT_2_3', target_human_minutes: { min: 0, max: 30 }, mandatory_review: false };
  if (credits <= 5) return { band: 'CREDIT_4_5', target_human_minutes: { min: 0, max: 45 }, mandatory_review: false };
  return { band: 'CREDIT_6_8', target_human_minutes: null, mandatory_review: true };
}

function creditBand(credits) {
  if (credits <= 1) return 'SMALL_STANDARDIZED';
  if (credits <= 3) return 'MEDIUM_STANDARDIZED';
  if (credits <= 5) return 'LARGE_STANDARDIZED';
  if (credits <= 7) return 'EXCEPTIONAL_MODULAR_REVIEW';
  return 'AURENTARA_BOUNDARY';
}

function heuristicCredits(input = {}, req = {}) {
  const moduleCredits = list(input.module_credit_allocations)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 5);
  if (moduleCredits.length) return moduleCredits.reduce((sum, value) => sum + value, 0);

  const complexity = clean(req.complexity || input.complexity || 'low', 40).toLowerCase();
  const requiredCapabilities = list(input.required_capabilities || req.required_capabilities);
  const systemCount = Math.max(1, Number((req.system_count ?? input.system_count ?? requiredCapabilities.length) || 1));
  const integrations = Math.max(0, Number(req.integration_count ?? input.integration_count ?? 0));

  let credits = 1;
  if (complexity === 'medium') credits += 1;
  if (complexity === 'high') credits += 3;
  if (complexity === 'critical') credits += 5;
  credits += Math.max(0, Math.min(3, systemCount - 1));
  credits += Math.max(0, Math.ceil(integrations / 2));
  if (req.production_required === true) credits += 1;
  if (req.standardized_template_available === false) credits += 1;
  if (clean(req.uncertainty, 40).toLowerCase() === 'high') credits += 2;
  return Math.max(1, credits);
}

export function evaluateBuildCreditEconomicsV1({ credits, projected_direct_cost_eur = 0, support_minutes = null } = {}) {
  const count = Math.max(1, Number(credits || 1));
  const projected = Math.max(0, Number(projected_direct_cost_eur || 0));
  const perCredit = projected / count;
  let economicStatus = 'TARGET';
  let health = 'HEALTHY';
  let reviewRequired = false;
  const reasons = [];

  if (perCredit > BUILD_CREDIT_ECONOMIC_GUARD_V1.mandatory_review_above_eur_per_credit) {
    economicStatus = 'MANDATORY_ECONOMIC_REVIEW';
    health = 'ECONOMIC_REVIEW';
    reviewRequired = true;
    reasons.push('DIRECT_COST_ABOVE_12_EUR_PER_CREDIT');
  } else if (perCredit > BUILD_CREDIT_ECONOMIC_GUARD_V1.soft_warning_eur_per_credit) {
    economicStatus = 'SOFT_WARNING';
    health = 'WATCH';
    reasons.push('DIRECT_COST_ABOVE_8_EUR_PER_CREDIT');
  } else if (perCredit > BUILD_CREDIT_ECONOMIC_GUARD_V1.target_direct_cost_eur_per_credit) {
    economicStatus = 'ABOVE_TARGET';
    health = 'WATCH';
    reasons.push('DIRECT_COST_ABOVE_5_EUR_PER_CREDIT');
  }

  const envelope = supportEnvelopeFor(count);
  if (envelope.mandatory_review) {
    reviewRequired = true;
    reasons.push('CREDIT_6_8_REQUIRES_REVIEW');
  }
  if (Number.isFinite(Number(support_minutes)) && envelope.target_human_minutes?.max != null && Number(support_minutes) > envelope.target_human_minutes.max) {
    health = health === 'ECONOMIC_REVIEW' ? health : 'WATCH';
    reasons.push('ECONOMIC_REVIEW_RECOMMENDED_SUPPORT_ENVELOPE_EXCEEDED');
  }

  return {
    projected_direct_cost_eur: projected,
    projected_direct_cost_eur_per_credit: perCredit,
    economic_status: economicStatus,
    health,
    review_required: reviewRequired,
    support_envelope: envelope,
    reason_codes: reasons
  };
}

export function estimateBuildCreditsV1(input = {}) {
  const req = normalizedRequirements(input);
  const policyDecision = input.policy_decision || classifyHamyrenCapabilityRequest({ ...input, ...req });
  const hardReasons = HARD_ESCALATION_FLAGS.filter(([field]) => req[field] === true).map(([, reason]) => reason);
  const requiredCapabilities = list(input.required_capabilities || policyDecision.required_capabilities);
  const systemCount = Math.max(1, Number((req.system_count ?? input.system_count ?? requiredCapabilities.length) || 1));
  const tightlyCoupled = req.materially_interdependent_systems === true || clean(req.system_coupling, 40).toLowerCase() === 'tight';
  if (systemCount >= 3 && tightlyCoupled) hardReasons.push('TIGHTLY_COUPLED_THREE_SYSTEM_SCOPE');

  const credits = heuristicCredits(input, req);
  const economics = evaluateBuildCreditEconomicsV1({
    credits,
    projected_direct_cost_eur: req.projected_direct_cost_eur ?? input.projected_direct_cost_eur ?? 0,
    support_minutes: req.human_support_minutes ?? input.human_support_minutes ?? null
  });

  const policyRequiresAurentara = policyDecision.implementation_execution_class === HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED
    || policyDecision.execution_class === HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED;
  const aurentaraRequired = policyRequiresAurentara || hardReasons.length > 0 || credits >= 8;
  const modularExceptional = credits >= 6 && credits <= 8 && req.modular === true && req.standardized_template_available !== false;
  // 8 Credits intentionally carries both REVIEW_REQUIRED diagnostics and the hard AURENTARA boundary.
  const reviewRequired = economics.review_required || modularExceptional || (credits >= 6 && credits <= 8);
  const selfServiceCandidate = !aurentaraRequired
    && policyDecision.implementation_execution_class === HAMYREN_EXECUTION_CLASSES.SELF_SERVICE;

  const reasonCodes = [...new Set([
    ...(policyDecision.reasons || []),
    ...hardReasons,
    ...economics.reason_codes,
    ...(credits >= 8 ? ['CREDIT_ESTIMATE_AT_OR_ABOVE_8_AURENTARA_REQUIRED'] : []),
    ...(reviewRequired ? ['ECONOMIC_OR_COMPLEXITY_REVIEW_REQUIRED'] : []),
    ...(systemCount <= 3 && !tightlyCoupled ? ['BOUNDED_SYSTEM_COUNT_WITHIN_V1_LIMIT'] : [])
  ])];

  return {
    schema_version: 'hamyren.build-credit-estimate.v1',
    credit_estimate: credits,
    credit_band: creditBand(credits),
    self_service_candidate: selfServiceCandidate,
    review_required: reviewRequired,
    aurentara_required: aurentaraRequired,
    reason_codes: reasonCodes,
    projected_direct_cost: economics.projected_direct_cost_eur,
    projected_direct_cost_per_credit: economics.projected_direct_cost_eur_per_credit,
    economic_status: economics.economic_status,
    economic_health: economics.health,
    support_envelope: economics.support_envelope,
    policy_decision: clone(policyDecision),
    bounded_system_count: systemCount,
    modular_exceptional_candidate: modularExceptional,
    execution_authorized: false,
    production_deploy: false
  };
}

export function customerSafeBuildCreditPresentationV1(estimate = {}) {
  if (estimate.aurentara_required === true) {
    return {
      route: 'AURENTARA_PROFESSIONAL',
      message: 'This project needs AURENTARA professional implementation.',
      build_credits_required: null,
      review_required: true
    };
  }
  const credits = Math.max(1, Number(estimate.credit_estimate || 1));
  return {
    route: estimate.review_required ? 'HAMYREN_SELF_SERVICE_REVIEW' : 'HAMYREN_SELF_SERVICE',
    message: estimate.review_required
      ? `This build requires ${credits} Build Credits and a review before execution.`
      : `This build requires ${credits} Build Credits.`,
    build_credits_required: credits,
    review_required: estimate.review_required === true
  };
}

export function classifyHamyrenFairUseV1(input = {}) {
  const repetitive = Math.max(0, Number(input.repetitive_operations || 0));
  const hugeContexts = Math.max(0, Number(input.repeated_huge_contexts || 0));
  const agentLoops = Math.max(0, Number(input.expensive_agent_loops || 0));
  if (input.machine_speed === true || input.unattended === true || repetitive >= 100) return { band: 'AUTOMATION_LIKE', quota_created: false, quality_reduced: false };
  if (repetitive >= 40 || agentLoops >= 10) return { band: 'POWER', quota_created: false, quality_reduced: false };
  if (repetitive >= 15 || hugeContexts >= 5 || agentLoops >= 3) return { band: 'HEAVY', quota_created: false, quality_reduced: false };
  return { band: 'NORMAL', quota_created: false, quality_reduced: false };
}

function emptySource() {
  return { available: 0, reserved: 0, consumed: 0, restored: 0 };
}

function emptyWallet(ctx) {
  return {
    schema: 'hamyren.build-credit-wallet.v1',
    tenant_id: ctx.tenant_id,
    business_id: ctx.business_id,
    balances: { INCLUDED: emptySource(), PURCHASED: emptySource() },
    grants: {},
    reservations: {},
    operation_index: {},
    entries: [],
    created_at: now(),
    updated_at: now()
  };
}

function buildContext(ctx = {}) {
  const tenant_id = clean(ctx.tenant_id, 120);
  const user_id = clean(ctx.user_id, 120);
  const business_id = clean(ctx.business_id, 120);
  return tenant_id && user_id && business_id
    ? { ok: true, tenant_id, user_id, business_id }
    : { ok: false, error: 'BUILD_CREDIT_TENANT_BUSINESS_CONTEXT_REQUIRED' };
}

function tierForPlan(planId) {
  return BUILD_CREDIT_PLAN_RECONCILIATION_V1[clean(planId, 120)] || null;
}

function total(wallet, field) {
  return Object.values(BUILD_CREDIT_SOURCES_V1)
    .reduce((sum, source) => sum + Number(wallet.balances[source]?.[field] || 0), 0);
}

function event(wallet, entry) {
  wallet.entries.push({
    sequence: wallet.entries.length + 1,
    at: now(),
    tenant_id: wallet.tenant_id,
    business_id: wallet.business_id,
    ...entry
  });
  wallet.updated_at = now();
}

export function createBuildCreditEntitlementExtension(options = {}) {
  const store = options.store;
  const economics = options.economics;
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') throw new Error('BUILD_CREDIT_RUNTIME_STORE_REQUIRED');
  if (!economics || typeof economics.getEntitlement !== 'function') throw new Error('CANONICAL_CUSTOMER_ECONOMICS_REQUIRED');
  const scope = (tenantId) => `tenant:${tenantId}:customer-economics`;

  async function readWallet(auth) {
    const record = await store.get(scope(auth.tenant_id), 'build-credit-wallets', auth.business_id);
    return record
      ? { revision: Number(record.revision || 0), wallet: clone(record.value) }
      : { revision: 0, wallet: null };
  }

  async function ensureBuildCreditWallet(ctx = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const existing = await readWallet(auth);
    if (existing.wallet) return { ok: true, created: false, wallet: existing.wallet };
    const written = await store.put(scope(auth.tenant_id), 'build-credit-wallets', auth.business_id, emptyWallet(auth), { expected_revision: 0 });
    if (!written.ok && written.error === 'STORE_REVISION_CONFLICT') {
      const raced = await readWallet(auth);
      return raced.wallet ? { ok: true, created: false, wallet: raced.wallet } : written;
    }
    return written.ok ? { ok: true, created: true, wallet: clone(written.value) } : written;
  }

  async function mutate(ctx, mutator) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const ensured = await ensureBuildCreditWallet(auth);
    if (!ensured.ok) return ensured;
    const current = await readWallet(auth);
    if (!current.wallet) return { ok: false, error: 'BUILD_CREDIT_WALLET_NOT_FOUND' };
    const draft = clone(current.wallet);
    const result = await mutator(draft, auth);
    if (result?.ok === false) return result;
    const written = await store.put(scope(auth.tenant_id), 'build-credit-wallets', auth.business_id, draft, { expected_revision: current.revision });
    if (!written.ok) return { ...written, retry_safe: true, double_charge_prevented: true };
    return { ok: true, ...result, wallet: clone(written.value) };
  }

  async function grantMonthlyIncludedBuildCredit(ctx = {}, input = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const current = await economics.getEntitlement(auth);
    if (!current.ok) return current;
    const tier = tierForPlan(current.entitlement.plan_id);
    if (!tier) return { ok: false, error: 'BUILD_CREDIT_PLAN_RECONCILIATION_REQUIRED' };

    const period = clean(input.period, 32);
    const subscriptionId = clean(input.subscription_id, 160);
    const source = clean(input.source, 80);
    if (!period || !subscriptionId) return { ok: false, error: 'BUILD_CREDIT_SUBSCRIPTION_PERIOD_REQUIRED' };
    if (input.subscription_period_status !== 'SUCCESSFUL') return { ok: false, error: 'BUILD_CREDIT_SUCCESSFUL_SUBSCRIPTION_PERIOD_REQUIRED' };
    if (!['synthetic_test', 'payment_lifecycle_projection'].includes(source)) return { ok: false, error: 'BUILD_CREDIT_GRANT_SOURCE_NOT_ALLOWED' };

    const grantKey = `included:${subscriptionId}:${period}`;
    return mutate(auth, (wallet) => {
      if (wallet.grants[grantKey]) return { duplicate: true, grant: clone(wallet.grants[grantKey]) };
      if (tier.included_monthly_credits <= 0) {
        const grant = { grant_id: grantKey, source: 'INCLUDED', amount: 0, status: 'NO_GRANT_FOR_STARTER', period, subscription_id: subscriptionId, plan_id: current.entitlement.plan_id, source_attribution: source, created_at: now() };
        wallet.grants[grantKey] = grant;
        event(wallet, { type: 'GRANT_SKIPPED', source: 'INCLUDED', amount: 0, grant_id: grantKey, plan_id: current.entitlement.plan_id, subscription_id: subscriptionId, period, reason: 'STARTER_ZERO_INCLUDED' });
        return { granted: 0, grant };
      }

      const unspentIncluded = wallet.balances.INCLUDED.available + wallet.balances.INCLUDED.reserved;
      if (unspentIncluded >= tier.included_credit_cap) {
        const grant = { grant_id: grantKey, source: 'INCLUDED', amount: 0, status: 'CAP_REACHED', period, subscription_id: subscriptionId, plan_id: current.entitlement.plan_id, source_attribution: source, created_at: now() };
        wallet.grants[grantKey] = grant;
        event(wallet, { type: 'GRANT_SKIPPED', source: 'INCLUDED', amount: 0, grant_id: grantKey, plan_id: current.entitlement.plan_id, subscription_id: subscriptionId, period, reason: 'INCLUDED_CAP_REACHED' });
        return { granted: 0, cap_reached: true, grant };
      }

      const amount = Math.min(tier.included_monthly_credits, tier.included_credit_cap - unspentIncluded);
      wallet.balances.INCLUDED.available += amount;
      const grant = { grant_id: grantKey, source: 'INCLUDED', amount, status: 'GRANTED', period, subscription_id: subscriptionId, plan_id: current.entitlement.plan_id, source_attribution: source, created_at: now() };
      wallet.grants[grantKey] = grant;
      event(wallet, { type: 'GRANT', source: 'INCLUDED', amount, grant_id: grantKey, plan_id: current.entitlement.plan_id, subscription_id: subscriptionId, period, source_attribution: source });
      return { granted: amount, cap_reached: false, grant };
    });
  }

  async function grantPurchasedBuildCredits(ctx = {}, input = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const amount = Number(input.credits);
    const grantId = clean(input.grant_id, 180);
    const source = clean(input.source, 80);
    if (![1, 3, 5].includes(amount)) return { ok: false, error: 'BUILD_CREDIT_PURCHASE_PACK_NOT_SUPPORTED' };
    if (!grantId) return { ok: false, error: 'BUILD_CREDIT_PURCHASE_GRANT_ID_REQUIRED' };
    if (!['synthetic_test', 'manual_preview'].includes(source)) return { ok: false, error: 'BUILD_CREDIT_REAL_PURCHASE_NOT_ACTIVATED' };

    return mutate(auth, (wallet) => {
      if (wallet.grants[grantId]) return { duplicate: true, grant: clone(wallet.grants[grantId]) };
      wallet.balances.PURCHASED.available += amount;
      const grant = { grant_id: grantId, source: 'PURCHASED', amount, status: 'SYNTHETIC_TECHNICAL_GRANT', transaction_id: null, payment_verified: false, source_attribution: source, created_at: now() };
      wallet.grants[grantId] = grant;
      event(wallet, { type: 'GRANT', source: 'PURCHASED', amount, grant_id: grantId, source_attribution: source, synthetic: true });
      return { granted: amount, grant };
    });
  }

  async function reserveBuildCredits(ctx = {}, input = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const operationId = clean(input.operation_id, 180);
    const estimate = input.estimate;
    if (!operationId || estimate?.schema_version !== 'hamyren.build-credit-estimate.v1') return { ok: false, error: 'BUILD_CREDIT_PREFLIGHT_AND_OPERATION_REQUIRED' };
    if (estimate.aurentara_required === true) return { ok: false, error: 'AURENTARA_REQUIRED', policy_decision: clone(estimate.policy_decision), credits_bypassed_policy: false };
    if (estimate.review_required === true && input.review_approved !== true) return { ok: false, error: 'BUILD_CREDIT_REVIEW_REQUIRED', review_required: true };

    const entitlement = await economics.getEntitlement(auth);
    if (!entitlement.ok) return entitlement;
    const amount = Math.max(1, Number(estimate.credit_estimate || 0));
    return mutate(auth, (wallet) => {
      const priorId = wallet.operation_index[operationId];
      if (priorId && wallet.reservations[priorId]) return { duplicate: true, reservation: clone(wallet.reservations[priorId]) };
      if (total(wallet, 'available') < amount) return { ok: false, error: 'INSUFFICIENT_BUILD_CREDITS', required: amount, available: total(wallet, 'available') };

      let remaining = amount;
      const allocations = [];
      for (const source of ['INCLUDED', 'PURCHASED']) {
        const take = Math.min(remaining, wallet.balances[source].available);
        if (take > 0) {
          wallet.balances[source].available -= take;
          wallet.balances[source].reserved += take;
          allocations.push({ source, credits: take });
          remaining -= take;
        }
      }

      const reservationId = clean(input.reservation_id, 200) || `build:${auth.business_id}:${operationId}`;
      const reservation = {
        reservation_id: reservationId,
        operation_id: operationId,
        mission_id: clean(input.mission_id, 180) || null,
        entitlement_plan_id: entitlement.entitlement.plan_id,
        credits: amount,
        allocations,
        status: 'RESERVED',
        estimate: clone(estimate),
        retry_count: 0,
        execution_authorized: false,
        production_deploy: false,
        created_at: now(),
        settled_at: null
      };
      wallet.reservations[reservationId] = reservation;
      wallet.operation_index[operationId] = reservationId;
      event(wallet, { type: 'RESERVE', reservation_id: reservationId, operation_id: operationId, mission_id: reservation.mission_id, entitlement_plan_id: reservation.entitlement_plan_id, amount, allocations: clone(allocations) });
      return { reservation, gates_preserved: true, execution_authorized: false };
    });
  }

  async function noteBuildCreditRetry(ctx = {}, input = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const reservationId = clean(input.reservation_id, 220);
    return mutate(auth, (wallet) => {
      const reservation = wallet.reservations[reservationId];
      if (!reservation) return { ok: false, error: 'BUILD_CREDIT_RESERVATION_NOT_FOUND' };
      reservation.retry_count = Number(reservation.retry_count || 0) + 1;
      event(wallet, { type: 'RETRY_NOT_CHARGED', reservation_id: reservationId, operation_id: reservation.operation_id, mission_id: reservation.mission_id, retry_count: reservation.retry_count });
      return { reservation: clone(reservation), additional_credits_charged: 0 };
    });
  }

  async function settleBuildCredits(ctx = {}, input = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const reservationId = clean(input.reservation_id, 220);
    const outcome = clean(input.outcome, 40).toUpperCase();

    return mutate(auth, (wallet) => {
      const reservation = wallet.reservations[reservationId];
      if (!reservation) return { ok: false, error: 'BUILD_CREDIT_RESERVATION_NOT_FOUND' };
      if (['CONSUMED', 'RELEASED', 'PARTIAL_SETTLED'].includes(reservation.status)) return { duplicate: true, reservation: clone(reservation) };
      if (reservation.status !== 'RESERVED') return { ok: false, error: 'BUILD_CREDIT_RESERVATION_NOT_SETTLEABLE' };

      let consumeCredits = 0;
      if (outcome === 'SUCCESS') {
        consumeCredits = reservation.credits;
      } else if (outcome === 'PARTIAL') {
        const modules = list(input.modules);
        if (!modules.length || modules.some((module) => !Number.isFinite(Number(module.credits)) || !['SUCCESS', 'FAILED', 'CANCELLED'].includes(clean(module.status, 40).toUpperCase()))) {
          return { ok: false, error: 'BUILD_CREDIT_PARTIAL_REVIEW_REQUIRED', review_required: true };
        }
        const allocated = modules.reduce((sum, module) => sum + Math.max(0, Number(module.credits)), 0);
        if (allocated !== reservation.credits) return { ok: false, error: 'BUILD_CREDIT_PARTIAL_ALLOCATION_MISMATCH', review_required: true };
        consumeCredits = modules
          .filter((module) => clean(module.status, 40).toUpperCase() === 'SUCCESS')
          .reduce((sum, module) => sum + Number(module.credits), 0);
      } else if (!['FAILED', 'CANCELLED', 'SYSTEM_FAILURE'].includes(outcome)) {
        return { ok: false, error: 'BUILD_CREDIT_SETTLEMENT_OUTCOME_REQUIRED' };
      }

      let remainingConsume = consumeCredits;
      const consumedBySource = [];
      const restoredBySource = [];
      for (const allocation of reservation.allocations) {
        const source = allocation.source;
        const allocated = Number(allocation.credits || 0);
        const consumed = Math.min(allocated, remainingConsume);
        const restored = allocated - consumed;
        wallet.balances[source].reserved -= allocated;
        wallet.balances[source].consumed += consumed;
        wallet.balances[source].available += restored;
        wallet.balances[source].restored += restored;
        if (consumed) consumedBySource.push({ source, credits: consumed });
        if (restored) restoredBySource.push({ source, credits: restored });
        remainingConsume -= consumed;
      }

      reservation.status = consumeCredits === reservation.credits ? 'CONSUMED' : consumeCredits === 0 ? 'RELEASED' : 'PARTIAL_SETTLED';
      reservation.settlement_outcome = outcome;
      reservation.consumed_credits = consumeCredits;
      reservation.restored_credits = reservation.credits - consumeCredits;
      reservation.actual_direct_cost_eur = Number.isFinite(Number(input.actual_direct_cost_eur)) ? Math.max(0, Number(input.actual_direct_cost_eur)) : null;
      reservation.settled_at = now();
      event(wallet, { type: 'SETTLE', reservation_id: reservationId, operation_id: reservation.operation_id, mission_id: reservation.mission_id, outcome, consumed_credits: consumeCredits, restored_credits: reservation.restored_credits, consumed_by_source: consumedBySource, restored_by_source: restoredBySource });
      return { reservation: clone(reservation), consumed_by_source: consumedBySource, restored_by_source: restoredBySource };
    });
  }

  async function buildCreditSnapshot(ctx = {}) {
    const auth = buildContext(ctx);
    if (!auth.ok) return auth;
    const ensured = await ensureBuildCreditWallet(auth);
    if (!ensured.ok) return ensured;
    const current = await readWallet(auth);
    const wallet = current.wallet;
    return {
      ok: true,
      tenant_id: auth.tenant_id,
      business_id: auth.business_id,
      credits: {
        available: total(wallet, 'available'),
        reserved: total(wallet, 'reserved'),
        consumed: total(wallet, 'consumed'),
        restored: total(wallet, 'restored'),
        sources: clone(wallet.balances)
      },
      reservations: Object.values(wallet.reservations).map(clone),
      grants: Object.values(wallet.grants).map(clone),
      entries: clone(wallet.entries)
    };
  }

  async function buildCreditOperatorDiagnostics(ctx = {}) {
    const snapshot = await buildCreditSnapshot(ctx);
    if (!snapshot.ok) return snapshot;
    const latest = snapshot.reservations.at(-1) || null;
    const estimate = latest?.estimate || null;
    const actualCost = latest?.actual_direct_cost_eur;
    const actualPerCredit = actualCost == null || !latest?.consumed_credits ? null : actualCost / latest.consumed_credits;
    let health = estimate?.economic_health || 'HEALTHY';
    if (actualPerCredit != null && actualPerCredit > 12) health = 'ECONOMIC_REVIEW';
    return {
      ...snapshot,
      health,
      estimated_credits: estimate?.credit_estimate ?? null,
      estimated_direct_cost_eur: estimate?.projected_direct_cost ?? null,
      actual_direct_cost_eur: actualCost ?? null,
      economic_variance_eur: actualCost == null || estimate?.projected_direct_cost == null ? null : actualCost - estimate.projected_direct_cost,
      retry_count: latest?.retry_count ?? 0,
      capability_policy_decision: clone(estimate?.policy_decision || null),
      economic_status: estimate?.economic_status || null,
      aurentara_escalation_reasons: estimate?.aurentara_required ? clone(estimate.reason_codes || []) : [],
      self_service_suspension_automatic: false,
      production_deploy: false
    };
  }

  return {
    ensureBuildCreditWallet,
    grantMonthlyIncludedBuildCredit,
    grantPurchasedBuildCredits,
    reserveBuildCredits,
    noteBuildCreditRetry,
    settleBuildCredits,
    buildCreditSnapshot,
    buildCreditOperatorDiagnostics
  };
}

export function buildCreditEntitlementManifestV1() {
  return {
    version: 'hamyren.build-credit-entitlement-extension.v1',
    canonical_customer_economics_required: true,
    canonical_cost_engine_preserved: 'riosystems.cost-ledger.v1',
    credit_entitlement_is_not_execution_authorization: true,
    sources: Object.values(BUILD_CREDIT_SOURCES_V1),
    consumption_order: ['INCLUDED', 'PURCHASED'],
    pro_included_grant: 1,
    included_cap: 3,
    starter_included_grant: 0,
    payment_provider_active: false,
    checkout_active: false,
    billing_active: false,
    real_transactions_active: false,
    public_pricing: false,
    production_active: false,
    external_writes_active: false,
    paid_provider_inference_activated: false
  };
}
