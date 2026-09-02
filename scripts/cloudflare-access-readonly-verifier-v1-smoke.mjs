#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildCloudflareAccessReadonlyPlan, runCloudflareAccessReadonlyVerification, cloudflareAccessReadonlyVerifierManifest } from '../src/cloudflare-access-readonly-verifier-v1.js';

const ACCOUNT = '0123456789abcdef0123456789abcdef';
const APP_ID = 'f174e90a-fafe-4643-bbbc-4a0ed4fc8415';
const CUSTOMER_APP_ID = 'a174e90a-fafe-4643-bbbc-4a0ed4fc8416';
const plan = buildCloudflareAccessReadonlyPlan({ account_id: ACCOUNT });
assert.equal(plan.ok, true);
assert.equal(plan.read_only, true);
assert.equal(plan.external_write, false);
assert.equal(plan.applications_request.method, 'GET');

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function fetchFor({ apps = [], policies = [], appStatus = 200, policyStatus = 200 } = {}) {
  return async (url, options = {}) => {
    assert.equal(options.method, 'GET');
    assert.ok(String(url).startsWith('https://api.cloudflare.com/client/v4/'));
    if (String(url).includes('/access/apps?')) return response({ success: appStatus < 400, result: apps }, appStatus);
    if (/\/access\/apps\/[^/]+\/policies/.test(String(url))) return response({ success: policyStatus < 400, result: policies }, policyStatus);
    return response({ success: false }, 404);
  };
}

const runtime = (fetch_impl) => ({ fetch_impl, resolve_secret: async () => 'test-token', timeout_ms: 1000, production_deploy: false });
const app = {
  id: APP_ID,
  type: 'self_hosted',
  domain: 'riosystems-staging.example.workers.dev/operator',
  destinations: [
    { type: 'public', uri: 'riosystems-staging.example.workers.dev/operator' },
    { type: 'public', uri: 'control.aurentarasystems.com' }
  ]
};
const customerApp = {
  id: CUSTOMER_APP_ID,
  type: 'self_hosted',
  domain: 'riosystems-staging.example.workers.dev/customer',
  destinations: [{ type: 'public', uri: 'riosystems-staging.example.workers.dev/customer' }]
};
const restrictive = { id: 'p1', decision: 'allow', include: [{ email: { email: 'operator@example.invalid' } }] };

const verified = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [app], policies: [restrictive] })));
assert.equal(verified.ok, true);
assert.equal(verified.stage, 'PRIVATE_ACCESS_VERIFIED');
assert.equal(verified.restrictive_policy_verified, true);
assert.equal(verified.resource_names_returned, false);
assert.equal(verified.external_side_effect_performed, false);

const customPlan = buildCloudflareAccessReadonlyPlan({ account_id: ACCOUNT, expected_hostname: 'control.aurentarasystems.com' });
assert.equal(customPlan.ok, true);
const customVerified = await runCloudflareAccessReadonlyVerification(customPlan, runtime(fetchFor({ apps: [app, customerApp], policies: [restrictive] })));
assert.equal(customVerified.ok, true);
assert.equal(customVerified.stage, 'PRIVATE_ACCESS_VERIFIED');
assert.equal(customVerified.matching_application_count, 1);

const operatorPathPlan = buildCloudflareAccessReadonlyPlan({ account_id: ACCOUNT, expected_worker_name: 'riosystems-staging', expected_path: '/operator' });
const operatorPathVerified = await runCloudflareAccessReadonlyVerification(operatorPathPlan, runtime(fetchFor({ apps: [app, customerApp], policies: [restrictive] })));
assert.equal(operatorPathVerified.ok, true);
assert.equal(operatorPathVerified.matching_application_count, 1);

const customerPathPlan = buildCloudflareAccessReadonlyPlan({ account_id: ACCOUNT, expected_worker_name: 'riosystems-staging', expected_path: '/customer' });
const customerPathVerified = await runCloudflareAccessReadonlyVerification(customerPathPlan, runtime(fetchFor({ apps: [app, customerApp], policies: [restrictive] })));
assert.equal(customerPathVerified.ok, true);
assert.equal(customerPathVerified.matching_application_count, 1);

const invalidPathPlan = buildCloudflareAccessReadonlyPlan({ account_id: ACCOUNT, expected_path: 'customer' });
assert.equal(invalidPathPlan.ok, false);
assert.equal(invalidPathPlan.error, 'ACCESS_EXPECTED_PATH_INVALID');

const missing = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [] })));
assert.equal(missing.ok, false);
assert.equal(missing.stage, 'ACCESS_APPLICATION_NOT_FOUND');

const ambiguous = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [app, customerApp] })));
assert.equal(ambiguous.stage, 'ACCESS_APPLICATION_AMBIGUOUS');

const everyone = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [app], policies: [{ decision: 'allow', include: [{ everyone: {} }] }] })));
assert.equal(everyone.ok, false);
assert.equal(everyone.stage, 'ACCESS_BROAD_ALLOW_POLICY_REJECTED');

const loginOnly = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [app], policies: [{ decision: 'allow', include: [{ login_method: { id: 'otp' } }] }] })));
assert.equal(loginOnly.stage, 'ACCESS_BROAD_ALLOW_POLICY_REJECTED');

const bypass = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [app], policies: [restrictive, { decision: 'bypass', include: [{ email: { email: 'x@example.invalid' } }] }] })));
assert.equal(bypass.stage, 'ACCESS_BYPASS_POLICY_REJECTED');

const noAllow = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [app], policies: [{ decision: 'block', include: [{ everyone: {} }] }] })));
assert.equal(noAllow.stage, 'ACCESS_RESTRICTIVE_ALLOW_POLICY_MISSING');

const permission = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [], appStatus: 403 })));
assert.equal(permission.error, 'ACCESS_READ_PERMISSION_MISSING');

const wrongTarget = await runCloudflareAccessReadonlyVerification(plan, runtime(fetchFor({ apps: [{ ...app, domain: 'other-worker.example.workers.dev', destinations: [] }] })));
assert.equal(wrongTarget.stage, 'ACCESS_APPLICATION_NOT_FOUND');

const wrongCustom = await runCloudflareAccessReadonlyVerification(customPlan, runtime(fetchFor({ apps: [{ ...app, destinations: [{ type: 'public', uri: 'other.example.com' }] }] })));
assert.equal(wrongCustom.stage, 'ACCESS_APPLICATION_NOT_FOUND');

const manifest = cloudflareAccessReadonlyVerifierManifest();
assert.deepEqual(manifest.methods, ['GET']);
assert.equal(manifest.multi_domain_destinations_supported, true);
assert.equal(manifest.path_aware_targeting_supported, true);
assert.equal(manifest.restrictive_allow_required, true);
assert.equal(manifest.bypass_policy_rejected, true);
assert.equal(manifest.external_write, false);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'cloudflare-access-readonly-verifier-v1',
  verified: verified.stage,
  custom_hostname_verified: customVerified.stage,
  operator_path_verified: operatorPathVerified.stage,
  customer_path_verified: customerPathVerified.stage,
  missing: missing.stage,
  ambiguous: ambiguous.stage,
  everyone: everyone.stage,
  bypass: bypass.stage,
  permission: permission.error,
  read_only: true,
  external_write: false,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
