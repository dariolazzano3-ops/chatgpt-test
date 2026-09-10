import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';
import { jarvisCommandCenterWorkerChainV1, resolveJarvisCommandWorkerV1 } from '../src/jarvis/command-center-worker-binding-v1.js';

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const CORR = '11111111-2222-4333-8444-555555555555';

function post(store, message, correlation_id) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, correlation_id })
    }),
    {},
    {},
    { authorize, memory_store: store }
  );
}
function truth(store) {
  return handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize, memory_store: store });
}

// ── 1. Read command: enters runtime, correlation id survives, becomes a real run ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await post(store, 'Was weißt du über meine Projekte?', CORR);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.request_id, CORR, 'client correlation id is used as the run id');
  assert.equal(b.correlation_id, CORR);
  assert.equal(b.approval_required, false);
  assert.equal(b.blocked, false);
  assert.equal(b.external_effect, false);
  assert.equal(b.audit_persisted, true);

  const t = await truth(store);
  const tb = await t.json();
  assert.equal(tb.runs.source.classification, 'DERIVED');
  const run = tb.runs.data.items.find((x) => x.id === CORR);
  assert.ok(run, 'the command shows up as a real projected run with the same id');
  assert.equal(run.progress, null, 'no fabricated progress');
  assert.equal(tb.activity.source.classification, 'REAL');
  assert.ok(tb.activity.data.items.some((a) => a.run_id === CORR));
}

// ── 2. Write command: approval-gated, NOT executed, surfaces an approval ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await post(store, 'Sende eine E-Mail an das Team und veröffentliche die Landing-Copy', '22222222-3333-4444-8555-666666666666');
  const b = await r.json();
  assert.equal(r.status, 200, 'accepted for planning');
  assert.equal(b.approval_required, true, 'write action is approval-gated');
  assert.equal(b.external_effect, false, 'nothing executed externally');
  assert.equal(b.run_state, 'WAITING_APPROVAL');
  assert.match(String(b.action), /EMAIL|WRITE|CREATE|SEND/i);

  const tb = await (await truth(store)).json();
  const run = tb.runs.data.items.find((x) => x.id === '22222222-3333-4444-8555-666666666666');
  assert.equal(run.status, 'WAITING_APPROVAL');
  assert.equal(tb.approvals.data.pending_count, 1, 'a real approval is projected');
  assert.equal(tb.approvals.data.items[0].run_id, '22222222-3333-4444-8555-666666666666');
}

// ── 3. Financial / dangerous command: blocked, no bypass, no external effect ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await post(store, 'Überweise 250 EUR an Lieferant XY', '33333333-4444-4555-8666-777777777777');
  const b = await r.json();
  assert.equal(r.status, 409, 'runtime not ok');
  assert.equal(b.ok, false);
  assert.equal(b.blocked, true);
  assert.equal(b.external_effect, false);
  assert.match(String(b.gate_status || b.error || ''), /BLOCK/i);

  const tb = await (await truth(store)).json();
  const run = tb.runs.data.items.find((x) => x.id === '33333333-4444-4555-8666-777777777777');
  assert.ok(run, 'blocked attempt is still auditable as a run');
  assert.notEqual(run.status, 'COMPLETE');
}

// ── 4. Duplicate correlation id does not create two runs ──
{
  const store = createMemoryJarvisStoreV1();
  const dup = '44444444-5555-4666-8777-888888888888';
  await post(store, 'Systemstatus', dup);
  await post(store, 'Systemstatus', dup);
  const tb = await (await truth(store)).json();
  const matches = tb.runs.data.items.filter((x) => x.id === dup);
  assert.equal(matches.length, 1, 'same correlation id groups into a single run');
}

// ── 5. Invalid correlation id -> server generates a UUID, still works ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await post(store, 'Was steht heute an?', 'not-a-uuid');
  const b = await r.json();
  assert.match(b.request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(b.request_id, 'not-a-uuid');
}

// ── 6. No store -> honest 503, nothing executed ──
{
  const r = await handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Systemstatus' }) }),
    { JARVIS_ENVIRONMENT: 'staging' }, {}, { authorize }
  );
  assert.equal(r.status, 503);
  const b = await r.json();
  assert.equal(b.ok, false);
}

// ── 7. Frontend: real POST wiring is in the served bundle, fake brain is gone ──
{
  const html = renderJarvisCommandCenterV1({ base_path: '/jarvis' });
  for (const marker of ['/chat', 'correlation_id', 'An JARVIS-Runtime', 'Wartet auf Freigabe']) {
    assert.ok(html.includes(marker), `Wave 6 command marker missing: ${JSON.stringify(marker)}`);
  }
  for (const gone of ['Alle fünf Kernsysteme sind erreichbar', 'Das Ergebnis kommt mit Evidence', 'Ich habe Freigabe A-0']) {
    assert.ok(!html.includes(gone), `fabricated command-brain reply still present: ${JSON.stringify(gone)}`);
  }
}

// ── 8. Worker chain binding truth: Claude Code primary, no fake availability ──
{
  const chain = jarvisCommandCenterWorkerChainV1();
  assert.equal(chain.primary_worker, 'CLAUDE_CODE');
  assert.equal(chain.fallback_worker, 'CODEX');
  assert.equal(chain.fallback_active, false, 'Codex fallback is never on by default');
  assert.equal(chain.claude_execution_bridge_bound, false, 'no fake Claude execution bridge');
  assert.equal(chain.codex_binding_present, false);
  assert.equal(chain.implementation_commands_fail_closed, true);
  assert.equal(chain.worker_output_self_accepts, false);
  const claude = chain.nodes.find((n) => n.node === 'CLAUDE_CODE');
  assert.equal(claude.bound, false);
  assert.match(claude.reason, /NO_EXECUTION_BRIDGE/);
  const bridge = chain.nodes.find((n) => n.node === 'BRIDGE');
  assert.equal(bridge.bound, true, 'the policy gate genuinely runs on every command');

  // routing: implementation-needing command has no executable worker
  assert.deepEqual(resolveJarvisCommandWorkerV1({ action: 'READ_CALENDAR' }), { worker: 'JARVIS_CONNECTOR', executable: true, reason: null });
  assert.equal(resolveJarvisCommandWorkerV1({ action: 'SEND_EMAIL', approval_required: true }).executable, false);
  assert.equal(resolveJarvisCommandWorkerV1({ action: 'REFACTOR_CODE' }).worker, 'CLAUDE_CODE');
  assert.equal(resolveJarvisCommandWorkerV1({ action: 'REFACTOR_CODE' }).executable, false);
  assert.equal(resolveJarvisCommandWorkerV1({ blocked: true }).worker, null);

  // exposed on the runtime-truth response
  const store = createMemoryJarvisStoreV1();
  const tb = await (await truth(store)).json();
  assert.equal(tb.command_chain.claude_execution_bridge_bound, false);
  assert.equal(tb.command_chain.worker_output_self_accepts, false);
  assert.equal(tb.command_chain.fallback_active, false);
}

console.log('JARVIS Command Center Wave 6 (real command input) smoke: PASS');
