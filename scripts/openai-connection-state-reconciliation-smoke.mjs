import assert from 'node:assert/strict';
import { openAiStagingConnectionEvidence, isOpenAiStagingConnected } from '../src/openai-staging-connection-evidence-v1.js';
import { providerActivationInventory, candidatesForCapability } from '../src/provider-activation-inventory.js';
import { providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';
import { reconcileOpenAiConnectionTruth, operatorProviderPreflightSealManifest } from '../src/operator-provider-preflight-seal-v1.js';

const evidence = openAiStagingConnectionEvidence();
assert.equal(isOpenAiStagingConnected(), true);
assert.equal(evidence.provider_id, 'openai-api');
assert.equal(evidence.environment, 'riosystems-staging');
assert.equal(evidence.connection.credential_present, true);
assert.equal(evidence.connection.credential_valid, true);
assert.equal(evidence.connection.connected_staging, true);
assert.equal(evidence.connection.http_status, 200);
assert.equal(evidence.connection.authenticated, true);
assert.equal(evidence.source.verification_method, 'GET /v1/models + bounded POST /v1/responses');
assert.equal(evidence.execution.inference_performed, true);
assert.equal(evidence.execution.inference_verified, true);
assert.equal(evidence.execution.token_generation_verified, true);
assert.equal(evidence.execution.model, 'gpt-5.6-luna');
assert.equal(evidence.execution.paid_execution_approved, false);
assert.equal(evidence.execution.routing_ready, true);
assert.equal(evidence.cost_guard.variable_cost_eur, 0);
assert.equal(evidence.cost_guard.automatic_paid_overflow, false);
assert.equal(evidence.safety.secret_value_exposed, false);
assert.equal(evidence.safety.secrets_embedded, false);
assert.equal(evidence.safety.production_deploy, false);
assert.equal(evidence.safety.production_eligible, false);

const inventory = providerActivationInventory();
const openAiInventory = inventory.providers.find((item) => item.id === 'openai-api');
assert.ok(openAiInventory);
assert.equal(openAiInventory.strategic_state, 'SELECTED');
assert.equal(openAiInventory.availability, 'AVAILABLE');
assert.equal(openAiInventory.verification, 'CONNECTION_VERIFIED_STAGING');
assert.equal(openAiInventory.connection_state, 'CONNECTED_STAGING');
assert.equal(openAiInventory.credential_state, 'PRESENT_VALID');
assert.equal(openAiInventory.inference_verified, true);
assert.equal(openAiInventory.token_generation_verified, true);
assert.equal(openAiInventory.routing_ready, true);
assert.equal(openAiInventory.paid_execution_approved, false);
assert.equal(openAiInventory.automatic_paid_overflow, false);
assert.equal(openAiInventory.production_eligible, false);
assert.equal(openAiInventory.restrictions.includes('BUDGET_GATE'), true);
assert.equal(openAiInventory.restrictions.includes('PAID_EXECUTION_APPROVAL_REQUIRED'), true);
assert.equal(openAiInventory.restrictions.includes('OPERATOR_AI_BOUNDED_STAGING_ONLY'), true);
assert.equal(openAiInventory.restrictions.includes('INFERENCE_NOT_VERIFIED'), false);
assert.equal(openAiInventory.restrictions.includes('PRODUCTION_DISABLED'), true);

const matrix = providerActivationMatrix();
const openAiMatrix = matrix.providers.find((item) => item.id === 'openai-api');
assert.ok(openAiMatrix);
assert.equal(openAiMatrix.connection_state, 'CONNECTED_STAGING');
assert.equal(openAiMatrix.activation, 'connected_staging_budget_gate');
assert.equal(openAiMatrix.credential, 'present_valid');
assert.equal(openAiMatrix.inference_verified, true);
assert.equal(openAiMatrix.routing_ready, true);
assert.equal(openAiMatrix.paid_execution, 'approval_required');
assert.equal(openAiMatrix.paid_execution_approved, false);
assert.equal(openAiMatrix.automatic_paid_overflow, false);
assert.equal(openAiMatrix.production_eligible, false);
assert.equal(matrix.automatic_paid_overflow, false);
assert.equal(matrix.production_deploy, false);
assert.equal(matrix.secrets_embedded, false);

const reconciled = reconcileOpenAiConnectionTruth({
  id: 'openai-api',
  runtime_eligible: true,
  connection_state: 'NOT_CONNECTED',
  verification: 'NOT_CONNECTED',
  evidence: openAiMatrix
});
assert.equal(reconciled.connection_state, 'CONNECTED_STAGING');
assert.equal(reconciled.verification, 'CONNECTION_VERIFIED_STAGING');
assert.equal(reconciled.credential_state, 'PRESENT_VALID');
assert.equal(reconciled.inference_verified, true);
assert.equal(reconciled.token_generation_verified, true);
assert.equal(reconciled.routing_ready, true);
assert.equal(reconciled.paid_execution_approved, false);
assert.equal(reconciled.automatic_paid_overflow, false);
assert.equal(reconciled.production_eligible, false);
assert.equal(reconciled.secrets_exposed, false);
assert.equal(reconciled.production_deploy, false);

const stack = providerStackV1();
assert.deepEqual(stack.factories.ai.free_staging_path, ['riosystems-ai-local-policy','cloudflare-workers-ai-free']);
assert.equal(stack.factories.ai.cloudflare_ai_runtime_verified, true);
assert.equal(stack.factories.ai.openai_connected_staging, true);
assert.equal(stack.factories.ai.openai_inference_verified, true);
assert.equal(stack.factories.ai.openai_routing_ready, true);
assert.equal(stack.factories.ai.openai_paid_execution_approved, false);
assert.equal(stack.activation_policy.paid_execution_requires_explicit_approval, true);
assert.equal(stack.activation_policy.automatic_paid_overflow, false);
assert.equal(stack.activation_policy.production_deploy, false);

const zeroCostAi = candidatesForCapability('ai.generate', { zero_cost_only: true });
assert.equal(zeroCostAi[0].id, 'cloudflare-workers-ai-free');
assert.equal(zeroCostAi.some((item) => item.id === 'openai-api'), false);

for (const providerId of ['cloudflare-workers-free','cloudflare-workers-ai-free','make-core','supabase-free','posthog-free']) {
  assert.ok(matrix.providers.find((item) => item.id === providerId), `${providerId} must remain in activation matrix`);
}

const seal = operatorProviderPreflightSealManifest();
assert.equal(seal.openai_connection_evidence_reconciled, true);
assert.equal(seal.openai_inference_verification_requires_explicit_evidence, true);
assert.equal(seal.openai_inference_verified_from_bounded_probe, true);
assert.equal(seal.openai_paid_execution_remains_gated, true);
assert.equal(seal.production_deploy, false);
assert.equal(seal.external_writes, false);
assert.equal(seal.paid_provider_activation, false);
assert.equal(seal.additional_variable_cost_eur, 0);

console.log(JSON.stringify({
  ok: true,
  suite: 'openai-connection-state-reconciliation-v1',
  provider: 'openai-api',
  connected_staging: true,
  inference_verified: true,
  routing_ready: true,
  paid_execution_approved: false,
  zero_cost_staging_ai: zeroCostAi[0].id,
  production_deploy: false
}, null, 2));
