import { buildMakeSafeStagingExecutionPlan, runMakeStagingScenarioOnce } from '../src/make-staging-execution-runner.js';

const SCOPE = Object.freeze({
  customer_id: 'synthetic-mueller-elektrotechnik-saarbruecken',
  project_id: 'mueller-elektrotechnik-digital-customer-system-v1',
  project_uuid: 'b3f54cc8-4abf-4f9c-92c9-81a4ebcdd001',
  scope_key: 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1'
});

const makeToken = String(process.env.MAKE_API_TOKEN || '').trim();
if (!makeToken) throw new Error('MAKE_API_TOKEN_SECRET_MISSING');

const makePlan = buildMakeSafeStagingExecutionPlan({
  zone_url: process.env.MAKE_ZONE_URL || 'https://eu1.make.com',
  team_id: Number(process.env.MAKE_TEAM_ID || 939128),
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: process.env.MAKE_PLAN || 'core',
  granted_scopes: ['organization:read','scenarios:read','scenarios:write','scenarios:run'],
  scenario_id: Number(process.env.MAKE_SCENARIO_ID || 7149691),
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  bridge_scope: SCOPE,
  production_deploy: false
});
if (!makePlan.ok) throw new Error(makePlan.error || 'MUELLER_MAKE_PLAN_BLOCKED');
if (makePlan.project_scope !== SCOPE.scope_key) throw new Error('MUELLER_MAKE_SCOPE_MISMATCH');
if (makePlan.synthetic_payload.pii_in_envelope !== false) throw new Error('MUELLER_MAKE_PII_ENVELOPE_REJECTED');

const result = await runMakeStagingScenarioOnce(makePlan, {
  confirmation: 'RUN_STAGING_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? makeToken : null,
  timeout_ms: 15000,
  production_deploy: false
});
if (!result.ok) throw new Error(result.error || 'MUELLER_MAKE_EXECUTION_FAILED');
if (!result.scenario_restored_inactive) throw new Error('MUELLER_MAKE_SCENARIO_NOT_RESTORED_INACTIVE');

console.log('PROJECT FERRARI Müller live Make: PASS');
console.log(JSON.stringify({
  status: 'PASS',
  scope_key: SCOPE.scope_key,
  provider: 'make-core',
  scenario_id: result.scenario_id,
  execution_id: result.execution_id,
  execution_status: result.execution_status,
  scenario_restored_inactive: result.scenario_restored_inactive,
  synthetic_test_data_only: true,
  pii_in_payload: false,
  external_connections: false,
  variable_cost_eur: 0,
  production_deploy: false,
  customer_communication_sent: false
}, null, 2));
