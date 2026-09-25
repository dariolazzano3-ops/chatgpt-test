/* JARVIS — Owner Workspace Git Index Access V1.
   Node/VPS-only, deliberately not imported by Worker-safe modules.

   Owner-chat implementation work is executed by the Claude bridge as the
   dedicated worker group, while trusted publication/finalization runs as
   jarvis-operator. Git may rewrite .git/index during add/commit. If the new
   index loses group-readability, the bridge cannot prove a clean worktree and
   correctly fails closed with BRIDGE_WORKSPACE_DIRTY.

   This helper repairs only that narrow metadata boundary:
     - exact configured repository only;
     - refuses active index.lock;
     - never changes tracked/untracked working-tree content;
     - sets core.sharedRepository=group so future Git index rewrites preserve
       shared repository semantics;
     - ensures .git/index belongs to the configured worker group and is
       group-readable;
     - verifies the result before returning success. */

import {
  chmodSync,
  chownSync,
  existsSync,
  lstatSync,
  realpathSync,
  readdirSync,
  readFileSync,
  readlinkSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);

function git(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000
  }).toString('utf8').trim();
}

function modeBits(stat) {
  return stat.mode & 0o777;
}


const SNAPSHOT_MAX_ENTRIES = 100000;
const SNAPSHOT_MAX_BYTES = 512 * 1024 * 1024;

function modeTextV1(stat) {
  return '0o' + modeBits(stat).toString(8);
}

function stableJsonV1(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((item) => stableJsonV1(item)).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJsonV1(value[key])).join(',') + '}';
}

export function computeJarvisOwnerWorkspaceFilesystemSnapshotV1(repoDir) {
  const root = realpathSync(repoDir);
  const entries = {};
  let totalBytes = 0;
  let complete = true;
  const reasons = [];

  function addReason(reason) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }

  function record(rel, payload) {
    if (Object.keys(entries).length >= SNAPSHOT_MAX_ENTRIES) {
      complete = false;
      addReason('ENTRY_LIMIT');
      return false;
    }
    entries[rel] = payload;
    return true;
  }

  function walk(absDir, relDir = '') {
    let names;
    try { names = readdirSync(absDir).sort(); }
    catch {
      complete = false;
      addReason('READDIR_FAILED:' + (relDir || '.'));
      return;
    }

    for (const name of names) {
      const rel = relDir ? relDir + '/' + name : name;
      if (rel === '.git' || rel.startsWith('.git/')) continue;
      const abs = path.join(absDir, name);

      let stat;
      try { stat = lstatSync(abs); }
      catch {
        complete = false;
        addReason('LSTAT_FAILED:' + rel);
        continue;
      }

      const mode = modeTextV1(stat);
      if (stat.isSymbolicLink()) {
        let target;
        try { target = readlinkSync(abs); }
        catch {
          complete = false;
          addReason('READLINK_FAILED:' + rel);
          continue;
        }
        if (!record(rel, { type: 'symlink', target, mode })) return;
        continue;
      }

      if (stat.isDirectory()) {
        if (!record(rel, { type: 'dir', mode })) return;
        walk(abs, rel);
        if (Object.keys(entries).length >= SNAPSHOT_MAX_ENTRIES) return;
        continue;
      }

      if (stat.isFile()) {
        let digest = null;
        if (totalBytes + stat.size > SNAPSHOT_MAX_BYTES) {
          complete = false;
          addReason('BYTE_LIMIT');
        } else {
          try {
            digest = createHash('sha256').update(readFileSync(abs)).digest('hex');
            totalBytes += stat.size;
          } catch {
            complete = false;
            addReason('HASH_FAILED:' + rel);
          }
        }
        if (!record(rel, { type: 'file', size: stat.size, sha256: digest, mode })) return;
        continue;
      }

      if (!record(rel, { type: 'special', mode })) return;
    }
  }

  walk(root);

  const serialized = stableJsonV1(entries);
  return {
    complete,
    reasons: [...reasons].sort(),
    entry_count: Object.keys(entries).length,
    bytes_hashed: totalBytes,
    sha256: createHash('sha256').update(serialized).digest('hex'),
    scope: 'working-tree including hidden + ignored files; .git excluded'
  };
}

function sortedUniqueV1(items = []) {
  return [...new Set((Array.isArray(items) ? items : []).map((x) => clean(x, 500)).filter(Boolean))].sort();
}

function sameStringArrayV1(a = [], b = []) {
  const aa = sortedUniqueV1(a), bb = sortedUniqueV1(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function statusLinesV1(repoDir) {
  const raw = git(repoDir, ['status', '--porcelain=v1', '--untracked-files=all']);
  return raw ? raw.split('\n').map((line) => line.trim()).filter(Boolean).sort() : [];
}

function currentDiffV1(repoDir) {
  return git(repoDir, ['diff', '--no-ext-diff', '--unified=3', 'HEAD', '--']);
}

function recoverProvenFailedCandidateV1(repoDir, candidate) {
  if (!candidate || candidate.schema !== 'aurentara.jarvis.owner-failed-candidate-provenance.v1') {
    return { ok: false, error: 'OWNER_WORKSPACE_DIRTY_UNPROVEN' };
  }
  const sourceRequestId = clean(candidate.source_request_id, 80);
  const expectedBranch = clean(candidate.branch, 200);
  const expectedHead = clean(candidate.head, 80);
  const expectedFiles = sortedUniqueV1(candidate.files);
  const expectedDiff = clean(candidate.diff, 100000);
  const expectedStatus = sortedUniqueV1(candidate.post_status);
  if (!sourceRequestId || !expectedBranch || !/^[0-9a-f]{40}$/i.test(expectedHead) || !expectedFiles.length || !expectedDiff) {
    return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_PROVENANCE_INVALID' };
  }

  let branch, head, staged, untracked, status, diff, changedFiles;
  try {
    branch = git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    head = git(repoDir, ['rev-parse', 'HEAD']);
    staged = git(repoDir, ['diff', '--cached', '--name-only']);
    untracked = git(repoDir, ['ls-files', '--others', '--exclude-standard']);
    status = statusLinesV1(repoDir);
    diff = currentDiffV1(repoDir);
    const changedRaw = git(repoDir, ['diff', '--name-only', 'HEAD', '--']);
    changedFiles = changedRaw ? changedRaw.split('\n').map((line) => line.trim()).filter(Boolean).sort() : [];
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_TRUTH_UNAVAILABLE' };
  }

  if (branch !== expectedBranch || head.toLowerCase() !== expectedHead.toLowerCase()) {
    return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_SCOPE_MISMATCH' };
  }
  if (staged || untracked) {
    return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_UNSAFE_DIRTY_STATE' };
  }
  if (!sameStringArrayV1(changedFiles, expectedFiles) || (expectedStatus.length && !sameStringArrayV1(status, expectedStatus))) {
    return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_FILESET_MISMATCH' };
  }
  const diffMatchesExactly = clean(diff, 100000) === expectedDiff;
  let filesystemHashMatched = false;
  if (!diffMatchesExactly) {
    const expectedFilesystemSha = clean(candidate.filesystem_post_sha256, 80).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expectedFilesystemSha)) {
      return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_DIFF_MISMATCH' };
    }
    let snapshot;
    try { snapshot = computeJarvisOwnerWorkspaceFilesystemSnapshotV1(repoDir); }
    catch {
      return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_FILESYSTEM_VERIFY_UNAVAILABLE' };
    }
    if (snapshot.complete !== true || snapshot.sha256 !== expectedFilesystemSha) {
      return {
        ok: false,
        error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_FILESYSTEM_MISMATCH',
        filesystem_complete: snapshot.complete === true,
        filesystem_sha256: snapshot.sha256 || null
      };
    }
    filesystemHashMatched = true;
  }

  try {
    execFileSync('git', ['restore', '--source=HEAD', '--worktree', '--', ...expectedFiles], {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000
    });
  } catch (error) {
    return {
      ok: false,
      error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_RESTORE_FAILED',
      detail: clean(error?.message, 240)
    };
  }

  let afterStatus = [];
  try { afterStatus = statusLinesV1(repoDir); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_RESTORE_VERIFY_UNAVAILABLE' }; }
  if (afterStatus.length) {
    return { ok: false, error: 'OWNER_WORKSPACE_FAILED_CANDIDATE_RESTORE_NOT_CLEAN' };
  }

  return {
    ok: true,
    recovered: true,
    source_request_id: sourceRequestId,
    files: expectedFiles,
    diff_matched_exactly: diffMatchesExactly,
    filesystem_hash_matched: filesystemHashMatched
  };
}

export function ensureJarvisOwnerWorkspaceGitIndexAccessV1(input = {}) {
  const repoDirRaw = clean(input.repo_dir, 400);
  const workerGid = Number(input.worker_gid ?? 11000);

  if (!repoDirRaw || !path.isAbsolute(repoDirRaw)) {
    return { ok: false, error: 'OWNER_WORKSPACE_REPO_DIR_INVALID' };
  }
  if (!Number.isInteger(workerGid) || workerGid < 0) {
    return { ok: false, error: 'OWNER_WORKSPACE_WORKER_GID_INVALID' };
  }

  let repoDir;
  try { repoDir = realpathSync(repoDirRaw); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_REPO_DIR_UNAVAILABLE' }; }

  const gitDir = path.join(repoDir, '.git');
  const indexPath = path.join(gitDir, 'index');
  const lockPath = path.join(gitDir, 'index.lock');

  try {
    if (!lstatSync(gitDir).isDirectory()) {
      return { ok: false, error: 'OWNER_WORKSPACE_GIT_DIR_INVALID' };
    }
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_GIT_DIR_UNAVAILABLE' };
  }

  if (existsSync(lockPath)) {
    return { ok: false, error: 'OWNER_WORKSPACE_GIT_INDEX_LOCK_PRESENT' };
  }

  try {
    if (git(repoDir, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
      return { ok: false, error: 'OWNER_WORKSPACE_NOT_GIT_REPOSITORY' };
    }
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_GIT_UNAVAILABLE' };
  }

  let before;
  try {
    before = lstatSync(indexPath);
    if (!before.isFile()) return { ok: false, error: 'OWNER_WORKSPACE_GIT_INDEX_INVALID' };
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_GIT_INDEX_UNAVAILABLE' };
  }

  let sharedRepositoryBefore = null;
  try { sharedRepositoryBefore = git(repoDir, ['config', '--get', 'core.sharedRepository']) || null; }
  catch { sharedRepositoryBefore = null; }

  let repaired = false;
  try {
    if (before.gid !== workerGid) {
      chownSync(indexPath, before.uid, workerGid);
      repaired = true;
    }

    const beforeMode = modeBits(before);
    if ((beforeMode & 0o040) === 0) {
      chmodSync(indexPath, beforeMode | 0o040);
      repaired = true;
    }

    if (sharedRepositoryBefore !== 'group' && sharedRepositoryBefore !== '1') {
      git(repoDir, ['config', 'core.sharedRepository', 'group']);
      repaired = true;
    }
  } catch (error) {
    return {
      ok: false,
      error: 'OWNER_WORKSPACE_GIT_INDEX_ACCESS_REPAIR_FAILED',
      detail: clean(error?.message, 240)
    };
  }

  let after;
  try { after = lstatSync(indexPath); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_GIT_INDEX_VERIFY_UNAVAILABLE' }; }

  let sharedRepositoryAfter = null;
  try { sharedRepositoryAfter = git(repoDir, ['config', '--get', 'core.sharedRepository']) || null; }
  catch {}

  if (after.gid !== workerGid || (modeBits(after) & 0o040) === 0) {
    return {
      ok: false,
      error: 'OWNER_WORKSPACE_GIT_INDEX_ACCESS_VERIFY_FAILED',
      index_gid: after.gid,
      worker_gid: workerGid,
      index_mode: modeBits(after)
    };
  }

  if (!['group', '1'].includes(sharedRepositoryAfter)) {
    return { ok: false, error: 'OWNER_WORKSPACE_SHARED_REPOSITORY_VERIFY_FAILED' };
  }

  let failedCandidateRecovery = null;
  let currentStatus = [];
  try { currentStatus = statusLinesV1(repoDir); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_STATUS_UNAVAILABLE' }; }
  if (currentStatus.length) {
    failedCandidateRecovery = recoverProvenFailedCandidateV1(repoDir, input.recover_failed_candidate || null);
    if (!failedCandidateRecovery.ok) return failedCandidateRecovery;
    currentStatus = [];
  }

  return {
    ok: true,
    schema: 'aurentara.jarvis.owner-workspace-git-index-access.v1',
    repaired,
    repo_dir: repoDir,
    worker_gid: workerGid,
    index_gid_before: before.gid,
    index_gid_after: after.gid,
    index_mode_before: modeBits(before),
    index_mode_after: modeBits(after),
    shared_repository_before: sharedRepositoryBefore,
    shared_repository_after: sharedRepositoryAfter,
    failed_candidate_recovered: failedCandidateRecovery?.recovered === true,
    failed_candidate_source_request_id: failedCandidateRecovery?.source_request_id || null,
    failed_candidate_files: failedCandidateRecovery?.files || [],
    failed_candidate_diff_matched_exactly: failedCandidateRecovery?.diff_matched_exactly ?? null,
    failed_candidate_filesystem_hash_matched: failedCandidateRecovery?.filesystem_hash_matched ?? null,
    working_tree_content_changed: failedCandidateRecovery?.recovered === true
  };
}

export function jarvisOwnerWorkspaceGitIndexAccessManifestV1() {
  return {
    schema: 'aurentara.jarvis.owner-workspace-git-index-access-manifest.v1',
    node_runtime_only: true,
    exact_repo_only: true,
    refuses_index_lock: true,
    arbitrary_working_tree_content_changes: false,
    failed_candidate_restore_supported: true,
    failed_candidate_restore_requires_exact_branch_head_files_and_diff_or_full_filesystem_hash: true,
    failed_candidate_filesystem_hash_uses_bridge_compatible_snapshot: true,
    failed_candidate_restore_refuses_staged_or_untracked_state: true,
    git_index_group_read_repair: true,
    shared_repository_group_enabled: true,
    default_worker_gid: 11000,
    fail_closed: true
  };
}
