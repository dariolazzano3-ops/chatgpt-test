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
  realpathSync
} from 'node:fs';
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
    working_tree_content_changed: false
  };
}

export function jarvisOwnerWorkspaceGitIndexAccessManifestV1() {
  return {
    schema: 'aurentara.jarvis.owner-workspace-git-index-access-manifest.v1',
    node_runtime_only: true,
    exact_repo_only: true,
    refuses_index_lock: true,
    working_tree_content_changes: false,
    git_index_group_read_repair: true,
    shared_repository_group_enabled: true,
    default_worker_gid: 11000,
    fail_closed: true
  };
}
