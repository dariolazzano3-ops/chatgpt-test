import assert from 'node:assert/strict';
import {
  createJarvisIntegrationRegistryV1,
  evaluateJarvisIntegrationActionV1,
  jarvisIntegrationManifestV1
} from '../src/jarvis/integration-layer-v1.js';

const manifest = jarvisIntegrationManifestV1();
assert.equal(manifest.remote_truth_provider, 'GITHUB');
assert.equal(manifest.coding_specialist, 'CLAUDE_CODE');
assert.equal(manifest.default_remote_write, 'OFF');
assert.equal(manifest.production_actions_enabled, false);
assert.equal(manifest.billing_actions_enabled, false);
assert.equal(manifest.hamyren_private_data_flow, false);
assert.equal(manifest.credentials_embedded, false);

const registry = createJarvisIntegrationRegistryV1();
assert.equal(registry.capabilities.some((item) => /^hamyren/i.test(item.id)), false);
assert.equal(registry.capabilities.some((item) => item.id === 'github.remote_truth.read'), true);
assert.equal(registry.capabilities.some((item) => item.id === 'claude_code.workspace_write'), true);

const githubRead = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'github.remote_truth.read',
  payload: { repo: 'owner/repo' }
});
assert.equal(githubRead.ok, true);
assert.equal(githubRead.status, 'ALLOWED');
assert.equal(githubRead.execution_authorized, true);
assert.equal(githubRead.approval_required, false);

const claudeBounded = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'claude_code.workspace_write',
  bounded_workspace: true,
  workspace: '/workspace/projects/aurentara',
  protected_branch: false,
  production: false
});
assert.equal(claudeBounded.status, 'AUTHORIZED');
assert.equal(claudeBounded.execution_authorized, true);

const claudeUnsafe = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'claude_code.workspace_write',
  bounded_workspace: false,
  workspace: '/opt/data',
  protected_branch: false,
  production: false
});
assert.equal(claudeUnsafe.status, 'PREPARE_ONLY');
assert.equal(claudeUnsafe.execution_authorized, false);

const merge = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'github.merge',
  explicit_approval: false
});
assert.equal(merge.status, 'AWAITING_APPROVAL');
assert.equal(merge.execution_authorized, false);

const approvedMerge = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'github.merge',
  explicit_approval: true
});
assert.equal(approvedMerge.status, 'AUTHORIZED');
assert.equal(approvedMerge.execution_authorized, true);

const production = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'cloudflare.deploy',
  production: true,
  explicit_approval: false
});
assert.equal(production.status, 'AWAITING_APPROVAL');
assert.equal(production.execution_authorized, false);

const billing = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'billing.write',
  explicit_approval: true
});
assert.equal(billing.ok, false);
assert.equal(billing.status, 'BLOCKED');

const secretPayload = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'github.remote_truth.read',
  payload: { access_token: 'ghp_this_must_never_enter_payload' }
});
assert.equal(secretPayload.ok, false);
assert.equal(secretPayload.error, 'JARVIS_INTEGRATION_SECRET_PAYLOAD_BLOCKED');

const hamyren = evaluateJarvisIntegrationActionV1({
  registry,
  capability: 'github.remote_truth.read',
  source_system: 'hamyren'
});
assert.equal(hamyren.ok, false);
assert.equal(hamyren.error, 'JARVIS_HAMYREN_PRIVATE_FLOW_BLOCKED');

console.log('JARVIS Integration Layer V1 smoke: PASS');
