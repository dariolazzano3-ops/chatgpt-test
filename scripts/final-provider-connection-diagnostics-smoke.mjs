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
assert.equal(webflowPresenceBody.credential_present, true);
assert.equal(webflowPresenceBody.provider_requests, 0);
assert.equal(seen.length, 0);
assert.equal(JSON.stringify(webflowPresenceBody).includes(env.WEBFLOW_SITE_TOKEN), false);

const activepiecesPresenceResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/activepieces-connection', { headers }),
  env,
  { fetch: mockFetch }
);
const activepiecesPresenceBody = await activepiecesPresenceResponse.json();
assert.equal(activepiecesPresenceBody.ok, true);
assert.equal(activepiecesPresenceBody.credential_present, true);
assert.equal(activepiecesPresenceBody.provider_requests, 0);
assert.equal(seen.length, 0);
assert.equal(JSON.stringify(activepiecesPresenceBody).includes(env.ACTIVEPIECES_API_KEY), false);

const webflowResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/webflow-connection?verify=sites', { headers }),
  env,
  { fetch: mockFetch }
);
const webflow = await webflowResponse.json();
assert.equal(webflow.ok, true);
assert.equal(webflow.credential_valid, true);
assert.equal(webflow.authenticated, true);
assert.equal(webflow.site_accessible, true);
assert.equal(webflow.site_metadata_read, true);
assert.equal(webflow.connected_staging, true);
assert.equal(webflow.provider_requests, 1);
assert.equal(webflow.provider_writes, 0);
assert.equal(webflow.publish_performed, false);
assert.equal(webflow.production_deploy, false);
assert.equal(JSON.stringify(webflow).includes(env.WEBFLOW_SITE_TOKEN), false);

const activepiecesResponse = await handleFinalProviderConnectionDiagnostic(
  new Request('https://control.example/factory/diagnostics/activepieces-connection?verify=projects', { headers }),
  env,
  { fetch: mockFetch }
);
const activepieces = await activepiecesResponse.json();
assert.equal(activepieces.ok, true);
assert.equal(activepieces.credential_valid, true);
assert.equal(activepieces.authenticated, true);
assert.equal(activepieces.api_accessible, true);
assert.equal(activepieces.connected_staging, true);
assert.equal(activepieces.provider_requests, 1);
assert.equal(activepieces.provider_writes, 0);
assert.equal(activepieces.flow_execution_performed, false);
assert.equal(activepieces.production_deploy, false);
assert.equal(JSON.stringify(activepieces).includes(env.ACTIVEPIECES_API_KEY), false);

assert.equal(seen.length, 2);
assert.equal(seen[0].url, 'https://api.webflow.com/v2/sites');
assert.equal(seen[1].url, 'https://cloud.activepieces.com/api/v1/projects?limit=1&types=PERSONAL');
assert.equal(seen.every((item) => item.method === 'GET'), true);
assert.equal(seen.every((item) => item.authPresent === true), true);

console.log(JSON.stringify({
  ok: true,
  suite: 'final-provider-connection-diagnostics-v1',
  presence_provider_requests: 0,
  simulated_read_requests: 2,
  provider_writes: 0,
  production_deploy: false,
  secrets_exposed: false
}, null, 2));
