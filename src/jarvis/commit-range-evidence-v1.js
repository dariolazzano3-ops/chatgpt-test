/* JARVIS — Commit-Range Evidence V1.

   Independent, historical-commit-based verification evidence for engineering
   work that was implemented and committed BEFORE a live repo-bound dispatch
   could ever observe it as a file-system diff. claude-code-repo-bound-
   executor-v1.js's before/after `git status` diff is structurally blind to
   work already committed prior to the dispatch it wraps — dispatching again
   correctly reports `files_changed: []` (there is genuinely nothing left
   uncommitted to diff), which is NOT the same thing as "no evidence the work
   happened". This module supplies the missing evidence type for exactly
   that situation, without weakening what live-dispatch evidence requires.

   This is NOT a looser acceptance path. It replaces "diff a live dispatch's
   working-tree changes" with "diff one real, already-existing commit against
   its own parent" — every fact below is computed by trusted code via real
   `git`/child-process calls, never asserted by a worker or by whoever
   requests acceptance. Structurally, it can never admit:
     - a commit that isn't real (git itself must resolve it);
     - a commit not actually reachable from the target branch's current HEAD
       (git merge-base --is-ancestor);
     - a merge commit (ambiguous which side is "the change" — refused, not
       guessed);
     - a commit with an EMPTY diff from its own parent — this is what makes
       "an empty dispatch with no historical diff" structurally inadmissible;
     - a commit that touches ANY file outside the wave's own
       `expected_files` (wave-registry-v1.js) — evidence is scoped to
       exactly the reviewed file set, never "whatever else happened to be in
       that commit";
     - a commit whose ADDED diff lines contain a forbidden external-effect
       pattern (deploy, force push, merge, destructive SQL, a genuine HAMYREN
       reference — but never a false positive on this codebase's own
       pervasive `..._data_flow: false` / `..._referenced: false` compliance
       fields, which are deliberately excluded from the scan);
     - a branch other than the wave's own `target_branch`, a protected
       branch, or a dirty (tracked-file) working tree at evaluation time
       (reuses branch-manager-v1.js's evaluateJarvisBranchTruthV1 — the same
       trusted git-truth check every other V2 evidence path already uses,
       including its existing "ignore untracked debris" rule);
     - a wave whose required checks (e.g. its own smoke tests) do not
       genuinely pass RIGHT NOW — executed here, in trusted code; a caller's
       claim that "tests pass" is never sufficient on its own.

   Node-only (uses node:child_process for real git/command invocations) —
   same import-direction rule as program-controller-v1.js and the other
   Node-only V2 modules: never imported by http-v1.js, standalone-worker-
   v1.js, pages-worker-v1.js, or any other deployed-Worker entrypoint. */

import { execFileSync } from 'node:child_process';
import { evaluateJarvisBranchTruthV1 } from './branch-manager-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const SHA_RE = /^[0-9a-f]{7,40}$/i;
const ADDED_LINE_RE = /^\+(?!\+\+)/;

// Same forbidden-external-effect class already checked elsewhere in this
// codebase (jarvis-engineering-mission-v1-smoke.mjs, jarvis-live-binding-v1-
// safety-regression-smoke.mjs, jarvis-command-center-wave8-audit-smoke.mjs),
// applied here to the commit's own ADDED diff lines rather than to whole
// source files.
const FORBIDDEN_DIFF_PATTERN = /wrangler\s+deploy|DROP\s+TABLE|TRUNCATE\s|rm\s+-rf|git\s+push|git\s+merge|--force\b/i;
// This codebase's own manifests routinely declare
// `hamyren_data_flow: false` / `hamyren_tables_referenced: false` etc. as a
// COMPLIANCE assertion — that is the opposite of a violation and must never
// trip this scan. Only a "hamyren" mention that is NOT one of these
// declared-false compliance fields counts as a hit.
const HAMYREN_COMPLIANCE_RE = /hamyren[a-z_]*\s*:\s*false/i;

export const JARVIS_COMMIT_RANGE_VERIFICATION_SCHEMA = 'aurentara.jarvis.commit-range-verification.v1';

function git(repoDir, args) {
  return execFileSync('git', args, { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

/** Scans only ADDED lines (the commit's own new content) for a forbidden
 *  external-effect pattern, or a genuine (non-compliance-assertion)
 *  "hamyren" mention. Returns the offending lines, trimmed, or []. */
function scanAddedLinesForForbiddenPatternsV1(diffText) {
  const hits = [];
  for (const rawLine of clean(diffText, 2_000_000).split('\n')) {
    if (!ADDED_LINE_RE.test(rawLine)) continue;
    const line = rawLine.slice(1);
    if (FORBIDDEN_DIFF_PATTERN.test(line)) { hits.push(line.trim().slice(0, 300)); continue; }
    if (/hamyren/i.test(line) && !HAMYREN_COMPLIANCE_RE.test(line)) hits.push(line.trim().slice(0, 300));
  }
  return hits;
}

/** Real, trusted execution of one required check command (e.g. a wave's own
 *  smoke test) inside repoDir. Never trusts a claim that it passed — runs
 *  it, right now, and reports the real exit code. */
function runRequiredCheckV1(repoDir, check = {}) {
  const command = clean(check.command, 200) || 'node';
  const args = Array.isArray(check.args) ? check.args.map((a) => clean(a, 400)) : [];
  const label = [command, ...args].join(' ');
  const startedAt = Date.now();
  try {
    execFileSync(command, args, { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    return { command: label, passed: true, exit_code: 0, duration_ms: Date.now() - startedAt };
  } catch (error) {
    return {
      command: label,
      passed: false,
      exit_code: typeof error?.status === 'number' ? error.status : null,
      duration_ms: Date.now() - startedAt,
      error: clean(error?.message, 300)
    };
  }
}

/** Node-only, trusted. Computes independent evidence for ONE already-
 *  committed, already-reachable commit. Read-only: never mutates the repo.
 *  `required_checks` are [{command, args}] — commands actually executed
 *  here, e.g. `{ command: 'node', args: ['scripts/jarvis-wave-registry-v1-
 *  smoke.mjs'] }`. */
export function computeJarvisCommitRangeEvidenceV1({
  repo_dir, target_branch, commit_sha, expected_files = [], required_checks = []
} = {}) {
  const repoDir = clean(repo_dir, 400);
  const branch = clean(target_branch, 200);
  const sha = clean(commit_sha, 80);
  const allowed = new Set((Array.isArray(expected_files) ? expected_files : []).map((f) => clean(f, 400)).filter(Boolean));
  const at = new Date().toISOString();

  if (!repoDir || !branch) return { sufficient: false, reason: 'REPO_DIR_OR_TARGET_BRANCH_REQUIRED', at };
  if (!SHA_RE.test(sha)) return { sufficient: false, reason: 'COMMIT_SHA_INVALID', at };
  if (!allowed.size) return { sufficient: false, reason: 'NO_EXPECTED_FILES_FOR_WAVE', at };

  // 1. Real, live branch/working-tree truth — the SAME trusted check every
  // other V2 evidence path uses (never a looser, ad-hoc git status call).
  const branchTruth = evaluateJarvisBranchTruthV1({ repo_dir: repoDir, target_branch: branch, base_ref: 'HEAD' });
  if (!branchTruth.is_git_repo) return { sufficient: false, reason: 'NOT_A_GIT_REPO', branch_truth: branchTruth, at };
  if (branchTruth.target_branch_protected) return { sufficient: false, reason: 'TARGET_BRANCH_PROTECTED', branch_truth: branchTruth, at };
  if (branchTruth.current_branch !== branch) return { sufficient: false, reason: 'NOT_ON_TARGET_BRANCH', branch_truth: branchTruth, at };
  if (branchTruth.working_tree_clean !== true) return { sufficient: false, reason: 'WORKING_TREE_DIRTY', branch_truth: branchTruth, at };

  // 2. The commit must be real and genuinely reachable from this exact
  // branch's current HEAD — never a commit on some other branch, a
  // dangling/unreachable object, or one the caller merely asserts exists.
  try { git(repoDir, ['cat-file', '-e', sha + '^{commit}']); } catch {
    return { sufficient: false, reason: 'COMMIT_NOT_FOUND', commit: sha, at };
  }
  try { git(repoDir, ['merge-base', '--is-ancestor', sha, 'HEAD']); } catch {
    return { sufficient: false, reason: 'COMMIT_NOT_ANCESTOR_OF_HEAD', commit: sha, at };
  }

  // 3. Exactly one parent required — a merge commit's diff is ambiguous
  // (which side is "the change"?), so it is never admissible here.
  let parents;
  try { parents = git(repoDir, ['show', '-s', '--format=%P', sha]).trim().split(/\s+/).filter(Boolean); } catch {
    return { sufficient: false, reason: 'COMMIT_PARENT_LOOKUP_FAILED', commit: sha, at };
  }
  if (parents.length !== 1) {
    return { sufficient: false, reason: 'COMMIT_MUST_HAVE_EXACTLY_ONE_PARENT', parent_count: parents.length, commit: sha, at };
  }
  const parentSha = parents[0];

  // 4. The commit's OWN diff, from its own parent — real, trusted,
  // independent of any live working tree. Empty is refused outright: this
  // is what makes "an empty dispatch with no historical diff" structurally
  // inadmissible.
  let filesChanged;
  try {
    filesChanged = git(repoDir, ['diff', '--name-only', parentSha, sha]).split('\n').map((f) => f.trim()).filter(Boolean);
  } catch {
    return { sufficient: false, reason: 'COMMIT_DIFF_LOOKUP_FAILED', commit: sha, parent_commit: parentSha, at };
  }
  if (!filesChanged.length) {
    return { sufficient: false, reason: 'NO_HISTORICAL_FILES_CHANGED', commit: sha, parent_commit: parentSha, at };
  }

  const unexpected = filesChanged.filter((f) => !allowed.has(f));
  if (unexpected.length) {
    return {
      sufficient: false, reason: 'UNEXPECTED_FILES_IN_COMMIT', unexpected_files: unexpected,
      files_changed: filesChanged, commit: sha, parent_commit: parentSha, at
    };
  }

  // 5. Forbidden-external-effect scan of the commit's own ADDED diff text.
  let diffText;
  try { diffText = git(repoDir, ['diff', parentSha, sha]); } catch {
    return { sufficient: false, reason: 'COMMIT_DIFF_TEXT_FAILED', commit: sha, parent_commit: parentSha, at };
  }
  const forbiddenHits = scanAddedLinesForForbiddenPatternsV1(diffText);
  if (forbiddenHits.length) {
    return {
      sufficient: false, reason: 'FORBIDDEN_PATTERN_IN_COMMIT_DIFF', forbidden_hits: forbiddenHits,
      commit: sha, parent_commit: parentSha, at
    };
  }

  // 6. Required checks (e.g. the wave's own smoke tests) — executed here,
  // for real, right now. A worker's or caller's claim that "tests pass" is
  // never sufficient; this bundle exists specifically so it never has to be.
  const checkResults = (Array.isArray(required_checks) ? required_checks : []).map((check) => runRequiredCheckV1(repoDir, check));
  const failedChecks = checkResults.filter((c) => !c.passed);
  if (failedChecks.length) {
    return {
      sufficient: false, reason: 'REQUIRED_CHECK_FAILED', failed_checks: failedChecks.map((c) => c.command),
      check_results: checkResults, commit: sha, parent_commit: parentSha, at
    };
  }

  return {
    sufficient: true,
    reason: null,
    schema: JARVIS_COMMIT_RANGE_VERIFICATION_SCHEMA,
    repo_dir: repoDir,
    branch,
    commit: sha,
    parent_commit: parentSha,
    files_changed: filesChanged,
    expected_files: [...allowed],
    check_results: checkResults,
    branch_truth: branchTruth,
    at
  };
}

export function jarvisCommitRangeEvidenceManifestV1() {
  return {
    schema: JARVIS_COMMIT_RANGE_VERIFICATION_SCHEMA,
    admits_empty_commit_diff: false,
    admits_files_outside_expected_set: false,
    admits_merge_commits: false,
    admits_unreachable_commits: false,
    admits_protected_branch: false,
    admits_dirty_tracked_working_tree: false,
    trusts_worker_or_caller_self_report: false,
    runs_required_checks_itself: true,
    mutates_repo: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
