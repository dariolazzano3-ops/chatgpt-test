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
  readlinkSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);

function git(repoDir, args) {
  return execFileSync('git', ['-c', `safe.directory=${repoDir}`, ...args], {
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
  // Python stat.S_IMODE() used by the Bridge includes suid/sgid/sticky bits.
  // Preserve all permission bits here so a setgid owner workspace hashes
  // identically to the Bridge snapshot.
  return '0o' + (stat.mode & 0o7777).toString(8);
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

function quarantineUnrelatedDirtyStateV1(repoDir) {
  let branch, head, staged, untracked, nameStatus, diff;
  try {
    branch = git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    head = git(repoDir, ['rev-parse', 'HEAD']);
    staged = git(repoDir, ['diff', '--cached', '--name-only']);
    untracked = git(repoDir, ['ls-files', '--others', '--exclude-standard']);
    nameStatus = git(repoDir, ['diff', '--name-status', 'HEAD', '--']);
    diff = currentDiffV1(repoDir);
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_TRUTH_UNAVAILABLE' };
  }

  if (staged || untracked) {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_UNSAFE_DIRTY_STATE' };
  }

  const rows = nameStatus ? nameStatus.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  if (!rows.length || rows.some((line) => !/^M\t[^\t\n]+$/.test(line))) {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_UNSAFE_CHANGE_TYPE' };
  }
  const files = rows.map((line) => line.slice(2).trim()).sort();
  if (!diff || !files.length) {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_EMPTY_DIFF' };
  }

  const patchPayload = diff.endsWith('\n') ? diff : diff + '\n';
  const patchSha256 = createHash('sha256').update(patchPayload).digest('hex');
  const quarantineDir = path.join(repoDir, '.git', 'jarvis-owner-quarantine');
  const stem = head.slice(0, 12) + '-' + patchSha256.slice(0, 16);
  const patchPath = path.join(quarantineDir, stem + '.patch');
  const metadataPath = path.join(quarantineDir, stem + '.json');

  try {
    mkdirSync(quarantineDir, { recursive: true, mode: 0o770 });
    writeFileSync(patchPath, patchPayload, { mode: 0o660 });
    writeFileSync(metadataPath, JSON.stringify({
      schema: 'aurentara.jarvis.owner-workspace-quarantine.v1',
      branch,
      head,
      files,
      patch_sha256: patchSha256,
      reason: 'UNRELATED_DIRTY_STATE_BLOCKING_VERIFIED_FAILED_CANDIDATE_RECOVERY'
    }, null, 2) + '\n', { mode: 0o660 });
    const persisted = readFileSync(patchPath);
    const persistedSha = createHash('sha256').update(persisted).digest('hex');
    if (persistedSha !== patchSha256) {
      return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_PERSIST_VERIFY_FAILED' };
    }
  } catch (error) {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_PERSIST_FAILED', detail: clean(error?.message, 240) };
  }

  try {
    execFileSync('git', ['-c', `safe.directory=${repoDir}`, 'restore', '--source=HEAD', '--worktree', '--', ...files], {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000
    });
  } catch (error) {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_RESTORE_FAILED', detail: clean(error?.message, 240) };
  }

  let afterStatus = [];
  try { afterStatus = statusLinesV1(repoDir); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_RESTORE_VERIFY_UNAVAILABLE' }; }
  if (afterStatus.length) {
    return { ok: false, error: 'OWNER_WORKSPACE_QUARANTINE_RESTORE_NOT_CLEAN' };
  }

  return {
    ok: true,
    quarantined: true,
    branch,
    head,
    files,
    patch_sha256: patchSha256,
    patch_ref: path.relative(repoDir, patchPath),
    metadata_ref: path.relative(repoDir, metadataPath)
  };
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
    execFileSync('git', ['-c', `safe.directory=${repoDir}`, 'restore', '--source=HEAD', '--worktree', '--', ...expectedFiles], {
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


function excludeUntrackedProjectDirectoryV1(repoDir, branch, head) {
  let staged, trackedStatus, untracked;
  try {
    staged = git(repoDir, ['diff', '--cached', '--name-only']);
    trackedStatus = git(repoDir, ['diff', '--name-status', 'HEAD', '--']);
    untracked = git(repoDir, ['ls-files', '--others', '--exclude-standard']);
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_TRUTH_UNAVAILABLE' };
  }

  if (staged || trackedStatus) {
    return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_TRACKED_STATE_REFUSED' };
  }

  const files = untracked
    ? untracked.split('\n').map((line) => clean(line, 500)).filter(Boolean).sort()
    : [];
  if (!files.length) {
    return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_NO_UNTRACKED' };
  }

  const roots = [...new Set(files.map((rel) => {
    const parts = rel.split('/');
    return parts.length >= 3 && parts[0] === 'projects'
      ? parts.slice(0, 2).join('/')
      : '';
  }))];

  if (roots.length !== 1 || !roots[0]) {
    return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_SCOPE_REFUSED' };
  }
  const root = roots[0];
  if (files.some((rel) => !rel.startsWith(root + '/'))) {
    return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_FILESET_REFUSED' };
  }

  const excludePath = path.join(repoDir, '.git', 'info', 'exclude');
  const metadataDir = path.join(repoDir, '.git', 'jarvis-owner-untracked-quarantine');
  const pattern = '/' + root + '/';
  let before = '';

  try {
    before = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : '';
    const lines = before.split('\n').map((line) => line.trim());
    if (!lines.includes(pattern)) {
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      writeFileSync(excludePath, before + prefix + pattern + '\n');
    }

    mkdirSync(metadataDir, { recursive: true, mode: 0o770 });
    const digest = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 16);
    const metadataPath = path.join(
      metadataDir,
      head.slice(0, 12) + '-local-exclude-' + digest + '.json'
    );

    let stashCommit = null;
    try { stashCommit = git(repoDir, ['rev-parse', 'refs/stash']); } catch {}

    writeFileSync(metadataPath, JSON.stringify({
      schema: 'aurentara.jarvis.owner-untracked-project-local-exclude.v1',
      branch,
      head,
      excluded_path: root,
      exclude_pattern: pattern,
      files,
      stash_commit: stashCommit,
      reversible: true
    }, null, 2) + '\n', { mode: 0o660 });

    const after = statusLinesV1(repoDir);
    if (after.length) {
      writeFileSync(excludePath, before);
      return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_NOT_CLEAN' };
    }

    return {
      ok: true,
      quarantined: true,
      mode: 'GIT_INFO_EXCLUDE_UNTRACKED_PROJECT',
      branch,
      head,
      files,
      excluded_path: root,
      exclude_pattern: pattern,
      metadata_ref: path.relative(repoDir, metadataPath)
    };
  } catch (error) {
    try { if (existsSync(excludePath)) writeFileSync(excludePath, before); } catch {}
    return {
      ok: false,
      error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_FAILED',
      detail: clean(error?.message, 240)
    };
  }
}


function recoverLocallyExcludedProjectV1(repoDir) {
  const excludePath = path.join(repoDir, '.git', 'info', 'exclude');
  if (!existsSync(excludePath)) return { ok: true, recovered: false, files: [] };

  let before = '';
  try { before = readFileSync(excludePath, 'utf8'); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_READ_FAILED' }; }

  const lines = before.split('\n');
  const patterns = [...new Set(lines.map((line) => line.trim()).filter((line) =>
    /^\/projects\/[A-Za-z0-9._-]+\/$/.test(line)
  ))];

  if (!patterns.length) return { ok: true, recovered: false, files: [] };

  let branch, head;
  try {
    branch = git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    head = git(repoDir, ['rev-parse', 'HEAD']);
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_TRUTH_UNAVAILABLE' };
  }

  const moved = [];
  const recoveredFiles = [];
  try {
    for (const pattern of patterns) {
      const rel = pattern.slice(1, -1);
      const source = path.join(repoDir, rel);
      if (!existsSync(source)) continue;

      const tracked = git(repoDir, ['ls-files', '--', rel]);
      if (tracked) {
        throw Object.assign(new Error('tracked content under excluded project'), { code: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_TRACKED_REFUSED' });
      }

      const st = lstatSync(source);
      if (!st.isDirectory() || st.isSymbolicLink()) {
        throw Object.assign(new Error('excluded project is not a plain directory'), { code: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_SOURCE_INVALID' });
      }

      const ignored = git(repoDir, ['ls-files', '--others', '--ignored', '--exclude-standard', '--', rel]);
      const files = ignored ? ignored.split('\n').map((line) => clean(line, 500)).filter(Boolean).sort() : [];
      if (!files.length) {
        throw Object.assign(new Error('excluded project has no ignored untracked files'), { code: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_EMPTY' });
      }

      const quarantineRoot = path.join(repoDir, '.git', 'jarvis-owner-untracked-quarantine');
      mkdirSync(quarantineRoot, { recursive: true, mode: 0o770 });
      const digest = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 16);
      const slug = path.basename(rel).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
      const destination = path.join(quarantineRoot, head.slice(0, 12) + '-' + slug + '-' + digest);
      const metadataPath = destination + '.json';

      if (existsSync(destination) || existsSync(metadataPath)) {
        throw Object.assign(new Error('quarantine destination already exists'), { code: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_COLLISION' });
      }

      renameSync(source, destination);
      moved.push({ source, destination, metadataPath, pattern });

      writeFileSync(metadataPath, JSON.stringify({
        schema: 'aurentara.jarvis.owner-untracked-project-quarantine.v1',
        branch,
        head,
        original_path: rel,
        quarantine_path: path.relative(repoDir, destination),
        files,
        reason: 'RECOVER_JARVIS_LOCAL_EXCLUDE_BEFORE_NEW_OWNER_JOB'
      }, null, 2) + '\n', { mode: 0o660 });
      recoveredFiles.push(...files);
    }

    const removable = new Set(patterns);
    const afterText = lines.filter((line) => !removable.has(line.trim())).join('\n');
    writeFileSync(excludePath, afterText);

    for (const pattern of patterns) {
      const rel = pattern.slice(1, -1);
      if (existsSync(path.join(repoDir, rel))) {
        throw Object.assign(new Error('excluded project path still exists after quarantine'), { code: 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_VERIFY_FAILED' });
      }
    }
  } catch (error) {
    for (const entry of moved.reverse()) {
      try {
        if (!existsSync(entry.source) && existsSync(entry.destination)) renameSync(entry.destination, entry.source);
        if (existsSync(entry.metadataPath)) {
          // Metadata is harmless if rollback cleanup cannot remove it; exclude restoration below is authoritative.
          try { execFileSync('rm', ['-f', entry.metadataPath], { stdio: 'ignore', timeout: 5000 }); } catch {}
        }
      } catch {}
    }
    try { writeFileSync(excludePath, before); } catch {}
    return {
      ok: false,
      error: clean(error?.code || 'OWNER_WORKSPACE_LOCAL_EXCLUDE_RECOVERY_FAILED', 160),
      detail: clean(error?.message, 240)
    };
  }

  return {
    ok: true,
    recovered: moved.length > 0 || patterns.length > 0,
    files: sortedUniqueV1(recoveredFiles),
    patterns_removed: patterns,
    mode: 'ATOMIC_RENAME_IGNORED_PROJECT'
  };
}

function stashStaleFailedProjectStateV1(repoDir) {
  let staged, trackedStatus, untracked;
  try {
    staged = git(repoDir, ['diff', '--cached', '--name-only']);
    trackedStatus = git(repoDir, ['diff', '--name-status', 'HEAD', '--']);
    untracked = git(repoDir, ['ls-files', '--others', '--exclude-standard']);
  } catch {
    return { ok: false, error: 'OWNER_WORKSPACE_STALE_STASH_STATUS_UNAVAILABLE' };
  }

  if (staged) {
    return { ok: false, error: 'OWNER_WORKSPACE_STALE_STASH_STAGED_REFUSED' };
  }

  const trackedRows = trackedStatus
    ? trackedStatus.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  if (trackedRows.some((line) => !/^M\t[^\t\n]+$/.test(line))) {
    return { ok: false, error: 'OWNER_WORKSPACE_STALE_STASH_UNSAFE_STATE' };
  }

  const trackedFiles = trackedRows.map((line) => clean(line.slice(2), 500)).filter(Boolean);
  const untrackedFiles = untracked ? untracked.split('\n').map((line) => clean(line, 500)).filter(Boolean) : [];
  const files = [...new Set([...trackedFiles, ...untrackedFiles])].sort();
  if (!files.length) return { ok: true, quarantined: false, files: [] };

  let branch, head, stashCommit;
  try {
    branch = git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    head = git(repoDir, ['rev-parse', 'HEAD']);
    const label = 'JARVIS stale failed project quarantine ' + head.slice(0, 12);
    git(repoDir, ['stash', 'push', '--include-untracked', '--message', label]);
    stashCommit = git(repoDir, ['rev-parse', 'refs/stash']);
  } catch (error) {
    const excluded = excludeUntrackedProjectDirectoryV1(repoDir, branch, head);
    if (excluded.ok) return excluded;
    return {
      ok: false,
      error: 'OWNER_WORKSPACE_STALE_STASH_FAILED',
      detail: clean(error?.message, 160),
      local_exclude_error: excluded.error || null
    };
  }

  let after = [];
  try { after = statusLinesV1(repoDir); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_STALE_STASH_VERIFY_UNAVAILABLE' }; }
  if (after.length) {
    return { ok: false, error: 'OWNER_WORKSPACE_STALE_STASH_NOT_CLEAN' };
  }
  if (!/^[0-9a-f]{40}$/i.test(stashCommit)) {
    return { ok: false, error: 'OWNER_WORKSPACE_STALE_STASH_REF_INVALID' };
  }

  return {
    ok: true,
    quarantined: true,
    mode: 'GIT_STASH_INCLUDE_UNTRACKED',
    branch,
    head,
    files,
    stash_ref: 'refs/stash',
    stash_commit: stashCommit
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

  const localExcludeRecovery = recoverLocallyExcludedProjectV1(repoDir);
  if (!localExcludeRecovery.ok) return localExcludeRecovery;

  let failedCandidateRecovery = null;
  let unrelatedDirtyQuarantine = null;
  let currentStatus = [];
  try { currentStatus = statusLinesV1(repoDir); }
  catch { return { ok: false, error: 'OWNER_WORKSPACE_STATUS_UNAVAILABLE' }; }
  if (currentStatus.length) {
    failedCandidateRecovery = recoverProvenFailedCandidateV1(repoDir, input.recover_failed_candidate || null);
    if (!failedCandidateRecovery.ok) {
      const mayQuarantineMismatch = input.quarantine_unrelated_dirty === true
        && failedCandidateRecovery.error === 'OWNER_WORKSPACE_FAILED_CANDIDATE_FILESET_MISMATCH'
        && input.recover_failed_candidate?.schema === 'aurentara.jarvis.owner-failed-candidate-provenance.v1';
      const mayQuarantineStaleFailedProject = input.quarantine_unrelated_dirty === true
        && input.quarantine_stale_failed_project_scope === true
        && failedCandidateRecovery.error === 'OWNER_WORKSPACE_DIRTY_UNPROVEN'
        && !input.recover_failed_candidate;
      if (!mayQuarantineMismatch && !mayQuarantineStaleFailedProject) return failedCandidateRecovery;
      unrelatedDirtyQuarantine = mayQuarantineStaleFailedProject
        ? stashStaleFailedProjectStateV1(repoDir)
        : quarantineUnrelatedDirtyStateV1(repoDir);
      if (!unrelatedDirtyQuarantine.ok) return unrelatedDirtyQuarantine;
      failedCandidateRecovery = null;
    }
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
    local_exclude_recovered: localExcludeRecovery.recovered === true,
    local_exclude_recovered_files: localExcludeRecovery.files || [],
    local_exclude_patterns_removed: localExcludeRecovery.patterns_removed || [],
    local_exclude_recovery_mode: localExcludeRecovery.mode || null,
    unrelated_dirty_quarantined: unrelatedDirtyQuarantine?.quarantined === true,
    quarantine_files: unrelatedDirtyQuarantine?.files || [],
    quarantine_patch_sha256: unrelatedDirtyQuarantine?.patch_sha256 || null,
    quarantine_patch_ref: unrelatedDirtyQuarantine?.patch_ref || null,
    quarantine_metadata_ref: unrelatedDirtyQuarantine?.metadata_ref || null,
    quarantine_mode: unrelatedDirtyQuarantine?.mode || null,
    quarantine_stash_ref: unrelatedDirtyQuarantine?.stash_ref || null,
    quarantine_stash_commit: unrelatedDirtyQuarantine?.stash_commit || null,
    working_tree_content_changed: failedCandidateRecovery?.recovered === true || unrelatedDirtyQuarantine?.quarantined === true
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
    unrelated_dirty_quarantine_supported: true,
    unrelated_dirty_quarantine_requires_failed_candidate_fileset_mismatch: true,
    stale_failed_project_scope_quarantine_supported: true,
    local_exclude_recovery_supported: true,
    local_exclude_recovery_uses_atomic_rename: true,
    local_exclude_recovery_refuses_tracked_content: true,
    stale_failed_project_scope_quarantine_requires_explicit_scoped_flag: true,
    stale_failed_project_scope_quarantine_uses_git_stash_include_untracked: true,
    stale_failed_project_scope_quarantine_refuses_staged_deleted_renamed_or_conflicted_state: true,
    unrelated_dirty_quarantine_preserves_exact_patch_before_restore: true,
    unrelated_dirty_quarantine_refuses_staged_untracked_delete_rename_conflict: true,
    git_index_group_read_repair: true,
    shared_repository_group_enabled: true,
    default_worker_gid: 11000,
    fail_closed: true
  };
}