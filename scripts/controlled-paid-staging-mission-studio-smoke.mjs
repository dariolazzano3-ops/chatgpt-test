import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { activateControlledPaidStagingProject, CONTROLLED_PAID_STAGING_CONFIRMATION } from '../src/operator-controlled-paid-staging-v1.js';
import { handleOperatorDashboard } from '../src/operator-controlled-paid-staging-dashboard-v1.js';

const operatorId = 'operator:acceptance@aurentara.test';
const gelatoScope = 'gelato-donatello:gelato-donatello-website-v1';
const otherScope = 'synthetic-customer-bakery:bakery-muller:universal-regression-v1';

const gelatoBase = {
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: gelatoScope,
  name: 'Gelato Donatello',
  industry: 'gelateria', country: 'DE', language: 'de',
  state: 'READY', blocked: false, priority: 1, budget_cost_units: 0,
  capability_count: 0, mission_count: 0, delivery_count: 0,
  production_deploy: false
};

const activated = activateControlledPaidStagingProject(gelatoBase, {
  project_id: gelatoBase.project_id,
  scope_key: gelatoScope,
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
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
  automatic_budget_increase: false
});
assert.equal(activated.ok, true);

const otherProject = {
  customer_id: 'synthetic-customer-bakery',
  project_id: 'bakery-muller:universal-regression-v1',
  scope_key: otherScope,
  name: 'Bäckerei Müller', industry: 'bakery', country: 'DE', language: 'de',
  state: 'READY', blocked: false, priority: 10, budget_cost_units: 0,
  capability_count: 5, mission_count: 0, delivery_count: 1, production_deploy: false
};

const created = createOperatorRuntime({
  operator_id: operatorId,
  portfolio: { operator_id: operatorId, projects: [activated.project, otherProject], production_deploy: false }
});
assert.equal(created.ok, true);
created.runtime.selected_project_scope = gelatoScope;
const store = createMemoryOperatorRuntimeStore([created.runtime]);
const service = createOperatorRuntimeApiService({ operator_id: operatorId, store });
const authorize = async () => ({ ok: true, operator_id: operatorId, email: 'acceptance@aurentara.test' });
const options = { runtime_service: service, authorize };
const env = {};
const ctx = {};

async function call(path, body = undefined, method = body === undefined ? 'GET' : 'POST') {
  const request = new Request(`https://operator.test${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const response = await handleOperatorDashboard(request, env, ctx, options);
  assert.ok(response, `response required for ${path}`);
  let json = null;
  try { json = await response.clone().json(); } catch {}
  return { response, json };
}

// CASE 1 + frontend policy manipulation: server project policy wins.
const preflight = await call('/operator/api/mission-preflight', {
  scope_key: gelatoScope,
  mission_text: 'Erstelle eine private Staging-Webseite für Gelato Donatello mit Startseite, Sortenübersicht und Kontaktbereich.',
  requested_outcomes: ['web_presence'],
  budget_policy: { variable_cost_ceiling_eur: 999, paid_overflow: true },
  data_mode: 'public',
  production_authorized: true
});
assert.equal(preflight.response.status, 201);
assert.equal(preflight.json.execution_mode, 'CONTROLLED_PAID_STAGING');
assert.equal(preflight.json.project_policy.project_budget_ceiling_eur, 25);
assert.equal(preflight.json.project_policy.current_spend_eur, 0);
assert.equal(preflight.json.project_policy.reserved_eur, 0);
assert.equal(preflight.json.project_policy.remaining_budget_eur, 25);
assert.equal(preflight.json.project_policy.data_mode, 'controlled-prelaunch');
assert.equal(preflight.json.project_policy.production, 'LOCKED');
assert.equal(preflight.json.project_policy.external_customer_writes, false);
assert.equal(preflight.json.budget_gate.ok, true);
assert.ok(preflight.json.cost_preflight.recommended_cost_ceiling_eur > 0);
assert.ok(preflight.json.cost_preflight.recommended_cost_ceiling_eur <= 25);
assert.equal(preflight.json.approval_binding.project_id, 'gelato-donatello-website-v1');
assert.equal(preflight.json.approval_binding.environment, 'staging');
assert.equal(preflight.json.approval_binding.production_locked, true);
assert.equal(preflight.json.approval_binding.external_write_locked, true);

// CASE 2: projected server-side mission estimate is allowed within the budget.
assert.equal(preflight.json.budget_gate.blocked, false);

// Dashboard project detail exposes the real ledger values.
const detail = await call(`/operator/api/project-detail/${encodeURIComponent(gelatoScope)}`);
assert.equal(detail.response.status, 200);
assert.equal(detail.json.controlled_paid_staging.active, true);
assert.equal(detail.json.controlled_paid_staging.project_budget_ceiling_eur, 25);
assert.equal(detail.json.controlled_paid_staging.remaining_budget_eur, 25);

// CASE 6: frontend cannot request production or external writes during approval.
const unsafe = await call('/operator/api/mission-plan-decision', {
  scope_key: gelatoScope,
  plan_token: preflight.json.plan_token,
  decision: 'approve',
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
  readiness_only: true,
  production_authorized: true,
  external_customer_writes: true
});
assert.equal(unsafe.response.status, 400);
assert.equal(unsafe.json.error, 'CONTROLLED_PAID_STAGING_SAFETY_GATE_REJECTED');

// Approval/readiness uses the durable plan, server provider truth and no provider call.
const readiness = await call('/operator/api/mission-plan-decision', {
  scope_key: gelatoScope,
  plan_token: preflight.json.plan_token,
  decision: 'approve',
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
  readiness_only: true,
  projected_cost_eur: 0.01,
  variable_cost_ceiling_eur: 999
});
assert.equal(readiness.response.status, 200);
assert.equal(readiness.json.status, 'EXECUTION_READY');
assert.equal(readiness.json.execution_started, false);
assert.equal(readiness.json.paid_provider_calls, 0);
assert.equal(readiness.json.actual_cost_eur, 0);
assert.equal(readiness.json.project_policy.project_budget_ceiling_eur, 25);
assert.equal(readiness.json.budget_gate.ok, true);
assert.ok(Array.isArray(readiness.json.provider_routes.eligible_routes));
assert.ok(readiness.json.provider_routes.eligible_routes.length >= 1);

// CASE 4: other projects remain on the existing synthetic zero-cost adapter.
const selectSnapshot = await service.handle({ method: 'GET', path: '/snapshot' });
const selected = await service.handle({ method: 'POST', path: `/projects/${encodeURIComponent(otherScope)}/select`, body: { expected_revision: selectSnapshot.runtime.revision }, expected_revision: selectSnapshot.runtime.revision });
assert.equal(selected.ok, true);
const otherPreflight = await call('/operator/api/mission-preflight', {
  scope_key: otherScope,
  mission_text: 'Prüfe eine kleine synthetische Website-Mission.',
  requested_outcomes: ['web_presence']
});
assert.equal(otherPreflight.response.status, 201);
assert.equal(otherPreflight.json.execution_mode, undefined);
const oldBudget = otherPreflight.json.mission?.budget_policy?.variable_cost_ceiling_eur ?? otherPreflight.json.review?.mission?.budget_policy?.variable_cost_ceiling_eur;
assert.ok(oldBudget === 0 || oldBudget === undefined);

// CASE 3 is already covered by the lower-level A-E smoke; verify no accidental execution in this dashboard acceptance.
const finalSnapshot = await service.handle({ method: 'GET', path: '/snapshot' });
assert.equal((finalSnapshot.runtime.live_staging_runs || []).length, 0);
assert.equal((finalSnapshot.runtime.command_center_state?.portfolio?.projects || []).find((p) => p.scope_key === gelatoScope)?.controlled_paid_staging?.cost_ledger?.spent_cost_units || 0, 0);

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.controlled-paid-staging-mission-studio-smoke.v1',
  cases: {
    project_policy_resolution: 'PASS',
    server_cost_preflight: 'PASS',
    frontend_policy_manipulation: 'PASS',
    production_external_write_lock: 'PASS',
    provider_eligibility: 'PASS',
    durable_approval_readiness: 'PASS',
    other_project_safe_default: 'PASS',
    dashboard_budget_projection: 'PASS'
  },
  paid_provider_calls: 0,
  actual_acceptance_cost_eur: 0,
  gelato_website_executed: false,
  production_deploy: false
}, null, 2));
