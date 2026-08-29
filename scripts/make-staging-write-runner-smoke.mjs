import assert from 'node:assert/strict';
import { buildMakeSafeStagingScenarioCreatePlan, makeStagingWriteRunnerManifest, runMakeStagingScenarioCreate } from '../src/make-staging-write-runner.js';

const baseInput = {
  zone_url: 'https://eu1.make.com',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read', 'scenarios:read', 'scenarios:write'],
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  production_deploy: false
};

const plan = buildMakeSafeStagingScenarioCreatePlan(baseInput);
assert.equal(plan.ok, true);
assert.equal(plan.state, 'WRITE_PLAN_APPROVED_NOT_EXECUTED');
assert.equal(plan.request.method, 'POST');
assert.equal(plan.request.url, 'https://eu1.make.com/api/v2/scenarios');
assert.equal(plan.external_write, true);
assert.equal(plan.production_deploy, false);
const blueprint = JSON.parse(plan.request.body.blueprint);
assert.equal(blueprint.name.startsWith('RIOSYSTEMS STAGING - '), true);
assert.deepEqual(blueprint.flow.map((item) => item.module), ['json:ParseJSON']);
assert.deepEqual(JSON.parse(plan.request.body.scheduling), { type: 'on-demand' });

const manifest = makeStagingWriteRunnerManifest();
assert.equal(manifest.allowed_method, 'POST');
assert.equal(manifest.allowed_path, '/api/v2/scenarios');
assert.equal(manifest.external_connections_allowed, false);
assert.equal(manifest.production_deploy, false);

const missingWriteApproval = await runMakeStagingScenarioCreate(plan, {});
assert.equal(missingWriteApproval.ok, false);
assert.equal(missingWriteApproval.error, 'MAKE_EXTERNAL_WRITE_EXECUTION_APPROVAL_REQUIRED');

let seenAuthorization = null;
let seenBody = null;
const fetchImpl = async (url, options) => {
  assert.equal(url.toString(), 'https://eu1.make.com/api/v2/scenarios');
  assert.equal(options.method, 'POST');
  seenAuthorization = options.headers.Authorization;
  seenBody = JSON.parse(options.body);
  return new Response(JSON.stringify({ scenario: { id: 987, isActive: false, name: 'private-staging-name' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};

const result = await runMakeStagingScenarioCreate(plan, {
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: fetchImpl,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? 'top-secret-token' : null,
  production_deploy: false
});
assert.equal(result.ok, true);
assert.equal(result.stage, 'MAKE_STAGING_SCENARIO_CREATED_INACTIVE');
assert.equal(result.scenario_id, 987);
assert.equal(result.is_active, false);
assert.equal(result.external_side_effect_performed, true);
assert.equal(result.production_deploy, false);
assert.equal(seenAuthorization, 'Token top-secret-token');
assert.equal(seenBody.teamId, 42);
assert.equal(JSON.parse(seenBody.scheduling).type, 'on-demand');
const serialized = JSON.stringify(result);
assert.equal(serialized.includes('top-secret-token'), false);
assert.equal(serialized.includes('private-staging-name'), false);

const prod = structuredClone(plan);
prod.production_deploy = true;
const prodRejected = await runMakeStagingScenarioCreate(prod, {
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'token'
});
assert.equal(prodRejected.ok, false);
assert.equal(prodRejected.error, 'PRODUCTION_DEPLOY_REJECTED');

const tamperedHost = structuredClone(plan);
tamperedHost.request.url = 'https://example.com/api/v2/scenarios';
const hostRejected = await runMakeStagingScenarioCreate(tamperedHost, {
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'token'
});
assert.equal(hostRejected.ok, false);
assert.equal(hostRejected.error, 'MAKE_STAGING_CREATE_ENDPOINT_REJECTED');

const tamperedModule = structuredClone(plan);
const tamperedBlueprint = JSON.parse(tamperedModule.request.body.blueprint);
tamperedBlueprint.flow[0].module = 'http:ActionSendData';
tamperedModule.request.body.blueprint = JSON.stringify(tamperedBlueprint);
const moduleRejected = await runMakeStagingScenarioCreate(tamperedModule, {
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'token'
});
assert.equal(moduleRejected.ok, false);
assert.equal(moduleRejected.error, 'MAKE_STAGING_MODULE_REJECTED');

const connectionTamper = structuredClone(plan);
const connectionBlueprint = JSON.parse(connectionTamper.request.body.blueprint);
connectionBlueprint.flow[0].connection = 123;
connectionTamper.request.body.blueprint = JSON.stringify(connectionBlueprint);
const connectionRejected = await runMakeStagingScenarioCreate(connectionTamper, {
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  paid_provider_approved: true,
  staging_only: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'token'
});
assert.equal(connectionRejected.ok, false);
assert.equal(connectionRejected.error, 'MAKE_STAGING_RUNTIME_BINDING_REJECTED');

console.log('RIOSYSTEMS Make staging write runner smoke: OK');
