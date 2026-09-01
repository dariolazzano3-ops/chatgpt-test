import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('wrangler.customer-production.jsonc', 'utf8'));
const evidence = JSON.parse(await readFile('evidence/aurentara/customer-production-live-state-v1.json', 'utf8'));
const supabaseUrl = String(config?.vars?.AURENTARA_CUSTOMER_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = String(config?.vars?.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY || '');
const customerRef = String(config?.vars?.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF || '');
const operatorRef = String(config?.vars?.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF || '');

assert.equal(customerRef, 'pqmbtfzjcdnihovvppjr');
assert.notEqual(customerRef, operatorRef);
assert.equal(new URL(supabaseUrl).hostname, `${customerRef}.supabase.co`);
assert.ok(publishableKey.startsWith('sb_publishable_'));

const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
  method: 'GET',
  headers: { apikey: publishableKey, accept: 'application/json' },
  redirect: 'error',
  signal: AbortSignal.timeout(10000)
});
assert.equal(response.ok, true, 'HOSTED_AUTH_SETTINGS_UNREACHABLE');
const settings = await response.json();
assert.equal(settings?.disable_signup, false, 'HOSTED_AUTH_SIGNUP_DISABLED');
assert.equal(settings?.external?.email, true, 'HOSTED_AUTH_EMAIL_DISABLED');
assert.equal(settings?.mailer_autoconfirm, false, 'HOSTED_AUTH_EMAIL_CONFIRMATION_POLICY_CHANGED');

assert.equal(evidence.customer_project_ref, customerRef);
assert.equal(evidence.operator_project_ref, operatorRef);
assert.equal(evidence.project_separation_verified, true);
assert.equal(evidence.auth_service_reachable, true);
assert.equal(evidence.hosted_auth_user_flow_verified, true);
assert.equal(evidence.hosted_password_sign_in_verified, true);
assert.equal(evidence.hosted_session_jwt_verified, true);
assert.equal(evidence.jwt_to_rls_membership_e2e_verified, true);
assert.equal(evidence.jwt_to_rls_business_e2e_verified, true);
assert.equal(evidence.admin_synthetic_identity_bootstrap_verified, true);
assert.equal(evidence.identity_e2e_cleanup_verified, true);
assert.equal(evidence.identity_e2e_method, 'ephemeral_admin_create_user_then_hosted_sign_in');
assert.equal(evidence.public_signup_email_confirmation_policy_unchanged, true);
assert.equal(evidence.public_signup_real_email_flow_verified, false);
assert.equal(evidence.real_customer_data, false);
assert.equal(evidence.variable_cost_eur, 0);
assert.equal(evidence.customer_surface_active, false);
assert.equal(evidence.real_customer_ai_processing_approved, false);
assert.equal(evidence.public_customer_surface_active, false);

console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER HOSTED IDENTITY E2E V1',
  status: 'PASS',
  hosted_auth_policy_live_verified: true,
  hosted_auth_user_flow_evidence_verified: true,
  hosted_password_sign_in_evidence_verified: true,
  hosted_session_jwt_evidence_verified: true,
  jwt_to_rls_membership_e2e_evidence_verified: true,
  jwt_to_rls_business_e2e_evidence_verified: true,
  identity_e2e_cleanup_evidence_verified: true,
  public_signup_email_confirmation_policy_unchanged: true,
  public_signup_real_email_flow_verified: false,
  customer_operator_project_separation: true,
  real_customer_data: false,
  paid_provider_calls: false,
  variable_cost_eur: 0
}, null, 2));
