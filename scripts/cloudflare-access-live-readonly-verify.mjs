#!/usr/bin/env node
import { buildCloudflareAccessReadonlyPlan, runCloudflareAccessReadonlyVerification } from '../src/cloudflare-access-readonly-verifier-v1.js';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const expectedWorkerName = String(process.env.RIOSYSTEMS_ACCESS_EXPECTED_WORKER_NAME || 'riosystems-staging').trim();
const expectedHostname = String(process.env.RIOSYSTEMS_ACCESS_EXPECTED_HOSTNAME || '').trim();

if (!token) {
  console.error(JSON.stringify({ ok: false, error: 'CLOUDFLARE_API_TOKEN_MISSING', secrets_returned: false, external_side_effect_performed: false, production_deploy: false }));
  process.exit(2);
}

const plan = buildCloudflareAccessReadonlyPlan({
  account_id: accountId,
  expected_worker_name: expectedWorkerName,
  expected_hostname: expectedHostname,
  token_ref: 'secret:CLOUDFLARE_API_TOKEN'
});
if (!plan.ok) {
  console.error(JSON.stringify({ ...plan, secrets_returned: false, external_side_effect_performed: false, production_deploy: false }));
  process.exit(2);
}

const result = await runCloudflareAccessReadonlyVerification(plan, {
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:CLOUDFLARE_API_TOKEN' ? token : '',
  timeout_ms: 10000,
  production_deploy: false
});

const sanitized = {
  ok: result.ok === true,
  schema: result.schema || 'riosystems.cloudflare-access-readonly-result.v1',
  stage: result.stage || null,
  error: result.error || null,
  access_application_verified: result.access_application_verified === true,
  restrictive_policy_verified: result.restrictive_policy_verified === true,
  matching_application_count: result.matching_application_count ?? null,
  policy_count: result.policy_count ?? null,
  restrictive_allow_policy_count: result.restrictive_allow_policy_count ?? null,
  broad_allow_policy_count: result.broad_allow_policy_count ?? null,
  bypass_policy_count: result.bypass_policy_count ?? null,
  resource_names_returned: false,
  secrets_returned: false,
  external_side_effect_performed: false,
  production_deploy: false,
  variable_cost_eur: 0
};

console.log(JSON.stringify(sanitized, null, 2));
if (!result.ok) process.exit(3);
