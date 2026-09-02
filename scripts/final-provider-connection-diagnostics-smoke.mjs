import assert from 'node:assert/strict';
import { finalProviderPresenceManifest, handleFinalProviderConnectionDiagnostic } from '../src/final-provider-connection-diagnostics-v1.js';

const env = {
  API_TOKEN: 'test-api-token',
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'false',
  RIOSYSTEMS_EXTERNAL_WRITES: 'false',
  WEBFLOW_SITE_TOKEN: 'test-webflow-secret',
  ACTIVEPIECES_API_KEY: 'test-activepieces-secret'
};

const presence = finalProviderPresenceManifest(env);
assert.equal(presence.webflow.credential_present, true);
assert.equal(presence.activepieces.credential_present, true);
assert.equal(presence.secret_value_exposed, false);
assert.equal(presence.provider_requests, 0);
assert.equal(presence.provider_writes, 0);
assert.equal(presence.production_deploy, false);
assert.equal(presence.external_writes, false);
assert.equal(presence.real_customer_data, false);
assert.equal(presence.variable_cost_eur, 0);

const headers = { authorization: 'Bearer test-api-token' };
const seen = [];
const mockFetch = async (url, init = {}) => {
  seen.push({ url, method: init.method, authPresent: Boolean(init.headers?.authorization) });
  if (String(url).includes('api.webflow.com')) {
    return new Response(JSON.stringify({ sites: [{ id: 'safe-test-site' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).includes('cloud.activepieces.com')) {
    return new Response(JSON.stringify({ data: [{ id: 'safe-test-project' }], next: null, previous: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected URL');
};

const webflowPresenceResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/webflow-connection', { headers }),
  env,
  { fetch: mockFetch }
);
const webflowPresenceBody = await webflowPresenceResponse.json();
assert.equal(webflowPresenceBody.ok, true);
assert.equal(webflowPresenceBody.worker_reached, true);
assert.equal(webflowPresenceBody.credential_present, true);
assert.equal(webflowPresenceBody.provider_requests, 0);
assert.equal(webflowPresenceBody.provider_writes, 0);
assert.equal(webflowPresenceBody.production_deploy, false);
assert.equal(webflowPresenceBody.external_writes, false);
assert.equal(webflowPresenceBody.real_customer_data, false);
assert.equal(webflowPresenceBody.variable_cost_eur, 0);
assert.equal(seen.length, 0);
assert.equal(JSON.stringify(webflowPresenceBody).includes(env.WEBFLOW_SITE_TOKEN), false);

const activepiecesPresenceResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/activepieces-connection', { headers }),
  env,
  { fetch: mockFetch }
);
const activepiecesPresenceBody = await activepiecesPresenceResponse.json();
assert.equal(activepiecesPresenceBody.ok, true);
assert.equal(activepiecesPresenceBody.worker_reached, true);
assert.equal(activepiecesPresenceBody.credential_present, true);
assert.equal(activepiecesPresenceBody.provider_requests, 0);
assert.equal(activepiecesPresenceBody.provider_writes, 0);
assert.equal(activepiecesPresenceBody.production_deploy, false);
assert.equal(activepiecesPresenceBody.external_writes, false);
assert.equal(activepiecesPresenceBody.real_customer_data, false);
assert.equal(activepiecesPresenceBody.variable_cost_eur, 0);
assert.equal(seen.length, 0);
assert.equal(JSON.stringify(activepiecesPresenceBody).includes(env.ACTIVEPIECES_API_KEY), false);

const missingActivepiecesEnv = { ...env };
delete missingActivepiecesEnv.ACTIVEPIECES_API_KEY;
const missingActivepiecesResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/activepieces-connection', { headers }),
  missingActivepiecesEnv,
  { fetch: mockFetch }
);
const missingActivepieces = await missingActivepiecesResponse.json();
assert.equal(missingActivepiecesResponse.status, 200);
assert.equal(missingActivepieces.ok, false);
assert.equal(missingActivepieces.worker_reached, true);
assert.equal(missingActivepieces.credential_present, false);
assert.equal(missingActivepieces.provider_requests, 0);
assert.equal(missingActivepieces.provider_writes, 0);
assert.equal(missingActivepieces.production_deploy, false);
assert.equal(missingActivepieces.external_writes, false);
assert.equal(seen.length, 0);
assert.equal(JSON.stringify(missingActivepieces).includes('test-activepieces-secret'), false);

const webflowResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/webflow-connection?verify=sites', { headers }),
  env,
  { fetch: mockFetch }
);
const webflow = await webflowResponse.json();
assert.equal(webflow.ok, true);
assert.equal(webflow.worker_reached, true);
assert.equal(webflow.credential_valid, true);
assert.equal(webflow.authenticated, true);
assert.equal(webflow.site_accessible, true);
assert.equal(webflow.site_metadata_read, true);
assert.equal(webflow.connected_staging, true);
assert.equal(webflow.provider_requests, 1);
assert.equal(webflow.provider_writes, 0);
assert.equal(webflow.publish_performed, false);
assert.equal(webflow.production_deploy, false);
assert.equal(webflow.external_writes, false);
assert.equal(webflow.real_customer_data, false);
assert.equal(webflow.variable_cost_eur, 0);
assert.equal(JSON.stringify(webflow).includes(env.WEBFLOW_SITE_TOKEN), false);

const activepiecesRequestsBeforeVerify = seen.filter((item) => String(item.url).includes('cloud.activepieces.com')).length;
const activepiecesResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/activepieces-connection?verify=projects', { headers }),
  env,
  { fetch: mockFetch }
);
const activepieces = await activepiecesResponse.json();
const activepiecesRequestsAfterVerify = seen.filter((item) => String(item.url).includes('cloud.activepieces.com')).length;
assert.equal(activepieces.ok, true);
assert.equal(activepieces.worker_reached, true);
assert.equal(activepieces.credential_valid, true);
assert.equal(activepieces.authenticated, true);
assert.equal(activepieces.api_accessible, true);
assert.equal(activepieces.connected_staging, true);
assert.equal(activepieces.provider_requests, 1);
assert.equal(activepieces.provider_writes, 0);
assert.equal(activepieces.flow_execution_performed, false);
assert.equal(activepieces.production_deploy, false);
assert.equal(activepieces.external_writes, false);
assert.equal(activepieces.real_customer_data, false);
assert.equal(activepieces.variable_cost_eur, 0);
assert.equal(activepiecesRequestsAfterVerify - activepiecesRequestsBeforeVerify, 1);
assert.equal(JSON.stringify(activepieces).includes(env.ACTIVEPIECES_API_KEY), false);

assert.equal(seen.length, 2);
assert.equal(seen[0].url, 'https://api.webflow.com/v2/sites');
assert.equal(seen[1].url, 'https://cloud.activepieces.com/api/v1/projects?limit=1&types=PERSONAL');
assert.equal(seen.every((item) => item.method === 'GET'), true);
assert.equal(seen.every((item) => item.authPresent === true), true);

console.log(JSON.stringify({
  ok: true,
  suite: 'final-provider-connection-diagnostics-v1',
  worker_reached_contract: true,
  missing_credential_fails_closed: true,
  presence_provider_requests: 0,
  activepieces_verify_max_provider_requests: 1,
  simulated_read_requests: 2,
  provider_writes: 0,
  production_deploy: false,
  external_writes: false,
  real_customer_data: false,
  secrets_exposed: false
}, null, 2));
