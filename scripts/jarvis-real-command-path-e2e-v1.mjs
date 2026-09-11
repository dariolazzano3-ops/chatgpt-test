/* JARVIS — ONE genuine nested Claude Code CLI invocation through the SAME
   command path the Command Center actually uses (Phase 3).

   This does NOT call claude-code-bridge-v1.js directly as its main proof.
   It drives the real HTTP contract handler (handleJarvisHttpV1) exactly the
   way the deployed Worker would:

     POST /jarvis/api/chat (write-shaped message)
       -> canonical request_id
       -> runtime resolution (handleJarvisRuntimeRequestV1)
       -> action gate: AWAITING_APPROVAL (blocked, nothing executes)
     POST /jarvis/api/approvals/decide (distinct operator action)
       -> GRANTED decision persisted; still executed:false, gate not bypassed
     POST /jarvis/api/chat again, same request_id
       -> runtime finds the persisted GRANTED decision itself (never a
          client-asserted flag) -> action gate AUTHORIZED
       -> genuine Claude Code execution adapter (claude-code-local-runtime-binding-v1.js)
       -> ONE real nested, non-interactive, --restricted `claude` CLI session,
          confined to a disposable /tmp workspace this script mints and
          deletes
       -> result -> evidence -> persisted audit
     GET /jarvis/api/runtime-truth
       -> Runs / Activity / Evidence projected straight from that persisted
          audit (DERIVED, not fabricated)

   Finally: genuine, read-only Git remote-truth for the current HEAD (via the
   gh CLI's own stored credential — this script never touches the token).

   Every outcome below is independently re-derived by this script, never
   trusted from a self-report: the fixture file the nested session was asked
   to write is read back from disk directly. */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeLocalRuntimeBindingV1, JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG } from '../src/jarvis/claude-code-local-runtime-binding-v1.js';

const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:e2e@example.invalid', email: 'e2e@example.invalid' });
const CORR = crypto.randomUUID();
const FIXTURE_NAME = 'jarvis-cmd-path-e2e.txt';
const EXPECTED_CONTENT = `JARVIS_CMD_PATH_E2E_OK:${CORR}`;
const MESSAGE = `Create a file named ${FIXTURE_NAME} in the current directory containing exactly this one line and nothing else: ${EXPECTED_CONTENT}. Do not touch any other file.`;

const store = createMemoryJarvisStoreV1();
let independentDiskCheck = { fixture_found: false, fixture_content_matches: false, only_expected_file_present: false };
const binding = createJarvisClaudeLocalRuntimeBindingV1(
  { [JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG]: 'on' },
  {
    // Testing-only hook: lets THIS script independently read the fixture
    // back from disk before the local runtime binding deletes the
    // disposable workspace it owns (see claude-code-local-runtime-binding-v1.js).
    // Not used, and not needed, by the normal runtime path.
    on_before_cleanup(dir) {
      try {
        const entries = fs.readdirSync(dir);
        const content = fs.readFileSync(`${dir}/${FIXTURE_NAME}`, 'utf8').trim();
        independentDiskCheck = {
          fixture_found: true,
          fixture_content_matches: content === EXPECTED_CONTENT,
          only_expected_file_present: entries.length === 1 && entries[0] === FIXTURE_NAME
        };
      } catch (error) {
        independentDiskCheck = { fixture_found: false, error: String(error?.message || error).slice(0, 200) };
      }
    }
  }
);

function post(path, body) {
  return handleJarvisHttpV1(
    new Request(`https://example.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    {}, {},
    { authorize, memory_store: store, claude_bridge: binding.bridge }
  );
}
function get(path) {
  return handleJarvisHttpV1(new Request(`https://example.invalid${path}`), {}, {}, { authorize, memory_store: store, claude_bridge: binding.bridge });
}

const report = { schema: 'aurentara.jarvis.real-command-path-e2e.v1', request_id: CORR, binding: { bound: binding.bound, reason: binding.reason } };

if (!binding.bound) {
  console.log(JSON.stringify({ ...report, genuine_success: false, blocker: binding.reason }, null, 2));
  process.exit(1);
}

// ── 1: first chat call — blocked, nothing executes ──
const first = await (await post('/jarvis/api/chat', { message: MESSAGE, correlation_id: CORR })).json();
report.step1_first_chat = { run_state: first.run_state, approval_required: first.approval_required, blocked: first.blocked, claude_execution: first.claude_execution };
const firstGenuinelyBlocked = first.run_state === 'WAITING_APPROVAL' && first.claude_execution === null && first.blocked === false;

// ── 2: distinct operator approval decision — recorded, not executed ──
const decideResp = await post('/jarvis/api/approvals/decide', { approval_id: `${CORR}:approval`, run_id: CORR, decision: 'approve' });
const decide = await decideResp.json();
report.step2_approval_decision = { status: decideResp.status, ok: decide.ok, executed: decide.executed, action_gate_bypassed: decide.action_gate_bypassed };
const approvalRecordedWithoutExecuting = decideResp.status === 200 && decide.ok === true && decide.executed === false && decide.action_gate_bypassed === false;

// ── 3: second chat call, same request_id — genuinely authorized, genuine Claude Code execution ──
const second = await (await post('/jarvis/api/chat', { message: MESSAGE, correlation_id: CORR })).json();
report.step3_second_chat = {
  run_state: second.run_state,
  blocked: second.blocked,
  independent_acceptance: second.independent_acceptance,
  external_effect: second.external_effect,
  claude_execution: second.claude_execution
};
const bridgeGenuinelyComplete = second.run_state === 'COMPLETE' && second.claude_execution?.state === 'COMPLETE' && second.independent_acceptance === false;

// ── independent verification: THIS script re-read the fixture from disk
//    itself (via the on_before_cleanup hook, BEFORE the local runtime
//    binding deleted the disposable workspace), never trusting the nested
//    session's own exit code / self-report. ──
report.independent_verification = independentDiskCheck;
const fixtureVerified = independentDiskCheck.fixture_found === true
  && independentDiskCheck.fixture_content_matches === true
  && independentDiskCheck.only_expected_file_present === true;

// ── 4: runtime-truth projection, from the SAME persisted audit ──
const truth = await (await get('/jarvis/api/runtime-truth')).json();
const run = truth.runs?.data?.items?.find((r) => r.id === CORR) || null;
report.step4_projection = {
  runs_classification: truth.runs?.source?.classification,
  run_found: Boolean(run),
  run_status: run?.status || null,
  run_worker: run?.worker || null,
  run_approval_state: run?.approval_state || null,
  command_chain_claude_bound: truth.command_chain?.claude_execution_bridge_bound
};
const projectionGenuine = run?.status === 'COMPLETE' && run?.worker === 'Claude Code' && run?.approval_state === 'GRANTED' && truth.command_chain?.claude_execution_bridge_bound === true;

// ── 5: genuine, read-only Git remote truth (gh CLI's own credential; never seen here) ──
let gitTruth;
try {
  const localHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  const remoteSha = execFileSync('gh', ['api', `repos/dariolazzano3-ops/chatgpt-test/git/ref/heads/${encodeURIComponent(branch)}`, '--jq', '.object.sha'], { encoding: 'utf8' }).trim();
  gitTruth = { branch, local_head: localHead, remote_head: remoteSha, status: localHead === remoteSha ? 'SYNCED' : 'CHANGED' };
} catch (error) {
  gitTruth = { status: 'UNKNOWN', error: String(error?.message || error).slice(0, 300) };
}
report.step5_git_remote_truth = gitTruth;

report.genuine_success = Boolean(firstGenuinelyBlocked && approvalRecordedWithoutExecuting && bridgeGenuinelyComplete && fixtureVerified && projectionGenuine);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.genuine_success ? 0 : 1;
