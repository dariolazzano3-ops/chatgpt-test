import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import {
  createJarvisClaudeLocalRuntimeBindingV1,
  jarvisClaudeLocalRuntimeBindingManifestV1,
  JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG
} from '../src/jarvis/claude-code-local-runtime-binding-v1.js';

/* Deterministic wiring regression for the Claude Code routing added to
   handleJarvisRuntimeRequestV1 / POST /jarvis/api/chat. Uses a FIXTURE
   executor (no `claude` CLI invoked here — that happens exactly once,
   deliberately, elsewhere) so this is fast, free, and CI-safe, while still
   exercising the real HTTP handler and the real approval-runtime route. */

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const WRITE_MSG = 'Create a file with the result';

function post(store, message, correlation_id, claudeBridge) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, correlation_id })
    }),
    {}, {},
    { authorize, memory_store: store, claude_bridge: claudeBridge }
  );
}
function decide(store, approval_id, run_id, decision) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/approvals/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approval_id, run_id, decision })
    }),
    {}, {},
    { authorize, memory_store: store }
  );
}
function truth(store, claudeBridge) {
  return handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize, memory_store: store, claude_bridge: claudeBridge });
}

// ── the local runtime binding itself: default OFF, fails closed ──
{
  const off = createJarvisClaudeLocalRuntimeBindingV1({});
  assert.equal(off.bound, false);
  assert.equal(off.bridge, null);
  assert.equal(off.reason, 'JARVIS_CLAUDE_LOCAL_EXECUTION_DISABLED');

  const on = createJarvisClaudeLocalRuntimeBindingV1({ [JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG]: 'on' });
  assert.equal(on.bound, true, 'bound under genuine local Node with the flag on');
  assert.equal(typeof on.bridge?.submit, 'function');

  const manifest = jarvisClaudeLocalRuntimeBindingManifestV1();
  assert.equal(manifest.default, 'off');
  assert.equal(manifest.imported_by_deployed_worker, false);
  assert.equal(manifest.production_deploy, false);
}

// ── no bridge injected at all: identical to pre-existing behaviour (Wave 6) ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await post(store, WRITE_MSG, '11111111-2222-4333-8444-555555555555', null);
  const b = await r.json();
  assert.equal(b.approval_required, true);
  assert.equal(b.run_state, 'WAITING_APPROVAL');
  assert.equal(b.claude_execution, null);
  assert.equal(b.external_effect, false);
}

// ── bridge injected but no prior approval yet: still blocked, nothing executes ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ [WRITE_MSG]: { exit_code: 0, stdout: 'ok' } }) });
  const CORR = '22222222-3333-4444-8555-666666666666';
  const r = await post(store, WRITE_MSG, CORR, bridge);
  const b = await r.json();
  assert.equal(b.run_state, 'WAITING_APPROVAL', 'first ask is never auto-executed even with a bound bridge');
  assert.equal(b.claude_execution, null);

  const tb = await (await truth(store, bridge)).json();
  assert.equal(tb.command_chain.claude_execution_bridge_bound, true, 'runtime-truth reflects the genuinely bound bridge');
}

// ── full chain: block -> distinct operator approval -> re-ask -> genuine (fixture) execution ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ [WRITE_MSG]: { exit_code: 0, stdout: 'fixture-ok', external_effect: false } }) });
  const CORR = '33333333-4444-4555-8666-777777777777';

  const first = await (await post(store, WRITE_MSG, CORR, bridge)).json();
  assert.equal(first.run_state, 'WAITING_APPROVAL');
  assert.equal(first.claude_execution, null);

  const decision = await decide(store, `${CORR}:approval`, CORR, 'approve');
  assert.equal(decision.status, 200);
  const decisionBody = await decision.json();
  assert.equal(decisionBody.executed, false, 'approving never itself executes');
  assert.equal(decisionBody.action_gate_bypassed, false);

  const second = await (await post(store, WRITE_MSG, CORR, bridge)).json();
  assert.equal(second.blocked, false);
  assert.equal(second.run_state, 'COMPLETE', 'genuinely re-authorized and executed only after a distinct persisted approval');
  assert.equal(second.claude_execution.state, 'COMPLETE');
  assert.equal(second.independent_acceptance, false, 'worker success is never independent acceptance');
  assert.equal(second.external_effect, false);
  assert.match(second.claude_execution.evidence.stdout_sha256, /^[0-9a-f]{64}$/);

  const tb = await (await truth(store, bridge)).json();
  const run = tb.runs.data.items.find((x) => x.id === CORR);
  assert.ok(run, 'the executed run is projected from the real persisted audit trail');
  assert.equal(run.status, 'COMPLETE');
  assert.equal(run.worker, 'Claude Code');
  assert.equal(run.approval_state, 'GRANTED');
  const evidenceItem = tb.evidence.data.items.find((e) => e.run_ref === CORR);
  assert.ok(evidenceItem, 'a real evidence row exists for the run');
  assert.equal(evidenceItem.independent_acceptance, false);
}

// ── replay protection: the bridge's own idempotency prevents a second execution
//    for the same correlation_id even if /chat is called again ──
{
  const store = createMemoryJarvisStoreV1();
  let calls = 0;
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: async () => { calls += 1; return { exit_code: 0, stdout: `run ${calls}` }; } });
  const CORR = '44444444-5555-4666-8777-888888888888';
  await post(store, WRITE_MSG, CORR, bridge);
  await decide(store, `${CORR}:approval`, CORR, 'approve');
  await post(store, WRITE_MSG, CORR, bridge);
  await post(store, WRITE_MSG, CORR, bridge);
  assert.equal(calls, 1, 'the executor never ran more than once for one correlation id');
}

console.log('JARVIS Claude Code local runtime binding V1 smoke: PASS');
