import assert from 'node:assert/strict';
import { buildSupabaseStagingCrmWritePlan, runSupabaseStagingCrmWrite, supabaseStagingWriteManifest } from '../src/business-staging-write-plan.js';

const input = {
  customer_id: 'bakery-muller',
  project_id: 'digital-system-v1',
  staging_only: true,
  synthetic_test_data_only: true,
  real_customer_data: false,
  production_deploy: false
};
const plan = buildSupabaseStagingCrmWritePlan(input);
assert.equal(plan.ok, true);
assert.equal(plan.state, 'WRITE_PLAN_READY_NOT_EXECUTED');
assert.equal(plan.scope.scope_key, 'bakery-muller:digital-system-v1');
assert.equal(plan.database.schema_name, 'riosystems_staging');
assert.equal(plan.database.exposed_via_data_api, false);
assert.equal(plan.database.rls_enabled, true);
assert.equal(plan.database.rls_forced, true);
assert.equal(plan.database.anon_access, false);
assert.equal(plan.database.authenticated_access, false);
assert.match(plan.statements.apply, /enable row level security/i);
assert.match(plan.statements.apply, /force row level security/i);
assert.match(plan.statements.apply, /revoke all on riosystems_staging\.crm_leads from public, anon, authenticated/i);
assert.match(plan.statements.apply, /on conflict \(customer_id, project_id, external_ref\)/i);
assert.match(plan.statements.apply, /example\.invalid/i);
assert.equal(plan.statements.apply.includes('service_role'), false);
assert.equal(plan.execute_sql, false);
assert.equal(plan.estimated_variable_cost_eur, 0);
assert.equal(plan.production_deploy, false);

const rejectedCustomerData = buildSupabaseStagingCrmWritePlan({ ...input, real_customer_data: true });
assert.equal(rejectedCustomerData.ok, false);
assert.equal(rejectedCustomerData.error, 'SYNTHETIC_ISOLATED_STAGING_REQUIRED');
const rejectedScope = buildSupabaseStagingCrmWritePlan({ ...input, customer_id: "bad'customer" });
assert.equal(rejectedScope.ok, false);
assert.equal(rejectedScope.error, 'STAGING_PROJECT_SCOPE_INVALID');

const noApproval = await runSupabaseStagingCrmWrite(plan, {});
assert.equal(noApproval.ok, false);
assert.equal(noApproval.error, 'SUPABASE_STAGING_WRITE_CONFIRMATION_REQUIRED');

const tampered = structuredClone(plan);
tampered.statements.apply = 'drop schema public cascade;';
const tamperedResult = await runSupabaseStagingCrmWrite(tampered, {
  confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  project_isolation_approved: true,
  approved_scope_key: plan.scope.scope_key,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  execute_sql: async () => { throw new Error('tampered plan must never reach executor'); }
});
assert.equal(tamperedResult.ok, false);
assert.equal(tamperedResult.error, 'SUPABASE_STAGING_WRITE_PLAN_TAMPERED');

const calls = [];
const result = await runSupabaseStagingCrmWrite(plan, {
  confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  project_isolation_approved: true,
  approved_scope_key: plan.scope.scope_key,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  production_deploy: false,
  execute_sql: async (request) => {
    calls.push(request);
    if (request.operation === 'verify_synthetic_scope') return { ok: true, rows: [{ synthetic_row_count: 1, synthetic_only: true }] };
    return { ok: true };
  }
});
assert.equal(result.ok, true);
assert.equal(result.stage, 'SUPABASE_STAGING_CRM_WRITE_VERIFIED');
assert.equal(result.scope_key, plan.scope.scope_key);
assert.equal(result.synthetic_test_data_only, true);
assert.equal(result.estimated_variable_cost_eur, 0);
assert.equal(result.external_side_effect_performed, true);
assert.equal(result.production_deploy, false);
assert.deepEqual(calls.map((item) => item.operation), ['staging_schema_and_synthetic_upsert', 'verify_synthetic_scope']);

const wrongScope = await runSupabaseStagingCrmWrite(plan, {
  confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  project_isolation_approved: true,
  approved_scope_key: 'another:project',
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0,
  execute_sql: async () => ({ ok: true })
});
assert.equal(wrongScope.ok, false);
assert.equal(wrongScope.error, 'SUPABASE_PROJECT_ISOLATION_APPROVAL_REQUIRED');

const paid = await runSupabaseStagingCrmWrite(plan, {
  confirmation: 'APPLY_SUPABASE_STAGING_CRM_ONCE',
  external_write_execution_approved: true,
  supervised_execution_approved: true,
  project_isolation_approved: true,
  approved_scope_key: plan.scope.scope_key,
  zero_cost_confirmed: true,
  max_variable_cost_eur: 0.01,
  execute_sql: async () => ({ ok: true })
});
assert.equal(paid.ok, false);
assert.equal(paid.error, 'SUPABASE_ZERO_COST_CONFIRMATION_REQUIRED');

const manifest = supabaseStagingWriteManifest();
assert.equal(manifest.rls_required, true);
assert.equal(manifest.public_roles_revoked, true);
assert.equal(manifest.data_api_exposure, false);
assert.equal(manifest.exact_scope_approval_required, true);
assert.equal(manifest.production_deploy, false);

console.log('RIOSYSTEMS Supabase staging write plan smoke: OK');
