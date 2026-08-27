import assert from 'node:assert/strict';
import { externalActionManifest, validateExternalAction, executeExternalAction } from '../src/automation-external-actions.js';

const manifest = externalActionManifest();
assert.equal(manifest.mode, 'supervised');
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.automatic_execution, false);
assert.ok(manifest.enabled_types.includes('webhook'));
assert.ok(manifest.blocked_types.includes('crm_write'));

const denied = validateExternalAction(
  { type: 'webhook', url: 'https://hooks.example.test/lead', method: 'POST', body: { id: 1 } },
  { allowed_hosts: ['hooks.example.test'], authorized: false }
);
assert.equal(denied.ok, false);
assert.ok(denied.errors.includes('EXTERNAL_ACTION_APPROVAL_REQUIRED'));

const privateHost = validateExternalAction(
  { type: 'http_request', url: 'https://127.0.0.1/internal' },
  { allowed_hosts: ['127.0.0.1'], authorized: true }
);
assert.equal(privateHost.ok, false);
assert.ok(privateHost.errors.includes('EXTERNAL_ACTION_PRIVATE_HOST_BLOCKED'));

const secretHeader = validateExternalAction(
  { type: 'webhook', url: 'https://hooks.example.test/lead', headers: { Authorization: 'Bearer secret' } },
  { allowed_hosts: ['hooks.example.test'], authorized: true }
);
assert.equal(secretHeader.ok, false);
assert.ok(secretHeader.errors.includes('EXTERNAL_ACTION_INLINE_SECRET_HEADER_BLOCKED'));

const blockedType = validateExternalAction(
  { type: 'crm_write', url: 'https://crm.example.test/contact' },
  { allowed_hosts: ['crm.example.test'], authorized: true }
);
assert.equal(blockedType.ok, false);
assert.ok(blockedType.errors.includes('EXTERNAL_ACTION_TYPE_NOT_ENABLED'));

let calls = 0;
const executed = await executeExternalAction(
  { type: 'webhook', url: 'https://hooks.example.test/lead', method: 'POST', body: { id: 7 } },
  { allowed_hosts: ['hooks.example.test'], authorized: true, timeout_ms: 1200 },
  async (request) => {
    calls += 1;
    assert.equal(request.url, 'https://hooks.example.test/lead');
    assert.equal(request.timeout_ms, 1200);
    return { status_code: 202 };
  }
);
assert.equal(calls, 1);
assert.equal(executed.ok, true);
assert.equal(executed.status, 'COMPLETED');
assert.equal(executed.external_side_effect, true);
assert.equal(executed.supervised, true);
assert.equal(executed.production_deploy, false);

const noTransport = await executeExternalAction(
  { type: 'webhook', url: 'https://hooks.example.test/lead' },
  { allowed_hosts: ['hooks.example.test'], authorized: true }
);
assert.equal(noTransport.ok, false);
assert.ok(noTransport.errors.includes('EXTERNAL_ACTION_TRANSPORT_REQUIRED'));

console.log('automation-external-actions-smoke: ok');
