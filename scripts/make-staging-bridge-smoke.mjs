import assert from 'node:assert/strict';
import {
  bakeryMullerMakeStagingSpec,
  buildMakeConnectionContract,
  makeStagingActivationManifest,
  planMakeReadOnlyPreflight,
  planMakeScenarioCreate,
  planMakeScenarioRun
} from '../src/make-staging-bridge.js';

const manifest = makeStagingActivationManifest();
assert.equal(manifest.provider_id, 'make-core');
assert.equal(manifest.status, 'CONTRACT_READY_CONNECTION_REQUIRED');
assert.equal(manifest.real_http_execution_implemented, false);
assert.equal(manifest.automatic_extra_credit_purchase, false);
assert.equal(manifest.production_deploy, false);

const unknown = buildMakeConnectionContract({
  zone_url: 'https://eu1.make.com',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  granted_scopes: ['organization:read', 'scenarios:read']
});
assert.equal(unknown.ready_for_read_only_preflight, false);
assert.ok(unknown.blockers.some((item) => item.code === 'MAKE_API_PLAN_ACCESS_UNVERIFIED'));

const free = buildMakeConnectionContract({
  zone_url: 'https://eu1.make.com',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'free',
  granted_scopes: ['organization:read', 'scenarios:read']
});
assert.ok(free.blockers.some((item) => item.code === 'MAKE_API_PLAN_UPGRADE_REQUIRED'));

const invalidHost = buildMakeConnectionContract({
  zone_url: 'https://evil.example',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read', 'scenarios:read']
});
assert.ok(invalidHost.blockers.some((item) => item.code === 'MAKE_ZONE_HOST_NOT_ALLOWED'));

const readyInput = {
  zone_url: 'https://eu1.make.com',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read', 'scenarios:read']
};
const ready = buildMakeConnectionContract(readyInput);
assert.equal(ready.ready_for_read_only_preflight, true);
assert.equal(ready.api_base_url, 'https://eu1.make.com/api/v2');
assert.equal(ready.secrets_embedded, false);

const preflight = planMakeReadOnlyPreflight(readyInput);
assert.equal(preflight.state, 'READY_FOR_READ_ONLY_PREFLIGHT');
assert.equal(preflight.execute_http, false);
assert.equal(preflight.external_write, false);
assert.equal(preflight.requests.length, 2);
assert.equal(preflight.requests[0].method, 'GET');
assert.ok(preflight.requests[1].url.includes('teamId=42'));

const bakery = bakeryMullerMakeStagingSpec();
assert.equal(bakery.environment, 'staging');
assert.equal(bakery.real_customer_data, false);
assert.equal(bakery.downstream_crm_write, false);
assert.equal(bakery.production_deploy, false);

const createBlocked = planMakeScenarioCreate({ ...readyInput, scenario_spec: bakery });
assert.equal(createBlocked.state, 'BLOCKED');
assert.ok(createBlocked.blockers.some((item) => item.code === 'MAKE_WRITE_SCOPE_REQUIRED'));
assert.ok(createBlocked.blockers.some((item) => item.code === 'PAID_PROVIDER_APPROVAL_REQUIRED'));
assert.ok(createBlocked.blockers.some((item) => item.code === 'EXTERNAL_WRITE_APPROVAL_REQUIRED'));
assert.ok(createBlocked.blockers.some((item) => item.code === 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED'));
assert.ok(createBlocked.blockers.some((item) => item.code === 'STAGING_ONLY_REQUIRED'));

const writeInput = {
  ...readyInput,
  granted_scopes: ['organization:read', 'scenarios:read', 'scenarios:write', 'scenarios:run'],
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true
};
const createPlan = planMakeScenarioCreate({ ...writeInput, scenario_spec: bakery });
assert.equal(createPlan.state, 'WRITE_PLAN_APPROVED_NOT_EXECUTED');
assert.equal(createPlan.request.method, 'POST');
assert.equal(createPlan.execute_http, false);
assert.equal(createPlan.production_deploy, false);

const embeddedSecret = planMakeScenarioCreate({
  ...writeInput,
  scenario_spec: { ...bakery, token: 'do-not-embed-me' }
});
assert.equal(embeddedSecret.state, 'BLOCKED');
assert.ok(embeddedSecret.blockers.some((item) => item.code === 'EMBEDDED_SECRET_REJECTED'));

const runBlocked = planMakeScenarioRun({ ...readyInput, scenario_id: 123 });
assert.equal(runBlocked.state, 'BLOCKED');
assert.ok(runBlocked.blockers.some((item) => item.code === 'MAKE_RUN_SCOPES_REQUIRED'));

const runPlan = planMakeScenarioRun({ ...writeInput, scenario_id: 123 });
assert.equal(runPlan.state, 'RUN_PLAN_APPROVED_NOT_EXECUTED');
assert.equal(runPlan.execute_http, false);
assert.equal(runPlan.production_deploy, false);

const prod = planMakeScenarioRun({ production_deploy: true });
assert.equal(prod.ok, false);
assert.equal(prod.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Make staging bridge smoke: OK');
