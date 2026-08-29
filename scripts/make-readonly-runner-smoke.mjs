import assert from 'node:assert/strict';
import { planMakeReadOnlyPreflight } from '../src/make-staging-bridge.js';
import { makeReadOnlyRunnerManifest, runMakeReadOnlyPreflight } from '../src/make-readonly-runner.js';

const plan = planMakeReadOnlyPreflight({
  zone_url: 'https://eu1.make.com',
  team_id: 42,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read', 'scenarios:read']
});
assert.equal(plan.state, 'READY_FOR_READ_ONLY_PREFLIGHT');

const manifest = makeReadOnlyRunnerManifest();
assert.deepEqual(manifest.methods, ['GET']);
assert.equal(manifest.explicit_read_only_execution_approval_required, true);
assert.equal(manifest.external_side_effects, false);
assert.equal(manifest.production_deploy, false);

const noApproval = await runMakeReadOnlyPreflight(plan, {});
assert.equal(noApproval.ok, false);
assert.equal(noApproval.error, 'MAKE_READONLY_EXECUTION_APPROVAL_REQUIRED');

const seenHeaders = [];
const fetchImpl = async (url, options) => {
  seenHeaders.push(options.headers.Authorization);
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/ping')) return new Response('pong', { status: 200, headers: { 'content-type': 'text/plain' } });
  return new Response(JSON.stringify({ scenarios: [{ id: 1, name: 'private-name-a' }, { id: 2, name: 'private-name-b' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const result = await runMakeReadOnlyPreflight(plan, {
  read_only_execution_approved: true,
  fetch_impl: fetchImpl,
  resolve_secret: async (ref) => ref === 'secret:MAKE_API_TOKEN' ? 'top-secret-token' : null
});
assert.equal(result.ok, true);
assert.equal(result.stage, 'MAKE_READONLY_PREFLIGHT_COMPLETE');
assert.equal(result.results.length, 2);
assert.equal(result.results[0].ping, 'pong');
assert.equal(result.results[1].scenario_count_visible, 2);
assert.equal(result.external_side_effect_performed, false);
assert.equal(result.secrets_returned, false);
assert.equal(result.authorization_header_returned, false);
assert.equal(seenHeaders.every((value) => value === 'Token top-secret-token'), true);
const serialized = JSON.stringify(result);
assert.equal(serialized.includes('top-secret-token'), false);
assert.equal(serialized.includes('private-name-a'), false);
assert.equal(serialized.includes('private-name-b'), false);

const postTamper = structuredClone(plan);
postTamper.requests[0].method = 'POST';
const postRejected = await runMakeReadOnlyPreflight(postTamper, {
  read_only_execution_approved: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'token'
});
assert.equal(postRejected.ok, false);
assert.equal(postRejected.error, 'MAKE_READONLY_METHOD_REJECTED');

const hostTamper = structuredClone(plan);
hostTamper.requests[0].url = 'https://example.com/api/v2/ping';
const hostRejected = await runMakeReadOnlyPreflight(hostTamper, {
  read_only_execution_approved: true,
  fetch_impl: fetchImpl,
  resolve_secret: async () => 'token'
});
assert.equal(hostRejected.ok, false);
assert.equal(hostRejected.error, 'MAKE_READONLY_HOST_REJECTED');

const production = await runMakeReadOnlyPreflight(plan, { production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

console.log('RIOSYSTEMS Make read-only runner smoke: OK');
