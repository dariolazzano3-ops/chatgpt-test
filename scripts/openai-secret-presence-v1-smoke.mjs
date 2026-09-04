import assert from 'node:assert/strict';
import { handleOpenAiSecretPresence, openAiSecretPresenceManifest, operatorAiInferenceProbeManifest } from '../src/openai-secret-presence-v1.js';

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

const probeManifest = operatorAiInferenceProbeManifest();
assert.equal(probeManifest.schema, 'aurentara.operator-ai-inference-probe.v1');
assert.equal(probeManifest.preferred_model, 'gpt-5.6-luna');
assert.equal(probeManifest.tools_enabled, false);
assert.equal(probeManifest.retry_count, 0);
assert.ok(probeManifest.call_cost_ceiling_usd <= 0.01);
assert.ok(probeManifest.run_cost_ceiling_usd <= 0.25);

let externalRequests = 0;
let paidInferenceCalls = 0;
const probeFetch = async (url, options = {}) => {
  externalRequests += 1;
  if (url === 'https://api.openai.com/v1/models') {
    return new Response(JSON.stringify({ data: [{ id: 'gpt-5.6-luna' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url === 'https://api.openai.com/v1/responses') {
    paidInferenceCalls += 1;
    assert.equal(options.method, 'POST');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'gpt-5.6-luna');
    assert.equal(payload.reasoning.effort, 'none');
    assert.deepEqual(payload.tools, []);
    assert.equal(payload.store, false);
    assert.ok(payload.max_output_tokens <= 32);
    return new Response(JSON.stringify({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'AURENTARA_OPERATOR_AI_OK' }] }],
      usage: { input_tokens: 20, output_tokens: 6, total_tokens: 26 }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('UNEXPECTED_TEST_URL');
};

const probeRequest = new Request('https://example.invalid/factory/diagnostics/openai-secret-presence?verify=inference', {
  method: 'POST',
  headers: {
    authorization: 'Bearer test-operator-token',
    'x-aurentara-openai-probe-confirmation': 'AURENTARA_OPERATOR_AI_INFERENCE_TEST_V1'
  }
});
const probeResponse = await handleOpenAiSecretPresence(probeRequest, env, { fetch: probeFetch });
assert.equal(probeResponse.status, 200);
const probeBody = await probeResponse.json();
assert.equal(probeBody.ok, true);
assert.equal(probeBody.inference_verified, true);
assert.equal(probeBody.token_generation_verified, true);
assert.equal(probeBody.model, 'gpt-5.6-luna');
assert.equal(probeBody.usage.total_tokens, 26);
assert.equal(probeBody.tool_calls, 0);
assert.equal(probeBody.secret_value_exposed, false);
assert.equal(probeBody.external_writes, false);
assert.equal(probeBody.production_deploy, false);
assert.equal(probeBody.paid_execution_globally_approved, false);
assert.equal(probeBody.paid_inference_calls, 1);
assert.ok(probeBody.estimated_cost_usd > 0 && probeBody.estimated_cost_usd < 0.01);
assert.equal(externalRequests, 2);
assert.equal(paidInferenceCalls, 1);
assert.equal(JSON.stringify(probeBody).includes(fakeSecret), false);

let unavailablePaidCalls = 0;
const unavailable = await handleOpenAiSecretPresence(probeRequest, env, {
  fetch: async (url) => {
    if (url === 'https://api.openai.com/v1/models') {
      return new Response(JSON.stringify({ data: [{ id: 'unrelated-model' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    unavailablePaidCalls += 1;
    throw new Error('PAID_CALL_MUST_NOT_RUN');
  }
});
const unavailableBody = await unavailable.json();
assert.equal(unavailableBody.ok, false);
assert.equal(unavailableBody.error, 'OPENAI_OPERATOR_AI_MODEL_UNAVAILABLE');
assert.equal(unavailableBody.paid_inference_calls, 0);
assert.equal(unavailablePaidCalls, 0);

let deniedFetches = 0;
const denied = await handleOpenAiSecretPresence(
  new Request('https://example.invalid/factory/diagnostics/openai-secret-presence?verify=inference', {
    method: 'POST',
    headers: { authorization: 'Bearer test-operator-token' }
  }),
  env,
  { fetch: async () => { deniedFetches += 1; throw new Error('MUST_NOT_FETCH'); } }
);
assert.equal(denied.status, 403);
assert.equal(deniedFetches, 0);

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
  inference_probe_mocked: true,
  real_paid_inference_calls: 0,
  production_deploy: false
}, null, 2));
