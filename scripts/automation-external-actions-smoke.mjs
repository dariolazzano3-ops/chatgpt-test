import assert from 'node:assert/strict';
import { validateExternalAction, executeExternalAction, externalActionManifest } from '../src/automation-external-actions.js';

const manifest = externalActionManifest();
assert.equal(manifest.version, '4.3');
assert.equal(manifest.automatic_execution, false);
assert.equal(manifest.production_deploy, false);
assert.ok(manifest.enabled_types.includes('http_request'));
assert.ok(manifest.enabled_types.includes('webhook'));
assert.ok(manifest.blocked_types.includes('email'));

const allowed = validateExternalAction({ type:'webhook', url:'https://hooks.example.test/lead', method:'POST', body:{ lead_id: 7 } }, { authorized:true, allowed_hosts:['hooks.example.test'] });
assert.equal(allowed.ok, true);
assert.equal(allowed.production_deploy, false);

const noApproval = validateExternalAction({ type:'http_request', url:'https://api.example.test/data' }, { allowed_hosts:['api.example.test'] });
assert.equal(noApproval.ok, false);
assert.ok(noApproval.errors.includes('EXTERNAL_ACTION_APPROVAL_REQUIRED'));

const privateTarget = validateExternalAction({ type:'http_request', url:'https://127.0.0.1/data' }, { authorized:true, allowed_hosts:['127.0.0.1'] });
assert.equal(privateTarget.ok, false);
assert.ok(privateTarget.errors.includes('EXTERNAL_ACTION_PRIVATE_HOST_BLOCKED'));

const secretHeader = validateExternalAction({ type:'http_request', url:'https://api.example.test/data', headers:{ Authorization:'Bearer secret' } }, { authorized:true, allowed_hosts:['api.example.test'] });
assert.equal(secretHeader.ok, false);
assert.ok(secretHeader.errors.includes('EXTERNAL_ACTION_INLINE_SECRET_HEADER_BLOCKED'));

const email = validateExternalAction({ type:'email', url:'https://api.example.test/send' }, { authorized:true, allowed_hosts:['api.example.test'] });
assert.equal(email.ok, false);
assert.ok(email.errors.includes('EXTERNAL_ACTION_TYPE_NOT_ENABLED'));

let calls = 0;
const executed = await executeExternalAction({ type:'webhook', url:'https://hooks.example.test/lead', method:'POST', body:{ lead_id:7 } }, { authorized:true, allowed_hosts:['hooks.example.test'], timeout_ms:1000 }, async (request) => {
  calls += 1;
  assert.equal(request.method, 'POST');
  return { status_code: 202 };
});
assert.equal(calls, 1);
assert.equal(executed.ok, true);
assert.equal(executed.status, 'COMPLETED');
assert.equal(executed.external_side_effect, true);
assert.equal(executed.automatic_execution, false);
assert.equal(executed.production_deploy, false);

console.log('automation-external-actions-smoke: ok');
