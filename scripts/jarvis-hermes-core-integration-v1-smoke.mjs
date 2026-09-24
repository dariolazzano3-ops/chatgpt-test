import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';

const authorize = async () => ({
  ok: true,
  operator_id: 'jarvis-operator:owner@example.invalid',
  email: 'owner@example.invalid'
});

const hermes = {
  configured: true,
  health: async () => ({ status: 'ok', platform: 'hermes-agent', version: '9.9.9-test' }),
  capabilities: async () => ({
    object: 'hermes.api_server.capabilities',
    platform: 'hermes-agent',
    auth: { type: 'bearer', required: true },
    features: { run_submission: true }
  }),
  toolsets: async () => ({
    object: 'list',
    platform: 'api_server',
    data: [{ name: 'hermes-api-server', enabled: true, tools: ['delegate_task', 'memory'] }]
  }),
  liveProbe: async () => ({
    live: true,
    state: 'ONLINE',
    source_id: 'jarvis-hermes-core:authenticated-api',
    observed_at: '2026-09-23T03:45:00.000Z',
    stale_after_ms: 60000
  })
};
const options = {
  authorize,
  memory_store: createMemoryJarvisStoreV1(),
  hermes_core_client: hermes,
  now: '2026-09-23T03:45:00.000Z'
};

const statusResponse = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/hermes/status'),
  {},
  {},
  options
);
assert.equal(statusResponse.status, 200);
const status = await statusResponse.json();
assert.equal(status.ok, true);
assert.equal(status.connected, true);
assert.equal(status.status, 'ONLINE');
assert.equal(status.platform, 'hermes-agent');
assert.equal(status.version, '9.9.9-test');
assert.equal(status.run_submission, true);
assert.equal(status.delegation_tool_available, true);
assert.equal(status.memory_tool_available, true);
assert.equal(status.owner_memory_scope_header, 'X-Hermes-Session-Key');
assert.equal(status.authenticated, true);
assert.equal(status.external_effect, false);
assert.equal('api_key' in status, false);
assert.equal('base_url' in status, false);

const truthResponse = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/runtime-truth'),
  {},
  {},
  options
);
assert.equal(truthResponse.status, 200);
const truth = await truthResponse.json();
assert.equal(truth.systems.data.HERMES, 'ONLINE');
assert.equal(truth.command_chain.hermes_core_bound, true);

const hermesNode = truth.command_chain.nodes.find((node) => node.node === 'HERMES');
assert.ok(hermesNode);
assert.equal(hermesNode.bound, true);
assert.equal(hermesNode.reason, null);
assert.match(String(hermesNode.evidence), /authenticated Hermes Core API probe/);

const unavailable = {
  ...hermes,
  liveProbe: async () => null,
  health: async () => { const e = new Error('offline'); e.code = 'HERMES_CORE_UNREACHABLE'; throw e; }
};

const failStatus = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/hermes/status'),
  {},
  {},
  { ...options, hermes_core_client: unavailable }
);
assert.equal(failStatus.status, 503);
const failBody = await failStatus.json();
assert.equal(failBody.connected, false);
assert.equal(failBody.error, 'HERMES_CORE_UNREACHABLE');

const failTruth = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/runtime-truth'),
  {},
  {},
  { ...options, hermes_core_client: unavailable }
);
const failTruthBody = await failTruth.json();
assert.equal(failTruthBody.systems.data.HERMES, 'UNKNOWN');
assert.equal(failTruthBody.command_chain.hermes_core_bound, false);

console.log('JARVIS_HERMES_CORE_INTEGRATION_V1_SMOKE_PASS');
