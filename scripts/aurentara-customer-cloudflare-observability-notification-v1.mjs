import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const policyName = 'AURENTARA Customer Runtime Observability Failure';

assert.match(accountId, /^[a-f0-9]{32}$/i, 'CLOUDFLARE_ACCOUNT_ID_INVALID');
assert.ok(token.length >= 20, 'CLOUDFLARE_API_TOKEN_MISSING');

async function cf(path, init = {}) {
  const url = new URL(path, 'https://api.cloudflare.com');
  assert.equal(url.origin, 'https://api.cloudflare.com');
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { ok: response.ok && body?.success !== false, status: response.status, body };
}

const policiesBefore = await cf(`/client/v4/accounts/${accountId}/alerting/v3/policies`);
assert.equal(policiesBefore.ok, true, `CLOUDFLARE_POLICIES_READ_FAILED:${policiesBefore.status}`);
const before = Array.isArray(policiesBefore.body?.result) ? policiesBefore.body.result : [];
let target = before.find((item) => item?.name === policyName && item?.alert_type === 'workers_observability_alert') || null;
let created = false;
let permissionGate = false;

if (!target) {
  const emailId = before
    .flatMap((item) => Array.isArray(item?.mechanisms?.email) ? item.mechanisms.email : [])
    .map((item) => String(item?.id || '').trim())
    .find((value) => value.includes('@'));
  assert.ok(emailId, 'CLOUDFLARE_READY_EMAIL_MECHANISM_NOT_DISCOVERED');

  const create = await cf(`/client/v4/accounts/${accountId}/alerting/v3/policies`, {
    method: 'POST',
    body: JSON.stringify({
      name: policyName,
      description: 'AURENTARA Customer-only Worker observability failure notification. No customer content.',
      enabled: true,
      alert_type: 'workers_observability_alert',
      mechanisms: { email: [{ id: emailId }] },
      filters: { status: ['FIRING_FAILED'] }
    })
  });
  if (!create.ok && create.status === 403) {
    permissionGate = true;
  } else {
    assert.equal(create.ok, true, `CLOUDFLARE_OBSERVABILITY_NOTIFICATION_CREATE_FAILED:${create.status}`);
    created = true;
  }
}

if (!permissionGate) {
  const policiesAfter = await cf(`/client/v4/accounts/${accountId}/alerting/v3/policies`);
  assert.equal(policiesAfter.ok, true, `CLOUDFLARE_POLICIES_VERIFY_FAILED:${policiesAfter.status}`);
  const after = Array.isArray(policiesAfter.body?.result) ? policiesAfter.body.result : [];
  target = after.find((item) => item?.name === policyName && item?.alert_type === 'workers_observability_alert') || null;
  assert.ok(target, 'CLOUDFLARE_OBSERVABILITY_NOTIFICATION_POLICY_MISSING');
  assert.equal(target.enabled, true, 'CLOUDFLARE_OBSERVABILITY_NOTIFICATION_POLICY_DISABLED');
  assert.deepEqual(target.filters?.status, ['FIRING_FAILED'], 'CLOUDFLARE_OBSERVABILITY_NOTIFICATION_FILTER_INVALID');
  assert.equal(Array.isArray(target.mechanisms?.email) && target.mechanisms.email.length >= 1, true, 'CLOUDFLARE_OBSERVABILITY_EMAIL_MECHANISM_MISSING');
  assert.equal(Array.isArray(target.mechanisms?.webhooks) && target.mechanisms.webhooks.length > 0, false, 'CLOUDFLARE_OBSERVABILITY_UNEXPECTED_WEBHOOK');
  assert.equal(Array.isArray(target.mechanisms?.pagerduty) && target.mechanisms.pagerduty.length > 0, false, 'CLOUDFLARE_OBSERVABILITY_UNEXPECTED_PAGERDUTY');
}

const evidence = {
  schema: 'aurentara.customer.cloudflare-observability-notification-policy.v1',
  observed_at: new Date().toISOString(),
  status: permissionGate ? 'OPERATOR_GATE' : 'PASS',
  policy_name: policyName,
  alert_type: 'workers_observability_alert',
  enabled: permissionGate ? false : true,
  firing_failed_filter: permissionGate ? false : true,
  email_mechanism_ready: true,
  policy_created_this_run: created,
  cloudflare_notifications_write_required: permissionGate,
  permission_http_status: permissionGate ? 403 : 200,
  email_address_returned: false,
  webhook_url_returned: false,
  account_id_returned: false,
  token_returned: false,
  customer_surface_activated: false,
  real_customer_data: false,
  paid_provider_calls: false,
  variable_cost_eur: 0
};
await writeFile('/tmp/aurentara-observability-notification.json', JSON.stringify(evidence, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(evidence, null, 2));
