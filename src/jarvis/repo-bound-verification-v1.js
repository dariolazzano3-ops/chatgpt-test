/* JARVIS — shared repo-bound verification computation V1.

   The ONE trusted, canonical way any executor wrapper computes
   `aurentara.jarvis.repo-bound-verification.v1` evidence: real
   `git status --porcelain` before/after a dispatch, content-diffed (not
   just path-diffed, so a repair dispatch editing an already-dirty path is
   still correctly detected as changed), and a real `node --check` on
   every changed .js/.mjs file.

   Extracted from claude-code-repo-bound-executor-v1.js (the local-CLI
   path, unchanged in behavior by this extraction — see that file) so
   claude-code-bridge-http-executor-v1.js (the private Bridge HTTP path)
   can compute BYTE-IDENTICAL evidence around a dispatch that actually ran
   somewhere else entirely (the Bridge container) but touched the SAME
   shared repo checkout this process also has direct filesystem access to.
   Both executors call this ONE implementation — never a second, subtly
   different one — which is what makes the resulting verification a single
   canonical contract both engineering-mission-acceptance-v1.js and
   astra-post-review-v1.js can read without either of them needing to know
   which execution path produced it.

   Node-only (real git/child_process). Never imported by http-v1.js,
   standalone-worker-v1.js, or any deployed-Worker entrypoint — same rule
   as every other Node-only V2 module. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const GIT_TIMEOUT_MS = 10000;

// Deliberately does NOT trim() the raw output: `git status --porcelain`'s
// first two columns are meaningful, possibly-leading-space status codes
// (" M path") — trimming the whole string would eat that leading space and
// shift every column, silently corrupting the first line's path.
function git(repoDir, args) {
  return execFileSync('git', args, { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_TIMEOUT_MS }).toString('utf8');
}

export function currentBranchOrNullV1(repoDir) {
  try { return git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { return null; }
}

export function currentHeadOrNullV1(repoDir) {
  try {
    const value = git(repoDir, ['rev-parse', 'HEAD']).trim();
    return /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null;
  } catch { return null; }
}


function boundedGitLinesV1(repoDir, args, maxLines = 20, maxLineChars = 220) {
  try {
    return git(repoDir, args)
      .split('\n')
      .map((line) => clean(line, maxLineChars))
      .filter(Boolean)
      .slice(0, maxLines);
  } catch {
    return [];
  }
}

/** Trusted read-only repository context for review-mode workers. This is
 * computed by the host process using git read commands only; Claude never
 * receives git/shell authority. Output is intentionally bounded so owner
 * instructions remain authoritative and cannot be truncated by metadata. */
export function trustedRepoReviewMetadataV1(repoDir) {
  const branches = boundedGitLinesV1(repoDir, [
    'for-each-ref',
    '--sort=-committerdate',
    '--count=24',
    '--format=%(refname:short)%09%(objectname:short)%09%(committerdate:short)',
    'refs/heads',
    'refs/remotes'
  ], 24, 220);

  const recentCommits = boundedGitLinesV1(repoDir, [
    'log',
    '--all',
    '-n',
    '18',
    '--date=short',
    '--pretty=format:%h%x09%ad%x09%d%x09%s'
  ], 18, 260);

  const relevantCommits = boundedGitLinesV1(repoDir, [
    'log',
    '--all',
    '--extended-regexp',
    '--regexp-ignore-case',
    '--grep=(AURENTARA|HAMYREN|Ferrari|customer|launch|legal|privacy|production|runtime|gate)',
    '-n',
    '18',
    '--date=short',
    '--pretty=format:%h%x09%ad%x09%d%x09%s'
  ], 18, 260);

  return {
    current_branch: currentBranchOrNullV1(repoDir),
    current_head: currentHeadOrNullV1(repoDir),
    branches,
    recent_commits: recentCommits,
    relevant_commits: relevantCommits
  };
}


/** One entry per dirty path, using git's porcelain short-status format.
 *  `--untracked-files=all` is required, not optional: without it, git
 *  collapses an entirely untracked directory into one summary line for the
 *  directory itself, which would make a second dispatch editing a file
 *  inside it look identical before/after. This only enumerates CANDIDATE
 *  dirty paths; whether one genuinely changed is decided by content via
 *  snapshotFileV1, not by presence alone. */
export function porcelainPathsV1(repoDir) {
  let raw;
  try { raw = git(repoDir, ['status', '--porcelain', '--untracked-files=all']); } catch { return null; }
  return raw.split('\n').map((line) => line.slice(3).trim()).filter(Boolean);
}

/** Raw file bytes, or null if the path doesn't exist / can't be read (a
 *  legitimate state for "not created yet" or "deleted"). Content, not a
 *  git object hash, so it works identically for tracked and untracked
 *  paths without needing anything staged. */
export function snapshotFileV1(repoDir, relPath) {
  try { return fs.readFileSync(path.join(repoDir, relPath)); } catch { return null; }
}

/** `node --check` on every changed file that looks like JS, run by THIS
 *  trusted code — never the worker, never Claude, never the Bridge's own
 *  self-report. A path the run deleted can't be checked and is skipped,
 *  not counted as a failure. */
export function syntaxCheckFilesV1(repoDir, files) {
  const results = (Array.isArray(files) ? files : [])
    .filter((file) => /\.(m?js)$/i.test(file))
    .map((file) => {
      const abs = path.join(repoDir, file);
      if (!fs.existsSync(abs)) return { file, passed: true, skipped: true, reason: 'DELETED_OR_MISSING' };
      try {
        execFileSync(process.execPath, ['--check', abs], { stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_TIMEOUT_MS });
        return { file, passed: true };
      } catch (error) {
        return { file, passed: false, error: clean(error?.stderr?.toString() || error?.message, 600) };
      }
    });
  return { passed: results.every((r) => r.passed !== false), checked: results.length, results };
}

/** Snapshot BEFORE a dispatch runs. Call this, run the dispatch, then pass
 *  the returned object to finishJarvisRepoBoundVerificationV1. */
export function beginJarvisRepoBoundVerificationV1(repoDir) {
  const branch = currentBranchOrNullV1(repoDir);
  const head = currentHeadOrNullV1(repoDir);
  const beforePathsRaw = porcelainPathsV1(repoDir);
  const beforePaths = beforePathsRaw || [];
  const beforeContent = new Map(beforePaths.map((p) => [p, snapshotFileV1(repoDir, p)]));
  return {
    repoDir,
    branch,
    head,
    porcelain_status_readable_before: beforePathsRaw !== null,
    beforePaths,
    beforeContent
  };
}

/** Computes the canonical `aurentara.jarvis.repo-bound-verification.v1`
 *  object AFTER a dispatch runs, given the snapshot
 *  beginJarvisRepoBoundVerificationV1 took before it. Branch drift (or an
 *  unreadable post-run branch) withholds nothing here — the caller
 *  decides what a drifted external_effect should be, exactly as
 *  claude-code-repo-bound-executor-v1.js already does. */
export function finishJarvisRepoBoundVerificationV1({
  repoDir,
  branch,
  head,
  porcelain_status_readable_before = true,
  beforePaths,
  beforeContent
}) {
  const branchAfter = currentBranchOrNullV1(repoDir);
  const headAfter = currentHeadOrNullV1(repoDir);
  const branchDrift = branchAfter === null || branchAfter !== branch;
  const headDrift = headAfter === null || headAfter !== head;
  const afterPaths = porcelainPathsV1(repoDir);
  const candidatePaths = afterPaths === null ? [] : [...new Set([...beforePaths, ...afterPaths])];
  const filesChanged = candidatePaths.filter((p) => {
    const wasTracked = beforeContent.has(p);
    const after = snapshotFileV1(repoDir, p);
    if (!wasTracked) return true; // newly dirty at all -> genuinely touched
    const before = beforeContent.get(p);
    if (before === null && after === null) return false; // still missing both times
    if (before === null || after === null) return true; // created or deleted
    return !before.equals(after);
  });
  const syntaxCheck = syntaxCheckFilesV1(repoDir, filesChanged);

  return {
    schema: 'aurentara.jarvis.repo-bound-verification.v1',
    repo_dir: repoDir,
    branch,
    head,
    branch_after: branchAfter,
    head_after: headAfter,
    branch_drift: branchDrift,
    head_drift: headDrift,
    porcelain_status_readable_before: porcelain_status_readable_before === true,
    porcelain_status_readable_after: afterPaths !== null,
    files_changed: filesChanged,
    pre_existing_dirty_files: beforePaths,
    syntax_check: syntaxCheck,
    at: new Date().toISOString()
  };
}

export function jarvisRepoBoundVerificationManifestV1() {
  return {
    schema: 'aurentara.jarvis.repo-bound-verification.v1',
    computed_by: 'TRUSTED_LOCAL_PROCESS_NEVER_WORKER_OR_BRIDGE_SELF_REPORT',
    shared_by_local_cli_and_bridge_http_executors: true,
    content_diffed_not_just_path_diffed: true,
    branch_and_head_captured_pre_post: true,
    trusted_review_branch_refs_supported: true,
    trusted_review_commit_summary_supported: true,
    trusted_review_metadata_read_only: true,
    syntax_check_mandatory: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
