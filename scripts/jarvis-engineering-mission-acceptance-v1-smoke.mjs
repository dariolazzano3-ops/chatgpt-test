import assert from 'node:assert/strict';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { jarvisEngineeringMissionAcceptanceManifestV1 } from '../src/jarvis/engineering-mission-acceptance-v1.js';

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:op@example.invalid', email: 'op@example.invalid' });
const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';

const REPO_BOUND_VERIFICATION_OK = {
  schema: 'aurentara.jarvis.repo-bound-verification.v1',
  repo_dir: '/home/dario/chatgpt-test',
  branch: 'factory/jarvis-command-center-real-truth-v1',
  branch_drift: false,
  files_changed: ['src/jarvis/v2-progress-v1.js'],
  pre_existing_dirty_files: [],
  syntax_check: { passed: true, checked: 1, results: [{ file: 'src/jarvis/v2-progress-v1.js', passed: true }] },
  at: '2026-01-01T00:00:00.000Z'
};

function postMission(store, mission, claudeBridge) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/engineering-mission', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mission)
    }),
    {}, {}, { authorize, memory_store: store, claude_bridge: claudeBridge || null }
  );
}
function decide(store, approval_id, run_id, decision) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/approvals/decide', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approval_id, run_id, decision })
    }),
    {}, {}, { authorize, memory_store: store }
  );
}
function accept(store, request_id) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/engineering-mission/accept', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id })
    }),
    {}, {}, { authorize, memory_store: store }
  );
}
function truth(store) {
  return handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize, memory_store: store });
}
async function dispatchApproved(store, corr, waveIndex, bridge) {
  await postMission(store, { title: `Wave ${waveIndex}`, goal: `Wave ${waveIndex} goal text`, program: PROGRAM, correlation_id: corr, wave_index: waveIndex });
  await decide(store, `${corr}:approval`, corr, 'approve');
  return postMission(store, { title: `Wave ${waveIndex}`, goal: `Wave ${waveIndex} goal text`, program: PROGRAM, correlation_id: corr, wave_index: waveIndex }, bridge);
}

// ── 1. Accepting a request_id that was never dispatched fails closed ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await accept(store, '11111111-1111-4111-8111-111111111111');
  assert.equal(r.status, 404);
  const b = await r.json();
  assert.match(b.error, /MISSION_NOT_FOUND/);
}

// ── 2. Dispatched but no verification evidence at all (disposable-tmp run) -> refused, V2 progress stays 0 ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0 } }) });
  const corr = '22222222-2222-4222-8222-222222222222';
  const dispatched = await (await dispatchApproved(store, corr, 0, bridge)).json();
  assert.equal(dispatched.claude_execution.state, 'COMPLETE');

  const r = await accept(store, corr);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.match(b.error, /VERIFICATION_INSUFFICIENT/);
  assert.equal(b.reason, 'NO_VERIFICATION_EVIDENCE_NOT_REPO_BOUND');

  const tb = await (await truth(store)).json();
  assert.equal(tb.v2_progress.data.verified_progress_percent, 0, 'no independent acceptance -> still 0%, even though the bridge genuinely completed');
}

// ── 3. No real files changed -> refused, even with otherwise-clean verification ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': { exit_code: 0, verification: { ...REPO_BOUND_VERIFICATION_OK, files_changed: [] } }
  }) });
  const corr = '33333333-3333-4333-8333-333333333333';
  await dispatchApproved(store, corr, 0, bridge);
  const r = await accept(store, corr);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.reason, 'NO_REAL_FILES_CHANGED');
}

// ── 4. Syntax check failed -> refused (broken code can never be independently accepted) ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': { exit_code: 0, verification: { ...REPO_BOUND_VERIFICATION_OK, syntax_check: { passed: false, checked: 1, results: [{ file: 'x.js', passed: false, error: 'SyntaxError' }] } } }
  }) });
  const corr = '44444444-4444-4444-8444-444444444444';
  await dispatchApproved(store, corr, 0, bridge);
  const r = await accept(store, corr);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.reason, 'SYNTAX_CHECK_FAILED_OR_MISSING');
}

// ── 5. Branch drift detected mid-run -> refused ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': { exit_code: 0, verification: { ...REPO_BOUND_VERIFICATION_OK, branch_drift: true } }
  }) });
  const corr = '55555555-5555-4555-8555-555555555555';
  await dispatchApproved(store, corr, 0, bridge);
  const r = await accept(store, corr);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.reason, 'BRANCH_DRIFT_DETECTED');
}

// ── 6. Run on a protected branch never counts, even if everything else looks fine ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': { exit_code: 0, verification: { ...REPO_BOUND_VERIFICATION_OK, branch: 'main' } }
  }) });
  const corr = '66666666-6666-4666-8666-666666666666';
  await dispatchApproved(store, corr, 0, bridge);
  const r = await accept(store, corr);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.reason, 'PROTECTED_OR_MISSING_BRANCH');
}

// ── 7. Sufficient repo-bound verification -> genuine acceptance, and V2 progress finally advances ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': { exit_code: 0, verification: REPO_BOUND_VERIFICATION_OK }
  }) });
  const corr = '77777777-7777-4777-8777-777777777777';
  const dispatched = await (await dispatchApproved(store, corr, 0, bridge)).json();
  assert.equal(dispatched.claude_execution.state, 'COMPLETE');

  const tbBefore = await (await truth(store)).json();
  assert.equal(tbBefore.v2_progress.data.verified_progress_percent, 0, 'still 0% before an explicit, distinct acceptance call');

  const r = await accept(store, corr);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.ok, true);
  assert.equal(b.accepted, true);
  assert.match(b.acceptance_ref, new RegExp(`^accept:${corr}:`));
  assert.equal(b.wave_index, 0);
  assert.equal(b.program, PROGRAM);
  assert.equal(b.self_acceptance_by_worker, false);
  assert.deepEqual(b.verification_summary.files_changed, ['src/jarvis/v2-progress-v1.js']);

  const tbAfter = await (await truth(store)).json();
  assert.equal(tbAfter.v2_progress.data.verified_progress_percent, 5, 'Wave 0 weight (5) now genuinely counted');
  assert.deepEqual(tbAfter.v2_progress.data.completed_waves, [0]);
  assert.equal(tbAfter.v2_progress.data.current_wave, 1);
  assert.ok(tbAfter.activity.data.items.some((a) => a.run_id === corr && /ACCEPTANCE/.test(a.summary || '')), 'shows up in Activity as a distinct event');

  // ── 7b. Duplicate acceptance is refused idempotently, never double-counted ──
  const again = await (await accept(store, corr)).json();
  assert.equal(again.ok, true);
  assert.equal(again.accepted, false);
  assert.equal(again.duplicate_acceptance_guard, 'ALREADY_ACCEPTED');
  const tbTwice = await (await truth(store)).json();
  assert.equal(tbTwice.v2_progress.data.verified_progress_percent, 5, 'unchanged by the duplicate call');
}

// ── 8. Two independently-accepted waves accumulate (proves a genuine, incremental V2 start, not a one-off fluke) ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({
    'Wave 0': { exit_code: 0, verification: { ...REPO_BOUND_VERIFICATION_OK, files_changed: ['a.js'] } },
    'Wave 1': { exit_code: 0, verification: { ...REPO_BOUND_VERIFICATION_OK, files_changed: ['b.js'] } }
  }) });
  const corr0 = '88888888-8888-4888-8888-888888888880';
  const corr1 = '88888888-8888-4888-8888-888888888881';
  await dispatchApproved(store, corr0, 0, bridge);
  await dispatchApproved(store, corr1, 1, bridge);
  await accept(store, corr0);
  await accept(store, corr1);

  const tb = await (await truth(store)).json();
  assert.equal(tb.v2_progress.data.verified_progress_percent, 15, 'Wave 0 (5) + Wave 1 (10)');
  assert.deepEqual(tb.v2_progress.data.completed_waves, [0, 1]);
  assert.equal(tb.v2_progress.data.current_wave, 2);
}

// ── 9. Manifest / safety invariants ──
{
  const man = jarvisEngineeringMissionAcceptanceManifestV1();
  assert.equal(man.requires_repo_bound_verification, true);
  assert.equal(man.requires_real_files_changed, true);
  assert.equal(man.requires_syntax_check_pass, true);
  assert.equal(man.requires_no_branch_drift, true);
  assert.equal(man.self_acceptance_by_worker, false);
  assert.equal(man.distinct_operator_action_required, true);
  assert.equal(man.fails_closed, true);
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
  assert.deepEqual(man.protected_branches, ['main', 'master']);
}

console.log('JARVIS Engineering Mission INDEPENDENT ACCEPTANCE V1 smoke: PASS');
