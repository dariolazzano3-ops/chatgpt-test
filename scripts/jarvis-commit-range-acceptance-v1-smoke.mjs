import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';
import { handleJarvisProgramApprovalGrantRuntimeV1 } from '../src/jarvis/program-approval-v1.js';
import { getJarvisWaveRegistryEntryV1, JARVIS_WAVE_REGISTRY_PROGRAM } from '../src/jarvis/wave-registry-v1.js';
import { computeJarvisCommitRangeEvidenceV1 } from '../src/jarvis/commit-range-evidence-v1.js';
import {
  handleJarvisCommitRangeAcceptanceRuntimeV1,
  jarvisCommitRangeAcceptanceManifestV1
} from '../src/jarvis/commit-range-acceptance-v1.js';
import { createJarvisCommandCenterReadBindingsV1 } from '../src/jarvis/command-center-read-bindings-v1.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_REF = 'jarvis:operator:op@example.invalid';
const PROGRAM = JARVIS_WAVE_REGISTRY_PROGRAM;
const BRANCH = 'factory/fixture-branch';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }

function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-commit-range-acceptance-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', 'main']);
  git(dir, ['checkout', '-q', '-b', BRANCH]);
  return dir;
}

// Wave 0's registry entry has NO required_checks (a doc-only wave), so it is
// the one entry a throwaway fixture repo can genuinely satisfy end-to-end —
// wave 1's required_checks name real project script paths that only exist
// in the real repo (exercised directly against the real repo in Part B
// below, read-only, never persisted from this test).
const WAVE0 = getJarvisWaveRegistryEntryV1(PROGRAM, 0);

async function grantAcceptance(store, repoDir, targetBranch) {
  const grant = await handleJarvisProgramApprovalGrantRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repoDir, target_branch: targetBranch,
    scope: ['ACCEPTANCE'], confirm_scope: true
  }, { memory_store: store });
  assert.equal(grant.ok, true);
}

/* ── Part A: the acceptance handler, generic path, wave 0 + a fixture repo ── */

// ── 1. Refused without Program Approval covering ACCEPTANCE ──
{
  const repo = makeFixtureRepo();
  fs.mkdirSync(path.join(repo, path.dirname(WAVE0.expected_files[0])), { recursive: true });
  fs.writeFileSync(path.join(repo, WAVE0.expected_files[0]), 'contract text\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'wave 0 contract']);
  const sha = git(repo, ['rev-parse', 'HEAD']);

  const store = createMemoryJarvisStoreV1();
  const result = await handleJarvisCommitRangeAcceptanceRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: BRANCH,
    wave_index: 0, commit_sha: sha
  }, { memory_store: store });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'JARVIS_COMMIT_RANGE_ACCEPTANCE_NOT_COVERED_BY_PROGRAM_APPROVAL');
  assert.equal(result.accepted, false);
}

// ── 2. Refused when the commit's evidence is insufficient (unregistered wave) ──
{
  const repo = makeFixtureRepo();
  const store = createMemoryJarvisStoreV1();
  await grantAcceptance(store, repo, BRANCH);
  fs.writeFileSync(path.join(repo, 'x.txt'), 'x\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'x']);
  const sha = git(repo, ['rev-parse', 'HEAD']);

  const result = await handleJarvisCommitRangeAcceptanceRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: BRANCH,
    wave_index: 7, commit_sha: sha // wave 7 is not registered
  }, { memory_store: store });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'JARVIS_COMMIT_RANGE_ACCEPTANCE_WAVE_NOT_REGISTERED');
}

// ── 3. Full real acceptance: Program Approval granted, real commit matching Wave 0's expected_files, no required_checks ──
{
  const repo = makeFixtureRepo();
  const store = createMemoryJarvisStoreV1();
  await grantAcceptance(store, repo, BRANCH);

  fs.mkdirSync(path.join(repo, path.dirname(WAVE0.expected_files[0])), { recursive: true });
  fs.writeFileSync(path.join(repo, WAVE0.expected_files[0]), 'contract text\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'wave 0 contract']);
  const sha = git(repo, ['rev-parse', 'HEAD']);

  const result = await handleJarvisCommitRangeAcceptanceRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: BRANCH,
    wave_index: 0, commit_sha: sha
  }, { memory_store: store });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.accepted, true);
  assert.equal(result.acceptance_ref, `commit-range:${sha}`);
  assert.equal(result.wave_state, 'COMPLETE');

  // v2-progress-v1.js (via the SAME read bindings the real program state
  // endpoint uses) must now genuinely count Wave 0's weight — no change was
  // made to v2-progress-v1.js or command-center-read-bindings-v1.js for
  // this to work; the audit row shape already matches what they expect.
  const bindings = createJarvisCommandCenterReadBindingsV1({ store, owner_id: OWNER_ID, owner_ref: OWNER_REF });
  const progress = await bindings.v2_progress();
  assert.deepEqual(progress.data.completed_waves, [0]);
  assert.equal(progress.data.verified_progress_percent, 5);

  // ── 4. Idempotent: a second call against the same wave never grants a duplicate ──
  const again = await handleJarvisCommitRangeAcceptanceRuntimeV1({
    owner_id: OWNER_ID, owner_ref: OWNER_REF, program: PROGRAM, repo_dir: repo, target_branch: BRANCH,
    wave_index: 0, commit_sha: sha
  }, { memory_store: store });
  assert.equal(again.ok, true);
  assert.equal(again.accepted, false);
  assert.equal(again.duplicate_acceptance_guard, 'ALREADY_ACCEPTED');
}

/* ── Part B: real, read-only sanity check of the ACTUAL registered waves'
      evidence against the real project repo — never persisted from here.
      Confirms wave-registry-v1.js's expected_files/required_checks for each
      registered wave are actually satisfied by its real, pinned commit
      before the real, one-time acceptance is ever run. ── */
{
  const repoRoot = path.resolve(new URL('../', import.meta.url).pathname);
  const realBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot }).toString('utf8').trim();
  const PINNED_WAVE_COMMITS = [
    { wave_index: 1, commit_sha: '70ab85c05e8b4e78c118e897bb15372a7ba30b0f' },
    { wave_index: 2, commit_sha: 'be87a8e0034ab3172f6d2307f802a9c61f5d8ad7' }
  ];

  for (const { wave_index, commit_sha } of PINNED_WAVE_COMMITS) {
    const entry = getJarvisWaveRegistryEntryV1(PROGRAM, wave_index);
    let commitKnown = true;
    try { execFileSync('git', ['cat-file', '-e', commit_sha + '^{commit}'], { cwd: repoRoot, stdio: 'ignore' }); }
    catch { commitKnown = false; }

    if (commitKnown) {
      const evidence = computeJarvisCommitRangeEvidenceV1({
        repo_dir: repoRoot, target_branch: realBranch, commit_sha,
        expected_files: entry.expected_files, required_checks: entry.required_checks, generated_files: entry.generated_files
      });
      assert.equal(evidence.sufficient, true, `Wave ${wave_index}'s real registry entry is not currently satisfiable: ${JSON.stringify(evidence, null, 2)}`);
      console.log(`Part B: real Wave ${wave_index} commit-range evidence is sufficient (commit=${evidence.commit}, files=${evidence.files_changed.join(', ')})`);
    } else {
      console.log(`Part B: skipped for Wave ${wave_index} — the pinned commit is not present in this checkout's history.`);
    }
  }
}

// ── Manifest ──
{
  const manifest = jarvisCommitRangeAcceptanceManifestV1();
  assert.equal(manifest.acceptance_without_program_approval_ever, false);
  assert.equal(manifest.acceptance_is_worker_self_report, false);
  assert.equal(manifest.duplicate_acceptance_guarded, true);
  assert.equal(manifest.expected_files_and_required_checks_caller_suppliable, false);
  assert.equal(manifest.grants_own_program_approval, false);
}

console.log('JARVIS Commit-Range Acceptance V1 smoke: PASS');
