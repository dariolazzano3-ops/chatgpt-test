import assert from 'node:assert/strict';
import { remainingProviderFastLaneManifest } from '../src/remaining-provider-fast-lane-evidence-v1.js';
import { providerActivationInventory } from '../src/provider-activation-inventory.js';
import { providerActivationMatrix, providerStackV1 } from '../src/provider-stack-v1.js';
import { webProviderStrategy } from '../src/web-provider-strategy.js';
import { automationProviderStrategy } from '../src/automation-provider-strategy.js';
import { framerStagingConnectionEvidence, isFramerStagingConnected } from '../src/framer-staging-connection-evidence-v1.js';
import { openAiStagingConnectionEvidence, isOpenAiStagingConnected } from '../src/openai-staging-connection-evidence-v1.js';

const batch = remainingProviderFastLaneManifest();
assert.equal(batch.provider_requests, 0);
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
assert.equal(activepieces.maturity_level, 'L0');
assert.equal(activepieces.final_classification, 'OPERATOR_GATE');
assert.equal(activepieces.central_connection_required, true);
assert.equal(activepieces.runtime_eligible, false);
assert.ok(activepieces.operator_gate);

const webflow = byId.get('webflow-api');
assert.equal(webflow.maturity_level, 'L0');
assert.equal(webflow.final_classification, 'OPERATOR_GATE');
assert.equal(webflow.central_connection_required, true);
assert.equal(webflow.runtime_eligible, false);
assert.ok(webflow.operator_gate);

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
for (const id of ['base44','activepieces-cloud-free','webflow-api','lovable-github','n8n-client-owned']) {
  const row = matrixById.get(id);
  assert.ok(row, `${id} missing from activation matrix`);
  assert.equal(row.connection_state, 'NOT_CONNECTED');
  assert.equal(row.provider_requests, 0);
  assert.equal(row.provider_writes, 0);
  assert.equal(row.production_eligible, false);
}
assert.equal(matrixById.get('activepieces-cloud-free').final_classification, 'OPERATOR_GATE');
assert.equal(matrixById.get('webflow-api').final_classification, 'OPERATOR_GATE');
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
assert.equal(webById.get('webflow-api').availability, 'operator_gate');
assert.equal(webById.get('webflow-api').paid_plan_required, true);
assert.equal(webById.get('webflow-api').read_only_connection_paid_plan_required, false);

const automation = automationProviderStrategy();
assert.equal(automation.primary_external_runtime, 'make-core');
assert.equal(automation.primary_external_runtime_staging_verified, true);
assert.equal(automation.strategic_secondary_runtime, 'activepieces-cloud-free');
assert.equal(automation.technical_specialist_runtime, 'n8n-client-owned');
assert.equal(automation.technical_specialist_central_connection_required, false);
assert.equal(automation.technical_specialist_customer_owned_strategy, true);

const stack = providerStackV1();
assert.deepEqual(stack.factories.web.primary_path, ['riosystems-native-web','cloudflare-workers-free']);
assert.deepEqual(stack.factories.automation.primary_path, ['riosystems-native-automation','make-core']);
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
  provider_requests: 0,
  provider_writes: 0,
  operator_gates: ['activepieces-cloud-free','webflow-api'],
  intentionally_not_central: ['base44','lovable-github','n8n-client-owned'],
  make_primary: automation.primary_external_runtime,
  cloudflare_primary_host: web.default_host,
  workers_ai_free_staging: stack.factories.ai.free_staging_path[1],
  openai_connected_staging: true,
  framer_connected_staging: true,
  production_deploy: false,
  total_new_paid_cost_eur: 0
}, null, 2));
