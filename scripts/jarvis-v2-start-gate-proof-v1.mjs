/* JARVIS — V2 Start Gate real proof (Part 5 of the V1 usability-gap mission).

   ONE controlled, operator-authorized run that proves the Engineering
   Mission dispatch path (Part 1) genuinely reaches Claude Code end to end,
   through the real HTTP route (/jarvis/api/engineering-mission), not a
   direct bridge call — and that the V2 target branch genuinely exists.

   What this does:
     1. Reads remote truth (read-only `git ls-remote`) for informational
        evidence only — never required to succeed (offline-safe).
     2. Creates the LOCAL branch factory/jarvis-masterarchitecture-v2 at the
        exact accepted V1 head, if it does not already exist there. Never
        checked out (the working tree stays on the current branch), never
        pushed (Part 7 safety: commit/push stays confined to
        factory/jarvis-command-center-real-truth-v1).
     3. Verifies the branch's head is genuinely that exact commit — never
        assumed.
     4. Dispatches a real, bounded Wave 0 task through the full engineering
        mission HTTP path: propose -> operator approval decision (persisted
        audit event) -> resubmit -> Claude Code bridge dispatch, using the
        real, already-authenticated local `claude` CLI
        (claude-code-local-cli-executor-v1.js) inside a disposable /tmp
        workspace — never the repo working tree.
     5. Independently verifies the outcome by reading the produced file back
        from disk itself (the bridge's own exit code / stdout is never
        trusted alone), and reads V2 progress back from the real
        /jarvis/api/runtime-truth projection.
     6. Persists one evidence record to evidence/jarvis-v2-start-gate-proof-v1.json.

   Exits 0 only on a genuine, independently-verified pass. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { createLocalClaudeCodeCliExecutorV1 } from '../src/jarvis/claude-code-local-cli-executor-v1.js';

const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';
const ACCEPTED_V1_HEAD = '9fbc56a9bb5498108b7804c4a49d6558cbfa7e2c';
const TARGET_BRANCH = 'factory/jarvis-masterarchitecture-v2';
const FIXTURE_NAME = 'WAVE_0_BOOTSTRAP.md';
const authorize = async () => ({ ok: true, operator_id: 'jarvis-operator:local-v2-start-gate', email: 'local-v2-start-gate@localhost' });

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', options.quiet ? 'ignore' : 'pipe'] }).trim();
}

const proof = {
  schema: 'aurentara.jarvis.v2-start-gate-proof.v1',
  program: PROGRAM,
  accepted_v1_head: ACCEPTED_V1_HEAD,
  target_branch: TARGET_BRANCH,
  generated_at: new Date().toISOString()
};

// ── 1. remote truth (read-only, best-effort, never required) ──
try {
  proof.remote_url = git(['remote', 'get-url', 'origin']);
  proof.remote_head_of_current_branch = git(['ls-remote', 'origin', 'factory/jarvis-command-center-real-truth-v1']).split(/\s+/)[0] || null;
} catch (error) {
  proof.remote_truth_error = String(error?.message || error).slice(0, 300);
}

// ── 2 + 3. local target branch at the exact accepted V1 head ──
let branchExisted = false;
try {
  const existingHead = git(['rev-parse', '--verify', '--quiet', TARGET_BRANCH], { quiet: true });
  branchExisted = true;
  proof.v2_branch_pre_existing_head = existingHead;
} catch { /* branch does not exist yet — expected on a first run */ }

if (!branchExisted) {
  git(['branch', TARGET_BRANCH, ACCEPTED_V1_HEAD]);
}
const branchHead = git(['rev-parse', TARGET_BRANCH]);
proof.v2_branch_exists = true;
proof.v2_branch_head = branchHead;
proof.v2_branch_head_matches_accepted_v1_head = branchHead === ACCEPTED_V1_HEAD;
proof.v2_branch_checked_out = git(['rev-parse', '--abbrev-ref', 'HEAD']) === TARGET_BRANCH; // must stay false
proof.v2_branch_pushed = false; // never pushed by this script

if (!proof.v2_branch_head_matches_accepted_v1_head) {
  console.log(JSON.stringify(proof, null, 2));
  console.error('V2_START_GATE_PROOF_FAILED: target branch head does not match ACCEPTED_V1_HEAD');
  process.exit(1);
}

// ── 4 + 5. real dispatch through the full HTTP engineering-mission path ──
const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-v2-wave0-'));
const store = createMemoryJarvisStoreV1();
const correlationId = crypto.randomUUID();

let genuineSuccess = false;
try {
  const executor = createLocalClaudeCodeCliExecutorV1({ workspace_dir: workspaceDir, max_budget_usd: 0.5 });
  const bridge = createJarvisClaudeCodeBridgeV1({ executor, timeout_ms: 120000 });

  function postMission(body) {
    return handleJarvisHttpV1(
      new Request('https://example.invalid/jarvis/api/engineering-mission', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      }),
      {}, {}, { authorize, memory_store: store, claude_bridge: bridge }
    );
  }
  function decide(body) {
    return handleJarvisHttpV1(
      new Request('https://example.invalid/jarvis/api/approvals/decide', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      }),
      {}, {}, { authorize, memory_store: store }
    );
  }
  function runtimeTruth() {
    return handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize, memory_store: store });
  }

  const mission = {
    title: 'Wave 0 bootstrap',
    goal: [
      `Using ONLY the Write tool, create exactly one file named ${FIXTURE_NAME} in the current directory.`,
      'Its content must be a short (3-5 bullet point) scope summary for Wave 0 of JARVIS_MASTERARCHITECTURE_V2:',
      'establish remote truth, create/use the target branch, verify the base head, begin Wave 0, dispatch genuine Claude implementation work.',
      'Do not create, read, or modify any other file. Do not use any tool other than Write/Read. Then stop.'
    ].join(' '),
    program: PROGRAM,
    correlation_id: correlationId,
    wave_index: 0
  };

  const propose = await (await postMission(mission)).json();
  proof.request_id = propose.request_id;
  proof.propose_run_state = propose.run_state;
  proof.propose_approval_required = propose.approval_required;

  const decision = await (await decide({ approval_id: `${correlationId}:approval`, run_id: correlationId, decision: 'approve' })).json();
  proof.approval_decision_ok = decision.ok === true;
  proof.approval_decision_executed = decision.executed === true; // must be false — approving is never execution

  const dispatchResp = await postMission(mission);
  const dispatch = await dispatchResp.json();
  proof.claude_code_dispatched = dispatch.claude_bridge_bound === true && dispatch.claude_execution !== null;
  proof.wave_0_status = dispatch.wave_state;
  proof.run_state = dispatch.run_state;
  proof.claude_exit_code = dispatch.claude_execution?.exit_code ?? null;
  proof.claude_evidence_id = dispatch.claude_execution?.evidence?.evidence_id || null;
  proof.independent_acceptance = dispatch.independent_acceptance === true; // must stay false — self-report is never acceptance

  // Independent verification: read the fixture back from disk ourselves.
  const fixturePath = path.join(workspaceDir, FIXTURE_NAME);
  let fixtureContent = null;
  try { fixtureContent = fs.readFileSync(fixturePath, 'utf8'); } catch {}
  const entries = fs.readdirSync(workspaceDir);
  proof.independent_verification = {
    fixture_path: fixturePath,
    fixture_found: fixtureContent !== null,
    fixture_non_empty: Boolean(fixtureContent && fixtureContent.trim().length > 0),
    only_expected_file_present: entries.length === 1 && entries[0] === FIXTURE_NAME,
    workspace_entries: entries
  };

  const truthResp = await runtimeTruth();
  const truthBody = await truthResp.json();
  const run = (truthBody.runs?.data?.items || []).find((x) => x.id === correlationId);
  proof.appears_in_runs = Boolean(run);
  proof.appears_in_activity = (truthBody.activity?.data?.items || []).some((a) => a.run_id === correlationId);
  proof.verified_progress_percent = truthBody.v2_progress?.data?.verified_progress_percent ?? null;
  proof.v2_progress_program = truthBody.v2_progress?.data?.program ?? null;
  proof.v2_progress_source_classification = truthBody.v2_progress?.source?.classification ?? null;

  genuineSuccess = proof.claude_code_dispatched === true
    && ['RUNNING', 'COMPLETE'].includes(proof.wave_0_status)
    && proof.independent_verification.fixture_found
    && proof.independent_verification.only_expected_file_present
    && proof.approval_decision_executed === false
    && proof.independent_acceptance === false;

  proof.evidence_ref = `evidence:${dispatch.claude_execution?.evidence?.evidence_id || `mission:${correlationId}`}`;
} finally {
  try { fs.rmSync(workspaceDir, { recursive: true, force: true }); } catch {}
}

proof.genuine_success = genuineSuccess;
proof.worker_self_report_treated_as_acceptance = false;

const evidencePath = path.resolve('evidence/jarvis-v2-start-gate-proof-v1.json');
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
proof.evidence_file = 'evidence/jarvis-v2-start-gate-proof-v1.json';

console.log(JSON.stringify(proof, null, 2));
console.log('');
console.log('REAL_V2_START_PROOF=' + (genuineSuccess ? 'PASS' : 'FAIL'));
console.log('V2_BRANCH_EXISTS=' + proof.v2_branch_exists);
console.log('V2_BRANCH=' + TARGET_BRANCH);
console.log('CLAUDE_CODE_DISPATCHED=' + proof.claude_code_dispatched);
console.log('REQUEST_ID=' + proof.request_id);
console.log('WAVE_0_STATUS=' + proof.wave_0_status);
console.log('VERIFIED_PROGRESS_PERCENT=' + proof.verified_progress_percent);
console.log('EVIDENCE_REF=' + proof.evidence_ref);

process.exitCode = genuineSuccess ? 0 : 1;
