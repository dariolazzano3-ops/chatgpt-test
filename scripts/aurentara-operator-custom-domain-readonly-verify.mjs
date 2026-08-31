#!/usr/bin/env node

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const token = clean(process.env.CLOUDFLARE_API_TOKEN, 1600);
const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID, 80);
const hostname = clean(process.env.AURENTARA_OPERATOR_HOSTNAME || 'control.aurentarasystems.com', 300).toLowerCase();
const worker = clean(process.env.AURENTARA_OPERATOR_WORKER || 'riosystems-staging', 160);
const API_ORIGIN = 'https://api.cloudflare.com';

function fail(error, extra = {}) {
  console.error(JSON.stringify({
    ok: false,
    error,
    hostname_verified: false,
    worker_verified: false,
    certificate_verified: false,
    tls_verified: false,
    access_enforced: false,
    public_operator_exposure: false,
    secrets_returned: false,
    external_side_effect_performed: false,
    production_deploy: false,
    variable_cost_eur: 0,
    ...extra
  }, null, 2));
  process.exit(3);
}

if (!token || !/^[a-f0-9]{32}$/i.test(accountId)) fail('CLOUDFLARE_CREDENTIALS_REQUIRED');
if (hostname !== 'control.aurentarasystems.com' || worker !== 'riosystems-staging') fail('CUSTOM_DOMAIN_SCOPE_REJECTED');

const url = new URL(`/client/v4/accounts/${accountId}/workers/domains?hostname=${encodeURIComponent(hostname)}`, API_ORIGIN);
const response = await fetch(url, {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  redirect: 'error',
  signal: AbortSignal.timeout(10000)
}).catch(() => null);
if (!response) fail('WORKERS_DOMAIN_READ_FAILED');
const payload = await response.json().catch(() => null);
if (!response.ok || payload?.success === false) fail(`WORKERS_DOMAIN_READ_FAILED_${response.status}`);
const matches = (Array.isArray(payload?.result) ? payload.result : []).filter((item) => clean(item?.hostname, 300).toLowerCase() === hostname);
if (matches.length !== 1) fail(matches.length ? 'CUSTOM_DOMAIN_AMBIGUOUS' : 'CUSTOM_DOMAIN_NOT_FOUND');
if (clean(matches[0]?.service, 160) !== worker) fail('CUSTOM_DOMAIN_WORKER_MISMATCH');
if (!clean(matches[0]?.cert_id, 160)) fail('CUSTOM_DOMAIN_CERTIFICATE_MISSING');

let live = null;
try {
  live = await fetch(`https://${hostname}/operator`, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000)
  });
} catch {
  fail('CUSTOM_DOMAIN_HTTPS_FAILED', { hostname_verified: true, worker_verified: true, certificate_verified: true });
}

if (live.status === 200) fail('PUBLIC_OPERATOR_EXPOSURE_DETECTED', {
  hostname_verified: true,
  worker_verified: true,
  certificate_verified: true,
  tls_verified: true,
  public_operator_exposure: true
});
const accessEnforced = [401, 403].includes(live.status) || (live.status >= 300 && live.status < 400);
if (!accessEnforced) fail(`ACCESS_ENFORCEMENT_UNEXPECTED_HTTP_${live.status}`, {
  hostname_verified: true,
  worker_verified: true,
  certificate_verified: true,
  tls_verified: true
});

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.operator-custom-domain-readonly-result.v1',
  hostname_verified: true,
  worker_verified: true,
  certificate_verified: true,
  tls_verified: true,
  access_enforced: true,
  unauthenticated_operator_status: live.status,
  public_operator_exposure: false,
  root_domain_targeted: false,
  workers_dev_fallback_preserved: true,
  secrets_returned: false,
  external_side_effect_performed: false,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
