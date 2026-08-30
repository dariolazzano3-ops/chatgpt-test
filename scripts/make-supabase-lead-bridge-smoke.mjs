import assert from 'node:assert/strict';
import { bakeryMullerSyntheticLead, buildMakeSupabaseLeadBridgePlan, makeSupabaseLeadBridgeManifest, runMakeSupabaseLeadBridge } from '../src/make-supabase-lead-bridge.js';

const input = {
  scope_key: 'bakery-muller:digital-system-v1',
  supabase_project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
  make_scenario_id: 7149691,
  lead: bakeryMullerSyntheticLead(),
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  max_variable_cost_eur: 0,
  production_deploy: false
};

const plan = buildMakeSupabaseLeadBridgePlan(input);
assert.equal(plan.ok, true);
assert.equal(plan.state, 'BRIDGE_PLAN_READY_NOT_EXECUTED');
assert.equal(plan.scope_key, 'bakery-muller:digital-system-v1');
assert.equal(plan.make_scenario_id, 7149691);
assert.equal(plan.idempotency_key, 'make-supabase:bakery-muller:digital-system-v1:block3-lead-001');
assert.equal(plan.max_persist_attempts, 2);
assert.equal(plan.dead_letter_on_persist_failure, true);
assert.equal(plan.production_deploy, false);

const rejectedRealData = buildMakeSupabaseLeadBridgePlan({ ...input, real_customer_data: true });
assert.equal(rejectedRealData.state, 'BLOCKED');
assert.equal(rejectedRealData.blockers.some((item) => item.code === 'SYNTHETIC_STAGING_ONLY_REQUIRED'), true);
const rejectedCost = buildMakeSupabaseLeadBridgePlan({ ...input, max_variable_cost_eur: 0.01 });
assert.equal(rejectedCost.state, 'BLOCKED');
assert.equal(rejectedCost.blockers.some((item) => item.code === 'ZERO_COST_REQUIRED'), true);

const noApproval = await runMakeSupabaseLeadBridge(plan, {});
assert.equal(noApproval.ok, false);
assert.equal(noApproval.error, 'MAKE_SUPABASE_BRIDGE_CONFIRMATION_REQUIRED');

const calls = [];
const success = await runMakeSupabaseLeadBridge(plan, {
  confirmation: 'RUN_MAKE_SUPABASE_STAGING_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false,
  run_make: async (request) => {
    calls.push(['make', request]);
    return {
      ok: true,
      scenario_id: 7149691,
      execution_id: 'make-exec-block3-001',
      execution_status: 'success',
      scenario_restored_inactive: true,
      synthetic_test_data_only: true
    };
  },
  persist_supabase: async (request) => {
    calls.push(['supabase', request]);
    return { ok: true, lead_count: 1, audit_count: 1, provider_ref_count: 1, synthetic_only: true, idempotent: true };
  }
});
assert.equal(success.ok, true);
assert.equal(success.stage, 'MAKE_TO_SUPABASE_SYNTHETIC_LEAD_VERIFIED');
assert.equal(success.scenario_restored_inactive, true);
assert.equal(success.persist_attempts, 1);
assert.equal(success.lead_count, 1);
assert.equal(success.variable_cost_eur, 0);
assert.deepEqual(calls.map(([provider]) => provider), ['make','supabase']);
assert.equal(calls[1][1].make.execution_id, 'make-exec-block3-001');
assert.equal(calls[1][1].lead.email.endsWith('@example.invalid'), true);

let persistenceAttempts = 0;
const retried = await runMakeSupabaseLeadBridge(plan, {
  confirmation: 'RUN_MAKE_SUPABASE_STAGING_ONCE', external_write_execution_approved: true, supervised_execution_approved: true,
  staging_only: true, synthetic_test_data_only: true, real_customer_data: false, zero_cost_confirmed: true, max_variable_cost_eur: 0,
  run_make: async () => ({ ok: true, scenario_id: 7149691, execution_id: 'make-exec-retry', execution_status: 'success', scenario_restored_inactive: true, synthetic_test_data_only: true }),
  persist_supabase: async () => {
    persistenceAttempts += 1;
    if (persistenceAttempts === 1) return { ok: false, error: 'TRANSIENT', retryable: true };
    return { ok: true, lead_count: 1, audit_count: 1, provider_ref_count: 1, synthetic_only: true, idempotent: true };
  }
});
assert.equal(retried.ok, true);
assert.equal(retried.persist_attempts, 2);
assert.equal(persistenceAttempts, 2);

const deadLetter = await runMakeSupabaseLeadBridge(plan, {
  confirmation: 'RUN_MAKE_SUPABASE_STAGING_ONCE', external_write_execution_approved: true, supervised_execution_approved: true,
  staging_only: true, synthetic_test_data_only: true, real_customer_data: false, zero_cost_confirmed: true, max_variable_cost_eur: 0,
  run_make: async () => ({ ok: true, scenario_id: 7149691, execution_id: 'make-exec-dlq', execution_status: 'success', scenario_restored_inactive: true, synthetic_test_data_only: true }),
  persist_supabase: async () => ({ ok: false, error: 'PERMANENT', retryable: false })
});
assert.equal(deadLetter.ok, false);
assert.equal(deadLetter.error, 'SUPABASE_BRIDGE_PERSIST_FAILED');
assert.equal(deadLetter.dead_letter.required, true);
assert.equal(deadLetter.dead_letter.make_execution_id, 'make-exec-dlq');
assert.equal(deadLetter.scenario_restored_inactive, true);

const makeFailure = await runMakeSupabaseLeadBridge(plan, {
  confirmation: 'RUN_MAKE_SUPABASE_STAGING_ONCE', external_write_execution_approved: true, supervised_execution_approved: true,
  staging_only: true, synthetic_test_data_only: true, real_customer_data: false, zero_cost_confirmed: true, max_variable_cost_eur: 0,
  run_make: async () => ({ ok: false, scenario_id: 7149691, scenario_restored_inactive: true, synthetic_test_data_only: true }),
  persist_supabase: async () => { throw new Error('must not persist after failed Make execution'); }
});
assert.equal(makeFailure.ok, false);
assert.equal(makeFailure.error, 'MAKE_BRIDGE_RESULT_REJECTED');
assert.equal(makeFailure.supabase_write_performed, false);

const manifest = makeSupabaseLeadBridgeManifest();
assert.deepEqual(manifest.providers, ['make-core','supabase-free']);
assert.equal(manifest.direct_cross_provider_secret_sharing, false);
assert.equal(manifest.idempotency_required, true);
assert.equal(manifest.bounded_persist_attempts, 2);
assert.equal(manifest.dead_letter_required_on_failure, true);
assert.equal(manifest.zero_cost_required, true);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Make to Supabase lead bridge smoke: OK');
