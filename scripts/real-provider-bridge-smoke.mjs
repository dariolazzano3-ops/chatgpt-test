import assert from 'node:assert/strict';
import { defineRealProviderCandidate, evaluateProviderEligibility, evaluateRealProviderBridge, buildRealProviderIntegrationEntry, buildMockToRealTransition, realProviderBridgeManifest } from '../src/real-provider-bridge.js';
import { createIntegrationCatalog } from '../src/integration-catalog.js';
import { prepareIntegrationExecution, runIntegration } from '../src/integration-runtime.js';
import { buildFactoryIntegrationPlan, integrationCapabilityForTask } from '../src/factory-integration-bridge.js';
import { runMissionPipeline } from '../src/mission-pipeline.js';

function candidateInput(overrides = {}) {
  return {
    id: 'free-web-provider',
    capability: 'web.build',
    kind: 'cloud_platform',
    enabled: true,
    credential_ref: 'binding://free-web-provider',
    endpoint: 'https://api.provider.invalid/v1',
    allowed_hosts: ['api.provider.invalid'],
    paid: false,
    estimated_monthly_cost_eur: 0,
    estimated_cost_per_run_eur: 0,
    free_tier_confirmed: true,
    external_write: false,
    automation_interface: 'api',
    ownership_grade: 'owned',
    code_export_supported: true,
    allowed_data_classes: ['public','business'],
    ...overrides
  };
}

const defined = defineRealProviderCandidate(candidateInput());
assert.equal(defined.ok, true);
assert.equal(defined.provider.schema, 'riosystems.real-provider-candidate.v2');
assert.equal(defined.provider.endpoint_host, 'api.provider.invalid');

const invalidEndpoint = defineRealProviderCandidate(candidateInput({ endpoint: 'http://api.provider.invalid/v1' }));
assert.equal(invalidEndpoint.ok, false);
assert.ok(invalidEndpoint.blockers.some((item) => item.code === 'PROVIDER_HTTPS_ENDPOINT_REQUIRED'));
const missingAllowlist = defineRealProviderCandidate(candidateInput({ allowed_hosts: [] }));
assert.equal(missingAllowlist.ok, false);
assert.ok(missingAllowlist.blockers.some((item) => item.code === 'PROVIDER_HOST_NOT_ALLOWLISTED'));
const missingEndpoint = defineRealProviderCandidate(candidateInput({ endpoint: null, allowed_hosts: [] }));
assert.equal(missingEndpoint.ok, false);
assert.ok(missingEndpoint.blockers.some((item) => item.code === 'PROVIDER_ENDPOINT_REQUIRED'));
const inlineSecret = defineRealProviderCandidate(candidateInput({ credential_ref: 'actual-secret-value' }));
assert.equal(inlineSecret.ok, false);
assert.ok(inlineSecret.blockers.some((item) => item.code === 'CREDENTIAL_REFERENCE_REQUIRED'));

const eligibility = evaluateProviderEligibility(defined.provider, { max_monthly_cost_eur: 0, max_cost_per_run_eur: 0, free_tier_required: true, code_export_required: true, minimum_ownership_grade: 'exportable', data_classes: ['business'], automation_required: true });
assert.equal(eligibility.eligible, true);
const privacyBlocked = evaluateProviderEligibility(defined.provider, { data_classes: ['personal'] });
assert.equal(privacyBlocked.eligible, false);
assert.ok(privacyBlocked.blockers.some((item) => item.code === 'PROVIDER_DATA_CLASS_NOT_ALLOWED'));
const budgetBlocked = evaluateProviderEligibility({ ...defined.provider, estimated_monthly_cost_eur: 20 }, { max_monthly_cost_eur: 0 });
assert.equal(budgetBlocked.eligible, false);
assert.ok(budgetBlocked.blockers.some((item) => item.code === 'PROVIDER_MONTHLY_BUDGET_EXCEEDED'));

const dryGate = evaluateRealProviderBridge(defined.provider, { execute: false, requirements: { free_tier_required: true } });
assert.equal(dryGate.ok, true);
assert.equal(dryGate.stage, 'REAL_PROVIDER_STAGING_READY');
assert.equal(dryGate.external_side_effects_allowed, false);
const blockedExecution = evaluateRealProviderBridge(defined.provider, { execute: true });
assert.equal(blockedExecution.ok, false);
for (const code of ['REAL_PROVIDER_ACTIVATION_APPROVAL_REQUIRED','SUPERVISED_EXECUTION_APPROVAL_REQUIRED']) assert.ok(blockedExecution.blockers.some((item) => item.code === code));
const approvedExecution = evaluateRealProviderBridge(defined.provider, { execute: true, provider_activation_approved: true, supervised_execution_approved: true });
assert.equal(approvedExecution.ok, true);
assert.equal(approvedExecution.external_side_effects_allowed, true);

const transition = buildMockToRealTransition({ id: 'mock-web', capability: 'web.build' }, defined.provider, {});
assert.equal(transition.fallback_to_mock, false);
assert.equal(transition.automatic_cutover, false);
assert.equal(buildMockToRealTransition({ id: 'mock-web' }, defined.provider, { allow_mock_fallback: true }).fallback_to_mock, true);

const builtEntry = buildRealProviderIntegrationEntry(defined.provider, { health: 'healthy' });
assert.equal(builtEntry.ok, true);
let catalog = createIntegrationCatalog([builtEntry.entry]);
assert.equal(catalog.integrations[0].real_provider, true);
assert.equal(catalog.integrations[0].provider_candidate.credential_ref, 'binding://free-web-provider');
const dryRun = await runIntegration(catalog, { capability: 'web.build', payload: { project: 'preview' } }, { execution_mode: 'dry_run' });
assert.equal(dryRun.stage, 'dry_run_complete');
assert.equal(dryRun.external_side_effect_performed, false);
const runnerMissing = prepareIntegrationExecution(catalog, { capability: 'web.build' }, { execution_mode: 'execute', provider_activation_approved: true, supervised_execution_approved: true });
assert.equal(runnerMissing.ok, false);
assert.equal(runnerMissing.error, 'INTEGRATION_RUNNER_NOT_CONFIGURED');

const safeRunner = async () => ({ ok: true, external_side_effect_performed: false, production_deploy: false });
catalog = createIntegrationCatalog([buildRealProviderIntegrationEntry(defined.provider, { health: 'healthy', runner: safeRunner }).entry]);
const execution = await runIntegration(catalog, { capability: 'web.build' }, { execution_mode: 'execute', provider_activation_approved: true, supervised_execution_approved: true });
assert.equal(execution.ok, true);
assert.equal(execution.stage, 'integration_execution_complete');
const productionRunner = async () => ({ ok: true, production_deploy: true });
const productionCatalog = createIntegrationCatalog([buildRealProviderIntegrationEntry(defined.provider, { health: 'healthy', runner: productionRunner }).entry]);
const productionRejected = await runIntegration(productionCatalog, { capability: 'web.build' }, { execution_mode: 'execute', provider_activation_approved: true, supervised_execution_approved: true });
assert.equal(productionRejected.ok, false);
assert.equal(productionRejected.error, 'PRODUCTION_SIDE_EFFECT_REJECTED');

assert.equal(integrationCapabilityForTask({ domain: 'web', capability: 'web_generate' }), 'web.build');
const plan = buildFactoryIntegrationPlan({ tasks: [{ task_id: 'web-1', domain: 'web', capability: 'web_generate' }] }, catalog, {});
assert.equal(plan.ready_for_supervised_integrations, true);
assert.equal(plan.tasks[0].capability, 'web.build');

const capabilities = [
  ['pipeline-web','web.build','cloud_platform'],
  ['pipeline-automation','automation.run','automation'],
  ['pipeline-ai','ai.generate','ai_provider'],
  ['pipeline-business','business.configure','crm']
];
const pipelineEntries = capabilities.map(([id, capability, kind]) => buildRealProviderIntegrationEntry(candidateInput({ id, capability, kind, credential_ref: `binding://${id}`, endpoint: `https://${id}.invalid/v1`, allowed_hosts: [`${id}.invalid`] })).entry);
const pipelineCatalog = createIntegrationCatalog(pipelineEntries);
const waiting = await runMissionPipeline({ prompt: 'Baue eine Website, ein CRM, eine Support KI und automatisiere eingehende Leads.', project: 'provider-pipeline' }, { integrations: { enabled: true, catalog: pipelineCatalog } });
assert.equal(waiting.ok, true);
assert.equal(waiting.stage, 'waiting_for_approval');
assert.equal(waiting.integrations.ready_for_supervised_integrations, true);
const missingCatalog = await runMissionPipeline({ prompt: 'Baue eine Website.', project: 'provider-pipeline' }, { integrations: { enabled: true } });
assert.equal(missingCatalog.ok, false);
assert.equal(missingCatalog.error, 'INTEGRATION_CATALOG_REQUIRED');

const manifest = realProviderBridgeManifest();
assert.equal(manifest.version, 'riosystems.real-provider-bridge.v2');
assert.equal(manifest.hard_eligibility_before_execution, true);
assert.equal(manifest.automatic_cutover, false);
assert.equal(manifest.production_deploy, false);
console.log(JSON.stringify({ ok: true, suite: 'real-provider-bridge', production_deploy: false, external_side_effects: false }, null, 2));
