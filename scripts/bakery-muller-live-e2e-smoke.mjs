import assert from 'node:assert/strict';
import { bakeryMullerBlock6SyntheticLead, buildBakeryMullerBlock6Plan, buildBakeryMullerBlock6Delivery, bakeryMullerBlock6Manifest } from '../src/bakery-muller-live-e2e.js';
import { buildBlock6MakeExecutionPlan, block6MakeRunnerManifest } from '../src/block6-make-staging-runner.js';

const scope = 'bakery-muller:digital-system-v1';
const lead = bakeryMullerBlock6SyntheticLead();
assert.equal(lead.project_scope, scope);
assert.equal(lead.trace_id, 'block6-e2e-staging-001');
assert.equal(lead.lead.idempotency_key, 'bakery-muller-digital-system-v1-block6-e2e-lead-001');
assert.equal(lead.contact.email.endsWith('@example.invalid'), true);
assert.equal(lead.synthetic, true);
assert.equal(lead.real_customer_data, false);
assert.equal(lead.production, false);

const blockedProd = buildBakeryMullerBlock6Plan({ production_deploy: true });
assert.equal(blockedProd.ok, false);
assert.equal(blockedProd.error, 'PRODUCTION_DEPLOY_REJECTED');
const blockedCost = buildBakeryMullerBlock6Plan({ staging_only: true, synthetic_test_data_only: true, zero_cost_confirmed: false, max_variable_cost_eur: 0 });
assert.equal(blockedCost.ok, false);

const plan = buildBakeryMullerBlock6Plan({
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
assert.equal(plan.ok, true);
assert.equal(plan.state, 'LIVE_STAGING_E2E_APPROVED_NOT_EXECUTED');
assert.deepEqual(plan.path, ['website','make','supabase','posthog','cloudflare-workers-ai','qa','unified-delivery']);
assert.equal(plan.execution_rules.posthog_max_events, 5);
assert.equal(plan.execution_rules.posthog_retries, 0);
assert.equal(plan.execution_rules.ai_max_tokens, 4);
assert.equal(plan.execution_rules.openai_paid_fallback, false);
assert.equal(plan.execution_rules.provider_secrets_shared_across_jobs, false);

const makePlan = buildBlock6MakeExecutionPlan({
  zone_url: 'https://eu1.make.com',
  team_id: 939128,
  token_ref: 'secret:MAKE_API_TOKEN',
  plan: 'core',
  granted_scopes: ['organization:read','scenarios:read','scenarios:write','scenarios:run'],
  scenario_id: 7149691,
  paid_provider_approved: true,
  external_write_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
assert.equal(makePlan.ok, true);
assert.equal(makePlan.synthetic_payload.trace_id, plan.trace_id);
assert.equal(makePlan.synthetic_payload.lead.idempotency_key, lead.lead.idempotency_key);
assert.equal(makePlan.production_deploy, false);
assert.equal(block6MakeRunnerManifest().external_connections_allowed, false);

const delivery = buildBakeryMullerBlock6Delivery({
  web: { ok: true, staging: true },
  make: { ok: true, scenario_id: 7149691, execution_id: 'synthetic-execution', scenario_restored_inactive: true },
  supabase: { ok: true, lead_count: 1, event_count: 1, provider_ref_count: 1, audit_count: 1 },
  posthog: { ok: true, event_count: 5, flow_id: 'block6-e2e-staging-001' },
  ai: { ok: true, http_status: 200, api_success: true, neurons: 0.2, variable_cost_eur: 0 }
});
assert.equal(delivery.ok, true);
assert.equal(delivery.qa.passed, true);
assert.equal(delivery.status, 'LIVE_STAGING_E2E_VERIFIED');
assert.equal(delivery.production_deploy, false);

const manifest = bakeryMullerBlock6Manifest();
assert.equal(manifest.scope.scope_key, scope);
assert.equal(manifest.live_staging_providers.length, 5);
assert.equal(manifest.max_variable_cost_eur, 0);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Block 6 bakery live E2E safety smoke: OK');
