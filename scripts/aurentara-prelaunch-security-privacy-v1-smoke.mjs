import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCustomerAiFoundation } from '../src/customer-ai/foundation-v1.js';
import {
  createDeterministicCustomerStoreDriver,
  createDurableCustomerStoreAdapter,
  createCustomerDeletionExecutor
} from '../src/customer-product/production-activation-contracts-v1.js';
import {
  CUSTOMER_LAUNCH_MODES_V1,
  customerPrelaunchSecurityPrivacyManifest,
  evaluateCustomerSqlSecurityContract,
  createCustomerConsentLedger,
  createCustomerPrivacyTechnicalController,
  createCustomerLaunchShield
} from '../src/customer-product/prelaunch-security-privacy-v1.js';

const foundationSql = readFileSync(new URL('../migrations/20260901_aurentara_customer_ai_foundation_v1.sql', import.meta.url), 'utf8');
const chatSql = readFileSync(new URL('../migrations/20260901_aurentara_customer_chat_runtime_v1.sql', import.meta.url), 'utf8');
const sqlSecurity = evaluateCustomerSqlSecurityContract({ foundation_sql: foundationSql, chat_sql: chatSql });
assert.equal(sqlSecurity.ok, true, JSON.stringify(sqlSecurity.failures));
assert.equal(sqlSecurity.dedicated_customer_plane_required, true);
assert.equal(sqlSecurity.customer_delete_policy_forbidden, true);
assert.equal(sqlSecurity.vector_filter_at_query_time_required, true);
assert.equal(sqlSecurity.reviewed_contracts_apply_automatically, false);

const manifest = customerPrelaunchSecurityPrivacyManifest();
assert.equal(manifest.sql_security_contract_verifier_ready, true);
assert.equal(manifest.consent_ledger_contract_ready, true);
assert.equal(manifest.launch_shield_contract_ready, true);
assert.equal(manifest.production_retention_policy_approved, false);
assert.equal(manifest.legal_review_complete, false);
assert.equal(manifest.public_customer_traffic_active, false);
assert.equal(manifest.production_deploy, false);

const driver = createDeterministicCustomerStoreDriver();
const store = createDurableCustomerStoreAdapter({ driver, synthetic_fixture: true });
const foundation = createCustomerAiFoundation({ store });
const owner = { tenant_id: 'tenant-privacy-a', user_id: 'user-owner-a' };
const tenant = await foundation.createTenant({ tenant_id: owner.tenant_id, owner_user_id: owner.user_id, name: 'Synthetic Privacy Tenant' });
assert.equal(tenant.ok, true);
const business = await foundation.createBusiness(owner, { business_id: 'business-a', name: 'Synthetic Bakery', country: 'DE', language: 'de', currency: 'EUR' });
assert.equal(business.ok, true);
assert.equal((await foundation.addConfirmedMemory(owner, 'business-a', {
  fact_key: 'daily_customers', category: 'OPERATIONS', value: 120, source_type: 'synthetic_test', confirmed_by_user: true
})).ok, true);

const consent = createCustomerConsentLedger({ store });
assert.equal((await consent.record({ tenant_id: owner.tenant_id, user_id: owner.user_id, purpose: 'persistent_business_memory', granted: true })).error, 'CONSENT_POLICY_VERSION_REQUIRED');
const consentGranted = await consent.record({
  tenant_id: owner.tenant_id,
  user_id: owner.user_id,
  purpose: 'persistent_business_memory',
  granted: true,
  policy_version: 'privacy-tech-v1',
  source: 'synthetic_test'
});
assert.equal(consentGranted.ok, true);
assert.equal((await consent.getCurrent({ tenant_id: owner.tenant_id, user_id: owner.user_id, purpose: 'persistent_business_memory' })).consent.granted, true);
const withdrawn = await consent.withdraw({
  tenant_id: owner.tenant_id,
  user_id: owner.user_id,
  purpose: 'persistent_business_memory',
  policy_version: 'privacy-tech-v1'
});
assert.equal(withdrawn.ok, true);
assert.equal((await consent.getCurrent({ tenant_id: owner.tenant_id, user_id: owner.user_id, purpose: 'persistent_business_memory' })).consent.granted, false);

const cachePurges = [];
const deletion = createCustomerDeletionExecutor({
  store,
  purge_targets: {
    cache_vector_scopes: async ({ tenant_id, dry_run }) => {
      cachePurges.push({ tenant_id, dry_run });
      return { ok: true, deleted_items: dry_run ? 0 : 2 };
    }
  }
});
const privacy = createCustomerPrivacyTechnicalController({ foundation, deletion_executor: deletion, consent_ledger: consent });
assert.equal(privacy.manifest().contract_ready, true);
assert.equal(privacy.manifest().export_supported, true);
assert.equal(privacy.manifest().memory_correction_reused_from_foundation, true);
assert.equal(privacy.manifest().legal_review_complete, false);
const exported = await privacy.exportBusiness(owner, 'business-a');
assert.equal(exported.ok, true);
assert.equal(exported.tenant_id, owner.tenant_id);
assert.equal(exported.data['memory-facts'].length, 1);
const deletionPlan = await privacy.buildDeletionPlan(owner, 'business-a');
assert.equal(deletionPlan.ok, true);
assert.equal(deletionPlan.plan.vector_index_scope.tenant_id, owner.tenant_id);
assert.equal((await privacy.executeTenantDeletion({ tenant_id: owner.tenant_id, synthetic: true, audit_id: 'privacy-audit-1' })).error, 'DELETION_USER_CONFIRMATION_REQUIRED');
const deletionResult = await privacy.executeTenantDeletion({
  tenant_id: owner.tenant_id,
  synthetic: true,
  user_confirmed: true,
  audit_id: 'privacy-audit-1',
  reason: 'synthetic_privacy_test'
});
assert.equal(deletionResult.ok, true);
assert.deepEqual(cachePurges.map((item) => item.dry_run), [true, false]);

const shield = createCustomerLaunchShield({ surface_options: { force_synthetic: true } });
const request = (headers = {}) => new Request('https://customer-shield.test/customer', { headers });
let response = await shield.handle(request(), { AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.OFF });
assert.equal(response.status, 404);
assert.equal((await response.json()).error, 'CUSTOMER_SURFACE_NOT_ACTIVATED');

response = await shield.handle(request(), { AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.SYNTHETIC_STAGING });
assert.equal(response.status, 200);
assert.ok((await response.text()).includes('AURENTARA'));

response = await shield.handle(request(), {
  AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.CONTROLLED_PRELAUNCH,
  AURENTARA_CUSTOMER_PRELAUNCH_ENABLED: 'true',
  AURENTARA_CUSTOMER_PRELAUNCH_TOKEN: 'synthetic-prelaunch-token',
  AURENTARA_CUSTOMER_REAL_DATA_ALLOWED: 'false'
});
assert.equal(response.status, 401);

response = await shield.handle(request({ 'x-aurentara-prelaunch-token': 'synthetic-prelaunch-token' }), {
  AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.CONTROLLED_PRELAUNCH,
  AURENTARA_CUSTOMER_PRELAUNCH_ENABLED: 'true',
  AURENTARA_CUSTOMER_PRELAUNCH_TOKEN: 'synthetic-prelaunch-token',
  AURENTARA_CUSTOMER_REAL_DATA_ALLOWED: 'false'
});
assert.equal(response.status, 200);
assert.equal(response.headers.get('x-aurentara-customer-mode'), 'controlled-prelaunch');

response = await shield.handle(request({ 'x-aurentara-prelaunch-token': 'synthetic-prelaunch-token' }), {
  AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.CONTROLLED_PRELAUNCH,
  AURENTARA_CUSTOMER_PRELAUNCH_ENABLED: 'true',
  AURENTARA_CUSTOMER_PRELAUNCH_TOKEN: 'synthetic-prelaunch-token',
  AURENTARA_CUSTOMER_REAL_DATA_ALLOWED: 'true'
});
assert.equal(response.status, 409);
assert.equal((await response.json()).error, 'CUSTOMER_PRELAUNCH_MUST_REMAIN_SYNTHETIC');

response = await shield.handle(request(), { AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.PUBLIC });
assert.equal(response.status, 404);
assert.equal((await response.json()).error, 'CUSTOMER_PUBLIC_ACTIVATION_REQUIRED');
response = await shield.handle(request(), {
  AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.PUBLIC,
  AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED: 'true',
  AURENTARA_CUSTOMER_REAL_DATA_ALLOWED: 'false'
});
assert.equal(response.status, 503);
assert.equal((await response.json()).error, 'CUSTOMER_REAL_DATA_GATE_REQUIRED');
response = await shield.handle(request(), {
  AURENTARA_CUSTOMER_SURFACE_MODE: CUSTOMER_LAUNCH_MODES_V1.PUBLIC,
  AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED: 'true',
  AURENTARA_CUSTOMER_REAL_DATA_ALLOWED: 'true'
});
assert.equal(response.status, 503);
assert.equal((await response.json()).error, 'CUSTOMER_PRODUCTION_RUNTIME_NOT_BOUND');

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI PRELAUNCH SECURITY PRIVACY V1',
  status: 'PASS',
  sql_rls_contract_verified: true,
  tenant_membership_function_hardened: true,
  authenticated_delete_policy_absent: true,
  vector_scope_at_query_time_verified: true,
  conversation_owner_scope_verified: true,
  consent_grant_withdrawal_verified: true,
  business_export_verified: true,
  deletion_plan_and_executor_verified: true,
  launch_default_off_verified: true,
  controlled_prelaunch_token_verified: true,
  controlled_prelaunch_real_data_rejected: true,
  public_activation_gate_verified: true,
  public_runtime_binding_gate_verified: true,
  legal_review_complete: false,
  production_retention_policy_approved: false,
  public_customer_traffic_active: false,
  real_customer_data: false,
  production_changes: false,
  paid_api_calls: 0,
  variable_cost_eur: 0
}, null, 2));
