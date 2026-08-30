import assert from 'node:assert/strict';
import {
  ACTION_CONTRACTS,
  InMemoryIdempotencyStore,
  automationMissionContract,
  automationProviderCatalog,
  buildWorkflowPlan,
  routeWorkflowPlan,
  validateFallback,
  runAutomationMission,
  redactSecrets
} from '../src/automation-v1/index.js';

assert.ok(ACTION_CONTRACTS.webhook);
assert.ok(ACTION_CONTRACTS.database_write);
assert.ok(ACTION_CONTRACTS.ai_call);
assert.ok(ACTION_CONTRACTS.crm_event);

const locked = automationMissionContract({
  project: 'Unsafe', project_id: 'unsafe', trigger: { type: 'webhook' }, goal: 'bad', systems: ['Make'],
  data_classification: 'customer_pii', budget: { variable_cost_ceiling_eur: 1 }, production: true,
  real_customer_data: true, mass_email: true, payments: true, automatic_paid_overflow: true
});
assert.equal(locked.ok, false);
for (const code of ['REAL_OR_SENSITIVE_CUSTOMER_DATA_REJECTED','VARIABLE_COST_CEILING_MUST_BE_ZERO','PRODUCTION_LOCKED','REAL_CUSTOMER_DATA_LOCKED','MASS_EMAIL_LOCKED','PAYMENTS_LOCKED','AUTOMATIC_PAID_OVERFLOW_LOCKED']) assert.ok(locked.errors.includes(code));

const providers = automationProviderCatalog();
assert.equal(providers.find((p) => p.id === 'make-core')?.role, 'primary_external_runtime');
assert.equal(providers.find((p) => p.id === 'activepieces-cloud-free')?.role, 'secondary_external_runtime');
assert.equal(providers.find((p) => p.id === 'n8n-client-owned')?.role, 'technical_specialist_runtime');
assert.equal(providers.find((p) => p.id === 'cloudflare-workers-free')?.role, 'small_code_webhook_runtime');

const bakeryMission = {
  project: 'Bäckerei Müller',
  project_id: 'bakery-muller',
  trigger: { type: 'webhook', source: 'website_form' },
  goal: 'Synthetic lead intake through Make, Supabase staging plan and PostHog-compatible analytics event',
  inputs: { name: 'Test Lead', email: ' TEST@EXAMPLE.COM ', source: 'synthetic-form' },
  outputs: { lead: 'staging_record', analytics: 'posthog_event_plan' },
  systems: ['Make', 'Supabase', 'PostHog'],
  data_classification: 'synthetic_test_data',
  execution_frequency: 'on_demand',
  side_effect_level: 'safe_synthetic_write',
  budget: { variable_cost_ceiling_eur: 0 },
  approval_requirements: ['SAFE_SYNTHETIC_WRITE'],
  workflow_type: 'lead_intake'
};

const bakeryPlan = routeWorkflowPlan(buildWorkflowPlan(bakeryMission));
assert.equal(bakeryPlan.ok, true);
assert.equal(bakeryPlan.nodes.find((n) => n.id === 'persist_lead')?.provider_id, 'make-core');
assert.equal(bakeryPlan.nodes.find((n) => n.id === 'normalize')?.provider_id, 'riosystems-native-automation');
assert.equal(bakeryPlan.variable_cost_ceiling_eur, 0);
assert.equal(bakeryPlan.production, false);

const store = new InMemoryIdempotencyStore();
const bakeryRun = await runAutomationMission(bakeryMission, { idempotency_store: store, run_id: 'bakery-run-1' });
assert.equal(bakeryRun.ok, true);
assert.equal(bakeryRun.run.status, 'COMPLETED');
assert.equal(bakeryRun.outputs.result.email, 'test@example.com');
assert.equal(bakeryRun.outputs.result.persisted, false);
assert.match(bakeryRun.outputs.result.staging_record_id, /^synthetic-/);
assert.equal(bakeryRun.variable_cost_eur, 0);
assert.equal(bakeryRun.production, false);
assert.equal(bakeryRun.delivery_manifest.qa.passed, true);
assert.equal(bakeryRun.delivery_manifest.cost.variable_eur, 0);
assert.equal(bakeryRun.run.steps.find((step) => step.step_id === 'analytics')?.artifacts?.analytics_event?.posthog_compatible, true);
const makePlan = bakeryRun.provider_plans.plans.find((p) => p.provider_id === 'make-core');
assert.ok(makePlan);
assert.equal(makePlan.existing_operator_scenarios, 'DO_NOT_TOUCH');
assert.equal(makePlan.create_then_test_then_restore_inactive, true);
assert.equal(makePlan.execution_runner.restore_inactive_required, true);
assert.equal(makePlan.provider_http_executed, false);
assert.equal(makePlan.scenario_spec.project, 'Bäckerei Müller');

const bakeryRepeat = await runAutomationMission(bakeryMission, { idempotency_store: store, run_id: 'bakery-run-2' });
assert.equal(bakeryRepeat.ok, true);
assert.ok(bakeryRepeat.run.steps.some((step) => step.status === 'DUPLICATE_SKIPPED'));
assert.equal(bakeryRepeat.run.steps.find((step) => step.step_id === 'persist_lead')?.status, 'DUPLICATE_SKIPPED');
assert.equal(bakeryRepeat.run.steps.find((step) => step.step_id === 'analytics')?.status, 'DUPLICATE_SKIPPED');

const crmSyncMission = {
  project: 'Synthetic CRM Sync',
  project_id: 'synthetic-crm-sync',
  trigger: { type: 'schedule', cron: '*/15 * * * *' },
  goal: 'Synchronize synthetic CRM changes and emit an analytics plan',
  inputs: { records: [] },
  outputs: { sync: 'synthetic_crm_event' },
  systems: ['Supabase', 'CRM', 'PostHog'],
  data_classification: 'synthetic_test_data',
  execution_frequency: 'scheduled',
  side_effect_level: 'safe_synthetic_write',
  budget: { variable_cost_ceiling_eur: 0 },
  workflow_type: 'crm_sync'
};
const crmSyncPlan = buildWorkflowPlan(crmSyncMission);
assert.equal(crmSyncPlan.ok, true);
assert.equal(crmSyncPlan.workflow_type, 'crm_sync');
assert.ok(crmSyncPlan.nodes.some((step) => step.type === 'crm_event'));

const fileMission = {
  project: 'Synthetic Ops Archive',
  project_id: 'synthetic-ops-archive',
  trigger: { type: 'schedule', cron: '0 6 * * *' },
  goal: 'Process a synthetic staging file batch and prepare an analytics event',
  inputs: { records: [], files: [{ name: 'synthetic.csv' }] },
  outputs: { report: 'synthetic_summary' },
  systems: ['Supabase', 'PostHog'],
  data_classification: 'synthetic_test_data',
  execution_frequency: 'daily',
  side_effect_level: 'safe_synthetic_write',
  budget: { variable_cost_ceiling_eur: 0 },
  workflow_type: 'file_processing'
};
const fileRun = await runAutomationMission(fileMission, { run_id: 'file-run-1' });
assert.equal(fileRun.ok, true);
assert.equal(fileRun.plan.workflow_type, 'file_processing');
assert.ok(fileRun.run.steps.some((step) => step.type === 'file_processing'));
assert.equal(fileRun.delivery_manifest.qa.synthetic_test_data_only, true);

const retryMission = {
  ...bakeryMission,
  project: 'Retry Test', project_id: 'retry-test',
  workflow: [
    { id: 'trigger', type: 'schedule' },
    { id: 'normalize', type: 'transform', depends_on: ['trigger'], retry_limit: 2 },
    { id: 'output', type: 'output', depends_on: ['normalize'] }
  ]
};
const retryRun = await runAutomationMission(retryMission, { run_id: 'retry-run', simulation: { failures: { normalize: [{ code: 'ETIMEDOUT' }] } } });
assert.equal(retryRun.ok, true);
assert.equal(retryRun.run.steps.find((step) => step.step_id === 'normalize')?.retry_count, 1);

const repairRun = await runAutomationMission(retryMission, { run_id: 'repair-run', simulation: { failures: { normalize: [{ code: 'SCHEMA_INVALID' }] } } });
assert.equal(repairRun.ok, true);
assert.equal(repairRun.run.steps.find((step) => step.step_id === 'normalize')?.retry_count, 1);

const fallbackMission = {
  ...bakeryMission,
  project: 'Fallback Test', project_id: 'fallback-test',
  workflow: [
    { id: 'trigger', type: 'schedule' },
    { id: 'fetch', type: 'http', depends_on: ['trigger'] },
    { id: 'output', type: 'output', depends_on: ['fetch'] }
  ]
};
const fallbackRun = await runAutomationMission(fallbackMission, {
  run_id: 'fallback-run', fallback_approved: true, fallback_semantics_match: true,
  simulation: { failures: { fetch: [{ type: 'PROVIDER', code: 'PROVIDER_DOWN' }] } }
});
assert.equal(fallbackRun.ok, true);
assert.equal(fallbackRun.run.steps.find((step) => step.step_id === 'fetch')?.provider_id, 'activepieces-cloud-free');

assert.equal(validateFallback({ from_provider: 'make-core', to_provider: 'activepieces-cloud-free', action_type: 'http', variable_cost_eur: 1, approval: true, side_effect_semantics_match: true }).ok, false);
assert.equal(validateFallback({ from_provider: 'make-core', to_provider: 'activepieces-cloud-free', action_type: 'http', variable_cost_eur: 0, approval: false, side_effect_semantics_match: true }).ok, false);
assert.equal(validateFallback({ from_provider: 'make-core', to_provider: 'activepieces-cloud-free', action_type: 'http', variable_cost_eur: 0, approval: true, side_effect_semantics_match: false }).ok, false);

const failClosed = await runAutomationMission(retryMission, { run_id: 'fail-run', simulation: { failures: { normalize: [{ code: 'PERMANENT_BAD_INPUT', api_key: 'do-not-log' }] } } });
assert.equal(failClosed.ok, false);
assert.equal(failClosed.run.status, 'FAILED');
assert.equal(failClosed.run.steps.find((step) => step.step_id === 'normalize')?.error?.api_key, '[REDACTED]');
assert.ok(failClosed.run.steps.some((step) => step.status === 'SKIPPED'));

const externalAttempt = await runAutomationMission(bakeryMission, { execute_external: true });
assert.equal(externalAttempt.ok, false);
assert.ok(externalAttempt.errors.includes('V1_EXTERNAL_PROVIDER_EXECUTION_DISABLED'));
assert.equal(externalAttempt.variable_cost_eur, 0);
assert.equal(externalAttempt.production, false);

assert.deepEqual(redactSecrets({ token: 'abc', nested: { password: 'x', ok: 1 } }), { token: '[REDACTED]', nested: { password: '[REDACTED]', ok: 1 } });

console.log('automation-factory-v1-smoke: ok');
