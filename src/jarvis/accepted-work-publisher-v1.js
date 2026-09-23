/* JARVIS — Accepted Work Publisher V1.
   Node-only trusted publication after verified work.

   Existing V3 program-wave publication remains local-commit-only and requires
   Independent Acceptance.

   Owner Chat publication is a separate narrow lane: after the already-trusted
   owner-chat runtime has SYSTEM-verified canonical repo-bound evidence, this
   publisher may commit exactly those verified dirty files and, when explicitly
   configured by the private runtime, push that non-protected factory branch to
   the canonical GitHub remote and queue a private maintenance install. It never
   merges, never performs a production/public deploy, and never escalates itself
   to root. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { computeJarvisWorkingTreeWaveEvidenceV1 } from './working-tree-wave-evidence-v1.js';

const clean = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
function git(repo, args) { return execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).toString('utf8').trim(); }
function at(row) { return Date.parse(row?.occurred_at || row?.timestamp || 0) || 0; }
function sortedUnique(values = []) { return [...new Set(values.map((v) => clean(v, 500)).filter(Boolean))].sort(); }
function sameFiles(a = [], b = []) {
  const aa = sortedUnique(a), bb = sortedUnique(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}
function dirtyFiles(repo) {
  const raw = git(repo, ['status', '--porcelain', '--untracked-files=all']);
  if (!raw) return [];
  const lines = raw.split('\n').filter(Boolean);
  if (lines.some((line) => line.includes(' -> '))) return null;
  return lines.map((line) => clean(line.slice(3), 500)).filter(Boolean);
}
function deployPathAllowed(rel) {
  const value = clean(rel, 500);
  if (!value || value.startsWith('/') || value.split('/').some((part) => part === '..' || part === '')) return false;
  return ['src/jarvis/', 'scripts/', 'docs/jarvis/', 'supabase/migrations/'].some((prefix) => value.startsWith(prefix));
}
function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
export async function queueOwnerChatPrivateDeployV1({
  repo, inbox, branch, requestId, files, sourceCommit, sourceTree, checks, runtimeRepo, runtimeBranch
}, testOptions = {}) {
  const allowedInbox = path.resolve(testOptions.allowed_inbox || '/opt/jarvis/owner-deploy-queue/pending.tgz');
  const resultsDir = path.resolve(testOptions.results_dir || '/opt/jarvis/owner-deploy-queue/results');
  const allowedRuntimeRepo = path.resolve(testOptions.allowed_runtime_repo || '/opt/jarvis/chatgpt-test');
  const expectedRuntimeBranch = clean(testOptions.runtime_branch || 'factory/jarvis-capability-expansion-v3', 200);
  const inboxPath = path.resolve(inbox);
  const runtimeRepoPath = path.resolve(runtimeRepo || '');
  const runtimeBranchName = clean(runtimeBranch, 200);

  if (inboxPath !== allowedInbox) return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_INBOX_NOT_ALLOWED' };
  if (runtimeRepoPath !== allowedRuntimeRepo) return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RUNTIME_REPO_NOT_ALLOWED' };
  if (runtimeBranchName !== expectedRuntimeBranch) return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RUNTIME_BRANCH_NOT_ALLOWED' };

  const inboxDir = path.dirname(inboxPath);
  const metadataPath = path.join(inboxDir, 'pending.json');
  if (!fs.existsSync(inboxDir) || !fs.existsSync(resultsDir)) {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_QUEUE_UNAVAILABLE' };
  }
  if (fs.existsSync(inboxPath) || fs.existsSync(metadataPath)) {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_QUEUE_BUSY' };
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit) || !/^[0-9a-f]{40}$/i.test(sourceTree)) {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_SOURCE_TRUTH_INVALID' };
  }
  if (!branch.startsWith('factory/')) return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_BRANCH_NOT_ALLOWED' };

  let runtimeHead;
  try {
    const currentRuntimeBranch = git(runtimeRepoPath, ['branch', '--show-current']);
    if (currentRuntimeBranch !== runtimeBranchName) {
      return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RUNTIME_BRANCH_MISMATCH', runtime_branch: currentRuntimeBranch };
    }
    if (git(runtimeRepoPath, ['status', '--porcelain'])) {
      return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RUNTIME_NOT_CLEAN' };
    }
    runtimeHead = git(runtimeRepoPath, ['rev-parse', 'HEAD']);
  } catch {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RUNTIME_TRUTH_UNAVAILABLE' };
  }
  if (!/^[0-9a-f]{40}$/i.test(runtimeHead)) return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RUNTIME_HEAD_INVALID' };

  const deployFiles = sortedUnique(files);
  if (!deployFiles.length || deployFiles.some((rel) => !deployPathAllowed(rel))) {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_FILE_SCOPE_NOT_ALLOWED' };
  }
  if (deployFiles.some((rel) => !fs.existsSync(path.join(repo, rel)))) {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_DELETION_NOT_SUPPORTED' };
  }

  const stage = fs.mkdtempSync(path.join(inboxDir, '.owner-chat-deploy-stage-'));
  try {
    const payloadRoot = path.join(stage, 'payload');
    const entries = [];
    for (const rel of deployFiles) {
      const src = path.join(repo, rel);
      const dst = path.join(payloadRoot, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      entries.push({ path: rel, sha256: sha256File(dst) });
    }

    const manifest = {
      schema: 'jarvis-maintenance-bundle.v1',
      target_branch: runtimeBranchName,
      expected_head: runtimeHead,
      commit_message: `chore(jarvis): deploy owner job ${requestId.slice(0, 8)}`,
      files: entries,
      checks: sortedUnique(checks)
    };
    fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });

    const bundle = path.join(stage, 'bundle.tgz');
    execFileSync('tar', ['-czf', bundle, '-C', stage, 'manifest.json', 'payload'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000
    });
    fs.chmodSync(bundle, 0o660);

    const metadata = {
      schema: 'aurentara.jarvis.owner-private-deploy-request.v1',
      request_id: requestId,
      source_commit: sourceCommit,
      source_tree: sourceTree,
      source_branch: branch,
      runtime_expected_head: runtimeHead,
      runtime_branch: runtimeBranchName
    };
    const metadataStage = path.join(stage, 'pending.json');
    fs.writeFileSync(metadataStage, JSON.stringify(metadata, null, 2) + '\n', { mode: 0o660 });

    fs.renameSync(bundle, inboxPath);
    fs.renameSync(metadataStage, metadataPath);

    const resultPath = path.join(resultsDir, `${requestId}.json`);
    const timeoutMs = Math.max(1000, Math.min(240000, Number(testOptions.timeout_ms) || 180000));
    const pollMs = Math.max(50, Math.min(2000, Number(testOptions.poll_ms) || 500));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (fs.existsSync(resultPath)) {
        let result;
        try { result = JSON.parse(fs.readFileSync(resultPath, 'utf8')); }
        catch { return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RESULT_INVALID_JSON' }; }
        if (
          clean(result?.request_id, 80) !== requestId
          || clean(result?.source_commit, 40) !== sourceCommit
          || clean(result?.source_tree, 40) !== sourceTree
        ) {
          return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RESULT_SCOPE_MISMATCH' };
        }
        if (result?.status !== 'DEPLOYED') {
          return { ok: false, error: clean(result?.error || 'OWNER_CHAT_PRIVATE_DEPLOY_FAILED', 200), result };
        }
        return { ok: true, queued: true, deployed: true, inbox: inboxPath, manifest, result };
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_RESULT_TIMEOUT', queued: true, inbox: inboxPath, manifest };
  } catch (error) {
    return { ok: false, error: 'OWNER_CHAT_PRIVATE_DEPLOY_QUEUE_FAILED', detail: clean(error?.message, 500) };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

export function createJarvisAcceptedWorkPublisherV1(config = {}, deps = {}) {
  const store = deps.memory_store;
  const now = deps.now || (() => new Date().toISOString());
  const ownerChatPushEnabled = config.owner_chat_push_enabled === true;
  const ownerChatPushRemote = clean(config.owner_chat_push_remote || 'github', 80);
  const ownerChatPrivateDeployEnabled = config.owner_chat_private_deploy_enabled === true;
  const ownerChatPrivateDeployInbox = clean(config.owner_chat_private_deploy_inbox || '', 500);
  const ownerChatPrivateDeployRuntimeRepo = clean(config.owner_chat_private_deploy_runtime_repo || '/opt/jarvis/chatgpt-test', 400);
  const ownerChatPrivateDeployRuntimeBranch = clean(config.owner_chat_private_deploy_runtime_branch || 'factory/jarvis-capability-expansion-v3', 200);
  const privateDeployQueue = deps.queue_private_deploy || queueOwnerChatPrivateDeployV1;
  const ownerChatPrivateDeployChecks = Array.isArray(config.owner_chat_private_deploy_checks)
    ? config.owner_chat_private_deploy_checks.map((item) => clean(item, 500)).filter(Boolean)
    : [
        'scripts/jarvis-owner-chat-auto-finalization-v1-smoke.mjs',
        'scripts/jarvis-owner-chat-job-v1-smoke.mjs',
        'scripts/jarvis-remote-operator-server-v1-smoke.mjs',
        'scripts/jarvis-command-center-autonomy-v1-smoke.mjs'
      ];

  return {
    async publish(request = {}) {
      const ownerId = clean(request.owner_id, 80), ownerRef = clean(request.owner_ref, 320);
      const program = clean(request.program, 80).toUpperCase(), repo = clean(request.repo_dir, 400), branch = clean(request.target_branch, 200);
      if (!store || typeof store.readAudit !== 'function' || typeof store.appendAudit !== 'function') return { ok: false, error: 'PUBLISHER_DURABLE_STORE_REQUIRED' };
      if (!ownerId || !ownerRef || !program || !repo || !branch || ['main', 'master'].includes(branch.toLowerCase())) return { ok: false, error: 'PUBLISHER_SCOPE_INVALID' };
      let current;
      try { current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return { ok: false, error: 'PUBLISHER_GIT_UNAVAILABLE' }; }
      if (current !== branch) return { ok: false, error: 'PUBLISHER_BRANCH_MISMATCH' };
      let audit;
      try { audit = await store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 }); } catch { return { ok: false, error: 'PUBLISHER_AUDIT_READ_FAILED' }; }
      const accepted = audit.filter((row) => row?.action === 'IMPLEMENTATION_MISSION'
        && clean(row?.result?.program, 80).toUpperCase() === program
        && row?.result?.independent_acceptance === true && clean(row?.result?.acceptance_ref, 240))
        .sort((a, b) => at(a) - at(b)).at(-1) || null;
      if (!accepted) return { ok: false, error: 'PUBLISHER_ACCEPTED_WAVE_REQUIRED' };
      const waveIndex = Number(accepted.result?.wave_index);
      const evidence = computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir: repo, target_branch: branch, program, wave_index: waveIndex, verification: accepted.result?.verification });
      if (!evidence.sufficient) return { ok: false, error: 'PUBLISHER_WORKING_TREE_EVIDENCE_INSUFFICIENT', evidence };
      const files = evidence.actual_dirty_files;
      try {
        execFileSync('git', ['add', '--', ...files], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
        execFileSync('git', ['-c', 'user.name=JARVIS Trusted Publisher', '-c', 'user.email=jarvis@localhost', 'commit', '-m', `chore(jarvis): publish ${program} wave ${waveIndex}`, '--', ...files], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
      } catch (error) { return { ok: false, error: 'PUBLISHER_LOCAL_COMMIT_FAILED', detail: clean(error?.message, 300) }; }
      let commit;
      try { commit = git(repo, ['rev-parse', 'HEAD']); } catch { return { ok: false, error: 'PUBLISHER_COMMIT_TRUTH_UNAVAILABLE' }; }
      if (git(repo, ['status', '--porcelain'])) return { ok: false, error: 'PUBLISHER_TREE_NOT_CLEAN_AFTER_COMMIT', commit };
      const event = createJarvisAuditEventV1({
        timestamp: now(), owner_ref: ownerRef,
        request: `[TRUSTED LOCAL PUBLICATION] ${program} wave ${waveIndex}`,
        intent: { intent_type: 'ACCEPTED_WORK_PUBLICATION', domain: 'PROGRAM', action: 'ACCEPTED_WORK_PUBLICATION' },
        tools_used: [], permissions: [], action: 'ACCEPTED_WORK_PUBLICATION',
        result: { status: 'COMPLETED', verified: true, external_effect: false, program, wave_index: waveIndex, commit, files_changed: files, push: false, merge: false, deploy: false },
        approval: { required: false, explicit: false, actor_type: 'SYSTEM', gate_status: 'POST_INDEPENDENT_ACCEPTANCE_LOCAL_ONLY' },
        cost: { estimated_eur: 0, actual_eur: 0 }, memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
      });
      try { await store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event }); }
      catch { return { ok: false, error: 'PUBLISHER_AUDIT_PERSIST_FAILED_AFTER_COMMIT', commit }; }
      return { ok: true, status: 200, published: true, local_commit_only: true, program, wave_index: waveIndex, commit, files_changed: files, push: false, merge: false, deploy: false };
    },

    async publishVerifiedOwnerChatJob(request = {}) {
      const ownerId = clean(request.owner_id, 80);
      const ownerRef = clean(request.owner_ref, 320);
      const requestId = clean(request.request_id, 80).toLowerCase();
      const repo = clean(request.repo_dir, 400);
      const branch = clean(request.target_branch, 200);
      const title = clean(request.title, 160) || requestId;
      const verification = request.verification && typeof request.verification === 'object' ? request.verification : null;

      if (!store || typeof store.appendAudit !== 'function') return { ok: false, error: 'OWNER_CHAT_PUBLISHER_DURABLE_STORE_REQUIRED' };
      if (!ownerId || !ownerRef || !requestId || !repo || !branch) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_SCOPE_INVALID' };
      if (!branch.startsWith('factory/') || ['main', 'master'].includes(branch.toLowerCase())) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_BRANCH_NOT_ALLOWED' };
      if (!verification || verification.schema !== 'aurentara.jarvis.repo-bound-verification.v1') return { ok: false, error: 'OWNER_CHAT_PUBLISHER_CANONICAL_VERIFICATION_REQUIRED' };
      if (clean(verification.repo_dir, 400) !== repo || clean(verification.branch, 200) !== branch || verification.branch_drift === true) {
        return { ok: false, error: 'OWNER_CHAT_PUBLISHER_VERIFICATION_SCOPE_MISMATCH' };
      }
      if (verification.syntax_check?.passed !== true) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_SYNTAX_CHECK_REQUIRED' };
      if ((verification.pre_existing_dirty_files || []).length > 0) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_PREEXISTING_DIRTY_REFUSED' };

      const verifiedFiles = sortedUnique(verification.files_changed || []);
      if (!verifiedFiles.length) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_REAL_CHANGE_REQUIRED' };

      let current;
      try { current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return { ok: false, error: 'OWNER_CHAT_PUBLISHER_GIT_UNAVAILABLE' }; }
      if (current !== branch) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_BRANCH_MISMATCH' };

      const commitMessage = `chore(jarvis): finalize owner job ${requestId}`;
      let commit = null;
      let baseCommit = null;
      let baseTree = null;
      let sourceTree = null;
      let committedNow = false;
      try {
        baseCommit = git(repo, ['rev-parse', 'HEAD']);
        baseTree = git(repo, ['rev-parse', 'HEAD^{tree}']);
      } catch {
        return { ok: false, error: 'OWNER_CHAT_PUBLISHER_BASE_COMMIT_UNAVAILABLE' };
      }

      let actualDirty;
      try { actualDirty = dirtyFiles(repo); } catch { return { ok: false, error: 'OWNER_CHAT_PUBLISHER_STATUS_UNAVAILABLE' }; }
      if (actualDirty === null) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_RENAME_REFUSED' };

      if (actualDirty.length > 0) {
        if (!sameFiles(actualDirty, verifiedFiles)) {
          return { ok: false, error: 'OWNER_CHAT_PUBLISHER_DIRTY_FILES_MISMATCH', verified_files: verifiedFiles, actual_dirty_files: actualDirty };
        }
        try {
          execFileSync('git', ['add', '--', ...verifiedFiles], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
          execFileSync('git', ['-c', 'user.name=JARVIS Trusted Publisher', '-c', 'user.email=jarvis@localhost', 'commit', '-m', commitMessage, '--', ...verifiedFiles], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
          committedNow = true;
        } catch (error) {
          return { ok: false, error: 'OWNER_CHAT_PUBLISHER_LOCAL_COMMIT_FAILED', detail: clean(error?.message, 300) };
        }
      } else {
        let lastMessage = '';
        try { lastMessage = git(repo, ['log', '-1', '--format=%B']); } catch {}
        if (!lastMessage.includes(requestId)) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_CLEAN_TREE_WITHOUT_MATCHING_COMMIT' };
        try {
          baseCommit = git(repo, ['rev-parse', 'HEAD^']);
          baseTree = git(repo, ['rev-parse', `${baseCommit}^{tree}`]);
        } catch {
          return { ok: false, error: 'OWNER_CHAT_PUBLISHER_BASE_COMMIT_UNAVAILABLE' };
        }
      }

      try { commit = git(repo, ['rev-parse', 'HEAD']); } catch { return { ok: false, error: 'OWNER_CHAT_PUBLISHER_COMMIT_TRUTH_UNAVAILABLE' }; }
      if (git(repo, ['status', '--porcelain'])) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_TREE_NOT_CLEAN_AFTER_COMMIT', commit };
      try { sourceTree = git(repo, ['rev-parse', `${commit}^{tree}`]); }
      catch { return { ok: false, error: 'OWNER_CHAT_PUBLISHER_SOURCE_TREE_UNAVAILABLE', commit }; }

      let pushed = false;
      let pushError = null;
      if (ownerChatPushEnabled) {
        if (ownerChatPushRemote !== 'github') return { ok: false, error: 'OWNER_CHAT_PUBLISHER_PUSH_REMOTE_NOT_ALLOWED', commit };
        try {
          git(repo, ['remote', 'get-url', ownerChatPushRemote]);
          execFileSync('git', ['push', ownerChatPushRemote, `HEAD:${branch}`], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
          pushed = true;
        } catch (error) {
          pushError = clean(error?.stderr?.toString() || error?.message, 500);
        }
      }

      let deployQueue = null;
      let deployError = null;
      if (ownerChatPrivateDeployEnabled && !pushError) {
        deployQueue = await privateDeployQueue({
          repo,
          inbox: ownerChatPrivateDeployInbox,
          branch,
          requestId,
          files: verifiedFiles,
          baseCommit,
          baseTree,
          sourceCommit: commit,
          sourceTree,
          checks: ownerChatPrivateDeployChecks,
          runtimeRepo: ownerChatPrivateDeployRuntimeRepo,
          runtimeBranch: ownerChatPrivateDeployRuntimeBranch
        });
        if (!deployQueue?.ok) deployError = clean(deployQueue?.error || 'OWNER_CHAT_PRIVATE_DEPLOY_QUEUE_FAILED', 200);
      }

      const event = createJarvisAuditEventV1({
        timestamp: now(),
        owner_ref: ownerRef,
        request: `[TRUSTED OWNER CHAT PUBLICATION] ${title}`,
        intent: { intent_type: 'OWNER_CHAT_JOB_PUBLICATION', domain: 'ENGINEERING', action: 'OWNER_CHAT_JOB_PUBLICATION' },
        tools_used: [],
        permissions: [],
        action: 'OWNER_CHAT_JOB_PUBLICATION',
        result: {
          status: (pushError || deployError) ? 'FAILED' : 'COMPLETED',
          verified: true,
          external_effect: pushed,
          request_id: requestId,
          branch,
          commit,
          files_changed: verifiedFiles,
          committed_now: committedNow,
          push: pushed,
          push_remote: ownerChatPushEnabled ? ownerChatPushRemote : null,
          merge: false,
          deploy: deployQueue?.deployed === true,
          deploy_state: deployQueue?.deployed === true
            ? 'DEPLOYED_PRIVATE_RUNTIME'
            : (deployQueue?.queued === true ? 'QUEUED_PRIVATE_RUNTIME_INSTALL' : (ownerChatPrivateDeployEnabled ? 'QUEUE_FAILED' : 'NOT_REQUESTED')),
          deploy_inbox: deployQueue?.queued === true ? ownerChatPrivateDeployInbox : null,
          error: pushError ? 'OWNER_CHAT_PUBLISHER_PUSH_FAILED' : deployError
        },
        approval: { required: false, explicit: false, actor_type: 'SYSTEM', gate_status: 'SYSTEM_VERIFIED_INTERNAL_FINALIZATION' },
        cost: { estimated_eur: 0, actual_eur: 0 },
        memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
      });
      try { await store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event }); }
      catch { return { ok: false, error: 'OWNER_CHAT_PUBLISHER_AUDIT_PERSIST_FAILED', commit, push: pushed }; }

      if (pushError) return { ok: false, error: 'OWNER_CHAT_PUBLISHER_PUSH_FAILED', detail: pushError, commit, push: false, retryable: true };
      if (deployError) return {
        ok: false,
        error: deployError,
        detail: deployQueue?.detail || null,
        commit,
        push: pushed,
        deploy: false,
        retryable: true
      };
      return {
        ok: true,
        status: 200,
        published: true,
        owner_chat_job: true,
        commit,
        base_commit: baseCommit,
        base_tree: baseTree,
        source_tree: sourceTree,
        files_changed: verifiedFiles,
        push: pushed,
        push_remote: pushed ? ownerChatPushRemote : null,
        merge: false,
        deploy: deployQueue?.deployed === true,
        deploy_state: deployQueue?.deployed === true ? 'DEPLOYED_PRIVATE_RUNTIME' : 'NOT_REQUESTED'
      };
    }
  };
}

export function jarvisAcceptedWorkPublisherManifestV1() {
  return {
    schema: 'aurentara.jarvis.accepted-work-publisher.v1',
    requires_independent_acceptance: true,
    commits_locally: true,
    can_push: false,
    owner_chat_system_verified_publication_supported: true,
    owner_chat_push_requires_private_runtime_configuration: true,
    owner_chat_push_protected_branches_refused: true,
    owner_chat_force_push_supported: false,
    owner_chat_private_deploy_queue_supported: true,
    owner_chat_private_deploy_reuses_existing_maintenance_gate: true,
    owner_chat_private_deploy_requires_new_root_consumer: false,
    owner_chat_private_deploy_production: false,
    can_merge: false,
    can_deploy: false,
    protected_branches_refused: true,
    registry_allowlist_rechecked: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
