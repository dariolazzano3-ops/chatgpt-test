import assert from 'node:assert/strict';
import { handleJarvisRequestV1, jarvisServiceManifestV1 } from '../src/jarvis/service-v1.js';

const manifest = jarvisServiceManifestV1();
assert.equal(manifest.codename, 'JARVIS');
assert.equal(manifest.shared_memory_with_hamyren, false);
assert.equal(manifest.automatic_data_flow_to_hamyren, false);

const state = {
  owner_ref: 'owner-1',
  personal_facts: [{ fact_key: 'preferred_language', value: 'de' }],
  goals: [{ title: 'Build a personal assistant', status: 'ACTIVE' }],
  projects: [{ name: 'AURENTARA SYSTEMS' }]
};

const read = handleJarvisRequestV1({ message: 'Was steht heute bei meinen Projekten an?' }, state, {});
assert.equal(read.ok, true);
assert.equal(read.context.isolation.hamyren_data_loaded, false);
assert.equal(read.action_gate.execution_authorized, true);

const reminder = handleJarvisRequestV1(
  { message: 'Erinnere mich morgen an den Termin' },
  state,
  { policy: { autonomy_level: 4, allow_personal_writes: true } }
);
assert.equal(reminder.status, 'AWAITING_APPROVAL');
assert.equal(reminder.action_gate.execution_authorized, false);

const approvedReminder = handleJarvisRequestV1(
  { message: 'Erinnere mich morgen an den Termin' },
  state,
  { policy: { autonomy_level: 4, allow_personal_writes: true }, explicit_approval: true }
);
assert.equal(approvedReminder.status, 'AUTHORIZED');
assert.equal(approvedReminder.action_gate.execution_authorized, true);

const payment = handleJarvisRequestV1(
  { message: 'Überweise 100 Euro' },
  state,
  { policy: { autonomy_level: 5, allow_external_writes: true }, explicit_approval: true }
);
assert.equal(payment.ok, false);
assert.equal(payment.action_gate.error, 'JARVIS_FINANCIAL_ACTIONS_DISABLED_V1');

console.log('JARVIS Personal Assistant V1 smoke: PASS');
