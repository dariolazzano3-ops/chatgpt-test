import assert from 'node:assert/strict';
import { buildCloudflareReadonlyPreflightPlan, cloudflareReadonlyRunnerManifest, runCloudflareReadonlyPreflight } from '../src/cloudflare-readonly-runner.js';

const accountId = 'a'.repeat(32);
const plan = buildCloudflareReadonlyPreflightPlan({ account_id: accountId, token_ref: 'secret:CLOUDFLARE_API_TOKEN' });
assert.equal(plan.ok, true);
assert.equal(plan.read_only, true);
assert.equal(plan.external_write, false);
assert.ok(Object.values(plan.requests).every((item) => item.method === 'GET'));
assert.ok(Object.values(plan.requests).every((item) => new URL(item.url).hostname === 'api.cloudflare.com'));

const calls = [];
const mockFetch = async (url, options) => {
  calls.push({ url, method: options.method, auth: options.headers.Authorization });
  const path = new URL(url).pathname;
  let result = [];
  if (path.endsWith('/tokens/verify')) result = { status: 'active' };
  else if (path.endsWith('/workers/scripts')) result = [{ id: 'hidden-worker-name' }];
  else if (path.endsWith('/d1/database')) result = [{ uuid: 'hidden-db-id' }];
  else if (path.endsWith('/ai/models/search')) result = [{ name: 'hidden-model' }];
  return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await runCloudflareReadonlyPreflight(plan, {
  fetch_impl: mockFetch,
  resolve_secret: async (ref) => ref === 'secret:CLOUDFLARE_API_TOKEN' ? 'test-token' : null,
  production_deploy: false
});
assert.equal(result.ok, true);
assert.equal(result.stage, 'CLOUDFLARE_READONLY_PREFLIGHT_COMPLETE');
assert.equal(result.capabilities.workers_scripts_read, 'verified');
assert.equal(result.capabilities.d1_read, 'verified');
assert.equal(result.capabilities.workers_ai_read, 'verified');
assert.equal(result.resource_presence.worker_scripts_present, true);
assert.equal(result.resource_presence.d1_databases_present, true);
assert.equal(result.resource_presence.workers_ai_models_visible, true);
assert.equal(result.resource_names_returned, false);
assert.equal(result.account_id_returned, false);
assert.equal(result.secrets_returned, false);
assert.equal(result.external_side_effect_performed, false);
assert.equal(result.production_deploy, false);
assert.ok(calls.every((item) => item.method === 'GET'));

const forbiddenProd = await runCloudflareReadonlyPreflight({ ...plan, production_deploy: true }, {});
assert.equal(forbiddenProd.ok, false);
assert.equal(forbiddenProd.error, 'PRODUCTION_DEPLOY_REJECTED');

const invalid = buildCloudflareReadonlyPreflightPlan({ account_id: 'bad' });
assert.equal(invalid.ok, false);

const manifest = cloudflareReadonlyRunnerManifest();
assert.deepEqual(manifest.methods, ['GET']);
assert.equal(manifest.external_write, false);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Cloudflare read-only runner smoke: OK');
