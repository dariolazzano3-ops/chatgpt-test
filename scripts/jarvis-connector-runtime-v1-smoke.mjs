import assert from 'node:assert/strict';
import { handleJarvisRequestV1 } from '../src/jarvis/service-v1.js';
import { createJarvisConnectorRegistryV1, routeJarvisConnectorV1 } from '../src/jarvis/connectors-v1.js';
import { executeJarvisConnectorV1 } from '../src/jarvis/connector-runtime-v1.js';

const owner = 'owner-connector-test';

const calendarRegistry = createJarvisConnectorRegistryV1([
  {
    connector_id: 'jarvis.calendar.synthetic.v1',
    family: 'CALENDAR',
    provider: 'synthetic',
    capabilities: ['calendar.read', 'calendar.write'],
    required_permissions: ['CALENDAR_READ'],
    risk_level: 'MEDIUM',
    write_scope: 'PERSONAL_EXTERNAL',
    authentication_state: 'AUTHENTICATED',
    availability: 'AVAILABLE',
    cost_profile: 'ZERO',
    handler: async ({ capability }) => capability === 'calendar.read'
      ? { events: [{ id: 'evt-1', title: 'Synthetic appointment' }] }
      : { event_id: 'evt-created' }
  }
]);

const readRequest = handleJarvisRequestV1(
  { message: 'Prüfe meinen Kalender für heute' },
  { owner_ref: owner, memory_entries: [] },
  {}
);
assert.equal(readRequest.intent.action, 'READ_CALENDAR');
assert.equal(readRequest.action_gate.execution_authorized, true);

const calendarRead = await executeJarvisConnectorV1({
  action_plan: readRequest.action_plan,
  connector_registry: calendarRegistry,
  capability: 'calendar.read',
  granted_permissions: ['CALENDAR_READ'],
  owner_ref: owner,
  payload: { range: 'today' }
});
assert.equal(calendarRead.ok, true);
assert.equal(calendarRead.executed, true);
assert.equal(calendarRead.external_effect, false);
assert.equal(calendarRead.result.events.length, 1);

const missingPermission = await executeJarvisConnectorV1({
  action_plan: readRequest.action_plan,
  connector_registry: calendarRegistry,
  capability: 'calendar.read',
  granted_permissions: [],
  owner_ref: owner,
  payload: { range: 'today' }
});
assert.equal(missingPermission.ok, false);
assert.equal(missingPermission.error, 'JARVIS_CONNECTOR_PERMISSION_REQUIRED');

const secretPayload = await executeJarvisConnectorV1({
  action_plan: readRequest.action_plan,
  connector_registry: calendarRegistry,
  capability: 'calendar.read',
  granted_permissions: ['CALENDAR_READ'],
  owner_ref: owner,
  payload: { access_token: 'secret-value' }
});
assert.equal(secretPayload.ok, false);
assert.equal(secretPayload.error, 'JARVIS_CONNECTOR_SECRET_IN_PAYLOAD_BLOCKED');

const reminderRequest = handleJarvisRequestV1(
  { message: 'Erinnere mich morgen an den Termin' },
  { owner_ref: owner, memory_entries: [] },
  { policy: { autonomy_level: 4, allow_personal_writes: true } }
);
const reminderRegistry = createJarvisConnectorRegistryV1([
  {
    connector_id: 'jarvis.reminder.synthetic.v1',
    family: 'REMINDERS',
    provider: 'synthetic',
    capabilities: ['reminders.write'],
    required_permissions: ['REMINDERS_WRITE'],
    risk_level: 'LOW',
    write_scope: 'PERSONAL_EXTERNAL',
    authentication_state: 'AUTHENTICATED',
    availability: 'AVAILABLE',
    handler: async () => ({ reminder_id: 'rem-1' })
  }
]);
const blockedWrite = await executeJarvisConnectorV1({
  action_plan: reminderRequest.action_plan,
  connector_registry: reminderRegistry,
  capability: 'reminders.write',
  granted_permissions: ['REMINDERS_WRITE'],
  owner_ref: owner,
  payload: { title: 'Termin', when: 'tomorrow' }
});
assert.equal(blockedWrite.ok, false);
assert.equal(blockedWrite.error, 'JARVIS_CONNECTOR_WRITE_NOT_AUTHORIZED');

const approvedReminderRequest = handleJarvisRequestV1(
  { message: 'Erinnere mich morgen an den Termin' },
  { owner_ref: owner, memory_entries: [] },
  { policy: { autonomy_level: 4, allow_personal_writes: true }, explicit_approval: true }
);
const approvedWrite = await executeJarvisConnectorV1({
  action_plan: approvedReminderRequest.action_plan,
  connector_registry: reminderRegistry,
  capability: 'reminders.write',
  granted_permissions: ['REMINDERS_WRITE'],
  owner_ref: owner,
  payload: { title: 'Termin', when: 'tomorrow' }
});
assert.equal(approvedWrite.ok, true);
assert.equal(approvedWrite.executed, true);
assert.equal(approvedWrite.external_effect, true);

const hamyrenRegistry = createJarvisConnectorRegistryV1([
  {
    connector_id: 'hamyren.calendar.v1',
    family: 'CALENDAR',
    provider: 'hamyren',
    capabilities: ['calendar.read'],
    authentication_state: 'AUTHENTICATED',
    availability: 'AVAILABLE',
    handler: async () => ({})
  }
]);
assert.equal(hamyrenRegistry.connectors.length, 0);

const unboundDefault = routeJarvisConnectorV1(undefined, 'calendar.read');
assert.equal(unboundDefault.ok, true);
assert.equal(unboundDefault.execution_ready, false);

console.log('JARVIS Connector Runtime V1 smoke: PASS');
