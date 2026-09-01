import assert from 'node:assert/strict';
import { handleOpenAiSecretPresence, openAiSecretPresenceManifest } from '../src/openai-secret-presence-v1.js';

const fakeSecret = 'test-only-not-a-real-key';
const env = {
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  API_TOKEN: 'test-operator-token',
  OPENAI_API_KEY: fakeSecret
};

const manifest = openAiSecretPresenceManifest(env);
assert.equal(manifest.schema, 'aurentara.openai-secret-presence.v1');
assert.equal(manifest.provider_id, 'openai-api');
assert.equal(manifest.runtime, 'riosystems-staging');
assert.equal(manifest.credential_ref, 'env://OPENAI_API_KEY');
assert.equal(manifest.secret_present, true);
assert.equal(manifest.secret_value_exposed, false);
assert.equal(manifest.external_request_performed, false);
assert.equal(manifest.openai_api_called, false);
assert.equal(manifest.paid_execution_approved, false);
assert.equal(manifest.production_deploy, false);
assert.equal(JSON.stringify(manifest).includes(fakeSecret), false);

const request = new Request('https://example.invalid/factory/diagnostics/openai-secret-presence', {
  method: 'GET',
  headers: { authorization: 'Bearer test-operator-token' }
});
const response = handleOpenAiSecretPresence(request, env);
assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.ok, true);
assert.equal(body.secret_present, true);
assert.equal(body.secret_value_exposed, false);
assert.equal(body.external_request_performed, false);
assert.equal(body.openai_api_called, false);
assert.equal(JSON.stringify(body).includes(fakeSecret), false);

const unauthorized = handleOpenAiSecretPresence(
  new Request('https://example.invalid/factory/diagnostics/openai-secret-presence'),
  env
);
assert.equal(unauthorized.status, 401);

const nonStaging = handleOpenAiSecretPresence(request, {
  ...env,
  RIOSYSTEMS_ENVIRONMENT: 'production'
});
assert.equal(nonStaging.status, 403);

console.log(JSON.stringify({
  suite: 'AURENTARA OPENAI SECRET PRESENCE V1',
  status: 'PASS',
  secret_value_exposed: false,
  external_request_performed: false,
  openai_api_called: false,
  variable_openai_cost_eur: 0,
  production_deploy: false
}, null, 2));
