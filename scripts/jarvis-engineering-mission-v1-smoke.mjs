import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { resolveJarvisIntentV1 } from '../src/jarvis/intent-v1.js';
import { classifyJarvisChatWorkRequestV1 } from '../src/jarvis/chat-work-router-v1.js';
import { classifyJarvisClaudeExecutionFailureV1, jarvisEngineeringMissionManifestV1 } from '../src/jarvis/engineering-mission-v1.js';
import { computeJarvisV2ProgressV1, JARVIS_V2_WAVE_WEIGHTS } from '../src/jarvis/v2-progress-v1.js';

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
function postChat(store, message, correlation_id) {
  return handleJarvisHttpV1(
    new Request('https://example.invalid/jarvis/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, correlation_id })
    }),
    {}, {}, { authorize, memory_store: store }
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
function truth(store) {
  return handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize, memory_store: store });
}

// ── 1. Generic chat still works, unaffected by the new route ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await postChat(store, 'Was weißt du über meine Projekte?', '10101010-1111-4111-8111-111111111111');
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.approval_required, false);
}

// ── 2. The fuzzy free-text keyword resolver (intent-v1.js) itself must still
//      NEVER resolve to the explicit engineering-mission action — that
//      invariant is unchanged. A genuinely bounded internal engineering
//      imperative typed into chat CAN now legitimately reach
//      IMPLEMENTATION_MISSION, but only through the dedicated, deterministic
//      chat-work-router-v1.js classifier (owner-chat-job-v1.js), and only
//      with a full, explicit, auditable self-approval trail — never
//      silently, and never via intent-v1.js's fuzzy table drifting into it.
//      See scripts/jarvis-owner-chat-job-v1-smoke.mjs for the dedicated,
//      end-to-end coverage of that new dispatch path. ──
{
  const bigPrompt = 'Implement JARVIS_MASTERARCHITECTURE_V2 Wave 0: establish remote truth, create the target branch, begin genuine Claude implementation work end to end across the whole system.';
  const resolved = resolveJarvisIntentV1({ message: bigPrompt });
  assert.notEqual(resolved.action, 'IMPLEMENTATION_MISSION', 'the fuzzy free-text keyword resolver must never itself resolve to the explicit engineering-mission action');
  assert.notEqual(resolved.intent_type, 'IMPLEMENTATION_MISSION_REQUEST');

  // A question about the same topic (no action verb) must stay CONVERSATION
  // end to end — chat-work-router-v1.js only ever fires on an explicit
  // imperative, never on a mere mention of engineering-shaped nouns.
  const questionPrompt = 'Was ist eigentlich der aktuelle Stand von JARVIS_MASTERARCHITECTURE_V2 Wave 0?';
  assert.equal(classifyJarvisChatWorkRequestV1(questionPrompt).classification, 'CONVERSATION');
  const store = createMemoryJarvisStoreV1();
  const rq = await postChat(store, questionPrompt, '20202020-2222-4222-8222-222222222222');
  const bq = await rq.json();
  assert.notEqual(bq.action, 'IMPLEMENTATION_MISSION', 'a non-imperative question must never produce the engineering-mission action');
  assert.equal(bq.chat_work_classification, 'CONVERSATION');
}

// ── 3. Engineering mission route is explicit: dedicated request shape, dedicated action ──
{
  const store = createMemoryJarvisStoreV1();
  const corr = '30303030-3333-4333-8333-333333333333';
  const r = await postMission(store, { title: 'Wave 0 bootstrap', goal: 'Establish remote truth and target branch.', program: PROGRAM, correlation_id: corr, wave_index: 0 });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.request_id, corr);
  assert.equal(b.correlation_id, corr);
  assert.equal(b.intent, 'IMPLEMENTATION_MISSION_REQUEST');
  assert.equal(b.action, 'IMPLEMENTATION_MISSION');
  assert.equal(b.approval_required, true, 'engineering missions are approval-gated like every other external-write action');
  assert.equal(b.run_state, 'WAITING_APPROVAL');
  assert.equal(b.claude_execution, null, 'no dispatch happens on the first, unapproved call');
  assert.equal(b.action_gate_bypassed, false);
}

// ── 4. Malformed missions are rejected (title/goal/program/correlation_id required), nothing persisted ──
{
  const store = createMemoryJarvisStoreV1();
  const r = await postMission(store, { title: '', goal: 'x', program: PROGRAM, correlation_id: '40404040-4444-4444-8444-444444444444' });
  assert.equal(r.status, 400);
  const b = await r.json();
  assert.equal(b.ok, false);
  assert.match(b.error, /TITLE_REQUIRED/);
}

// ── 5. Approval/action gate remains enforced: still no dispatch without a persisted approval, even with a bound bridge ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0, stdout: 'ok' } }) });
  const corr = '50505050-5555-4555-8555-555555555555';
  const r = await postMission(store, { title: 'Wave 0', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 }, bridge);
  const b = await r.json();
  assert.equal(b.approval_required, true);
  assert.equal(b.claude_execution, null, 'a bound bridge alone never authorizes execution');
}

// ── 6. Engineering mission genuinely reaches the Claude Code path once approved; request_id continuity holds; run/activity/evidence show up ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0, stdout: 'wave 0 done' } }) });
  const corr = '60606060-6666-4666-8666-666666666666';

  const first = await (await postMission(store, { title: 'Wave 0 bootstrap', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 }, bridge)).json();
  assert.equal(first.run_state, 'WAITING_APPROVAL');

  const dec = await (await decide(store, `${corr}:approval`, corr, 'approve')).json();
  assert.equal(dec.ok, true);
  assert.equal(dec.execution_authorized, false, 'approving is never itself execution');
  assert.equal(dec.executed, false);

  const second = await postMission(store, { title: 'Wave 0 bootstrap', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 }, bridge);
  const b2 = await second.json();
  assert.equal(b2.request_id, corr, 'request_id continuity holds across the propose -> approve -> dispatch sequence');
  assert.equal(b2.claude_bridge_bound, true);
  assert.equal(b2.claude_execution.state, 'COMPLETE');
  assert.equal(b2.run_state, 'COMPLETE');
  assert.equal(b2.wave_state, 'COMPLETE');
  assert.equal(b2.independent_acceptance, false, 'the bridge exit code alone is never independent acceptance');

  const tb = await (await truth(store)).json();
  const run = tb.runs.data.items.find((x) => x.id === corr);
  assert.ok(run, 'the mission shows up as a real projected run');
  assert.ok(tb.activity.data.items.some((a) => a.run_id === corr), 'the mission shows up in Activity');
}

// ── 7. Claude bridge unavailable -> fails closed, never fabricated as dispatched ──
{
  const store = createMemoryJarvisStoreV1();
  const corr = '70707070-7777-4777-8777-777777777777';
  await postMission(store, { title: 'Wave 1', goal: 'Wave 1 goal text', program: PROGRAM, correlation_id: corr, wave_index: 1 });
  await decide(store, `${corr}:approval`, corr, 'approve');
  const r = await postMission(store, { title: 'Wave 1', goal: 'Wave 1 goal text', program: PROGRAM, correlation_id: corr, wave_index: 1 }); // no bridge injected
  const b = await r.json();
  assert.equal(b.claude_bridge_bound, false);
  assert.equal(b.claude_execution, null, 'no dispatch is ever fabricated when no genuine bridge is bound');
  assert.equal(b.wave_state, 'BLOCKED', 'approved-but-unbound fails closed to BLOCKED, never COMPLETE');
  assert.equal(b.run_state, 'BLOCKED');
}

// ── 7a. Bridge HTTP failures resolve to bounded safe codes only ──
{
  assert.equal(classifyJarvisClaudeExecutionFailureV1({
    state: 'FAILED',
    stderr: 'BRIDGE_HTTP_401: {"ok":false,"error":"UNAUTHORIZED"}'
  }), 'BRIDGE_AUTH_FAILED');
  assert.equal(classifyJarvisClaudeExecutionFailureV1({
    state: 'FAILED',
    stderr: 'BRIDGE_HTTP_409: {"ok":false,"error":"IMPLEMENT_REQUIRES_CLEAN_OR_SAFE_REPAIR_WORKSPACE"}'
  }), 'BRIDGE_WORKSPACE_DIRTY');
  assert.equal(classifyJarvisClaudeExecutionFailureV1({
    state: 'FAILED',
    stderr: 'BRIDGE_HTTP_409: {"ok":false,"error":"IMPLEMENT_REQUIRES_GIT_REPOSITORY"}'
  }), 'BRIDGE_WORKSPACE_NOT_GIT_REPOSITORY');
  assert.equal(classifyJarvisClaudeExecutionFailureV1({
    state: 'FAILED',
    stderr: 'BRIDGE_HTTP_400: {"ok":false,"error":"project does not exist"}'
  }), 'BRIDGE_PROJECT_NOT_FOUND');
  assert.equal(classifyJarvisClaudeExecutionFailureV1({
    state: 'FAILED',
    stderr: 'BRIDGE_HTTP_400: {"ok":false,"error":"some unknown validation"}'
  }), 'BRIDGE_BAD_REQUEST');
}

// ── 7b. Failed Claude execution exposes only a classified safe reason, never raw provider stderr ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: async () => ({
      exit_code: 1,
      stdout: '',
      stderr: "You've hit your session limit · usage_limit_reached"
    })
  });
  const corr = '71717171-7777-4777-8777-777777777771';
  await postMission(store, {
    title: 'Read-only provider failure probe',
    goal: 'Inspect only.',
    program: PROGRAM,
    correlation_id: corr,
    wave_index: 1
  }, bridge);
  await decide(store, `${corr}:approval`, corr, 'approve');
  const response = await postMission(store, {
    title: 'Read-only provider failure probe',
    goal: 'Inspect only.',
    program: PROGRAM,
    correlation_id: corr,
    wave_index: 1
  }, bridge);
  const body = await response.json();
  assert.equal(body.claude_execution.state, 'FAILED');
  assert.equal(body.claude_execution.failure_reason, 'CLAUDE_USAGE_LIMIT');
  assert.equal(body.run_state, 'FAILED');
  assert.doesNotMatch(JSON.stringify(body), /You've hit your session limit/i);
}

// ── 8. V2 progress = 0 when no V2 program evidence exists at all ──
{
  const store = createMemoryJarvisStoreV1();
  const tb = await (await truth(store)).json();
  assert.equal(tb.v2_progress.data.program, null);
  assert.equal(tb.v2_progress.data.verified_progress_percent, 0);
  assert.equal(tb.v2_progress.data.current_wave, 0);
  assert.deepEqual(tb.v2_progress.data.completed_waves, []);
  assert.equal(tb.v2_progress.source.classification, 'DERIVED');
}

// ── 8b. Review mode receives an explicit direct-tools-only guard before dispatch ──
{
  const store = createMemoryJarvisStoreV1();
  const corr = '78787878-7878-4787-8787-787878787878';
  let captured = null;
  const bridge = {
    bound: true,
    submit(input) {
      captured = input;
      return {
        result: Promise.resolve({
          state: 'COMPLETE',
          exit_code: 0,
          external_effect: false,
          evidence: {
            evidence_id: 'claude-code:' + corr,
            verification: {
              schema: 'aurentara.jarvis.repo-bound-verification.v1',
              branch_drift: false,
              files_changed: [],
              syntax_check: { passed: true, checked: 0, results: [] }
            }
          }
        })
      };
    }
  };

  await postMission(store, {
    title: 'Read-only inspection',
    goal: 'Inspect evidence only.',
    program: PROGRAM,
    correlation_id: corr,
    execution_mode: 'review'
  }, bridge);
  await decide(store, corr + ':approval', corr, 'approve');
  await postMission(store, {
    title: 'Read-only inspection',
    goal: 'Inspect evidence only.',
    program: PROGRAM,
    correlation_id: corr,
    execution_mode: 'review'
  }, bridge);

  assert.equal(captured.execution_mode, 'review');
  assert.match(captured.task, /STRICT JARVIS REVIEW MODE/);
  assert.match(captured.task, /Use only Read, Glob, and Grep/);
  assert.match(captured.task, /Do not use Agent or Task/);
  assert.match(captured.task, /Do not modify the workspace/);
  assert.match(captured.task, /verify every named category/i);
  assert.match(captured.task, /inspect relevant existing test\/smoke files and recorded test outcomes/i);
  assert.match(captured.task, /trusted server repository metadata/i);
}

// ── 8c. Owner implementation mode is direct-tools-only at the task level ──
{
  const store = createMemoryJarvisStoreV1();
  const corr = '79797979-7979-4797-8797-797979797979';
  let captured = null;
  const bridge = {
    bound: true,
    submit(input) {
      captured = input;
      return {
        result: Promise.resolve({
          state: 'COMPLETE',
          exit_code: 0,
          external_effect: false,
          evidence: {
            evidence_id: 'claude-code:' + corr,
            verification: {
              schema: 'aurentara.jarvis.repo-bound-verification.v1',
              branch: 'factory/owner-implementation-fixture',
              branch_drift: false,
              files_changed: ['src/fixture.js'],
              pre_existing_dirty_files: [],
              syntax_check: { passed: true, checked: 1, results: [{ file: 'src/fixture.js', passed: true }] }
            }
          }
        })
      };
    }
  };

  await postMission(store, {
    title: 'Owner implementation fixture',
    goal: 'Implement the smallest bounded fix.',
    program: 'JARVIS_OWNER_CHAT',
    correlation_id: corr,
    execution_mode: 'implement'
  }, bridge);
  await decide(store, corr + ':approval', corr, 'approve');
  await postMission(store, {
    title: 'Owner implementation fixture',
    goal: 'Implement the smallest bounded fix.',
    program: 'JARVIS_OWNER_CHAT',
    correlation_id: corr,
    execution_mode: 'implement'
  }, bridge);

  assert.equal(captured.execution_mode, 'implement');
  assert.match(captured.task, /STRICT JARVIS OWNER IMPLEMENTATION MODE/);
  assert.match(captured.task, /Use only Read, Glob, Grep, Edit, and Write/);
  assert.match(captured.task, /Do not use Agent or Task/);
  assert.match(captured.task, /Do not delegate.*Explore/i);
  assert.match(captured.task, /Treat orchestration metadata as environment context, not as a task to audit/i);
  assert.match(captured.task, /If a concrete repository gap exists, use Edit or Write/i);
  assert.doesNotMatch(captured.task, /trusted host verifier/i);
}

// ── 9. No worker self-report can mark a wave complete: a genuinely COMPLETE bridge run (wave_state COMPLETE) still contributes 0% until an independent acceptance ref exists ──
{
  const store = createMemoryJarvisStoreV1();
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'Wave 0': { exit_code: 0 } }) });
  const corr = '80808080-8888-4888-8888-888888888888';
  await postMission(store, { title: 'Wave 0', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 });
  await decide(store, `${corr}:approval`, corr, 'approve');
  const done = await (await postMission(store, { title: 'Wave 0', goal: 'Wave 0 goal text', program: PROGRAM, correlation_id: corr, wave_index: 0 }, bridge)).json();
  assert.equal(done.claude_execution.state, 'COMPLETE', 'the bridge genuinely completed');

  const tb = await (await truth(store)).json();
  assert.equal(tb.v2_progress.data.verified_progress_percent, 0, 'worker self-report (bridge exit_code 0 / state COMPLETE) never counts on its own');
  assert.deepEqual(tb.v2_progress.data.completed_waves, [], 'no independently-accepted wave exists yet');
  assert.equal(tb.v2_progress.data.current_wave, 0, 'wave 0 is not counted complete, so it is still the current wave');
}

// ── 10. Progress increments only from accepted waves; blocked/failed waves never add progress (pure unit tests of the compute function) ──
{
  assert.equal(JARVIS_V2_WAVE_WEIGHTS.reduce((a, b) => a + b, 0), 100);

  const noEvidence = computeJarvisV2ProgressV1([]);
  assert.equal(noEvidence.verified_progress_percent, 0);

  const selfReportOnly = computeJarvisV2ProgressV1([{ wave_index: 0, wave_state: 'COMPLETE', independent_acceptance: false, acceptance_ref: null, at: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(selfReportOnly.verified_progress_percent, 0, 'COMPLETE without independent_acceptance/acceptance_ref never counts');

  const accepted = computeJarvisV2ProgressV1([
    { wave_index: 0, wave_state: 'COMPLETE', independent_acceptance: true, acceptance_ref: 'review:1', at: '2026-01-01T00:00:00.000Z', evidence_ref: 'audit:1' },
    { wave_index: 1, wave_state: 'COMPLETE', independent_acceptance: true, acceptance_ref: 'review:2', at: '2026-01-02T00:00:00.000Z', evidence_ref: 'audit:2' }
  ]);
  assert.equal(accepted.verified_progress_percent, JARVIS_V2_WAVE_WEIGHTS[0] + JARVIS_V2_WAVE_WEIGHTS[1]);
  assert.deepEqual(accepted.completed_waves, [0, 1]);
  assert.equal(accepted.current_wave, 2);
  assert.equal(accepted.program, 'JARVIS_MASTERARCHITECTURE_V2');

  const blockedAndFailed = computeJarvisV2ProgressV1([
    { wave_index: 0, wave_state: 'COMPLETE', independent_acceptance: true, acceptance_ref: 'review:1', at: '2026-01-01T00:00:00.000Z' },
    { wave_index: 1, wave_state: 'BLOCKED', independent_acceptance: false, acceptance_ref: null, at: '2026-01-02T00:00:00.000Z' },
    { wave_index: 2, wave_state: 'FAILED', independent_acceptance: false, acceptance_ref: null, at: '2026-01-03T00:00:00.000Z' }
  ]);
  assert.equal(blockedAndFailed.verified_progress_percent, JARVIS_V2_WAVE_WEIGHTS[0], 'blocked/failed waves add nothing');
  assert.equal(blockedAndFailed.blocked_wave, 1);
  assert.equal(blockedAndFailed.current_wave, 1, 'current wave is the first not-yet-accepted wave, not the highest attempted');
}

// ── 11. No fabricated truth ever reaches the snapshot (schema-level guarantee, not just this domain) ──
{
  const store = createMemoryJarvisStoreV1();
  const tb = await (await truth(store)).json();
  assert.equal(tb.validation.ok, true);
  assert.equal(tb.validation.mock_operational_truth_visible, false);
}

// ── 12. Manifest / safety invariants: no HAMYREN flow, no production deploy, gate never bypassed ──
{
  const man = jarvisEngineeringMissionManifestV1();
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
  assert.equal(man.action_gate_bypassed, false);
  assert.equal(man.worker_self_acceptance_counts_as_independent, false);
  assert.equal(man.default_claude_bridge_bound, false);
  assert.equal(man.fabricates_worker_availability, false);
  assert.deepEqual(man.review_mode_direct_tools_only, ['Read', 'Glob', 'Grep']);
  assert.equal(man.review_mode_agent_delegation_forbidden, true);
  assert.deepEqual(man.owner_implementation_mode_direct_tools_only, ['Read', 'Glob', 'Grep', 'Edit', 'Write']);
  assert.equal(man.owner_implementation_mode_agent_delegation_forbidden, true);
  assert.equal(man.owner_implementation_mode_unrelated_infra_inspection_forbidden, true);
  assert.equal(man.review_named_evidence_categories_must_be_checked, true);
  assert.equal(man.review_tests_are_inspected_not_executed, true);

  const FORBIDDEN = [/wrangler\s+deploy/i, /\bgit\s+push\b/i, /\bgit\s+merge\b/i, /hamyren/i];
  for (const file of ['src/jarvis/engineering-mission-v1.js', 'src/jarvis/v2-progress-v1.js']) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN) {
      // Comments legitimately say "no HAMYREN flow" / "hamyren_data_flow: false" —
      // only forbid the deploy/push/merge verbs as live code.
      if (pattern.source.includes('hamyren')) continue;
      assert.doesNotMatch(text, pattern, `${file} must not contain forbidden pattern ${pattern}`);
    }
  }
}

console.log('JARVIS Engineering Mission V1 (dedicated dispatch + V2 progress HUD) smoke: PASS');
