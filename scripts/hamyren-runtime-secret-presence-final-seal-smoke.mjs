import assert from 'node:assert/strict';
import entry from '../src/entry.js';

const hamyrenSecret = 'hamyren-runtime-secret-test-only';
const existingOpenAiSecret = 'existing-openai-secret-test-only';
const baseEnv = {
  AURENTARA_CUSTOMER_SURFACE_MODE: 'private-acceptance',
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'false',
  RIOSYSTEMS_EXTERNAL_WRITES: 'false',
  AURENTARA_CUSTOMER_PRIVATE_ACCEPTANCE_APPROVED: 'true',
  AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED: 'false',
  AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE: 'false',
  HAMYREN_OPENAI_API_KEY: hamyrenSecret,
  OPENAI_API_KEY: existingOpenAiSecret
};

const url = 'https://control.aurentarasystems.com/customer/api/hamyren-runtime-secret-presence';
const allowed = await entry.fetch(new Request(url, {
  method: 'GET',
  headers: { 'cf-access-jwt-assertion': 'test-access-assertion' }
}), baseEnv, {});
assert.equal(allowed.status, 200);
assert.equal(allowed.headers.get('x-aurentara-customer-mode'), 'private-acceptance');
assert.equal(allowed.headers.get('x-aurentara-public-active'), 'false');
assert.equal(allowed.headers.get('x-aurentara-production-deploy'), 'false');
const body = await allowed.json();
assert.equal(body.ok, true);
assert.equal(body.runtime, 'riosystems-staging');
assert.equal(body.hamyren_secret_present, true);
assert.equal(body.secret_value_exposed, false);
assert.equal(body.external_request_performed, false);
assert.equal(body.openai_api_called, false);
assert.equal(body.inference_performed, false);
assert.equal(body.production_deploy, false);
assert.equal(body.public_active, false);
assert.equal(body.billing_active, false);
assert.equal(body.variable_cost_eur, 0);
assert.equal(JSON.stringify(body).includes(hamyrenSecret), false);
assert.equal(JSON.stringify(body).includes(existingOpenAiSecret), false);

const withoutAccess = await entry.fetch(new Request(url, { method: 'GET' }), baseEnv, {});
assert.equal(withoutAccess.status, 403);
const deniedBody = await withoutAccess.text();
assert.equal(deniedBody.includes(hamyrenSecret), false);
assert.equal(deniedBody.includes(existingOpenAiSecret), false);

const productionDenied = await entry.fetch(new Request(url, {
  method: 'GET',
  headers: { 'cf-access-jwt-assertion': 'test-access-assertion' }
}), { ...baseEnv, RIOSYSTEMS_PRODUCTION_DEPLOY: 'true' }, {});
assert.equal(productionDenied.status, 403);

console.log(JSON.stringify({
  suite: 'HAMYREN RUNTIME SECRET PRESENCE FINAL SEAL',
  status: 'PASS',
  access_required: true,
  api_token_required: false,
  production_fail_closed: true,
  secret_value_exposed: false,
  external_request_performed: false,
  openai_api_called: false,
  inference_performed: false,
  variable_cost_eur: 0
}, null, 2));