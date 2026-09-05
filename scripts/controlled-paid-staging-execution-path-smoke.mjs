import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import {
  activateControlledPaidStagingProject,
  reserveControlledPaidStagingCost,
  CONTROLLED_PAID_STAGING_CONFIRMATION
} from '../src/operator-controlled-paid-staging-v1.js';
import { handleOperatorDashboard } from '../src/operator-controlled-paid-staging-dashboard-v1.js';

const operatorId = 'operator:execution-path@aurentara.test';
const scope = 'gelato-donatello:gelato-donatello-website-v1';
const base = {
  customer_id: 'gelato-donatello', project_id: 'gelato-donatello-website-v1', scope_key: scope,
  name: 'Gelato Donatello', industry: 'gelateria', country: 'DE', language: 'de', state: 'READY',
  blocked: false, priority: 1, budget_cost_units: 0, capability_count: 0, mission_count: 0, delivery_count: 0,
  production_deploy: false
};

function activeProject() {
  const result = activateControlledPaidStagingProject(base, {
    project_id: base.project_id, scope_key: scope, confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION,
    project_budget_ceiling_eur: 25, environment: 'staging', paid_provider_permission: true,
    production_locked: true, external_write_locked: true, public_deploy: false, dns_change: false,
    billing: false, checkout: false, public_indexing: false, real_end_customer_data: false,
    automatic_budget_increase: false
  });
  assert.equal(result.ok, true);
  return result.project;
}

function harness(project, extraOptions = {}) {
  const created = createOperatorRuntime({ operator_id: operatorId, portfolio: { operator_id: operatorId, projects: [project], production_deploy: false } });
  assert.equal(created.ok, true);
  created.runtime.selected_project_scope = scope;
  const store = createMemoryOperatorRuntimeStore([created.runtime]);
  const service = createOperatorRuntimeApiService({ operator_id: operatorId, store });
  const options = { runtime_service: service, authorize: async () => ({ ok: true, operator_id: operatorId, email: 'execution-path@aurentara.test' }), ...extraOptions };
  return { service, options };
}

async function call(options, path, body) {
  const request = new Request(`https://operator.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const response = await handleOperatorDashboard(request, {}, {}, options);
  const json = await response.clone().json();
  return { response, json };
}

// Dashboard-level over-budget gate: spend/reserve state in the real project ledger wins.
const nearlySpent = reserveControlledPaidStagingCost(activeProject(), {
  reservation_id: 'existing-reservation', estimated_cost_eur: 24.5,
  provider_id: 'make-core', capability: 'web_presence', mission_id: 'prior-mission'
});
assert.equal(nearlySpent.ok, true);
const blockedHarness = harness(nearlySpent.project);
const blocked = await call(blockedHarness.options, '/operator/api/mission-preflight', {
  scope_key: scope,
  mission_text: 'Erstelle eine private Staging-Webseite für Gelato Donatello.',
  requested_outcomes: ['web_presence'],
  projected_cost_eur: 0.01,
  variable_cost_ceiling_eur: 999
});
assert.equal(blocked.response.status, 409);
assert.equal(blocked.json.status, 'PROJECT_BUDGET_REAPPROVAL_REQUIRED');
assert.equal(blocked.json.budget_gate.blocked, true);
assert.equal(blocked.json.project_policy.project_budget_ceiling_eur, 25);
assert.equal(blocked.json.project_policy.reserved_eur, 24.5);

// Full dashboard wiring proof with a local zero-cost executor. No network/provider call is made.
let executorCalls = 0;
let capturedContract = null;
const executionHarness = harness(activeProject(), {
  current_runtime_verified_provider_ids: ['posthog-free'],
  synthetic_acceptance: true,
  live_staging_executor: async (contract) => {
    executorCalls += 1;
    capturedContract = structuredClone(contract);
    return {
      ok: true,
      status: 'LIVE_PROVIDER_VERIFIED',
      actual_provider: 'riosystems-native-web',
      executor_id: 'web-factory-native-v1',
      outputs: { fixture: 'native-web-safe-runner' },
      qa: { passed: true },
      synthetic_only: false,
      variable_cost_eur: 0,
      paid_overflow: false,
      real_customer_data: false,
      external_customer_writes: false,
      public_deploy: false,
      dns_change: false,
      billing: false,
      checkout: false,
      public_indexing: false,
      production_deploy: false
    };
  }
});
const preflight = await call(executionHarness.options, '/operator/api/mission-preflight', {
  scope_key: scope,
  mission_text: 'Erstelle eine private Staging-Webseite für Gelato Donatello mit Startseite und Sortenübersicht.',
  requested_outcomes: ['web_presence']
});
assert.equal(preflight.response.status, 201);
const execute = await call(executionHarness.options, '/operator/api/mission-plan-decision', {
  scope_key: scope,
  plan_token: preflight.json.plan_token,
  decision: 'approve',
  confirmation_text: CONTROLLED_PAID_STAGING_CONFIRMATION
});
assert.equal(execute.response.status, 201);
assert.equal(executorCalls, 1);
assert.equal(capturedContract.environment, 'staging');
assert.equal(capturedContract.data_mode, 'controlled-prelaunch');
assert.equal(capturedContract.project_budget_ceiling_eur, 25);
assert.equal(capturedContract.production_authorized, false);
assert.equal(capturedContract.external_customer_writes, false);
assert.equal(capturedContract.public_deploy, false);
assert.equal(capturedContract.canonical_provider_envelope.provider_route.provider_id, 'riosystems-native-web');
assert.equal(capturedContract.canonical_provider_envelope.provider_route.capability, 'web.build');
assert.equal(capturedContract.canonical_provider_envelope.executor_id, 'web-factory-native-v1');
assert.equal(execute.json.project_policy.current_spend_eur, 0);
assert.equal(execute.json.project_policy.reserved_eur, 0);
assert.equal(execute.json.project_policy.remaining_budget_eur, 25);
assert.equal(execute.json.variable_cost_eur, 0);

const snapshot = await executionHarness.service.handle({ method: 'GET', path: '/snapshot' });
assert.equal(snapshot.ok, true);
assert.equal(snapshot.runtime.live_staging_runs.length, 1);
assert.equal(snapshot.runtime.live_staging_runs[0].controlled_paid_staging, true);
assert.equal(snapshot.runtime.live_staging_runs[0].status, 'LIVE_STAGING_VERIFIED');
assert.equal(snapshot.runtime.live_staging_runs[0].variable_cost_eur, 0);
assert.equal(snapshot.runtime.live_staging_runs[0].evidence.planned_provider, 'riosystems-native-web');
assert.equal(snapshot.runtime.live_staging_runs[0].evidence.dispatched_provider, 'riosystems-native-web');
assert.equal(snapshot.runtime.live_staging_runs[0].evidence.actual_provider, 'riosystems-native-web');
assert.equal(snapshot.runtime.live_staging_runs[0].evidence.executor_id, 'web-factory-native-v1');

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.controlled-paid-staging-execution-path-smoke.v1',
  dashboard_over_budget_gate: 'PASS',
  budget_reserve_path: 'PASS',
  eligible_provider_route_path: 'PASS',
  existing_live_staging_runtime_path: 'PASS',
  cost_settlement_release_path: 'PASS',
  delivery_verification_path: 'PASS',
  paid_provider_calls: 0,
  actual_acceptance_cost_eur: 0,
  gelato_website_executed: false,
  production_deploy: false,
  public_deploy: false,
  external_customer_writes: false
}, null, 2));
