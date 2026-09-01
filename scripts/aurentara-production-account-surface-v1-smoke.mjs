import assert from 'node:assert/strict';
import { createProductionCustomerAccountSurface } from '../src/customer-product/production-account-surface-v1.js';
import { createCustomerLaunchShield } from '../src/customer-product/prelaunch-security-privacy-v1.js';

const env = {
  AURENTARA_CUSTOMER_SUPABASE_URL: 'https://pqmbtfzjcdnihovvppjr.supabase.co',
  AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF: 'pqmbtfzjcdnihovvppjr',
  AURENTARA_OPERATOR_SUPABASE_PROJECT_REF: 'pgzayxpqiakuvibhonwh',
  AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only'
};
const calls = [];
const fakeFetch = async (url, init = {}) => {
  const target = String(url);
  calls.push({ url: target, method: init.method || 'GET', headers: Object.fromEntries(new Headers(init.headers || {}).entries()), body: init.body || null });
  if (target.endsWith('/auth/v1/signup')) {
    return Response.json({ user: { id: 'user-1', email: 'synthetic@example.test', created_at: '2026-09-01T00:00:00Z' }, access_token: 'access-signup', refresh_token: 'refresh-signup', expires_in: 3600 }, { status: 200 });
  }
  if (target.includes('/auth/v1/token?grant_type=password')) {
    return Response.json({ user: { id: 'user-1', email: 'synthetic@example.test' }, access_token: 'access-login', refresh_token: 'refresh-login', expires_in: 3600 }, { status: 200 });
  }
  if (target.includes('/auth/v1/token?grant_type=refresh_token')) {
    return Response.json({ user: { id: 'user-1' }, access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600 }, { status: 200 });
  }
  if (target.endsWith('/auth/v1/user')) {
    return Response.json({ id: 'user-1', email: 'synthetic@example.test', created_at: '2026-09-01T00:00:00Z' }, { status: 200 });
  }
  if (target.endsWith('/auth/v1/logout')) return new Response('', { status: 204 });
  if (target.endsWith('/rest/v1/rpc/bootstrap_personal_workspace')) {
    return Response.json({ ok: true, created: true, tenant_id: 'tenant_user1', business_id: 'business_user1', user_id: 'user-1' }, { status: 200 });
  }
  if (target.includes('/rest/v1/memberships?')) {
    return Response.json([{ tenant_id: 'tenant_user1', role: 'owner', status: 'active' }], { status: 200 });
  }
  if (target.includes('/rest/v1/businesses?')) {
    return Response.json([{ business_id: 'business_user1', name: 'Synthetic Business', country: 'DE', language: 'de', currency: 'EUR' }], { status: 200 });
  }
  throw new Error(`Unexpected fake request: ${target}`);
};

const surface = createProductionCustomerAccountSurface({ fetch_impl: fakeFetch });
const manifest = surface.manifest();
assert.equal(manifest.supabase_auth, true);
assert.equal(manifest.http_only_session_cookies, true);
assert.equal(manifest.service_role_in_browser, false);
assert.equal(manifest.real_customer_ai_processing_active, false);

const signup = await surface.handle(new Request('https://customer.example/customer/api/account/signup', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://customer.example' },
  body: JSON.stringify({ email: 'synthetic@example.test', password: 'Synthetic-Only-Password-123!' })
}), env);
assert.equal(signup.status, 201);
const signupText = await signup.text();
assert.equal(signupText.includes('access-signup'), false);
assert.equal(signupText.includes('refresh-signup'), false);
assert.ok(signup.headers.get('set-cookie')?.includes('HttpOnly'));

const signin = await surface.handle(new Request('https://customer.example/customer/api/account/signin', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://customer.example' },
  body: JSON.stringify({ email: 'synthetic@example.test', password: 'Synthetic-Only-Password-123!' })
}), env);
assert.equal(signin.status, 200);
const signinCookie = signin.headers.get('set-cookie');
assert.ok(signinCookie?.includes('aurentara_customer_access'));
assert.ok(signinCookie?.includes('HttpOnly'));
assert.equal((await signin.text()).includes('access-login'), false);

const cookieHeader = 'aurentara_customer_access=access-login; aurentara_customer_refresh=refresh-login';
const account = await surface.handle(new Request('https://customer.example/customer/api/account', { headers: { cookie: cookieHeader } }), env);
assert.equal(account.status, 200);
assert.equal((await account.json()).user.email, 'synthetic@example.test');

const bootstrap = await surface.handle(new Request('https://customer.example/customer/api/account/bootstrap', {
  method: 'POST', headers: { cookie: cookieHeader, 'content-type': 'application/json', origin: 'https://customer.example' },
  body: JSON.stringify({ business_name: 'Synthetic Business' })
}), env);
assert.equal(bootstrap.status, 200);
assert.equal((await bootstrap.json()).workspace.tenant_id, 'tenant_user1');
const bootstrapCall = calls.find((call) => call.url.endsWith('/rest/v1/rpc/bootstrap_personal_workspace'));
assert.equal(bootstrapCall.headers['content-profile'], 'aurentara_customer_ai');
assert.equal(bootstrapCall.headers.authorization, 'Bearer access-login');
assert.equal(bootstrapCall.headers.apikey, env.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY);
assert.equal(JSON.stringify(calls).includes('service_role'), false);

const workspace = await surface.handle(new Request('https://customer.example/customer/api/account/workspace', { headers: { cookie: cookieHeader } }), env);
assert.equal(workspace.status, 200);
const workspaceBody = await workspace.json();
assert.equal(workspaceBody.workspace.tenant_id, 'tenant_user1');
assert.equal(workspaceBody.workspace.businesses.length, 1);

const chat = await surface.handle(new Request('https://customer.example/customer/api/chat', {
  method: 'POST', headers: { cookie: cookieHeader, 'content-type': 'application/json', origin: 'https://customer.example' }, body: '{}'
}), env);
assert.equal(chat.status, 503);
const chatBody = await chat.json();
assert.equal(chatBody.error, 'REAL_CUSTOMER_AI_PROCESSING_NOT_APPROVED');
assert.equal(chatBody.customer_data_sent_to_ai_provider, false);

const crossOrigin = await surface.handle(new Request('https://customer.example/customer/api/account/signin', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}'
}), env);
assert.equal(crossOrigin.status, 403);
assert.equal(calls.some((call) => call.url.includes('evil.example')), false);

const badConfig = await surface.handle(new Request('https://customer.example/customer/api/manifest'), {
  ...env,
  AURENTARA_OPERATOR_SUPABASE_PROJECT_REF: 'pqmbtfzjcdnihovvppjr'
});
assert.equal(badConfig.status, 503);

const shield = createCustomerLaunchShield({ production_surface: surface, production_runtime_active: true });
const stillOff = await shield.handle(new Request('https://customer.example/customer'), { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: 'off' });
assert.equal(stillOff.status, 404);
const publicWithoutApproval = await shield.handle(new Request('https://customer.example/customer'), { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: 'public' });
assert.equal(publicWithoutApproval.status, 404);
const publicWithoutDataGate = await shield.handle(new Request('https://customer.example/customer'), { ...env, AURENTARA_CUSTOMER_SURFACE_MODE: 'public', AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED: 'true' });
assert.equal(publicWithoutDataGate.status, 503);

console.log(JSON.stringify({
  suite: 'AURENTARA PRODUCTION ACCOUNT SURFACE V1',
  status: 'PASS',
  supabase_auth_gateway_ready: true,
  http_only_session_cookies: true,
  service_role_browser_exposure: false,
  user_jwt_rls_bootstrap: true,
  real_customer_ai_processing: false,
  public_customer_surface: false,
  external_calls_in_test: calls.length
}, null, 2));
