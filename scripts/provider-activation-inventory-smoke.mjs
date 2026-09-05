import assert from 'node:assert/strict';
import {
  providerActivationInventory,
  candidatesForCapability,
  evaluateProviderActivationInventory,
  providerActivationInventoryManifest
} from '../src/provider-activation-inventory.js';
import { framerStagingConnectionEvidence, isFramerStagingConnected } from '../src/framer-staging-connection-evidence-v1.js';
import { providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';

const inventory = providerActivationInventory();
assert.equal(inventory.production_deploy, false);
assert.equal(inventory.secrets_embedded, false);
assert.equal(inventory.pricing_must_be_reverified_before_activation, true);
assert.equal(inventory.historical_evidence_is_not_current_runtime, true);

const framerEvidence = framerStagingConnectionEvidence();
assert.equal(isFramerStagingConnected(), true);
assert.equal(framerEvidence.provider_id, 'framer-server-api');
assert.equal(framerEvidence.environment, 'riosystems-staging');
assert.equal(framerEvidence.source.verification_method, 'getProjectInfo');
assert.equal(framerEvidence.connection.project_binding_present, true);
assert.equal(framerEvidence.connection.credential_present, true);
assert.equal(framerEvidence.connection.credential_valid, true);
assert.equal(framerEvidence.connection.authenticated, true);
assert.equal(framerEvidence.connection.project_accessible, true);
assert.equal(framerEvidence.connection.project_metadata_read, true);
assert.equal(framerEvidence.connection.connected_staging, true);
assert.equal(framerEvidence.connection.disconnect_completed, true);
assert.equal(framerEvidence.connection.provider_requests, 1);
assert.equal(framerEvidence.execution.provider_writes, 0);
assert.equal(framerEvidence.execution.staging_write_verified, false);
assert.equal(framerEvidence.execution.publish_verified, false);
assert.equal(framerEvidence.execution.publish_performed, false);
assert.equal(framerEvidence.execution.deploy_performed, false);
assert.equal(framerEvidence.execution.mutating_execution_approval_required, true);
assert.equal(framerEvidence.cost_guard.variable_cost_eur, 0);
assert.equal(framerEvidence.safety.secret_value_exposed, false);
assert.equal(framerEvidence.safety.production_deploy, false);
assert.equal(framerEvidence.safety.production_eligible, false);
assert.equal(framerEvidence.safety.framer_agent_codex_path, 'UNCHANGED');

const framerInventory = inventory.providers.find((item) => item.id === 'framer-server-api');
assert.ok(framerInventory);
assert.equal(framerInventory.strategic_state, 'SELECTED');
assert.equal(framerInventory.availability, 'AVAILABLE');
assert.equal(framerInventory.verification, 'CONNECTION_VERIFIED_STAGING');
assert.equal(framerInventory.connection_state, 'CONNECTED_STAGING');
assert.equal(framerInventory.account_state, 'READY');
assert.equal(framerInventory.project_binding_state, 'PRESENT');
assert.equal(framerInventory.credential_state, 'PRESENT_VALID');
assert.equal(framerInventory.runtime_eligible, true);
assert.equal(framerInventory.external_write, true);
assert.equal(framerInventory.staging_write_verified, false);
assert.equal(framerInventory.publish_verified, false);
assert.equal(framerInventory.routing_scope, 'specialist_only');
assert.equal(framerInventory.mutating_execution_approval_required, true);
assert.equal(framerInventory.production_eligible, false);
assert.equal(framerInventory.restrictions.includes('STAGING_WRITE_NOT_VERIFIED'), true);
assert.equal(framerInventory.restrictions.includes('PUBLISH_NOT_VERIFIED'), true);
assert.equal(framerInventory.restrictions.includes('PRODUCTION_DISABLED'), true);

const matrix = providerActivationMatrix();
const framerMatrix = matrix.providers.find((item) => item.id === 'framer-server-api');
assert.ok(framerMatrix);
assert.equal(framerMatrix.connection_state, 'CONNECTED_STAGING');
assert.equal(framerMatrix.activation, 'historical_read_only_connection_evidence');
assert.equal(framerMatrix.current_runtime_verified, false);
assert.equal(framerMatrix.runtime_truth.actual_executor_availability, 'NOT_CURRENTLY_VERIFIED');
assert.equal(framerMatrix.account, 'ready');
assert.equal(framerMatrix.project_binding, 'present');
assert.equal(framerMatrix.credential, 'present_valid');
assert.equal(framerMatrix.project_metadata_read, true);
assert.equal(framerMatrix.provider_writes, 0);
assert.equal(framerMatrix.staging_write_verified, false);
assert.equal(framerMatrix.publish_verified, false);
assert.equal(framerMatrix.publish_performed, false);
assert.equal(framerMatrix.deploy_performed, false);
assert.equal(framerMatrix.production_eligible, false);
assert.equal(matrix.production_deploy, false);
assert.equal(matrix.secrets_embedded, false);

const stack = providerStackV1();
assert.deepEqual(stack.factories.web.primary_path, ['riosystems-native-web','cloudflare-workers-free']);
assert.equal(stack.factories.web.framer_connected_staging, true);
assert.equal(stack.factories.web.framer_staging_write_verified, false);
assert.equal(stack.factories.web.framer_publish_verified, false);
assert.equal(stack.factories.web.framer_routing_scope, 'specialist_only');
assert.equal(stack.factories.ai.openai_connected_staging, true);
assert.equal(stack.factories.ai.openai_inference_verified, true);
assert.equal(stack.factories.ai.openai_routing_ready, true);
assert.deepEqual(stack.factories.ai.free_staging_path, ['riosystems-ai-local-policy','cloudflare-workers-ai-free']);
assert.equal(stack.activation_policy.external_writes_require_explicit_approval, true);
assert.equal(stack.activation_policy.production_deploy, false);

for (const providerId of ['cloudflare-workers-free','cloudflare-workers-ai-free','make-core','supabase-free','posthog-free','openai-api']) {
  assert.ok(matrix.providers.find((item) => item.id === providerId), `${providerId} must remain in activation matrix`);
}

const zeroCostAi = candidatesForCapability('ai.generate', { zero_cost_only: true });
assert.equal(zeroCostAi.length >= 1, true);
assert.equal(zeroCostAi[0].id, 'cloudflare-workers-ai-free');
assert.equal(zeroCostAi[0].cost_mode, 'free_tier_hard_fail');

const initial = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate','business.configure','web.analytics'],
  zero_cost_only: true
});
assert.equal(initial.zero_cost_path_available, true);
assert.equal(initial.ready_for_real_staging, false);
assert.equal(initial.user_action_required, true);
assert.equal(initial.automatic_paid_overflow, false);
assert.equal(initial.production_deploy, false);
assert.equal(initial.blockers.some((item) => item.code === 'PROVIDER_ACCOUNT_BINDING_REQUIRED'), true);

const routeReadyOnly = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate'],
  zero_cost_only: true,
  account_bindings: ['cloudflare-workers-ai-free'],
  credential_refs: ['cloudflare-workers-ai-free']
});
assert.equal(routeReadyOnly.ready_for_route_resolution, true);
assert.equal(routeReadyOnly.ready_for_real_staging, false);
assert.equal(routeReadyOnly.ready_for_execution, false);
assert.equal(routeReadyOnly.blockers.some((item) => item.code === 'PROVIDER_CURRENT_RUNTIME_VERIFICATION_REQUIRED'), true);

const readyReadOnly = evaluateProviderActivationInventory({
  required_capabilities: ['ai.generate'],
  zero_cost_only: true,
  account_bindings: ['cloudflare-workers-ai-free'],
  credential_refs: ['cloudflare-workers-ai-free'],
  current_runtime_verified_provider_ids: ['cloudflare-workers-ai-free']
});
assert.equal(readyReadOnly.ready_for_real_staging, true);
assert.equal(readyReadOnly.ready_for_execution, true);

const writeStillBlocked = evaluateProviderActivationInventory({
  required_capabilities: ['business.configure'],
  zero_cost_only: true,
  account_bindings: ['supabase-free'],
  credential_refs: ['supabase-free']
});
assert.equal(writeStillBlocked.ready_for_real_staging, false);
assert.equal(writeStillBlocked.blockers.some((item) => item.code === 'EXTERNAL_WRITE_APPROVAL_REQUIRED'), true);

const premium = candidatesForCapability('ai.generate', { zero_cost_only: false });
assert.equal(premium.some((item) => item.id === 'openai-api' && item.cost_mode === 'paid_usage'), true);

const framerSpecialist = candidatesForCapability('web.design', { zero_cost_only: false });
assert.equal(framerSpecialist.some((item) => item.id === 'framer-server-api' && item.routing_scope === 'specialist_only'), true);

const manifest = providerActivationInventoryManifest();
assert.equal(manifest.paid_overflow_disabled, true);
assert.equal(manifest.historical_evidence_is_not_current_runtime, true);
assert.equal(manifest.current_runtime_executor_verification_required, true);
console.log(JSON.stringify({
  ok: true,
  suite: 'provider-activation-inventory',
  providers: inventory.providers.map((item) => item.id),
  zero_cost_ai: zeroCostAi[0].id,
  framer_connected_staging: true,
  framer_staging_write_verified: false,
  framer_publish_verified: false,
  production_deploy: false
}, null, 2));
