import { buildBlock6MakeExecutionPlan, runBlock6MakeOnce } from '../src/block6-make-staging-runner.js';

const token = String(process.env.MAKE_API_TOKEN || '').trim();
if (!token) throw new Error('MAKE_API_TOKEN_MISSING');
if (String(process.env.BLOCK6_LIVE_APPROVED || '') !== 'RUN_BLOCK6_MAKE_ONCE') throw new Error('BLOCK6_LIVE_APPROVAL_REQUIRED');

const plan = buildBlock6MakeExecutionPlan({
  zone_url: 'https://eu1.make.com',
  team_id: 939128,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read','scenarios:read','scenarios:write','scenarios:run'],
  scenario_id: 7149691,
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
if (!plan.ok) throw new Error(plan.error || 'BLOCK6_MAKE_PLAN_FAILED');

const result = await runBlock6MakeOnce(plan, {
  confirmation: 'RUN_STAGING_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? token : null,
  timeout_ms: 15000,
  production_deploy: false
});
if (!result.ok) {
  console.log(JSON.stringify({ ok: false, error: result.error, scenario_restored_inactive: result.scenario_restored_inactive === true, production_deploy: false }));
  process.exit(4);
}
console.log(JSON.stringify({
  ok: true,
  scenario_id: result.scenario_id,
  execution_id: result.execution_id,
  execution_status: result.execution_status,
  trace_id: result.block6_trace_id,
  scope_key: result.block6_scope_key,
  scenario_restored_inactive: result.scenario_restored_inactive,
  idempotency_key: result.synthetic_payload.lead.idempotency_key,
  variable_cost_eur: 0,
  secrets_returned: false,
  production_deploy: false
}));
