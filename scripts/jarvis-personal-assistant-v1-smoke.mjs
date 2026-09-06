import assert from 'node:assert/strict';
import { handleJarvisRequestV1, jarvisServiceManifestV1 } from '../src/jarvis/service-v1.js';
import { normalizeJarvisMemoryEntryV1, retrieveJarvisMemoryV1 } from '../src/jarvis/memory-v1.js';
import { createJarvisToolRegistryV1 } from '../src/jarvis/tools-v1.js';
import { redactJarvisSensitiveDataV1 } from '../src/jarvis/audit-v1.js';

const manifest = jarvisServiceManifestV1();
assert.equal(manifest.codename, 'JARVIS');
assert.equal(manifest.shared_memory_with_hamyren, false);
assert.equal(manifest.automatic_data_flow_to_hamyren, false);
assert.equal(manifest.memory.automatic_hamyren_sync, false);
assert.equal(manifest.tools.hamyren_connector_registered, false);

const owner = 'owner-1';
const memoryEntry = normalizeJarvisMemoryEntryV1({
  owner_ref: owner,
  category: 'DECISIONS',
  subject: 'JARVIS architecture',
  value: 'Use one JARVIS core with isolated personal memory',
  status: 'CONFIRMED',
  source: { type: 'operator_statement' },
  confidence: 1,
  sensitivity: 'INTERNAL',
  created_at: '2026-09-07T00:25:00+02:00'
});
assert.equal(memoryEntry.ok, true);

const secretMemory = normalizeJarvisMemoryEntryV1({
  owner_ref: owner,
  category: 'PERSONAL_FACTS',
  subject: 'credential',
  value: { api_key: 'sk-this-must-never-be-memory' },
  status: 'CONFIRMED'
});
assert.equal(secretMemory.ok, false);
assert.equal(secretMemory.error, 'JARVIS_MEMORY_CREDENTIAL_DATA_BLOCKED');

const hamyrenMemory = normalizeJarvisMemoryEntryV1({
  owner_ref: owner,
  category: 'PROJECTS',
  subject: 'forbidden import',
  value: 'x',
  status: 'CONFIRMED',
  source_system: 'hamyren'
});
assert.equal(hamyrenMemory.ok, false);
assert.equal(hamyrenMemory.error, 'JARVIS_HAMYREN_MEMORY_IMPORT_BLOCKED');

const retrieved = retrieveJarvisMemoryV1([memoryEntry.entry, { ...memoryEntry.entry, namespace: 'hamyren.personal', memory_id: 'hamyren:1' }], 'JARVIS architecture', { owner_ref: owner });
assert.equal(retrieved.count, 1);
assert.equal(retrieved.hamyren_memory_loaded, false);

const state = {
  owner_ref: owner,
  personal_facts: [{ fact_key: 'preferred_language', value: 'de' }],
  goals: [{ title: 'Build a personal assistant', status: 'ACTIVE' }],
  projects: [{ name: 'AURENTARA SYSTEMS' }],
  memory_entries: [memoryEntry.entry]
};

const read = handleJarvisRequestV1({ message: 'Was habe ich letztes Mal zu JARVIS entschieden?' }, state, {});
assert.equal(read.ok, true);
assert.equal(read.intent.intent_type, 'MEMORY_REQUEST');
assert.equal(read.context.isolation.hamyren_data_loaded, false);
assert.equal(read.memory_retrieval.count, 1);
assert.equal(read.action_gate.execution_authorized, true);
assert.equal(read.tool_route.execution_ready, true);

const reminder = handleJarvisRequestV1(
  { message: 'Erinnere mich morgen an den Termin' },
  state,
  { policy: { autonomy_level: 4, allow_personal_writes: true } }
);
assert.equal(reminder.status, 'AWAITING_APPROVAL');
assert.equal(reminder.action_gate.execution_authorized, false);
assert.equal(reminder.action_plan.execution_ready, false);

const approvedReminder = handleJarvisRequestV1(
  { message: 'Erinnere mich morgen an den Termin' },
  state,
  { policy: { autonomy_level: 4, allow_personal_writes: true }, explicit_approval: true }
);
assert.equal(approvedReminder.status, 'AUTHORIZED');
assert.equal(approvedReminder.action_gate.execution_authorized, true);
assert.equal(approvedReminder.tool_route.execution_ready, false);
assert.equal(approvedReminder.action_plan.execution_ready, false);
assert.equal(approvedReminder.action_result.external_effect, false);

const payment = handleJarvisRequestV1(
  { message: 'Überweise 100 Euro' },
  state,
  { policy: { autonomy_level: 5, allow_external_writes: true }, explicit_approval: true }
);
assert.equal(payment.ok, false);
assert.equal(payment.action_gate.error, 'JARVIS_FINANCIAL_ACTIONS_DISABLED_V1');

const writeback = handleJarvisRequestV1(
  { message: 'Merke dir meine bestätigte Entscheidung' },
  state,
  {
    policy: { autonomy_level: 2, allow_memory_writeback: true },
    memory_candidates: [{
      owner_ref: owner,
      category: 'DECISIONS',
      subject: 'Testing policy',
      value: 'No external writes during V1 foundation',
      status: 'CONFIRMED',
      source: { type: 'operator_statement' },
      created_at: '2026-09-07T00:25:00+02:00'
    }]
  }
);
assert.equal(writeback.memory_writeback.accepted.length, 1);
assert.equal(writeback.memory_writeback.hamyren_memory_write, false);

const registry = createJarvisToolRegistryV1();
assert.equal(registry.tools.some((tool) => /^hamyren/i.test(tool.tool_id)), false);

const redacted = redactJarvisSensitiveDataV1({ authorization: 'Bearer abcdefghijklmnop', note: 'sk-abcdefghijklmnop' });
assert.equal(redacted.authorization, '[REDACTED]');
assert.equal(redacted.note.includes('sk-'), false);

console.log('JARVIS Personal AI Operating System V1 smoke: PASS');
