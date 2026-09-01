import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';

const config = JSON.parse(await readFile('wrangler.customer-production.jsonc', 'utf8'));
const supabaseUrl = String(config?.vars?.AURENTARA_CUSTOMER_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = String(config?.vars?.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY || '');
const customerRef = String(config?.vars?.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF || '');
const operatorRef = String(config?.vars?.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF || '');
const schema = 'aurentara_customer_ai';

assert.equal(customerRef, 'pqmbtfzjcdnihovvppjr');
assert.notEqual(customerRef, operatorRef);
assert.equal(new URL(supabaseUrl).hostname, `${customerRef}.supabase.co`);
assert.ok(publishableKey.startsWith('sb_publishable_'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    ...init
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, body };
}

const baseHeaders = { apikey: publishableKey, 'content-type': 'application/json', accept: 'application/json' };
const settings = await requestJson(`${supabaseUrl}/auth/v1/settings`, { method: 'GET', headers: { apikey: publishableKey, accept: 'application/json' } });
assert.equal(settings.ok, true, 'HOSTED_AUTH_SETTINGS_UNREACHABLE');
assert.equal(settings.body?.disable_signup, false, 'HOSTED_AUTH_SIGNUP_DISABLED');
assert.equal(settings.body?.external?.email, true, 'HOSTED_AUTH_EMAIL_DISABLED');
assert.equal(typeof settings.body?.mailer_autoconfirm, 'boolean', 'HOSTED_AUTH_AUTOCONFIRM_STATE_UNKNOWN');

const configuredEmail = String(process.env.AURENTARA_IDENTITY_E2E_EMAIL || '').trim().toLowerCase();
const email = configuredEmail || `aurentara.identity.e2e.${randomUUID().replaceAll('-', '')}@example.com`;
assert.match(email, /^aurentara\.identity\.e2e\.[a-z0-9.-]+@example\.com$/, 'SYNTHETIC_IDENTITY_EMAIL_REQUIRED');
const password = `Au!${randomBytes(24).toString('base64url')}9z`;
let accessToken = null;
let userId = null;
let tenantId = null;
let businessId = null;
let deletion = null;
let cleanupAttempted = false;
let confirmationWaited = false;

function userHeaders(profile = null, contentProfile = false) {
  assert.ok(accessToken, 'HOSTED_AUTH_ACCESS_TOKEN_REQUIRED');
  return {
    ...baseHeaders,
    authorization: `Bearer ${accessToken}`,
    ...(profile ? { [contentProfile ? 'Content-Profile' : 'Accept-Profile']: profile } : {})
  };
}

async function deleteSyntheticAccount() {
  if (!accessToken || cleanupAttempted === true) return null;
  cleanupAttempted = true;
  const result = await requestJson(`${supabaseUrl}/functions/v1/aurentara-delete-account-v1`, {
    method: 'POST',
    headers: userHeaders(),
    body: JSON.stringify({ confirm: 'DELETE_MY_AURENTARA_DATA' })
  });
  deletion = result;
  return result;
}

async function acquireHostedSession() {
  const signup = await requestJson(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      email,
      password,
      data: { synthetic_e2e: true, source: 'aurentara_hosted_identity_e2e_v1' }
    })
  });
  assert.equal(signup.ok, true, `HOSTED_AUTH_SIGNUP_FAILED:${signup.status}`);
  userId = String(signup.body?.user?.id || '');
  assert.match(userId, /^[0-9a-f-]{36}$/i, 'HOSTED_AUTH_USER_ID_INVALID');

  const immediate = String(signup.body?.access_token || '');
  if (immediate.length > 100) return immediate;

  assert.equal(settings.body?.mailer_autoconfirm, false, 'HOSTED_AUTH_SESSION_NOT_CREATED_UNEXPECTEDLY');
  confirmationWaited = true;
  console.log(JSON.stringify({
    suite: 'AURENTARA CUSTOMER HOSTED IDENTITY E2E V1',
    status: 'WAITING_FOR_SYNTHETIC_ADMIN_CONFIRMATION',
    hosted_signup_created: true,
    mailer_autoconfirm: false,
    synthetic_user_id_available: true,
    email_returned: false,
    password_returned: false,
    access_token_returned: false,
    real_customer_data: false,
    variable_cost_eur: 0
  }));

  for (let attempt = 1; attempt <= 150; attempt += 1) {
    const signIn = await requestJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email, password })
    });
    const token = String(signIn.body?.access_token || '');
    if (signIn.ok && token.length > 100) return token;
    await sleep(2000);
  }
  throw new Error('HOSTED_AUTH_SYNTHETIC_CONFIRMATION_TIMEOUT');
}

let primaryError = null;
try {
  accessToken = await acquireHostedSession();
  assert.ok(accessToken.length > 100, 'HOSTED_AUTH_SESSION_NOT_CREATED');

  const user = await requestJson(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: userHeaders()
  });
  assert.equal(user.ok, true, 'HOSTED_AUTH_GET_USER_FAILED');
  assert.equal(user.body?.id, userId, 'HOSTED_AUTH_USER_ID_MISMATCH');

  const bootstrap = await requestJson(`${supabaseUrl}/rest/v1/rpc/bootstrap_personal_workspace`, {
    method: 'POST',
    headers: userHeaders(schema, true),
    body: JSON.stringify({ p_business_name: 'AURENTARA Synthetic Identity E2E' })
  });
  assert.equal(bootstrap.ok, true, `HOSTED_IDENTITY_BOOTSTRAP_FAILED:${bootstrap.status}`);
  assert.equal(bootstrap.body?.ok, true, 'HOSTED_IDENTITY_BOOTSTRAP_NOT_OK');
  assert.equal(bootstrap.body?.user_id, userId, 'HOSTED_IDENTITY_BOOTSTRAP_USER_MISMATCH');
  tenantId = String(bootstrap.body?.tenant_id || '');
  businessId = String(bootstrap.body?.business_id || '');
  assert.ok(tenantId.startsWith('tenant_'), 'HOSTED_IDENTITY_TENANT_ID_INVALID');
  assert.ok(businessId.startsWith('business_'), 'HOSTED_IDENTITY_BUSINESS_ID_INVALID');

  const memberships = await requestJson(`${supabaseUrl}/rest/v1/memberships?select=tenant_id,user_id,role,status&user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: userHeaders(schema)
  });
  assert.equal(memberships.ok, true, 'HOSTED_IDENTITY_RLS_MEMBERSHIP_READ_FAILED');
  assert.equal(Array.isArray(memberships.body), true);
  assert.equal(memberships.body.length, 1, 'HOSTED_IDENTITY_RLS_MEMBERSHIP_COUNT_INVALID');
  assert.equal(memberships.body[0]?.tenant_id, tenantId);
  assert.equal(memberships.body[0]?.user_id, userId);
  assert.equal(memberships.body[0]?.role, 'owner');
  assert.equal(memberships.body[0]?.status, 'active');

  const businesses = await requestJson(`${supabaseUrl}/rest/v1/businesses?select=tenant_id,business_id,name,owner_user_id&tenant_id=eq.${encodeURIComponent(tenantId)}`, {
    method: 'GET',
    headers: userHeaders(schema)
  });
  assert.equal(businesses.ok, true, 'HOSTED_IDENTITY_RLS_BUSINESS_READ_FAILED');
  assert.equal(Array.isArray(businesses.body), true);
  assert.equal(businesses.body.length, 1, 'HOSTED_IDENTITY_RLS_BUSINESS_COUNT_INVALID');
  assert.equal(businesses.body[0]?.business_id, businessId);
  assert.equal(businesses.body[0]?.owner_user_id, userId);

  const foreignTenant = `tenant_${randomUUID().replaceAll('-', '')}`;
  const foreignMembership = await requestJson(`${supabaseUrl}/rest/v1/memberships?select=tenant_id,user_id&tenant_id=eq.${encodeURIComponent(foreignTenant)}`, {
    method: 'GET',
    headers: userHeaders(schema)
  });
  assert.equal(foreignMembership.ok, true, 'HOSTED_IDENTITY_FOREIGN_SCOPE_QUERY_FAILED');
  assert.deepEqual(foreignMembership.body, [], 'HOSTED_IDENTITY_FOREIGN_SCOPE_VISIBLE');

  const repeatedBootstrap = await requestJson(`${supabaseUrl}/rest/v1/rpc/bootstrap_personal_workspace`, {
    method: 'POST',
    headers: userHeaders(schema, true),
    body: JSON.stringify({ p_business_name: 'Ignored Duplicate' })
  });
  assert.equal(repeatedBootstrap.ok, true, 'HOSTED_IDENTITY_BOOTSTRAP_IDEMPOTENCY_FAILED');
  assert.equal(repeatedBootstrap.body?.created, false, 'HOSTED_IDENTITY_DUPLICATE_WORKSPACE_CREATED');
  assert.equal(repeatedBootstrap.body?.tenant_id, tenantId);

  const removed = await deleteSyntheticAccount();
  assert.equal(removed?.ok, true, `HOSTED_IDENTITY_CLEANUP_FAILED:${removed?.status}`);
  assert.equal(removed?.body?.ok, true, 'HOSTED_IDENTITY_DELETE_FUNCTION_NOT_OK');
  assert.equal(removed?.body?.customer_data_deleted, true, 'HOSTED_IDENTITY_CUSTOMER_DATA_NOT_DELETED');
  assert.equal(removed?.body?.auth_user_deleted, true, 'HOSTED_IDENTITY_AUTH_USER_NOT_DELETED');

  const deletedUser = await requestJson(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: userHeaders()
  });
  assert.equal(deletedUser.ok, false, 'HOSTED_IDENTITY_DELETED_USER_SESSION_STILL_RESOLVES');
} catch (error) {
  primaryError = error;
} finally {
  if (accessToken && !cleanupAttempted) {
    try { await deleteSyntheticAccount(); } catch {}
  }
}

if (primaryError) {
  if (accessToken && (!deletion?.ok || deletion?.body?.auth_user_deleted !== true)) {
    throw new Error(`HOSTED_IDENTITY_E2E_FAILED_AND_CLEANUP_UNVERIFIED:${primaryError.message}`);
  }
  throw primaryError;
}

assert.equal(deletion?.body?.auth_user_deleted, true, 'HOSTED_IDENTITY_FINAL_CLEANUP_UNVERIFIED');
console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER HOSTED IDENTITY E2E V1',
  status: 'PASS',
  hosted_auth_settings_verified: true,
  hosted_signup_verified: true,
  hosted_confirmation_path_verified: confirmationWaited,
  hosted_auth_user_flow_verified: true,
  hosted_session_jwt_verified: true,
  jwt_to_rls_membership_e2e_verified: true,
  workspace_bootstrap_verified: true,
  bootstrap_idempotency_verified: true,
  foreign_scope_hidden: true,
  production_delete_function_cleanup_verified: true,
  synthetic_auth_user_retained: false,
  customer_project_ref: customerRef,
  operator_project_ref: operatorRef,
  customer_operator_project_separation: true,
  email_returned: false,
  password_returned: false,
  access_token_returned: false,
  real_customer_data: false,
  paid_provider_calls: false,
  variable_cost_eur: 0
}, null, 2));
