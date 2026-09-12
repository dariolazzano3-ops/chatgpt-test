import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  evaluateJarvisBranchTruthV1,
  prepareJarvisTargetBranchV1,
  jarvisBranchManagerManifestV1,
  JARVIS_PROTECTED_BRANCHES
} from '../src/jarvis/branch-manager-v1.js';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-branch-manager-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', 'main']);
  return dir;
}

// ── 1. Protected target branch is refused outright, even with a clean tree ──
{
  const repo = makeFixtureRepo();
  const truth = evaluateJarvisBranchTruthV1({ repo_dir: repo, target_branch: 'main', base_ref: 'main' });
  assert.equal(truth.target_branch_protected, true);
  assert.equal(truth.safe_to_prepare, false);
  const prep = prepareJarvisTargetBranchV1({ repo_dir: repo, target_branch: 'main', base_ref: 'main' });
  assert.equal(prep.ok, false);
  assert.equal(prep.error, 'TARGET_BRANCH_PROTECTED');
}
{
  const truth = evaluateJarvisBranchTruthV1({ repo_dir: '/tmp/nonexistent-repo-dir-xyz', target_branch: 'master' });
  assert.equal(truth.target_branch_protected, true, 'master is protected regardless of repo state');
}

// ── 2. A dirty working tree refuses preparation, even for a safe target ──
{
  const repo = makeFixtureRepo();
  fs.writeFileSync(path.join(repo, 'README.md'), '# locally modified\n');
  const prep = prepareJarvisTargetBranchV1({ repo_dir: repo, target_branch: 'feature/x', base_ref: 'main' });
  assert.equal(prep.ok, false);
  assert.equal(prep.error, 'WORKING_TREE_DIRTY');
}

// ── 3. Target branch does not exist -> created fresh from base_ref, nothing destroyed ──
{
  const repo = makeFixtureRepo();
  const prep = prepareJarvisTargetBranchV1({ repo_dir: repo, target_branch: 'factory/jarvis-masterarchitecture-v2', base_ref: 'main' });
  assert.equal(prep.ok, true);
  assert.deepEqual(prep.actions, ['CREATED_FROM:main']);
  assert.equal(prep.truth.current_branch, 'factory/jarvis-masterarchitecture-v2');
  assert.equal(git(repo, ['rev-parse', 'HEAD']), git(repo, ['rev-parse', 'main']), 'new branch starts exactly at base_ref');
}

// ── 4. Target exists, no unique work relative to base_ref -> fast-forward-aligned, not recreated ──
{
  const repo = makeFixtureRepo();
  git(repo, ['branch', 'factory/jarvis-masterarchitecture-v2']); // exists, identical to main, no unique work
  fs.writeFileSync(path.join(repo, 'second.md'), '# second\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'advance main further']);
  const truth = evaluateJarvisBranchTruthV1({ repo_dir: repo, target_branch: 'factory/jarvis-masterarchitecture-v2', base_ref: 'main' });
  assert.equal(truth.has_unique_work, false);
  const prep = prepareJarvisTargetBranchV1({ repo_dir: repo, target_branch: 'factory/jarvis-masterarchitecture-v2', base_ref: 'main' });
  assert.equal(prep.ok, true);
  assert.deepEqual(prep.actions, ['FAST_FORWARD_ALIGNED_TO:main']);
  assert.equal(git(repo, ['rev-parse', 'HEAD']), git(repo, ['rev-parse', 'main']));
}

// ── 5. Target exists WITH unique work -> only checked out, never reset/destroyed ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'factory/jarvis-masterarchitecture-v2']);
  fs.writeFileSync(path.join(repo, 'unique.md'), '# unique work\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'unique commit on the feature branch']);
  git(repo, ['checkout', '-q', 'main']);
  const uniqueHeadBefore = git(repo, ['rev-parse', 'factory/jarvis-masterarchitecture-v2']);

  const truth = evaluateJarvisBranchTruthV1({ repo_dir: repo, target_branch: 'factory/jarvis-masterarchitecture-v2', base_ref: 'main' });
  assert.equal(truth.has_unique_work, true);

  const prep = prepareJarvisTargetBranchV1({ repo_dir: repo, target_branch: 'factory/jarvis-masterarchitecture-v2', base_ref: 'main' });
  assert.equal(prep.ok, true);
  assert.deepEqual(prep.actions, ['CHECKED_OUT_EXISTING_WITH_UNIQUE_WORK']);
  assert.equal(git(repo, ['rev-parse', 'factory/jarvis-masterarchitecture-v2']), uniqueHeadBefore, 'the unique commit is untouched');
}

// ── 6. No remote configured -> remote truth fails closed to unbound, never fabricated ──
{
  const repo = makeFixtureRepo();
  const truth = evaluateJarvisBranchTruthV1({ repo_dir: repo, target_branch: 'feature/y', base_ref: 'main' });
  assert.equal(truth.remote_truth_bound, false);
  assert.equal(truth.target_exists_on_remote, false);
  assert.equal(truth.remote_target_head, null);
  assert.equal(truth.ahead, null);
  assert.equal(truth.behind, null);
}

// ── 7. Manifest / safety invariants ──
{
  const man = jarvisBranchManagerManifestV1();
  assert.deepEqual(man.protected_branches, ['main', 'master']);
  assert.equal(man.can_touch_main_master, false);
  assert.equal(man.can_force_push, false);
  assert.equal(man.can_merge_non_ff, false);
  assert.equal(man.can_push, false);
  assert.equal(man.can_destroy_unique_work, false);
  assert.deepEqual(JARVIS_PROTECTED_BRANCHES, ['main', 'master']);
  const src = fs.readFileSync('src/jarvis/branch-manager-v1.js', 'utf8');
  assert.doesNotMatch(src, /['"]push['"]/, 'no push subcommand literal anywhere');
  assert.doesNotMatch(src, /--force\b/, 'no force flag anywhere in the module');
}

console.log('JARVIS Branch Manager V1 smoke: PASS');
