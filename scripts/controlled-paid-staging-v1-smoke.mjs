import assert from 'node:assert/strict';
import { evaluateCommand, applyLocalCommand } from '../src/command-center.js';
import {
  CONTROLLED_PAID_STAGING_CONFIRMATION,
  activateControlledPaidStagingProject,
  controlledPaidStagingSnapshot,
  controlledPaidProviderEligibility,
  evaluateControlledPaidStagingBudget,
  reserveControlledPaidStagingCost,
  settleControlledPaidStagingCost
} from '../src/operator-controlled-paid-staging-v1.js';
import { reserveOperatorLiveStagingExecution, finalizeOperatorLiveStagingExecution } from '../src/operator-finalization-runtime-v1.js';

const scope = 'gelato-donatello:gelato-donatello-website-v1';
const baseProject = () => ({
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: scope,
  business_name: 'Gelato Donatello',
  name: 'Gelato Donatello',
  industry: 'gelateria',
  country: 'DE',
  language: 'de',
  allowed_environments: ['staging'],
  environment: 'staging',
  data_policy: { synthetic_only: true, real_customer_data: false },
  budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
  state: 'READY',
  blocked: false,
  priority: 1,
  budget_cost_units: 0,
  capability_count: 0,
  mission_count: 0,
  delivery_count: 0,
  synthetic: true,
  real_customer_data: false,
  production_authorized: false,
  production_deploy: false
});

const activation = {
  type: 'ACTIVATE_CONTROLLED_PAID_STAGING',
  scope_key: scope,
  project_id: 'gelato-donatello-website-v1',
  project_budget_ceiling_eur: 25,
  environment: 'staging',
  paid_provider_permission: true,
  production_locked: true,
  external_write_locked: true,
  public_deploy: false,
  dns_change: false,
  billing: false,
  checkout: false,
  public_indexing: false,
  real_end_customer_data: false,
  automatic_budget_increase: false,
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
  approved: true
};

const state = {
  schema_version: 'riosystems.command-center.v1',
  operator_id: 'operator',
  portfolio: { operator_id: 'operator', projects: [baseProject()] },
  approvals: [], integration_health: {}, execution_runs: [], alerts: [], audit: [], production_deploy: false
};
const evaluated = evaluateCommand(state, activation);
assert.equal(evaluated.ok, true);
assert.equal(evaluated.ready_for_dispatch, true);
const applied = applyLocalCommand(state, evaluated);
assert.equal(applied.ok, true);
let gelato = applied.state.portfolio.projects[0];
let snap = controlledPaidStagingSnapshot(gelato);
assert.equal(snap.active, true);
assert.equal(snap.project_budget_ceiling_eur, 25);
assert.equal(snap.current_spend_eur, 0);
assert.equal(snap.remaining_budget_eur, 25);
assert.equal(snap.paid_provider_calls, 'ALLOWED_WITHIN_PROJECT_BUDGET');
assert.equal(snap.production, 'LOCKED');
assert.equal(snap.external_customer_writes, false);
assert.equal(snap.automatic_budget_increase, false);
assert.equal(snap.provider_native_hard_cap_guaranteed, false);

// CASE A: 0 + 3 => allowed.
assert.equal(evaluateControlledPaidStagingBudget(gelato, 3).ok, true);

// Move project spend to 20 using the existing project-scoped cost ledger.
let reservation = reserveControlledPaidStagingCost(gelato, { reservation_id: 'seed-20', estimated_cost_eur: 20, mission_id: 'seed' });
assert.equal(reservation.ok, true);
let settlement = settleControlledPaidStagingCost(reservation.project, { reservation_id: 'seed-20', actual_cost_units: 20 });
assert.equal(settlement.ok, true);
gelato = settlement.project;

// CASE B: 20 + 4 => allowed. CASE C: 20 + 6 => blocked.
assert.equal(evaluateControlledPaidStagingBudget(gelato, 4).ok, true);
const caseC = evaluateControlledPaidStagingBudget(gelato, 6);
assert.equal(caseC.ok, false);
assert.equal(caseC.approval_required, true);
assert.equal(caseC.reason, 'PROJECT_EXECUTION_BUDGET_REAPPROVAL_REQUIRED');

// CASE D: 25 spent => any paid execution blocked.
reservation = reserveControlledPaidStagingCost(gelato, { reservation_id: 'seed-5', estimated_cost_eur: 5, mission_id: 'seed' });
assert.equal(reservation.ok, true);
settlement = settleControlledPaidStagingCost(reservation.project, { reservation_id: 'seed-5', actual_cost_units: 5 });
assert.equal(settlement.ok, true);
gelato = settlement.project;
snap = controlledPaidStagingSnapshot(gelato);
assert.equal(snap.current_spend_eur, 25);
assert.equal(snap.remaining_budget_eur, 0);
assert.equal(evaluateControlledPaidStagingBudget(gelato, 0.01).ok, false);

// CASE E: another project keeps safe defaults and cannot activate this V1.
const other = { ...baseProject(), customer_id: 'other', project_id: 'other-project', scope_key: 'other:other-project' };
assert.equal(controlledPaidStagingSnapshot(other).active, false);
assert.equal(controlledPaidStagingSnapshot(other).project_budget_ceiling_eur, 0);
assert.equal(activateControlledPaidStagingProject(other, { ...activation, project_id: 'other-project', scope_key: other.scope_key }).ok, false);

// Provider eligibility remains evidence-driven and project-scoped.
const cf = controlledPaidProviderEligibility(applied.state.portfolio.projects[0], {
  id: 'cloudflare-workers-free', connection_state: 'CONNECTED_STAGING', verification: 'VERIFIED_STAGING', active_runtime: true, runtime_eligible: true, restrictions: [], capabilities: ['web.deploy']
});
assert.equal(cf.ok, true);
const n8n = controlledPaidProviderEligibility(applied.state.portfolio.projects[0], {
  id: 'n8n-client-owned', connection_state: 'NOT_CONNECTED', verification: 'NOT_CONNECTED', active_runtime: false, runtime_eligible: false, restrictions: [], capabilities: ['automation.run']
});
assert.equal(n8n.ok, false);

// Supervised live-staging reservation reserves budget before executor dispatch and settles actual cost after QA.
const liveProject = applied.state.portfolio.projects[0];
const runtime = {
  schema: 'riosystems.operator-runtime.v1', runtime_version: '1.0', operator_id: 'operator', revision: 1,
  selected_project_scope: scope,
  command_center_state: { ...applied.state, portfolio: { ...applied.state.portfolio, projects: [liveProject] } },
  missions: [], universal_runs: [], mission_plans: [{
    schema: 'riosystems.operator-mission-plan.v1', plan_token: 'dplan:gelato-test:r1', scope_key: scope, mission_id: 'gelato-test',
    review: { mission: { mission_id: 'gelato-test', business_name: 'Gelato Donatello' }, plan: { selected_capabilities: [{ capability: 'web_presence' }] } },
    safe_input: {}, status: 'APPROVAL_REQUIRED', runtime_revision: 1, production_deploy: false
  }], live_staging_runs: [], audit: [], safety: { production_deploy: false }, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z'
};
const reserved = reserveOperatorLiveStagingExecution(runtime, {
  plan_token: 'dplan:gelato-test:r1', confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
  idempotency_key: 'gelato-paid-staging-smoke', environment: 'staging', variable_cost_ceiling_eur: 3,
  paid_overflow: false, production_authorized: false, external_customer_writes: false, public_deploy: false,
  dns_change: false, billing: false, checkout: false, public_indexing: false, real_customer_data: false,
  provider_eligibility_pass: true, project_scope_pass: true,
  provider_routes: [{ provider_id: 'cloudflare-workers-free', capability: 'web.deploy' }]
}, 1, { at: '2026-09-03T00:01:00.000Z' });
assert.equal(reserved.ok, true);
assert.equal(reserved.contract.controlled_paid_staging, undefined);
assert.equal(reserved.contract.paid_provider_calls, 'ALLOWED_WITHIN_PROJECT_BUDGET');
assert.equal(reserved.run.controlled_paid_staging, true);
assert.equal(reserved.run.reserved_variable_cost_eur, 3);
assert.equal(controlledPaidStagingSnapshot(reserved.runtime.command_center_state.portfolio.projects[0]).reserved_eur, 3);

const finalized = finalizeOperatorLiveStagingExecution(reserved.runtime, reserved.run.execution_id, {
  ok: true, status: 'LIVE_PROVIDER_VERIFIED', qa: { passed: true }, synthetic_only: false,
  real_customer_data: false, variable_cost_eur: 2.5, paid_overflow: false, production_deploy: false,
  external_customer_writes: false, public_deploy: false, dns_change: false, billing: false, checkout: false, public_indexing: false
}, reserved.runtime.revision, { at: '2026-09-03T00:02:00.000Z' });
assert.equal(finalized.ok, true);
assert.equal(finalized.run.variable_cost_eur, 2.5);
assert.equal(finalized.run.project_budget.current_spend_eur, 2.5);
assert.equal(finalized.run.project_budget.remaining_budget_eur, 22.5);

// Existing zero-cost live staging remains unchanged for a non-controlled project.
const zeroScope = 'safe:zero-project';
const zeroRuntime = structuredClone(runtime);
zeroRuntime.revision = 1;
zeroRuntime.selected_project_scope = zeroScope;
zeroRuntime.command_center_state.portfolio.projects = [{ ...other, customer_id: 'safe', project_id: 'zero-project', scope_key: zeroScope }];
zeroRuntime.mission_plans = [{ ...runtime.mission_plans[0], plan_token: 'dplan:zero:r1', scope_key: zeroScope, mission_id: 'zero', runtime_revision: 1 }];
zeroRuntime.live_staging_runs = [];
const zeroReserved = reserveOperatorLiveStagingExecution(zeroRuntime, {
  plan_token: 'dplan:zero:r1', confirmation_text: 'CONFIRM_LIVE_STAGING_ZERO_COST', idempotency_key: 'zero-smoke',
  environment: 'staging', synthetic_only: true, variable_cost_ceiling_eur: 0, paid_overflow: false,
  production_authorized: false, provider_eligibility_pass: true, project_scope_pass: true
}, 1);
assert.equal(zeroReserved.ok, true);
const paidOnZero = reserveOperatorLiveStagingExecution(zeroRuntime, {
  plan_token: 'dplan:zero:r1', confirmation_text: 'CONFIRM_LIVE_STAGING_ZERO_COST', idempotency_key: 'zero-paid-smoke',
  environment: 'staging', synthetic_only: true, variable_cost_ceiling_eur: 1, paid_overflow: false,
  production_authorized: false, provider_eligibility_pass: true, project_scope_pass: true
}, 1);
assert.equal(paidOnZero.ok, false);

console.log(JSON.stringify({
  status: 'PASS',
  project: 'gelato-donatello-website-v1',
  budget_cases: { A: 'ALLOWED', B: 'ALLOWED', C: 'BLOCKED', D: 'BLOCKED', E: 'SAFE_DEFAULT' },
  project_budget_eur: 25,
  paid_provider_calls: 'ALLOWED_WITHIN_PROJECT_BUDGET',
  production: 'LOCKED', public_deploy: false, external_customer_writes: false,
  automatic_budget_increase: false, provider_native_hard_cap_guaranteed: false,
  gelato_mission_executed: false
}, null, 2));
