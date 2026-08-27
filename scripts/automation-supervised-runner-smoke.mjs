import assert from 'node:assert/strict';
import { executeSupervisedAutomation, supervisedAutomationManifest } from '../src/automation-supervised-runner.js';

const manifest = supervisedAutomationManifest();
assert.equal(manifest.version, '4.4');
assert.equal(manifest.automatic_execution, false);
assert.equal(manifest.production_deploy, false);

const contract = {
  goal: 'Normalize a lead and notify an approved webhook',
  steps: [
    { id: 'seed', type: 'input', config: { value: { id: 7, state: 'new' } } },
    { id: 'mark', type: 'transform', config: { mode: 'set', field: 'state', value: 'ready' } },
    { id: 'notify', type: 'webhook', config: { url: 'https://hooks.example.test/lead', method: 'POST', body: { lead_id: 7 } } },
    { id: 'finish', type: 'output' },
  ],
};

const blocked = await executeSupervisedAutomation(contract, {}, {
  policy: { allowed_hosts: ['hooks.example.test'] },
  transport: async () => ({ status_code: 204 }),
});
assert.equal(blocked.ok, false);
assert.equal(blocked.status, 'BLOCKED_EXTERNAL_SIDE_EFFECT');
assert.ok(blocked.trace.find((item) => item.step_id === 'notify')?.errors?.includes('EXTERNAL_ACTION_APPROVAL_REQUIRED'));

const calls = [];
const completed = await executeSupervisedAutomation(contract, {}, {
  policy: { authorized: true, allowed_hosts: ['hooks.example.test'] },
  transport: async (request) => {
    calls.push(request);
    return { status_code: 202 };
  },
});
assert.equal(completed.ok, true);
assert.equal(completed.status, 'COMPLETED');
assert.equal(completed.outputs.result.state, 'ready');
assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'https://hooks.example.test/lead');
assert.equal(completed.trace.find((item) => item.step_id === 'notify')?.external_side_effect, true);

const forbidden = await executeSupervisedAutomation({
  goal: 'Attempt blocked email',
  steps: [{ id: 'mail', type: 'email', config: { url: 'https://hooks.example.test/mail' } }],
}, {}, {
  policy: { authorized: true, allowed_hosts: ['hooks.example.test'] },
  transport: async () => ({ status_code: 200 }),
});
assert.equal(forbidden.ok, false);
assert.ok(forbidden.trace[0].errors.includes('EXTERNAL_ACTION_TYPE_NOT_ENABLED'));

console.log('automation-supervised-runner-smoke: ok');
