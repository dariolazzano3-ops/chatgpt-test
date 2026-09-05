import { createCostLedger, costLedgerSnapshot, reserveCost, settleCost, releaseCost } from './runtime-cost-ledger.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const CONTROLLED_PAID_STAGING_PROJECT_ID = 'gelato-donatello-website-v1';
export const CONTROLLED_PAID_STAGING_MAX_EUR = 25;
export const CONTROLLED_PAID_STAGING_CONFIRMATION = 'CONFIRM_CONTROLLED_PAID_STAGING_25_EUR';

const EXPLICIT_PROVIDER_ALLOWLIST = Object.freeze([
  'framer-server-api',
  'cloudflare-workers-free',
  'make-core',
  'openai-api',
  'supabase-free',
  'posthog-free'
]);

function ledgerFromProject(project = {}) {
  return project.controlled_paid_staging?.cost_ledger || null;
}

export function controlledPaidStagingSnapshot(project = {}) {
  const policy = project.controlled_paid_staging || null;
  const ledger = ledgerFromProject(project);
  const ledgerSnapshot = ledger ? costLedgerSnapshot(ledger) : null;
  const active = policy?.status === 'ACTIVE';
  const ceiling = active ? money(policy.project_budget_ceiling_eur) : 0;
  const spent = active ? money(ledgerSnapshot?.spent_cost_units || 0) : 0;
  const reserved = active ? money(ledgerSnapshot?.reserved_cost_units || 0) : 0;
  const remaining = active ? money(Math.max(0, ceiling - spent - reserved)) : 0;
  return {
    schema: 'aurentara.controlled-paid-staging.snapshot.v1',
    active,
    mode: active ? 'CONTROLLED_PAID_STAGING' : 'SAFE_DEFAULT',
    environment: 'staging',
    data_mode: active ? 'controlled-prelaunch' : 'synthetic_only',
    project_budget_ceiling_eur: ceiling,
    current_spend_eur: spent,
    reserved_eur: reserved,
    remaining_budget_eur: remaining,
    paid_provider_calls: active ? 'ALLOWED_WITHIN_PROJECT_BUDGET' : 'NOT_AUTHORIZED',
    production: 'LOCKED',
    public_deploy: false,
    dns_change: false,
    external_customer_writes: false,
    billing: false,
    checkout: false,
    public_indexing: false,
    real_end_customer_data: false,
    automatic_budget_increase: false,
    provider_native_hard_cap_guaranteed: false,
    production_deploy: false
  };
}

export function activateControlledPaidStagingProject(project = {}, input = {}) {
  if (clean(project.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID) {
    return { ok: false, error: 'CONTROLLED_PAID_STAGING_PROJECT_NOT_ELIGIBLE', production_deploy: false };
  }
  if (clean(input.project_id, 160) !== CONTROLLED_PAID_STAGING_PROJECT_ID || clean(input.scope_key, 320) !== clean(project.scope_key, 320)) {
    return { ok: false, error: 'CONTROLLED_PAID_STAGING_SCOPE_CONFIRMATION_REQUIRED', production_deploy: false };
  }
  if (clean(input.confirmation_text, 200) !== CONTROLLED_PAID_STAGING_CONFIRMATION) {
    return { ok: false, error: 'CONTROLLED_PAID_STAGING_CONFIRMATION_REQUIRED', production_deploy: false };
  }
  const ceiling = money(input.project_budget_ceiling_eur);
  const safetyOk = input.environment === 'staging'
    && ceiling === CONTROLLED_PAID_STAGING_MAX_EUR
    && input.paid_provider_permission === true
    && input.production_locked === true
    && input.external_write_locked === true
    && input.public_deploy === false
    && input.dns_change === false
    && input.billing === false
    && input.checkout === false
    && input.public_indexing === false
    && input.real_end_customer_data === false
    && input.automatic_budget_increase === false;
  if (!safetyOk) return { ok: false, error: 'CONTROLLED_PAID_STAGING_SAFETY_GATE_REJECTED', production_deploy: false };

  const existing = project.controlled_paid_staging;
  if (existing?.status === 'ACTIVE') {
    const snapshot = controlledPaidStagingSnapshot(project);
    return snapshot.project_budget_ceiling_eur === ceiling
      ? { ok: true, changed: false, project: clone(project), snapshot, idempotent_replay: true, production_deploy: false }
      : { ok: false, error: 'CONTROLLED_PAID_STAGING_AUTOMATIC_BUDGET_CHANGE_FORBIDDEN', production_deploy: false };
  }

  const ledgerResult = createCostLedger({ customer_id: project.customer_id, project_id: project.project_id, limit_cost_units: ceiling });
  if (!ledgerResult.ok) return { ...ledgerResult, production_deploy: false };
  const next = clone(project);
  next.environment = 'staging';
  next.data_policy = {
    ...(next.data_policy || {}),
    synthetic_only: false,
    controlled_prelaunch: true,
    operator_approved_company_information_only: true,
    real_customer_data: false,
    payment_data: false,
    confidential_personal_data: false,
    live_customer_inquiries: false
  };
  next.budget_policy = {
    ...(next.budget_policy || {}),
    variable_cost_ceiling_eur: ceiling,
    paid_overflow: false,
    automatic_budget_increase: false
  };
  next.controlled_paid_staging = {
    schema: 'aurentara.controlled-paid-staging.v1',
    status: 'ACTIVE',
    environment: 'staging',
    project_budget_ceiling_eur: ceiling,
    paid_provider_permission: true,
    provider_allowlist: [...EXPLICIT_PROVIDER_ALLOWLIST],
    production_locked: true,
    public_deploy: false,
    dns_change: false,
    external_write_locked: true,
    billing: false,
    checkout: false,
    public_indexing: false,
    real_end_customer_data: false,
    automatic_budget_increase: false,
    cost_ledger_unit: 'EUR',
    cost_ledger: ledgerResult.ledger,
    provider_native_hard_cap_guaranteed: false
  };
  next.synthetic = false;
  next.real_customer_data = false;
  next.production_authorized = false;
  next.production_deploy = false;
  return { ok: true, changed: true, project: next, snapshot: controlledPaidStagingSnapshot(next), production_deploy: false };
}

export function controlledPaidProviderEligibility(project = {}, provider = {}) {
  const policy = project.controlled_paid_staging;
  if (policy?.status !== 'ACTIVE') return { ok: false, error: 'CONTROLLED_PAID_STAGING_NOT_ACTIVE', production_deploy: false };
  const id = clean(provider.id, 160);
  const allowlisted = Array.isArray(policy.provider_allowlist) && policy.provider_allowlist.includes(id);
  const connected = ['CONNECTED_STAGING', 'READ_ONLY_VERIFIED'].includes(clean(provider.connection_state, 80).toUpperCase());
  const verified = ['CURRENT_RUNTIME_VERIFIED', 'VERIFIED_STAGING', 'VERIFIED_READ_ONLY', 'CONNECTION_VERIFIED_STAGING'].includes(clean(provider.verification, 100).toUpperCase());
  const executable = provider.active_runtime === true && provider.runtime_eligible !== false;
  const writeRestricted = Array.isArray(provider.restrictions) && provider.restrictions.some((value) => /WRITE_NOT_VERIFIED|PUBLISH_NOT_VERIFIED|INFERENCE_NOT_VERIFIED|FLOW_EXECUTION_NOT_VERIFIED/.test(String(value)));
  const paidEligible = allowlisted && connected && verified && executable && !writeRestricted;
  return {
    ok: paidEligible,
    provider_id: id,
    allowlisted,
    connected,
    verified,
    runtime_eligible: executable,
    controlled_paid_staging_eligible: paidEligible,
    reason: paidEligible ? 'CONNECTED_VERIFIED_RUNTIME_ELIGIBLE_AND_PROJECT_ALLOWLISTED' : 'PROVIDER_CURRENT_TRUTH_OR_PROJECT_POLICY_NOT_ELIGIBLE',
    production_deploy: false
  };
}

export function evaluateControlledPaidStagingBudget(project = {}, projectedAdditionalCostEur = 0) {
  const snapshot = controlledPaidStagingSnapshot(project);
  const additional = money(Math.max(0, Number(projectedAdditionalCostEur || 0)));
  const projectedTotal = money(snapshot.current_spend_eur + snapshot.reserved_eur + additional);
  const ok = snapshot.active && additional <= snapshot.remaining_budget_eur && projectedTotal <= snapshot.project_budget_ceiling_eur;
  return {
    ok,
    blocked: !ok,
    project_budget_ceiling_eur: snapshot.project_budget_ceiling_eur,
    current_spend_eur: snapshot.current_spend_eur,
    reserved_eur: snapshot.reserved_eur,
    projected_additional_cost_eur: additional,
    projected_total_eur: projectedTotal,
    remaining_budget_eur: snapshot.remaining_budget_eur,
    approval_required: !ok,
    automatic_budget_increase: false,
    reason: ok ? 'WITHIN_PROJECT_EXECUTION_BUDGET' : 'PROJECT_EXECUTION_BUDGET_REAPPROVAL_REQUIRED',
    production_deploy: false
  };
}

export function reserveControlledPaidStagingCost(project = {}, request = {}) {
  const gate = evaluateControlledPaidStagingBudget(project, request.estimated_cost_eur);
  if (!gate.ok) return { ok: false, error: 'PROJECT_BUDGET_EXCEEDED', gate, project: clone(project), production_deploy: false };
  const ledger = ledgerFromProject(project);
  const reserved = reserveCost(ledger, {
    reservation_id: request.reservation_id,
    cost_units: money(request.estimated_cost_eur),
    provider_id: request.provider_id,
    capability: request.capability,
    mission_id: request.mission_id,
    task_id: request.task_id,
    execution_id: request.execution_id,
    customer_id: project.customer_id,
    project_id: project.project_id,
    scope_key: project.scope_key,
    binding: request.binding
  });
  if (!reserved.ok) return { ...reserved, gate, project: clone(project), production_deploy: false };
  const next = clone(project);
  next.controlled_paid_staging.cost_ledger = reserved.ledger;
  return { ok: true, project: next, gate, reservation_id: reserved.reservation_id, snapshot: controlledPaidStagingSnapshot(next), production_deploy: false };
}

export function settleControlledPaidStagingCost(project = {}, request = {}) {
  const ledger = ledgerFromProject(project);
  if (!ledger) return { ok: false, error: 'CONTROLLED_PAID_STAGING_LEDGER_REQUIRED', project: clone(project), production_deploy: false };
  const settled = settleCost(ledger, {
    ...request,
    customer_id: project.customer_id,
    project_id: project.project_id,
    scope_key: project.scope_key
  });
  if (!settled.ok) return { ...settled, project: clone(project), production_deploy: false };
  const next = clone(project);
  next.controlled_paid_staging.cost_ledger = settled.ledger;
  return { ok: true, project: next, snapshot: controlledPaidStagingSnapshot(next), production_deploy: false };
}

export function releaseControlledPaidStagingCost(project = {}, request = {}) {
  const ledger = ledgerFromProject(project);
  if (!ledger) return { ok: false, error: 'CONTROLLED_PAID_STAGING_LEDGER_REQUIRED', project: clone(project), production_deploy: false };
  const released = releaseCost(ledger, {
    ...request,
    customer_id: project.customer_id,
    project_id: project.project_id,
    scope_key: project.scope_key
  });
  if (!released.ok) return { ...released, project: clone(project), production_deploy: false };
  const next = clone(project);
  next.controlled_paid_staging.cost_ledger = released.ledger;
  return { ok: true, project: next, snapshot: controlledPaidStagingSnapshot(next), production_deploy: false };
}

export function controlledPaidStagingManifest() {
  return {
    schema: 'aurentara.controlled-paid-staging.v1',
    project_scoped: true,
    reference_project_id: CONTROLLED_PAID_STAGING_PROJECT_ID,
    max_project_execution_budget_eur: CONTROLLED_PAID_STAGING_MAX_EUR,
    existing_cost_ledger_reused: true,
    existing_mission_preflight_reused: true,
    execution_bound_cost_reservation_supported: true,
    terminal_cost_idempotency_supported: true,
    automatic_budget_increase: false,
    automatic_paid_overflow: false,
    production_deploy: false,
    public_deploy: false,
    external_customer_writes: false
  };
}
