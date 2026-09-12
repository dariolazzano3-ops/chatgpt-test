import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  computeJarvisCommitRangeEvidenceV1,
  jarvisCommitRangeEvidenceManifestV1,
  JARVIS_COMMIT_RANGE_VERIFICATION_SCHEMA
} from '../src/jarvis/commit-range-evidence-v1.js';

const BRANCH = 'factory/fixture-branch';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }

function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-commit-range-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', 'main']); // deterministic protected-branch name regardless of git's default
  git(dir, ['checkout', '-q', '-b', BRANCH]);
  return dir;
}

function commitFile(dir, relPath, content, message) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  git(dir, ['add', relPath]);
  git(dir, ['commit', '-q', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']);
}

// ── 1. Happy path: real commit, exactly the expected file, required checks genuinely run and pass ──
{
  const repo = makeFixtureRepo();
  const sha = commitFile(repo, 'src/thing.js', 'module.exports = 1;\n', 'add thing');
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha,
    expected_files: ['src/thing.js'],
    required_checks: [{ command: 'node', args: ['-e', 'process.exit(0)'] }]
  });
  assert.equal(evidence.sufficient, true, JSON.stringify(evidence));
  assert.equal(evidence.schema, JARVIS_COMMIT_RANGE_VERIFICATION_SCHEMA);
  assert.deepEqual(evidence.files_changed, ['src/thing.js']);
  assert.equal(evidence.commit, sha);
  assert.equal(evidence.check_results.length, 1);
  assert.equal(evidence.check_results[0].passed, true);
}

// ── 2. An empty-diff commit (--allow-empty) is structurally refused — this is
//    the exact "prevent an empty dispatch with no historical diff" guarantee ──
{
  const repo = makeFixtureRepo();
  git(repo, ['commit', '-q', '--allow-empty', '-m', 'empty']);
  const sha = git(repo, ['rev-parse', 'HEAD']);
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: ['src/thing.js']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'NO_HISTORICAL_FILES_CHANGED');
}

// ── 3. A commit touching a file outside expected_files is refused, even
//    though it also touches an expected one ──
{
  const repo = makeFixtureRepo();
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/thing.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(repo, 'unexpected.js'), '// sneaky\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'mixed']);
  const sha = git(repo, ['rev-parse', 'HEAD']);
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: ['src/thing.js']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'UNEXPECTED_FILES_IN_COMMIT');
  assert.deepEqual(evidence.unexpected_files, ['unexpected.js']);
}

// ── 4. Forbidden external-effect pattern in an ADDED line is refused ──
{
  const repo = makeFixtureRepo();
  const sha = commitFile(repo, 'deploy.sh', '#!/bin/bash\nwrangler deploy --env production\n', 'sneaky deploy');
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: ['deploy.sh']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'FORBIDDEN_PATTERN_IN_COMMIT_DIFF');
}

// ── 4a2. The SAME forbidden text inside a declared generated_files path is
//    exempt from the content scan (minified build output is not meaningfully
//    reviewable line-by-line) — but ONLY for that path; a sibling
//    non-generated file with the same content in the same commit is still
//    flagged, and the generated file still has to be a real, expected part
//    of the diff (this is not a way to sneak an unlisted file through). ──
{
  const repo = makeFixtureRepo();
  fs.mkdirSync(path.join(repo, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'dist/bundle.js'), '// minified: wrangler deploy --env production\n');
  fs.writeFileSync(path.join(repo, 'src/real.js'), 'export const ok = 1;\n');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-q', '-m', 'build output + real change']);
  const sha = git(repo, ['rev-parse', 'HEAD']);

  const exempt = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha,
    expected_files: ['dist/bundle.js', 'src/real.js'], generated_files: ['dist/bundle.js']
  });
  assert.equal(exempt.sufficient, true, JSON.stringify(exempt));
  assert.deepEqual(exempt.generated_files, ['dist/bundle.js']);

  // Same commit, but dist/bundle.js is NOT declared generated this time -> flagged.
  const notExempt = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha,
    expected_files: ['dist/bundle.js', 'src/real.js'], generated_files: []
  });
  assert.equal(notExempt.sufficient, false);
  assert.equal(notExempt.reason, 'FORBIDDEN_PATTERN_IN_COMMIT_DIFF');
}

// ── 4b. The codebase's own pervasive `hamyren_..._data_flow: false` /
//    `hamyren_tables_referenced: false` compliance fields must NEVER false-
//    positive this scan — only a genuine (non-"...: false") hamyren mention does ──
{
  const repo = makeFixtureRepo();
  const compliant = commitFile(repo, 'src/manifest.js', "export function m() { return { hamyren_data_flow: false, hamyren_tables_referenced: false }; }\n", 'compliant manifest');
  const okEvidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: compliant, expected_files: ['src/manifest.js']
  });
  assert.equal(okEvidence.sufficient, true, JSON.stringify(okEvidence));

  const badSha = commitFile(repo, 'src/leak.js', "export const flow = 'hamyren_pipeline_enabled';\n", 'genuine hamyren reference');
  const badEvidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: badSha, expected_files: ['src/leak.js']
  });
  assert.equal(badEvidence.sufficient, false);
  assert.equal(badEvidence.reason, 'FORBIDDEN_PATTERN_IN_COMMIT_DIFF');
}

// ── 5. Wrong branch is refused ──
{
  const repo = makeFixtureRepo();
  const sha = commitFile(repo, 'src/thing.js', 'x', 'x');
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: 'factory/some-other-branch', commit_sha: sha, expected_files: ['src/thing.js']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'NOT_ON_TARGET_BRANCH');
}

// ── 5b. Protected branch (main) is refused outright ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', 'main']);
  const sha = git(repo, ['rev-parse', 'HEAD']);
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: 'main', commit_sha: sha, expected_files: ['README.md']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'TARGET_BRANCH_PROTECTED');
}

// ── 6. Dirty tracked working tree is refused, untracked debris is not
//    (reuses branch-manager-v1.js's own "ignore untracked debris" rule) ──
{
  const repo = makeFixtureRepo();
  const sha = commitFile(repo, 'src/thing.js', 'x', 'x');
  fs.writeFileSync(path.join(repo, 'README.md'), '# locally modified, uncommitted\n');
  const dirtyEvidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: ['src/thing.js']
  });
  assert.equal(dirtyEvidence.sufficient, false);
  assert.equal(dirtyEvidence.reason, 'WORKING_TREE_DIRTY');

  git(repo, ['checkout', '--', 'README.md']);
  fs.writeFileSync(path.join(repo, 'untracked-debris.txt'), 'debris\n');
  const cleanEvidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: ['src/thing.js']
  });
  assert.equal(cleanEvidence.sufficient, true, JSON.stringify(cleanEvidence));
}

// ── 7. A commit not reachable from the target branch's HEAD is refused ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'factory/side-branch']);
  const sideSha = commitFile(repo, 'src/side.js', 'x', 'side work');
  git(repo, ['checkout', '-q', BRANCH]);
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sideSha, expected_files: ['src/side.js']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'COMMIT_NOT_ANCESTOR_OF_HEAD');
}

// ── 8. A nonexistent commit sha is refused ──
{
  const repo = makeFixtureRepo();
  commitFile(repo, 'src/thing.js', 'x', 'x');
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', expected_files: ['src/thing.js']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'COMMIT_NOT_FOUND');
}

// ── 9. A merge commit (ambiguous diff) is refused, never guessed ──
{
  const repo = makeFixtureRepo();
  commitFile(repo, 'src/base.js', 'x', 'base work');
  git(repo, ['checkout', '-q', '-b', 'factory/merge-side']);
  commitFile(repo, 'src/side.js', 'y', 'side work');
  git(repo, ['checkout', '-q', BRANCH]);
  git(repo, ['merge', '-q', '--no-ff', '-m', 'merge side', 'factory/merge-side']);
  const mergeSha = git(repo, ['rev-parse', 'HEAD']);
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: mergeSha, expected_files: ['src/side.js']
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'COMMIT_MUST_HAVE_EXACTLY_ONE_PARENT');
  assert.equal(evidence.parent_count, 2);
}

// ── 10. A required check that genuinely fails is refused — never trusted from a claim ──
{
  const repo = makeFixtureRepo();
  const sha = commitFile(repo, 'src/thing.js', 'x', 'x');
  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: ['src/thing.js'],
    required_checks: [{ command: 'node', args: ['-e', 'process.exit(1)'] }]
  });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'REQUIRED_CHECK_FAILED');
  assert.equal(evidence.check_results[0].passed, false);
}

// ── 11. No expected_files configured for the wave -> refused, never treated as "anything goes" ──
{
  const repo = makeFixtureRepo();
  const sha = commitFile(repo, 'src/thing.js', 'x', 'x');
  const evidence = computeJarvisCommitRangeEvidenceV1({ repo_dir: repo, target_branch: BRANCH, commit_sha: sha, expected_files: [] });
  assert.equal(evidence.sufficient, false);
  assert.equal(evidence.reason, 'NO_EXPECTED_FILES_FOR_WAVE');
}

// ── 12. Manifest ──
{
  const manifest = jarvisCommitRangeEvidenceManifestV1();
  assert.equal(manifest.admits_empty_commit_diff, false);
  assert.equal(manifest.admits_files_outside_expected_set, false);
  assert.equal(manifest.admits_merge_commits, false);
  assert.equal(manifest.trusts_worker_or_caller_self_report, false);
  assert.equal(manifest.runs_required_checks_itself, true);
  assert.equal(manifest.mutates_repo, false);
  assert.equal(manifest.generated_files_exempt_from_content_scan_only, true);
  assert.equal(manifest.generated_files_still_subject_to_expected_files_check, true);
}

console.log('JARVIS Commit-Range Evidence V1 smoke: PASS');
