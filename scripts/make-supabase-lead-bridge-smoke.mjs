import assert from 'node:assert/strict';
import {
  buildMakeSupabaseLeadBridgePlan,
  evaluateMakeSupabaseLeadBridgeExecution,
  makeSupabaseLeadBridgeManifest
} from '../src/make-supabase-lead-bridge.js';

const legacyInput = {
  customer_id: 'bakery-muller',
  project_id: 'digital-system-v1',
  project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  production_deploy: false
};
const muellerInput = {
  customer_id: 'synthetic-mueller-elektrotechnik-saarbruecken',
  project_id: 'mueller-elektrotechnik-digital-customer-system-v1',
  project_uuid: 'b3f54cc8-4abf-4f9c-92c9-81a4ebcdd001',
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  production_deploy: false
};

for (const input of [legacyInput, muellerInput]) {
  const plan = buildMakeSupabaseLeadBridgePlan(input);
  assert.equal(plan.ok, true);
  assert.equal(plan.state, 'BRIDGE_PLAN_READY_APPROVAL_REQUIRED');
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.scope.scope_key, input.customer_id + ':' + input.project_id);
  assert.equal(plan.scope.project_uuid, input.project_uuid);
  assert.equal(plan.providers.automation.provider_id, 'make-core');
  assert.equal(plan.providers.automation.verified_scenario_id, 7149691);
  assert.equal(plan.providers.business.provider_id, 'supabase-free');
  assert.equal(plan.providers.business.project_ref, 'pgzayxpqiakuvibhonwh');
  assert.equal(plan.providers.business.foundation_verified, true);
  assert.equal(plan.providers.business.write_plan.scope.scope_key, plan.scope.scope_key);
  assert.equal(plan.bridge_contract.input.project_scope, plan.scope.scope_key);
  assert.equal(plan.bridge_contract.input.pii_in_envelope, false);
  assert.equal(JSON.stringify(plan.bridge_contract.input).includes('@'), false);
  assert.equal(plan.execution_authorized, false);
  assert.equal(plan.max_variable_cost_eur, 0);
  assert.equal(plan.automatic_paid_overflow, false);
  assert.equal(plan.production_deploy, false);

  const approved = evaluateMakeSupabaseLeadBridgeExecution(plan, {
    bridge_confirmation: 'RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE',
    make_confirmation: 'RUN_STAGING_ONCE',
    supabase_confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
    external_write_execution_approved: true,
    supervised_execution_approved: true,
    make_provider_approved: true,
    project_isolation_approved: true,
    approved_scope_key: plan.scope.scope_key,
    staging_only: true,
    synthetic_test_data_only: true,
    zero_cost_confirmed: true,
    max_variable_cost_eur: 0,
    production_deploy: false
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.execution_ready, true);
}

const partialScope = buildMakeSupabaseLeadBridgePlan({ customer_id: 'only-customer', staging_only: true, synthetic_test_data_only: true });
assert.equal(partialScope.ok, false);
assert.equal(partialScope.error, 'MAKE_SUPABASE_BRIDGE_SCOPE_INVALID');
const customerData = buildMakeSupabaseLeadBridgePlan({ ...muellerInput, real_customer_data: true });
assert.equal(customerData.ok, false);
const production = buildMakeSupabaseLeadBridgePlan({ ...muellerInput, production_deploy: true });
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

const manifest = makeSupabaseLeadBridgeManifest();
assert.equal(manifest.scope_mode, 'explicit_customer_project_uuid');
assert.equal(manifest.pii_in_bridge_envelope, false);
assert.equal(manifest.exact_scope_required, true);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Make -> Supabase generalized lead bridge smoke: OK');
