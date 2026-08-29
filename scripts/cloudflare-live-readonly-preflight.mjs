import { buildCloudflareReadonlyPreflightPlan, runCloudflareReadonlyPreflight } from '../src/cloudflare-readonly-runner.js';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
if (!accountId || !token) {
  console.error('CLOUDFLARE_PREFLIGHT_SECRETS_MISSING');
  process.exit(2);
}

const plan = buildCloudflareReadonlyPreflightPlan({
  account_id: accountId,
  token_ref: 'secret:CLOUDFLARE_API_TOKEN'
});
if (!plan.ok) {
  console.log(JSON.stringify({ ok: false, error: plan.error, external_side_effect_performed: false, production_deploy: false }, null, 2));
  process.exit(3);
}

const result = await runCloudflareReadonlyPreflight(plan, {
  fetch_impl: globalThis.fetch,
  resolve_secret: async (ref) => ref === 'secret:CLOUDFLARE_API_TOKEN' ? token : null,
  timeout_ms: 8000,
  production_deploy: false
});
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(4);
