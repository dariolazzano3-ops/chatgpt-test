import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ensureJarvisOwnerWorkspaceGitIndexAccessV1,
  jarvisOwnerWorkspaceGitIndexAccessManifestV1
} from '../src/jarvis/owner-workspace-git-index-access-v1.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-owner-index-access-'));
const git = (args) => execFileSync('git', args, { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();

try {
  git(['init', '-q']);
  git(['config', 'user.email', 'smoke@example.invalid']);
  git(['config', 'user.name', 'JARVIS Smoke']);
  fs.writeFileSync(path.join(tmp, 'README.md'), 'fixture\n');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'fixture']);

  const indexPath = path.join(tmp, '.git', 'index');
  const gid = process.getgid();
  fs.chmodSync(indexPath, 0o600);
  try { git(['config', '--unset-all', 'core.sharedRepository']); } catch {}

  const before = fs.statSync(indexPath);
  assert.equal(before.mode & 0o040, 0, 'fixture must start without group-read');

  const repaired = ensureJarvisOwnerWorkspaceGitIndexAccessV1({
    repo_dir: tmp,
    worker_gid: gid
  });
  assert.equal(repaired.ok, true);
  assert.equal(repaired.repaired, true);
  assert.equal(repaired.working_tree_content_changed, false);
  assert.equal((fs.statSync(indexPath).mode & 0o040) !== 0, true);
  assert.equal(git(['config', '--get', 'core.sharedRepository']), 'group');
  assert.equal(git(['status', '--porcelain']), '');

  const second = ensureJarvisOwnerWorkspaceGitIndexAccessV1({
    repo_dir: tmp,
    worker_gid: gid
  });
  assert.equal(second.ok, true);
  assert.equal(second.repaired, false, 'second pass must be idempotent');

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = git(['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(tmp, 'README.md'), 'candidate change\n');
  const candidateDiff = git(['diff', '--no-ext-diff', '--unified=3', 'HEAD', '--']);
  const candidate = {
    schema: 'aurentara.jarvis.owner-failed-candidate-provenance.v1',
    source_request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    branch,
    head,
    files: ['README.md'],
    diff: candidateDiff,
    post_status: ['M README.md']
  };
  const recovered = ensureJarvisOwnerWorkspaceGitIndexAccessV1({
    repo_dir: tmp,
    worker_gid: gid,
    recover_failed_candidate: candidate
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.failed_candidate_recovered, true);
  assert.equal(recovered.failed_candidate_source_request_id, candidate.source_request_id);
  assert.deepEqual(recovered.failed_candidate_files, ['README.md']);
  assert.equal(git(['status', '--porcelain']), '');
  assert.equal(fs.readFileSync(path.join(tmp, 'README.md'), 'utf8'), 'fixture\n');

  fs.writeFileSync(path.join(tmp, 'README.md'), 'different unproven change\n');
  const beforeMismatch = fs.readFileSync(path.join(tmp, 'README.md'), 'utf8');
  const mismatch = ensureJarvisOwnerWorkspaceGitIndexAccessV1({
    repo_dir: tmp,
    worker_gid: gid,
    recover_failed_candidate: { ...candidate, diff: candidate.diff + '\nnot-the-current-diff' }
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error, 'OWNER_WORKSPACE_FAILED_CANDIDATE_DIFF_MISMATCH');
  assert.equal(fs.readFileSync(path.join(tmp, 'README.md'), 'utf8'), beforeMismatch,
    'mismatched provenance must not alter workspace content');
  execFileSync('git', ['restore', '--source=HEAD', '--worktree', '--', 'README.md'], { cwd: tmp });

  fs.writeFileSync(path.join(tmp, '.git', 'index.lock'), 'active lock');
  const locked = ensureJarvisOwnerWorkspaceGitIndexAccessV1({
    repo_dir: tmp,
    worker_gid: gid
  });
  assert.equal(locked.ok, false);
  assert.equal(locked.error, 'OWNER_WORKSPACE_GIT_INDEX_LOCK_PRESENT');
  fs.unlinkSync(path.join(tmp, '.git', 'index.lock'));

  const man = jarvisOwnerWorkspaceGitIndexAccessManifestV1();
  assert.equal(man.arbitrary_working_tree_content_changes, false);
  assert.equal(man.failed_candidate_restore_supported, true);
  assert.equal(man.failed_candidate_restore_requires_exact_branch_head_files_and_diff, true);
  assert.equal(man.failed_candidate_restore_refuses_staged_or_untracked_state, true);
  assert.equal(man.refuses_index_lock, true);
  assert.equal(man.fail_closed, true);
  assert.equal(man.default_worker_gid, 11000);

  console.log('JARVIS Owner Workspace Git Index Access V1 smoke: PASS');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
