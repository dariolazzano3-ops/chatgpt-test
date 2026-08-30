import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { handleOperatorDashboard } from '../src/operator-dashboard-completeness-v1.js';

const operatorId = 'operator:test@example.com';
const scope = 'synthetic-customer-craft:handwerk-modernisierung:universal-v1';
const created = createOperatorRuntime({
  operator_id: operatorId,
  selected_project_scope: scope,
  portfolio: {
    operator_id: operatorId,
    projects: [{
      customer_id: 'synthetic-customer-craft',
      project_id: 'handwerk-modernisierung:universal-v1',
      scope_key: scope,
      name: 'Muster Handwerksbetrieb',
      industry: 'handwerk', country: 'DE', language: 'de',
      state: 'ACTIVE', blocked: false, production_deploy: false
    }],
    production_deploy: false
  },
  at: '2026-08-30T12:30:00.000Z'
});
assert.equal(created.ok, true);
const store = createMemoryOperatorRuntimeStore([created.runtime]);
let service = createOperatorRuntimeApiService({ operator_id: operatorId, store });
let executorCalls = 0;
const executor = async (contract) => {
  executorCalls += 1;
  assert.equal(contract.schema, 'riosystems.operator-live-staging-execution-contract.v1');
  assert.equal(contract.scope_key, scope);
  assert.equal(contract.environment, 'staging');
  assert.equal(contract.synthetic_only, true);
  assert.equal(contract.variable_cost_ceiling_eur, 0);
  assert.equal(contract.paid_overflow, false);
  assert.equal(contract.production_authorized, false);
  assert.ok(contract.idempotency_key);
  return {
    ok: true,
    schema: 'riosystems.synthetic-live-staging-evidence.v1',
    status: 'LIVE_STAGING_VERIFIED',
    provider_chain: ['make-core','supabase-free','posthog-free','cloudflare-workers-ai-free'],
    qa: { passed: true },
    synthetic_only: true,
    real_customer_data: false,
    variable_cost_eur: 0,
    paid_overflow: false,
    production_deploy: false
  };
};
const authorize = async () => ({ ok: true, operator_id: operatorId, email: 'test@example.com' });
const env = { RIOSYSTEMS_ENVIRONMENT: 'local' };
const ctx = {};
const request = (path, method = 'GET', body = null) => new Request(`https://operator.test${path}`, {
  method,
  headers: body ? { 'content-type': 'application/json' } : {},
  body: body ? JSON.stringify(body) : undefined
});
const options = () => ({ runtime_service: service, live_staging_executor: executor, authorize });

const preflight = await handleOperatorDashboard(request('/operator/api/mission-preflight', 'POST', {
  scope_key: scope,
  industry: 'handwerk', country: 'DE', language: 'de',
  mission_text: 'Baue ein digitales Vertriebs- und Betriebssystem mit Website, Lead-Erfassung, CRM, automatisierter Anfrageverarbeitung, KI-Unterstützung, Analytics und Growth-Grundlage.',
  requested_outcomes: ['website','crm','automation','analytics','growth'],
  known_constraints: ['synthetische Daten','keine Production']
}), env, ctx, options());
assert.equal(preflight.status, 201);
const review = await preflight.json();
assert.equal(review.durable_plan, true);
assert.equal(review.live_staging_available, true);
assert.match(review.plan_token, /^dplan:/);
assert.equal(review.runtime_revision, 2);

let approvals = await handleOperatorDashboard(request('/operator/api/approvals'), env, ctx, options());
assert.equal(approvals.status, 200);
let approvalBody = await approvals.json();
assert.equal(approvalBody.durable_plan_store, true);
assert.equal(approvalBody.mission_plans.length, 1);
assert.equal(approvalBody.mission_plans[0].plan_token, review.plan_token);
assert.equal(approvalBody.mission_plans[0].live_staging_available, true);

// Simulate a Worker/runtime-service restart. The durable plan must survive because it is in the store.
service = createOperatorRuntimeApiService({ operator_id: operatorId, store });
approvals = await handleOperatorDashboard(request('/operator/api/approvals'), env, ctx, options());
approvalBody = await approvals.json();
assert.equal(approvalBody.mission_plans.length, 1);
assert.equal(approvalBody.runtime_revision, 2);

const live = await handleOperatorDashboard(request('/operator/api/mission-plan-decision', 'POST', {
  plan_token: review.plan_token,
  decision: 'approve_live_staging',
  confirmation_text: 'CONFIRM_LIVE_STAGING_ZERO_COST'
}), env, ctx, options());
assert.equal(live.status, 201);
const liveBody = await live.json();
assert.equal(liveBody.status, 'LIVE_STAGING_VERIFIED');
assert.equal(liveBody.variable_cost_eur, 0);
assert.equal(liveBody.production_deploy, false);
assert.equal(executorCalls, 1);

const duplicate = await handleOperatorDashboard(request('/operator/api/mission-plan-decision', 'POST', {
  plan_token: review.plan_token,
  decision: 'approve_live_staging',
  confirmation_text: 'CONFIRM_LIVE_STAGING_ZERO_COST'
}), env, ctx, options());
assert.notEqual(duplicate.status, 201);
assert.equal(executorCalls, 1);

const deliveries = await service.handle({ method: 'GET', path: '/deliveries' });
assert.equal(deliveries.ok, true);
assert.equal(deliveries.body.live_staging_executions.length, 1);
assert.equal(deliveries.body.live_staging_executions[0].status, 'LIVE_STAGING_VERIFIED');
assert.equal(deliveries.body.live_staging_executions[0].evidence.qa.passed, true);
assert.equal(deliveries.body.live_staging_executions[0].evidence.variable_cost_eur, 0);

const runtimeAfter = deliveries.runtime;
assert.equal(runtimeAfter.live_staging_runs.length, 1);
assert.equal(runtimeAfter.mission_plans[0].status, 'APPROVED');
assert.ok(runtimeAfter.audit.some((event) => event.event === 'MISSION_PLAN_DURABLY_RECORDED'));
assert.ok(runtimeAfter.audit.some((event) => event.event === 'LIVE_STAGING_EXECUTION_RESERVED'));
assert.ok(runtimeAfter.audit.some((event) => event.event === 'LIVE_STAGING_EXECUTION_VERIFIED'));

// A forged unsafe execution must fail before the executor can run.
const unsafe = await service.runLiveStaging({
  expected_revision: runtimeAfter.revision,
  plan_token: review.plan_token,
  confirmation_text: 'CONFIRM_LIVE_STAGING_ZERO_COST',
  idempotency_key: 'unsafe-cost-test',
  environment: 'staging', synthetic_only: true, production_authorized: false,
  variable_cost_ceiling_eur: 1, paid_overflow: false,
  provider_eligibility_pass: true, project_scope_pass: true
}, { executor });
assert.notEqual(unsafe.status, 201);
assert.equal(executorCalls, 1);

console.log(JSON.stringify({
  ok: true,
  schema: 'riosystems.operator-live-staging-bridge.smoke.v1',
  durable_plan_restart_recovery: true,
  live_staging_execution_reserved_before_call: true,
  duplicate_provider_execution_prevented: true,
  evidence_returned_to_runtime: true,
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
