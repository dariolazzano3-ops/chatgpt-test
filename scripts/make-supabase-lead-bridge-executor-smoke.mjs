import assert from 'node:assert/strict';
import { buildMakeSupabaseLeadBridgePlan } from '../src/make-supabase-lead-bridge.js';
import { makeSupabaseLeadBridgeExecutorManifest, runMakeSupabaseLeadBridgeOnce } from '../src/make-supabase-lead-bridge-executor.js';

const plan = buildMakeSupabaseLeadBridgePlan({ customer_id: 'bakery-muller', project_id: 'digital-system-v1', project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101', staging_only: true, synthetic_test_data_only: true, real_customer_data: false, production_deploy: false });
const approvals = {
  bridge_confirmation: 'RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE', make_confirmation: 'RUN_STAGING_ONCE', supabase_confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true, supervised_execution_approved: true, make_provider_approved: true, project_isolation_approved: true,
  approved_scope_key: 'bakery-muller:digital-system-v1', staging_only: true, synthetic_test_data_only: true, zero_cost_confirmed: true, max_variable_cost_eur: 0, production_deploy: false
};

let calls = [];
const success = await runMakeSupabaseLeadBridgeOnce(plan, approvals, {
  run_make: async ({ input, scenario_id }) => {
    calls.push('make');
    return { ok: true, scenario_id, execution_id: 'make-exec-block3', execution_status: 'success', scenario_restored_inactive: true, synthetic_test_data_only: true, synthetic_payload: input };
  },
  persist_supabase: async ({ input, make }) => {
    calls.push('supabase');
    assert.equal(input.contact.email, 'synthetic.lead@example.invalid');
    assert.equal(make.execution_id, 'make-exec-block3');
    return { ok: true, lead_count: 1, lead_event_count: 1, provider_ref_count: 1, audit_count: 1, synthetic_only: true, idempotent: true };
  }
});
assert.equal(success.ok, true);
assert.equal(success.stage, 'MAKE_TO_SUPABASE_SYNTHETIC_LEAD_VERIFIED');
assert.deepEqual(calls, ['make','supabase']);
assert.equal(success.scenario_restored_inactive, true);
assert.equal(success.persist_attempts, 1);
assert.equal(success.variable_cost_eur, 0);

let attempts = 0;
const retried = await runMakeSupabaseLeadBridgeOnce(plan, approvals, {
  run_make: async ({ input, scenario_id }) => ({ ok: true, scenario_id, execution_id: 'make-exec-retry', scenario_restored_inactive: true, synthetic_test_data_only: true, synthetic_payload: input }),
  persist_supabase: async () => {
    attempts += 1;
    if (attempts === 1) return { ok: false, error: 'TRANSIENT', retryable: true };
    return { ok: true, lead_count: 1, lead_event_count: 1, provider_ref_count: 1, audit_count: 1, synthetic_only: true, idempotent: true };
  }
});
assert.equal(retried.ok, true);
assert.equal(retried.persist_attempts, 2);

let supabaseCalled = false;
const badMake = await runMakeSupabaseLeadBridgeOnce(plan, approvals, {
  run_make: async () => ({ ok: false, scenario_id: 7149691, scenario_restored_inactive: true }),
  persist_supabase: async () => { supabaseCalled = true; }
});
assert.equal(badMake.ok, false);
assert.equal(badMake.error, 'MAKE_SUPABASE_BRIDGE_MAKE_RESULT_REJECTED');
assert.equal(supabaseCalled, false);

const dead = await runMakeSupabaseLeadBridgeOnce(plan, approvals, {
  run_make: async ({ input, scenario_id }) => ({ ok: true, scenario_id, execution_id: 'make-exec-dead', scenario_restored_inactive: true, synthetic_test_data_only: true, synthetic_payload: input }),
  persist_supabase: async () => ({ ok: false, error: 'PERMANENT', retryable: false })
});
assert.equal(dead.ok, false);
assert.equal(dead.dead_letter.required, true);
assert.equal(dead.dead_letter.make_execution_id, 'make-exec-dead');
assert.equal(dead.scenario_restored_inactive, true);

const manifest = makeSupabaseLeadBridgeExecutorManifest();
assert.equal(manifest.make_must_restore_inactive_before_persist, true);
assert.equal(manifest.max_supabase_persist_attempts, 2);
assert.equal(manifest.dead_letter_required, true);
assert.equal(manifest.cross_provider_secret_sharing, false);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Make -> Supabase lead bridge executor smoke: OK');
