import assert from 'node:assert/strict';
import {
  buildMakeSupabaseLeadBridgePlan,
  evaluateMakeSupabaseLeadBridgeExecution,
  makeSupabaseLeadBridgeManifest
} from '../src/make-supabase-lead-bridge.js';

const input = {
  customer_id: 'bakery-muller',
  project_id: 'digital-system-v1',
  project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  production_deploy: false
};

const plan = buildMakeSupabaseLeadBridgePlan(input);
assert.equal(plan.ok, true);
assert.equal(plan.state, 'BRIDGE_PLAN_READY_APPROVAL_REQUIRED');
assert.deepEqual(plan.blockers, []);
assert.equal(plan.scope.scope_key, 'bakery-muller:digital-system-v1');
assert.equal(plan.scope.project_uuid, input.project_uuid);
assert.equal(plan.providers.automation.provider_id, 'make-core');
assert.equal(plan.providers.automation.verified_scenario_id, 7149691);
assert.equal(plan.providers.automation.latest_verified_execution_id, 'e3198aaaeed64e7b8380c6e067439ecf');
assert.equal(plan.providers.automation.existing_staging_activation_verified, true);
assert.equal(plan.providers.automation.new_supervised_run_required, true);
assert.equal(plan.providers.business.provider_id, 'supabase-free');
assert.equal(plan.providers.business.project_ref, 'pgzayxpqiakuvibhonwh');
assert.equal(plan.providers.business.foundation_verified, true);
assert.equal(plan.providers.business.foundation_schema, 'public');
assert.deepEqual(plan.providers.business.foundation_tables, ['customer_projects','contacts','leads','lead_events','provider_execution_refs','audit_log']);
assert.equal(plan.providers.business.write_plan.state, 'WRITE_PLAN_READY_EXISTING_FOUNDATION');
assert.equal(plan.providers.business.write_plan.scope.scope_key, input.customer_id + ':' + input.project_id);
assert.equal(plan.bridge_contract.supabase_persistence.reuse_existing_foundation, true);
assert.equal(plan.bridge_contract.supabase_persistence.create_new_schema, false);
assert.equal(plan.bridge_contract.supabase_persistence.idempotency_scope, 'project_id_plus_idempotency_key');
assert.equal(plan.bridge_contract.supabase_persistence.audit_required, true);
assert.equal(plan.bridge_contract.input.synthetic, true);
assert.equal(plan.bridge_contract.input.real_customer_data, false);
assert.equal(plan.execution_authorized, false);
assert.equal(plan.execute_make, false);
assert.equal(plan.execute_supabase, false);
assert.equal(plan.max_variable_cost_eur, 0);
assert.equal(plan.automatic_paid_overflow, false);
assert.equal(plan.production_deploy, false);

const wrongScope = buildMakeSupabaseLeadBridgePlan({ ...input, project_id: 'other-project' });
assert.equal(wrongScope.ok, false);
assert.equal(wrongScope.error, 'MAKE_SUPABASE_BRIDGE_SCOPE_REJECTED');

const customerData = buildMakeSupabaseLeadBridgePlan({ ...input, real_customer_data: true });
assert.equal(customerData.ok, false);
assert.equal(customerData.error, 'MAKE_SUPABASE_BRIDGE_SYNTHETIC_STAGING_REQUIRED');

const notStaging = buildMakeSupabaseLeadBridgePlan({ ...input, staging_only: false });
assert.equal(notStaging.ok, false);
assert.equal(notStaging.error, 'MAKE_SUPABASE_BRIDGE_SYNTHETIC_STAGING_REQUIRED');

const production = buildMakeSupabaseLeadBridgePlan({ ...input, production_deploy: true });
assert.equal(production.ok, false);
assert.equal(production.error, 'PRODUCTION_DEPLOY_REJECTED');

const blocked = evaluateMakeSupabaseLeadBridgeExecution(plan, {});
assert.equal(blocked.ok, false);
assert.equal(blocked.execution_ready, false);
assert.equal(blocked.state, 'BLOCKED');
assert.ok(blocked.blockers.some((item) => item.code === 'MAKE_SUPABASE_BRIDGE_CONFIRMATION_REQUIRED'));
assert.ok(blocked.blockers.some((item) => item.code === 'EXTERNAL_WRITE_EXECUTION_APPROVAL_REQUIRED'));
assert.ok(blocked.blockers.some((item) => item.code === 'ZERO_VARIABLE_COST_CONFIRMATION_REQUIRED'));

const approved = evaluateMakeSupabaseLeadBridgeExecution(plan, {
  bridge_confirmation: 'RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE',
  make_confirmation: 'RUN_STAGING_ONCE',
  supabase_confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  make_provider_approved: true,
  project_isolation_approved: true,
  approved_scope_key: 'bakery-muller:digital-system-v1',
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false
});
assert.equal(approved.ok, true);
assert.equal(approved.execution_ready, true);
assert.equal(approved.state, 'BRIDGE_EXECUTION_APPROVED_NOT_EXECUTED');
assert.deepEqual(approved.blockers, []);
assert.equal(approved.execute_make, false);
assert.equal(approved.execute_supabase, false);
assert.equal(approved.max_variable_cost_eur, 0);
assert.equal(approved.production_deploy, false);

const paid = evaluateMakeSupabaseLeadBridgeExecution(plan, {
  bridge_confirmation: 'RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE',
  make_confirmation: 'RUN_STAGING_ONCE',
  supabase_confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  make_provider_approved: true,
  project_isolation_approved: true,
  approved_scope_key: 'bakery-muller:digital-system-v1',
  staging_only: true,
  synthetic_test_data_only: true,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0.01,
  production_deploy: false
});
assert.equal(paid.ok, false);
assert.ok(paid.blockers.some((item) => item.code === 'ZERO_VARIABLE_COST_CONFIRMATION_REQUIRED'));

const manifest = makeSupabaseLeadBridgeManifest();
assert.deepEqual(manifest.providers, ['make-core','supabase-free']);
assert.equal(manifest.reuse_verified_make_staging_scenario, true);
assert.equal(manifest.reuse_verified_supabase_crm_foundation, true);
assert.equal(manifest.synthetic_test_data_only, true);
assert.equal(manifest.exact_scope_required, true);
assert.equal(manifest.explicit_external_write_execution_approval_required, true);
assert.equal(manifest.supervised_execution_required, true);
assert.equal(manifest.zero_variable_cost_confirmation_required, true);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Make -> Supabase lead bridge plan smoke: OK');
