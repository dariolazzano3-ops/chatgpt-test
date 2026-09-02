import assert from 'node:assert/strict';
import { remainingProviderFastLaneManifest } from '../src/remaining-provider-fast-lane-evidence-v1.js';
import { providerActivationInventory } from '../src/provider-activation-inventory.js';
import { providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';
import { webProviderStrategy } from '../src/web-provider-strategy.js';
import { automationProviderStrategy } from '../src/automation-provider-strategy.js';
import { framerStagingConnectionEvidence, isFramerStagingConnected } from '../src/framer-staging-connection-evidence-v1.js';
import { webflowStagingConnectionEvidence, isWebflowStagingConnected } from '../src/webflow-staging-connection-evidence-v1.js';
import { activepiecesStagingConnectionEvidence, isActivepiecesStagingConnected } from '../src/activepieces-staging-connection-evidence-v1.js';
import { openAiStagingConnectionEvidence, isOpenAiStagingConnected } from '../src/openai-staging-connection-evidence-v1.js';

const batch = remainingProviderFastLaneManifest();
assert.equal(batch.provider_requests, 2);
assert.equal(batch.provider_writes, 0);
assert.equal(batch.production_deploy, false);
assert.equal(batch.external_writes, false);
assert.equal(batch.real_customer_data, false);
assert.equal(batch.secrets_exposed, false);
assert.equal(batch.total_new_paid_cost_eur, 0);

const inventory = providerActivationInventory();
const byId = new Map(inventory.providers.map((item) => [item.id, item]));
for (const id of ['base44','activepieces-cloud-free','webflow-api','lovable-github','n8n-client-owned']) assert.ok(byId.has(id), `${id} missing from inventory`);

const base44 = byId.get('base44');
assert.equal(base44.maturity_level, 'L0');
assert.equal(base44.final_classification, 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED');
assert.equal(base44.central_connection_required, false);
assert.equal(base44.runtime_eligible, false);
assert.equal(base44.routing_ready, false);

const activepieces = byId.get('activepieces-cloud-free');
assert.equal(activepieces.verification, 'CONNECTION_VERIFIED_STAGING');
assert.equal(activepieces.connection_state, 'CONNECTED_STAGING');
assert.equal(activepieces.maturity_level, 'L3');
assert.equal(activepieces.final_classification, 'CONNECTED_STAGING');
assert.equal(activepieces.central_connection_required, true);
assert.equal(activepieces.account_state, 'READY');
assert.equal(activepieces.credential_state, 'PRESENT_VALID');
assert.equal(activepieces.api_accessible, true);
assert.equal(activepieces.runtime_eligible, false);
assert.equal(activepieces.routing_ready, false);
assert.equal(activepieces.flow_execution_verified, false);
assert.equal(activepieces.routing_scope, 'secondary_only');
assert.equal(activepieces.operator_gate, null);

const webflow = byId.get('webflow-api');
assert.equal(webflow.maturity_level, 'L3');
assert.equal(webflow.final_classification, 'CONNECTED_STAGING');
assert.equal(webflow.central_connection_required, true);
assert.equal(webflow.connection_state, 'CONNECTED_STAGING');
assert.equal(webflow.credential_state, 'PRESENT_VALID');
assert.equal(webflow.runtime_eligible, false);
assert.equal(webflow.routing_ready, false);
assert.equal(webflow.operator_gate, null);

const lovable = byId.get('lovable-github');
assert.equal(lovable.maturity_level, 'L0');
assert.equal(lovable.final_classification, 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED');
assert.equal(lovable.central_connection_required, false);
assert.equal(lovable.runtime_eligible, false);

const n8n = byId.get('n8n-client-owned');
assert.equal(n8n.maturity_level, 'L0');
assert.equal(n8n.final_classification, 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED');
assert.equal(n8n.central_connection_required, false);
assert.equal(n8n.customer_owned_strategy, true);
assert.equal(n8n.runtime_eligible, false);

const matrix = providerActivationMatrix();
const matrixById = new Map(matrix.providers.map((item) => [item.id, item]));
for (const id of ['base44','lovable-github','n8n-client-owned']) {
  const row = matrixById.get(id);
  assert.ok(row, `${id} missing from activation matrix`);
  assert.equal(row.connection_state, 'NOT_CONNECTED');
  assert.equal(row.provider_writes, 0);
  assert.equal(row.production_eligible, false);
}
const activepiecesMatrix = matrixById.get('activepieces-cloud-free');
assert.ok(activepiecesMatrix);
assert.equal(activepiecesMatrix.connection_state, 'CONNECTED_STAGING');
assert.equal(activepiecesMatrix.activation, 'live_staging_verified_read_only_connection');
assert.equal(activepiecesMatrix.maturity_level, 'L3');
assert.equal(activepiecesMatrix.final_classification, 'CONNECTED_STAGING');
assert.equal(activepiecesMatrix.account, 'ready');
assert.equal(activepiecesMatrix.credential, 'present_valid');
assert.equal(activepiecesMatrix.authenticated, true);
assert.equal(activepiecesMatrix.api_accessible, true);
assert.equal(activepiecesMatrix.connected_staging, true);
assert.equal(activepiecesMatrix.operator_gate, null);
assert.equal(activepiecesMatrix.routing_eligibility, 'secondary_only_flow_execution_not_verified');
assert.equal(activepiecesMatrix.flow_execution_verified, false);
assert.equal(activepiecesMatrix.provider_requests, 1);
assert.equal(activepiecesMatrix.provider_writes, 0);
assert.equal(activepiecesMatrix.production_eligible, false);

const webflowMatrix = matrixById.get('webflow-api');
assert.ok(webflowMatrix);
assert.equal(webflowMatrix.connection_state, 'CONNECTED_STAGING');
assert.equal(webflowMatrix.activation, 'live_staging_verified_read_only_connection');
assert.equal(webflowMatrix.maturity_level, 'L3');
assert.equal(webflowMatrix.final_classification, 'CONNECTED_STAGING');
assert.equal(webflowMatrix.provider_requests, 1);
assert.equal(webflowMatrix.provider_writes, 0);
assert.equal(webflowMatrix.staging_write_verified, false);
assert.equal(webflowMatrix.publish_verified, false);
assert.equal(webflowMatrix.production_eligible, false);
assert.equal(matrixById.get('activepieces-cloud-free').final_classification, 'CONNECTED_STAGING');
assert.equal(matrixById.get('webflow-api').final_classification, 'CONNECTED_STAGING');
assert.equal(matrixById.get('base44').final_classification, 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED');
assert.equal(matrixById.get('lovable-github').final_classification, 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED');
assert.equal(matrixById.get('n8n-client-owned').final_classification, 'INTENTIONALLY_NOT_CENTRALLY_CONNECTED');

const web = webProviderStrategy();
assert.equal(web.default_builder, 'riosystems-native-web');
assert.equal(web.default_host, 'cloudflare-workers-free');
const webById = new Map(web.providers.map((item) => [item.id, item]));
assert.equal(webById.get('framer-server-api').availability, 'connected_staging_read_only');
assert.equal(webById.get('framer-server-api').staging_write_verified, false);
assert.equal(webById.get('framer-server-api').publish_verified, false);
assert.equal(webById.get('lovable-github').central_connection_required, false);
assert.equal(webById.get('lovable-github').account_connection_required, true);
assert.equal(webById.get('webflow-api').availability, 'connected_staging_read_only');
assert.equal(webById.get('webflow-api').paid_plan_required, true);
assert.equal(webById.get('webflow-api').read_only_connection_paid_plan_required, false);

const webflowEvidence = webflowStagingConnectionEvidence();
assert.equal(isWebflowStagingConnected(), true);
assert.equal(webflowEvidence.connection.provider_requests, 1);
assert.equal(webflowEvidence.connection.credential_valid, true);
assert.equal(webflowEvidence.connection.authenticated, true);
assert.equal(webflowEvidence.connection.site_accessible, true);
assert.equal(webflowEvidence.connection.site_metadata_read, true);
assert.equal(webflowEvidence.connection.connected_staging, true);
assert.equal(webflowEvidence.execution.provider_writes, 0);
assert.equal(webflowEvidence.execution.staging_write_verified, false);
assert.equal(webflowEvidence.execution.publish_verified, false);
assert.equal(webflowEvidence.safety.production_eligible, false);

const activepiecesEvidence = activepiecesStagingConnectionEvidence();
assert.equal(isActivepiecesStagingConnected(), true);
assert.equal(activepiecesEvidence.connection.provider_requests, 1);
assert.equal(activepiecesEvidence.connection.credential_valid, true);
assert.equal(activepiecesEvidence.connection.authenticated, true);
assert.equal(activepiecesEvidence.connection.api_accessible, true);
assert.equal(activepiecesEvidence.connection.connected_staging, true);
assert.equal(activepiecesEvidence.execution.provider_writes, 0);
assert.equal(activepiecesEvidence.execution.flow_execution_performed, false);
assert.equal(activepiecesEvidence.safety.production_deploy, false);
assert.equal(activepiecesEvidence.safety.external_writes, false);
assert.equal(activepiecesEvidence.safety.real_customer_data, false);
assert.equal(activepiecesEvidence.safety.variable_cost_eur, 0);

const automation = automationProviderStrategy();
assert.equal(automation.primary_external_runtime, 'make-core');
assert.equal(automation.primary_external_runtime_staging_verified, true);
assert.equal(automation.strategic_secondary_runtime, 'activepieces-cloud-free');
assert.equal(automation.strategic_secondary_runtime_connected_staging, true);
assert.equal(automation.strategic_secondary_runtime_operator_gate, null);
assert.equal(automation.strategic_secondary_runtime_flow_execution_verified, false);
assert.equal(automation.technical_specialist_runtime, 'n8n-client-owned');
assert.equal(automation.technical_specialist_central_connection_required, false);
assert.equal(automation.technical_specialist_customer_owned_strategy, true);

const stack = providerStackV1();
assert.deepEqual(stack.factories.web.primary_path, ['riosystems-native-web','cloudflare-workers-free']);
assert.deepEqual(stack.factories.automation.primary_path, ['riosystems-native-automation','make-core']);
assert.deepEqual(stack.factories.automation.secondary_path, ['riosystems-native-automation','activepieces-cloud-free']);
assert.equal(stack.factories.automation.activepieces_connected_staging, true);
assert.equal(stack.factories.automation.activepieces_flow_execution_verified, false);
assert.equal(stack.factories.automation.activepieces_routing_scope, 'secondary_only');
assert.deepEqual(stack.factories.ai.free_staging_path, ['riosystems-ai-local-policy','cloudflare-workers-ai-free']);
assert.equal(stack.factories.ai.cloudflare_ai_runtime_verified, true);
assert.equal(stack.factories.business.provider_read_verified, true);
assert.equal(stack.factories.business.analytics_staging_verified, true);
assert.equal(stack.activation_policy.automatic_paid_overflow, false);
assert.equal(stack.activation_policy.production_deploy, false);

const openai = openAiStagingConnectionEvidence();
assert.equal(isOpenAiStagingConnected(), true);
assert.equal(openai.connection.connected_staging, true);
assert.equal(openai.execution.inference_performed, false);
assert.equal(openai.execution.routing_ready, false);
assert.equal(openai.execution.paid_execution_approved, false);
assert.equal(openai.safety.production_eligible, false);

const framer = framerStagingConnectionEvidence();
assert.equal(isFramerStagingConnected(), true);
assert.equal(framer.connection.connected_staging, true);
assert.equal(framer.execution.provider_writes, 0);
assert.equal(framer.execution.staging_write_verified, false);
assert.equal(framer.execution.publish_verified, false);
assert.equal(framer.execution.publish_performed, false);
assert.equal(framer.execution.deploy_performed, false);
assert.equal(framer.safety.framer_agent_codex_path, 'UNCHANGED');
assert.equal(framer.safety.production_eligible, false);

for (const id of ['cloudflare-workers-free','make-core','supabase-free','posthog-free','cloudflare-workers-ai-free','openai-api','framer-server-api']) assert.ok(matrixById.has(id), `${id} existing provider regressed from matrix`);
assert.equal(matrix.secrets_embedded, false);
assert.equal(matrix.automatic_paid_overflow, false);
assert.equal(matrix.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'remaining-provider-fast-lane-v1',
  provider_requests: 2,
  provider_writes: 0,
  operator_gates: [],
  intentionally_not_central: ['base44','lovable-github','n8n-client-owned'],
  make_primary: automation.primary_external_runtime,
  activepieces_secondary_connected_staging: true,
  activepieces_flow_execution_verified: false,
  cloudflare_primary_host: web.default_host,
  workers_ai_free_staging: stack.factories.ai.free_staging_path[1],
  openai_connected_staging: true,
  framer_connected_staging: true,
  webflow_connected_staging: true,
  production_deploy: false,
  total_new_paid_cost_eur: 0
}, null, 2));
