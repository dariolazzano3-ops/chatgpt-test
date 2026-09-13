/* JARVIS Astra PRE/POST review + supervised mission V1 — targeted smoke.

   CI-safe: fixture Claude executor (createLocalFixtureExecutorV1, no live
   Claude CLI/Bridge call), a real in-memory JARVIS store, and a real
   throwaway temp git repo. Proves: Astra PRE frames/approves/rejects
   correctly; Astra POST reads ONLY Bridge-computed evidence and returns
   PASS/REPAIR/BLOCK correctly; the supervised orchestration reuses the
   real Program Controller tick (no second dispatch path), reaches real
   evidence, and NEVER calls acceptance itself. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { reviewJarvisAstraPreV1, jarvisAstraPreManifestV1 } from '../src/jarvis/astra-pre-review-v1.js';
import { reviewJarvisAstraPostV1, jarvisAstraPostManifestV1 } from '../src/jarvis/astra-post-review-v1.js';
import { runJarvisAstraSupervisedMissionV1, jarvisAstraSupervisedMissionManifestV1 } from '../src/jarvis/astra-supervised-mission-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { handleJarvisProgramApprovalGrantRuntimeV1 } from '../src/jarvis/program-approval-v1.js';
import { handleJarvisProgramStateRuntimeV1 } from '../src/jarvis/program-controller-v1.js';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_REF = 'jarvis:operator:astra-smoke@example.invalid';
const PROGRAM = 'JARVIS_MASTERARCHITECTURE_V2';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepo(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-astra-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

// ══ Astra PRE ══

await check('PRE: approves a normal, in-bounds request and frames it correctly', () => {
  const result = reviewJarvisAstraPreV1({
    title: 'Add a health check endpoint',
    request_text: 'Add a GET /healthz route that returns {ok:true} — no other changes.',
    program: PROGRAM, repo_dir: '/tmp/fixture-repo', target_branch: 'factory/jarvis-masterarchitecture-v2'
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision, 'APPROVE');
  assert.equal(result.goal, 'Add a health check endpoint');
  assert.equal(result.acceptance_criteria.exit_code_zero, true);
  assert.equal(result.acceptance_criteria.real_change_required, true);
  assert.deepEqual(result.acceptance_criteria.allowed_tools_only, ['Read', 'Glob', 'Grep', 'Edit', 'Write']);
  assert.deepEqual(result.safety_boundary.protected_branches_refused, ['main', 'master']);
});

await check('PRE: rejects requests naming a forbidden intent (deploy/merge/main/production/DNS/billing/HAMYREN/force-push/public release)', () => {
  const cases = [
    ['deploy this to production', 'NO_DEPLOY'],
    ['merge this branch', 'NO_MERGE'],
    ['push this to main branch', 'NO_MAIN_MASTER'],
    ['activate production mode', 'NO_PRODUCTION_ACTIVATION'],
    ['update the DNS records', 'NO_DNS_CHANGES'],
    ['change the billing plan', 'NO_BILLING_CHANGES'],
    ['sync HAMYREN customer data', 'NO_HAMYREN_DATA_FLOW'],
    ['git push --force to the branch', 'NO_FORCE_PUSH'],
    ['publish this publicly', 'NO_PUBLIC_RELEASE']
  ];
  for (const [text, expectedReason] of cases) {
    const result = reviewJarvisAstraPreV1({
      title: 'x', request_text: text, program: PROGRAM, repo_dir: '/tmp/x', target_branch: 'factory/x'
    });
    assert.equal(result.decision, 'REJECT', `expected REJECT for: ${text}`);
    assert.equal(result.reason, `ASTRA_PRE_FORBIDDEN_INTENT:${expectedReason}`, `expected ${expectedReason} for: ${text}`);
  }
});

await check('PRE: rejects a protected target branch and missing scope/text', () => {
  const protectedBranch = reviewJarvisAstraPreV1({ title: 'x', request_text: 'do something', program: PROGRAM, repo_dir: '/tmp/x', target_branch: 'main' });
  assert.equal(protectedBranch.reason, 'ASTRA_PRE_PROTECTED_BRANCH_REFUSED');

  const noText = reviewJarvisAstraPreV1({ title: '', request_text: '', program: PROGRAM, repo_dir: '/tmp/x', target_branch: 'factory/x' });
  assert.equal(noText.reason, 'ASTRA_PRE_MISSION_TEXT_REQUIRED');

  const noScope = reviewJarvisAstraPreV1({ title: 'x', request_text: 'y', program: '', repo_dir: '', target_branch: '' });
  assert.equal(noScope.reason, 'ASTRA_PRE_PROGRAM_SCOPE_REQUIRED');
});

// ══ Astra POST ══

const GOOD_FRAME = reviewJarvisAstraPreV1({
  title: 'Add a health check endpoint', request_text: 'Add a GET /healthz route.',
  program: PROGRAM, repo_dir: '/fixture', target_branch: 'factory/jarvis-masterarchitecture-v2'
});

await check('POST: PASS when evidence genuinely satisfies the acceptance criteria', () => {
  const result = reviewJarvisAstraPostV1({
    acceptance_criteria: GOOD_FRAME.acceptance_criteria,
    safety_boundary: GOOD_FRAME.safety_boundary,
    exit_code: 0,
    external_effect: true,
    verification: {
      branch: 'factory/jarvis-masterarchitecture-v2',
      tool_audit: [{ tool: 'Write', path: 'a.js' }, { tool: 'Read', path: 'b.js' }],
      git_evidence: { files_changed: ['a.js'] },
      filesystem_evidence: { files_changed: ['a.js'] }
    }
  });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.reason, null);
});

await check('POST: REPAIR on a nonzero exit code or missing real-change evidence, never BLOCK for an ordinary failure', () => {
  const badExit = reviewJarvisAstraPostV1({
    acceptance_criteria: GOOD_FRAME.acceptance_criteria, safety_boundary: GOOD_FRAME.safety_boundary,
    exit_code: 1, external_effect: false, verification: { branch: 'factory/jarvis-masterarchitecture-v2', tool_audit: [] }
  });
  assert.equal(badExit.decision, 'REPAIR');
  assert.equal(badExit.reason, 'ASTRA_POST_NONZERO_EXIT_CODE');

  const noChange = reviewJarvisAstraPostV1({
    acceptance_criteria: GOOD_FRAME.acceptance_criteria, safety_boundary: GOOD_FRAME.safety_boundary,
    exit_code: 0, external_effect: false, verification: { branch: 'factory/jarvis-masterarchitecture-v2', tool_audit: [] }
  });
  assert.equal(noChange.decision, 'REPAIR');
  assert.equal(noChange.reason, 'ASTRA_POST_NO_REAL_CHANGE_EVIDENCE');
});

await check('POST: BLOCK on a disallowed tool, protected-branch evidence, branch mismatch, files out of scope, or missing evidence', () => {
  const disallowedTool = reviewJarvisAstraPostV1({
    acceptance_criteria: GOOD_FRAME.acceptance_criteria, safety_boundary: GOOD_FRAME.safety_boundary,
    exit_code: 0, external_effect: true,
    verification: { branch: 'factory/jarvis-masterarchitecture-v2', tool_audit: [{ tool: 'Bash', path: 'x' }] }
  });
  assert.equal(disallowedTool.decision, 'BLOCK');
  assert.equal(disallowedTool.reason, 'ASTRA_POST_DISALLOWED_TOOL_USED');

  const protectedBranch = reviewJarvisAstraPostV1({
    acceptance_criteria: GOOD_FRAME.acceptance_criteria, safety_boundary: GOOD_FRAME.safety_boundary,
    exit_code: 0, external_effect: true, verification: { branch: 'main', tool_audit: [] }
  });
  assert.equal(protectedBranch.decision, 'BLOCK');
  assert.equal(protectedBranch.reason, 'ASTRA_POST_PROTECTED_BRANCH_EVIDENCE');

  const branchMismatch = reviewJarvisAstraPostV1({
    acceptance_criteria: GOOD_FRAME.acceptance_criteria, safety_boundary: GOOD_FRAME.safety_boundary,
    exit_code: 0, external_effect: true, verification: { branch: 'factory/some-other-branch', tool_audit: [] }
  });
  assert.equal(branchMismatch.decision, 'BLOCK');
  assert.equal(branchMismatch.reason, 'ASTRA_POST_BRANCH_MISMATCH');

  const scopedFrame = reviewJarvisAstraPreV1({
    title: 'x', request_text: 'y', program: PROGRAM, repo_dir: '/fixture', target_branch: 'factory/jarvis-masterarchitecture-v2',
    expected_files: ['a.js']
  });
  const outOfScope = reviewJarvisAstraPostV1({
    acceptance_criteria: scopedFrame.acceptance_criteria, safety_boundary: scopedFrame.safety_boundary,
    exit_code: 0, external_effect: true,
    verification: { branch: 'factory/jarvis-masterarchitecture-v2', tool_audit: [], filesystem_evidence: { files_changed: ['b.js'] } }
  });
  assert.equal(outOfScope.decision, 'BLOCK');
  assert.equal(outOfScope.reason, 'ASTRA_POST_FILES_OUT_OF_SCOPE');
  assert.deepEqual(outOfScope.out_of_scope_files, ['b.js']);

  const noEvidence = reviewJarvisAstraPostV1({ acceptance_criteria: GOOD_FRAME.acceptance_criteria, safety_boundary: GOOD_FRAME.safety_boundary, exit_code: 0, external_effect: true, verification: null });
  assert.equal(noEvidence.decision, 'BLOCK');
  assert.equal(noEvidence.reason, 'ASTRA_POST_NO_BRIDGE_EVIDENCE');
});

// ══ Supervised mission orchestration ══

await check('SUPERVISED: rejects at Astra PRE before ever ticking the Program Controller', async () => {
  const store = createMemoryJarvisStoreV1();
  const result = await runJarvisAstraSupervisedMissionV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: '/tmp/x', target_branch: 'factory/x',
    title: 'x', request_text: 'deploy this to production'
  }, { memory_store: store });
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'ASTRA_PRE');
  assert.equal(result.program_tick_run, false);
  assert.equal(result.claude_mission_dispatched, false);
});

await check('SUPERVISED: surfaces PROGRAM_CONTROLLER_BLOCKED when dispatch is not covered by Program Approval — never bypasses it', async () => {
  const repo = makeFixtureRepo('factory/astra-smoke-no-approval');
  const store = createMemoryJarvisStoreV1();
  // Deliberately grant ACCEPTANCE only, mirroring the real current state
  // (dispatch intentionally not covered) — proves this wrapper never
  // works around that gate.
  await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: 'factory/astra-smoke-no-approval',
    scope: ['ACCEPTANCE'], confirm_scope: true
  }, { memory_store: store });

  const result = await runJarvisAstraSupervisedMissionV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: 'factory/astra-smoke-no-approval',
    title: 'Add a health check endpoint', request_text: 'Add a GET /healthz route.'
  }, { memory_store: store });

  assert.equal(result.ok, false);
  assert.equal(result.stage, 'PROGRAM_CONTROLLER_BLOCKED');
  assert.equal(result.blocked_reason, 'DISPATCH_NOT_COVERED_BY_PROGRAM_APPROVAL');
  assert.equal(result.claude_mission_dispatched, false);
});

await check('SUPERVISED: full flow reaches real evidence via the real Program Controller, Astra POST decides PASS, but NOTHING is accepted', async () => {
  const repo = makeFixtureRepo('factory/astra-smoke-full');
  const store = createMemoryJarvisStoreV1();
  await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: 'factory/astra-smoke-full',
    scope: ['CLAUDE_REPO_BOUND_EXECUTION', 'ACCEPTANCE', 'LOCAL_FEATURE_BRANCH_MANAGEMENT', 'PROGRESS_ADVANCEMENT', 'NEXT_WAVE_CONTINUATION'],
    confirm_scope: true
  }, { memory_store: store });

  const missionTitle = 'Add a health check endpoint';
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({
      [missionTitle]: {
        exit_code: 0,
        external_effect: true,
        verification: {
          schema: 'aurentara.jarvis.repo-bound-verification.v1', repo_dir: repo, branch: 'factory/astra-smoke-full', branch_drift: false,
          files_changed: ['healthz.js'], pre_existing_dirty_files: [], syntax_check: { passed: true, checked: 1, results: [] }, at: new Date().toISOString()
        }
      }
    })
  });

  const result = await runJarvisAstraSupervisedMissionV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: 'factory/astra-smoke-full',
    title: missionTitle, request_text: 'Add a GET /healthz route that returns {ok:true}.'
  }, { memory_store: store, claude_bridge: bridge });

  assert.equal(result.ok, true);
  assert.equal(result.stage, 'ASTRA_POST_SUPERVISED_STOP');
  assert.equal(result.program_tick_run, true);
  assert.equal(result.claude_mission_dispatched, true);
  assert.equal(result.accepted, false, 'this function must NEVER accept anything itself');
  assert.equal(result.astra_post.decision, 'PASS');
  assert.equal(result.would_run_next.action, 'VERIFY_AND_ACCEPT');
  assert.ok(result.would_run_next.request_id);

  // Independently confirm through the REAL program-state read path that no
  // acceptance was actually recorded — not just trusting this function's
  // own return value.
  const state = await handleJarvisProgramStateRuntimeV1(
    { owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: 'factory/astra-smoke-full' },
    { memory_store: store }
  );
  assert.equal(state.ok, true);
  assert.deepEqual(state.completed_waves, [], 'nothing was ever accepted — completed_waves must still be empty');
  assert.equal(state.verified_progress_percent, 0);
});

// ══ Manifests ══

await check('manifests are honest about scope and non-duplication', () => {
  const pre = jarvisAstraPreManifestV1();
  assert.equal(pre.duplicates_program_controller, false);
  assert.equal(pre.fabricates_capability, false);
  assert.equal(pre.reasoning_mode, 'DETERMINISTIC_CODE_NOT_LIVE_MODEL_CALL');

  const post = jarvisAstraPostManifestV1();
  assert.equal(post.duplicates_bridge_evidence_computation, false);
  assert.equal(post.trusts_worker_self_report, false);

  const supervised = jarvisAstraSupervisedMissionManifestV1();
  assert.equal(supervised.calls_acceptance_itself, false);
  assert.equal(supervised.reaches_verify_and_accept_itself, false);
  assert.equal(supervised.second_dispatch_path, false);
});

console.log(JSON.stringify({
  schema: 'aurentara.jarvis.astra-review.smoke.v1',
  passed,
  live_claude_cli_invoked: false,
  live_bridge_network_call: false,
  acceptance_ever_called: false
}, null, 2));
