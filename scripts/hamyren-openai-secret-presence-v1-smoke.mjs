import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  hamyrenOpenAiSecretPresenceManifest,
  handleHamyrenOpenAiSecretPresence
} from '../src/hamyren-openai-secret-presence-v1.js';

const oldSecret = 'old-openai-secret-test-only';
const hamyrenSecret = 'hamyren-openai-secret-test-only';

const oldOnly = hamyrenOpenAiSecretPresenceManifest({
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  OPENAI_API_KEY: oldSecret
});
assert.equal(oldOnly.secret_present, false);
assert.equal(oldOnly.credential_ref, 'env://HAMYREN_OPENAI_API_KEY');
assert.equal(oldOnly.secret_value_exposed, false);
assert.equal(oldOnly.external_request_performed, false);
assert.equal(oldOnly.openai_api_called, false);

const dedicated = hamyrenOpenAiSecretPresenceManifest({
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  OPENAI_API_KEY: oldSecret,
  HAMYREN_OPENAI_API_KEY: hamyrenSecret
});
assert.equal(dedicated.secret_present, true);
assert.equal(dedicated.secret_value_exposed, false);
assert.equal(dedicated.external_request_performed, false);
assert.equal(dedicated.openai_api_called, false);
assert.equal(JSON.stringify(dedicated).includes(hamyrenSecret), false);
assert.equal(JSON.stringify(dedicated).includes(oldSecret), false);

const request = new Request('https://example.invalid/factory/diagnostics/hamyren-openai-secret-presence', {
  method: 'GET',
  headers: { authorization: 'Bearer operator-test-token' }
});
const response = handleHamyrenOpenAiSecretPresence(request, {
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  API_TOKEN: 'operator-test-token',
  OPENAI_API_KEY: oldSecret,
  HAMYREN_OPENAI_API_KEY: hamyrenSecret
});
assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.secret_present, true);
assert.equal(body.secret_value_exposed, false);
assert.equal(body.external_request_performed, false);
assert.equal(body.openai_api_called, false);
assert.equal(body.inference_performed, false);
assert.equal(body.variable_cost_eur, 0);
assert.equal(JSON.stringify(body).includes(hamyrenSecret), false);
assert.equal(JSON.stringify(body).includes(oldSecret), false);

const privateRuntimeSource = await readFile(new URL('../src/customer-product/private-customer-ai-acceptance-v2.js', import.meta.url), 'utf8');
assert.equal(privateRuntimeSource.includes('env.HAMYREN_OPENAI_API_KEY'), true);
assert.equal(privateRuntimeSource.includes('env.OPENAI_API_KEY'), false);

console.log(JSON.stringify({
  suite: 'HAMYREN DEDICATED OPENAI SECRET PRESENCE V1',
  status: 'PASS',
  dedicated_secret_only: true,
  existing_openai_secret_untouched: true,
  secret_value_exposed: false,
  external_request_performed: false,
  openai_api_called: false,
  inference_performed: false,
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
