import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { jarvisEngineeringMissionResumeManifestV1 } from '../src/jarvis/engineering-mission-resume-v1.js';

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';

function postMission(store, mission, claudeBridge) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/engineering-mission', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mission)
    }),
    {}, {}, { authorize, memory_store: store, claude_bridge: claudeBridge || null }
  );
}
function decide(store, approval_id, run_id, decision) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/approvals/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approval_id, run_id, decision })
    }),
    {}, {}, { authorize, memory_store: store }
  );
}
function resume(store, request_id, claudeBridge, body = {}) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/engineering-mission/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request_id, ...body })
    }),
    {}, {}, { authorize, memory_store: store, claude_bridge: claudeBridge || null }
  );
}
function truth(store) {
  return handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize, memory_store: store });
}

// ── 1. Resuming a request_id that was never proposed fails closed (no mission found) ──
{
  const store = createMemoryJarvisStoreV1();
  const corr = '11111111-1111-4111-8111-111111111111';
  const r = await resume(store, corr);
  assert.equal(r.status, 404);
  const b = await r.json();
  assert.equal(b.ok, false);
  assert.match(b.error, /MISSION_NOT_FOUND/);
  assert.equal(b.executed, false);
}

// ── 2. Proposed but not yet approved -> resume refuses; no dispatch even with a bound bridge ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0, stdout: 'ok' } }) });
  const corr = '22222222-2222-4222-8222-222222222222';
  await postMission(store, { title: 'Wave 0', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 });

  const tb1 = await (await truth(store)).json();
  const run1 = tb1.runs.data.items.find((x) => x.id === corr);
  assert.equal(run1.resumable, false, 'not approved yet -> not resumable in the projection either');

  const r = await resume(store, corr, bridge);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.ok, false);
  assert.match(b.error, /NOT_APPROVED/);
  assert.equal(b.executed, false, 'a bound bridge alone never authorizes a resume dispatch');
}

// ── 3. Approved + resumed genuinely dispatches; request_id continuity holds; client-supplied mission fields are ignored ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0, stdout: 'wave 0 done' } }) });
  const corr = '33333333-3333-4333-8333-333333333333';

  await postMission(store, { title: 'Wave 0 bootstrap', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 });
  const dec = await (await decide(store, `${corr}:approval`, corr, 'approve')).json();
  assert.equal(dec.execution_authorized, false, 'approving is still never itself execution');

  const tb1 = await (await truth(store)).json();
  const run1 = tb1.runs.data.items.find((x) => x.id === corr);
  assert.equal(run1.resumable, true, 'approved + not yet executed -> resumable in the projection');

  // Body carries a different title/goal — must be ignored; the persisted
  // original mission payload is what actually gets dispatched.
  const r = await resume(store, corr, bridge, { title: 'HIJACKED', goal: 'attacker-controlled goal' });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.ok, true);
  assert.equal(b.resumed, true);
  assert.equal(b.request_id, corr);
  assert.equal(b.correlation_id, corr);
  assert.equal(b.claude_bridge_bound, true);
  assert.equal(b.claude_execution.state, 'COMPLETE');
  assert.equal(b.wave_state, 'COMPLETE');
  assert.equal(b.claude_execution.independent_acceptance, false, 'the bridge exit code alone is never independent acceptance');
  assert.equal(b.action_gate_bypassed, false);
  assert.equal(b.independent_acceptance, false);
  assert.equal(b.production_deploy, false);
  assert.equal(b.hamyren_data_flow, false);

  const tb2 = await (await truth(store)).json();
  const run2 = tb2.runs.data.items.find((x) => x.id === corr);
  assert.equal(run2.resumable, false, 'already executed -> no longer resumable');
  assert.ok(tb2.activity.data.items.some((a) => a.run_id === corr && /RESUME/.test(a.summary || '')), 'the resume dispatch shows up in Activity');
}

// ── 4. Duplicate-execution guard: resuming again after dispatch never re-executes, even on repeated calls (e.g. a page refresh re-POSTing) ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0 } }) });
  const corr = '44444444-4444-4444-8444-444444444444';
  await postMission(store, { title: 'Wave 0', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 });
  await decide(store, `${corr}:approval`, corr, 'approve');
  await resume(store, corr, bridge);

  const again = await (await resume(store, corr, bridge)).json();
  assert.equal(again.ok, true);
  assert.equal(again.resumed, false, 'second resume call does not dispatch again');
  assert.equal(again.executed, false);
  assert.equal(again.duplicate_execution_guard, 'BLOCKED_DUPLICATE');
  assert.equal(again.last_execution_state, 'COMPLETE');
}

// ── 5. No bound bridge -> approved resume fails closed to BLOCKED, never fabricated as dispatched ──
{
  const store = createMemoryJarvisStoreV1();
  const corr = '55555555-5555-4555-8555-555555555555';
  await postMission(store, { title: 'Wave 1', goal: 'Wave 1 goal text', program: PROGRAM, correlation_id: corr, wave_index: 1 });
  await decide(store, `${corr}:approval`, corr, 'approve');
  const r = await resume(store, corr); // no bridge injected
  const b = await r.json();
  assert.equal(b.ok, true);
  assert.equal(b.claude_bridge_bound, false);
  assert.equal(b.claude_execution, null, 'no dispatch is ever fabricated when no genuine bridge is bound');
  assert.equal(b.wave_state, 'BLOCKED');
  assert.equal(b.executed, false);
}

// ── 6. Resuming with a malformed / unknown request_id fails closed ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await resume(store, 'not-a-uuid');
  assert.equal(r.status, 400);
  const b = await r.json();
  assert.equal(b.ok, false);
  assert.match(b.error, /REQUEST_ID_REQUIRED/);
}

// ── 7. Manifest / safety invariants ──
{
  const man = jarvisEngineeringMissionResumeManifestV1();
  assert.equal(man.accepts_client_mission_fields, false);
  assert.equal(man.mission_payload_source, 'DURABLE_AUDIT_ORIGINAL_REQUEST_ONLY');
  assert.equal(man.requires_prior_distinct_operator_approval, true);
  assert.equal(man.approval_bypassed, false);
  assert.equal(man.action_gate_reevaluated_every_call, true);
  assert.equal(man.fails_closed, true);
  assert.equal(man.worker_self_acceptance_counts_as_independent, false);
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);

  const FORBIDDEN = [/wrangler\s+deploy/i, /\bgit\s+push\b/i, /\bgit\s+merge\b/i];
  const text = fs.readFileSync('src/jarvis/engineering-mission-resume-v1.js', 'utf8');
  for (const pattern of FORBIDDEN) assert.doesNotMatch(text, pattern, `engineering-mission-resume-v1.js must not contain forbidden pattern ${pattern}`);
}

console.log('JARVIS Engineering Mission RESUME V1 (canonical approval-resume path) smoke: PASS');
