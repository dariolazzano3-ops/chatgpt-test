import assert from 'node:assert/strict';
import { buildMakeSafeStagingExecutionPlan, makeStagingExecutionRunnerManifest, runMakeStagingScenarioOnce } from '../src/make-staging-execution-runner.js';

const plan = buildMakeSafeStagingExecutionPlan({
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
  production_deploy: false
});
assert.equal(plan.state, 'STAGING_EXECUTION_APPROVED_NOT_EXECUTED');
assert.equal(plan.scenario_id, 7149691);
assert.equal(plan.synthetic_payload.scope_key, 'bakery-muller:digital-system-v1');
assert.equal(plan.synthetic_payload.lead.external_ref, 'block3-lead-001');
assert.equal(plan.synthetic_payload.lead.email, 'block3-lead-001@example.invalid');
assert.equal(plan.synthetic_payload.lead.synthetic, true);

const manifest = makeStagingExecutionRunnerManifest();
assert.equal(manifest.single_supervised_run_only, true);
assert.equal(manifest.restore_inactive_required, true);
assert.equal(manifest.synthetic_bridge_payload_supported, true);
assert.equal(manifest.production_deploy, false);

const calls = [];
const fetchImpl = async (url, options = {}) => {
  const parsed = new URL(url);
  calls.push({ method: options.method || 'GET', path: parsed.pathname, body: options.body || null, auth: options.headers?.Authorization });
  if (parsed.pathname === '/api/v2/scenarios/7149691' && (options.method || 'GET') === 'GET') {
    return new Response(JSON.stringify({ scenario: { id: 7149691, name: 'RIOSYSTEMS STAGING - Bäckerei Müller Lead Intake', isActive: false } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (parsed.pathname.endsWith('/blueprint')) {
    return new Response(JSON.stringify({ response: { blueprint: { name: 'RIOSYSTEMS STAGING - Bäckerei Müller Lead Intake', flow: [{ id: 1, module: 'json:ParseJSON', version: 1 }], metadata: { version: 1 } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (parsed.pathname === '/api/v2/scenarios/7149691' && options.method === 'PATCH') {
    return new Response(JSON.stringify({ scenario: { id: 7149691, isActive: false } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (parsed.pathname.endsWith('/start')) return new Response(JSON.stringify({ scenario: { id: 7149691, isActive: true } }), { status: 200 });
  if (parsed.pathname.endsWith('/run')) return new Response(JSON.stringify({ executionId: 'exec-1', status: '1' }), { status: 200 });
  if (parsed.pathname.endsWith('/stop')) return new Response(JSON.stringify({ scenario: { id: 7149691, isActive: false } }), { status: 200 });
  return new Response('{}', { status: 404 });
};

const denied = await runMakeStagingScenarioOnce(plan, {});
assert.equal(denied.ok, false);
assert.equal(denied.error, 'MAKE_STAGING_EXECUTION_APPROVAL_REQUIRED');

const result = await runMakeStagingScenarioOnce(plan, {
  confirmation: 'RUN_STAGING_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'secret-token',
  production_deploy: false
});
assert.equal(result.ok, true);
assert.equal(result.stage, 'MAKE_STAGING_EXECUTION_COMPLETE_AND_INACTIVE');
assert.equal(result.scenario_restored_inactive, true);
assert.equal(result.synthetic_payload.lead.external_ref, 'block3-lead-001');
assert.equal(result.synthetic_payload.lead.email, 'block3-lead-001@example.invalid');
assert.deepEqual(calls.map((x) => `${x.method} ${x.path}`), [
  'GET /api/v2/scenarios/7149691',
  'GET /api/v2/scenarios/7149691/blueprint',
  'PATCH /api/v2/scenarios/7149691',
  'POST /api/v2/scenarios/7149691/start',
  'POST /api/v2/scenarios/7149691/run',
  'POST /api/v2/scenarios/7149691/stop'
]);
assert.equal(calls.every((x) => x.auth === 'Token secret-token'), true);
assert.equal(JSON.stringify(result).includes('secret-token'), false);
const patchBody = JSON.parse(calls[2].body);
const blueprint = JSON.parse(patchBody.blueprint);
assert.equal(blueprint.flow[0].module, 'json:ParseJSON');
const makePayload = JSON.parse(blueprint.flow[0].mapper.json);
assert.equal(makePayload.synthetic, true);
assert.equal(makePayload.scope_key, 'bakery-muller:digital-system-v1');
assert.equal(makePayload.lead.external_ref, 'block3-lead-001');
assert.equal(makePayload.lead.email.endsWith('@example.invalid'), true);
assert.equal(JSON.parse(patchBody.scheduling).type, 'on-demand');
assert.equal(JSON.parse(calls[4].body).responsive, true);

const activeFetch = async (url, options = {}) => {
  const parsed = new URL(url);
  if (parsed.pathname === '/api/v2/scenarios/7149691' && (options.method || 'GET') === 'GET') return new Response(JSON.stringify({ scenario: { id: 7149691, name: 'RIOSYSTEMS STAGING - test', isActive: true } }), { status: 200 });
  return new Response('{}', { status: 500 });
};
const alreadyActive = await runMakeStagingScenarioOnce(plan, {
  confirmation: 'RUN_STAGING_ONCE', external_write_execution_approved: true, supervised_execution_approved: true, paid_provider_approved: true, staging_only: true,
  fetch_impl: activeFetch, resolve_secret: async () => 'secret-token'
});
assert.equal(alreadyActive.ok, false);
assert.equal(alreadyActive.error, 'MAKE_STAGING_SCENARIO_ALREADY_ACTIVE');

console.log('RIOSYSTEMS Make staging execution runner smoke: OK');
