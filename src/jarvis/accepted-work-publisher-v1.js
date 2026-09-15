/* JARVIS — Accepted Work Publisher V1. Node-only, local commit only after Independent Acceptance. */
import { execFileSync } from 'node:child_process';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { computeJarvisWorkingTreeWaveEvidenceV1 } from './working-tree-wave-evidence-v1.js';

const clean = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
function git(repo, args) { return execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).toString('utf8').trim(); }
function at(row) { return Date.parse(row?.occurred_at || row?.timestamp || 0) || 0; }

export function createJarvisAcceptedWorkPublisherV1(config = {}, deps = {}) {
  const store = deps.memory_store;
  const now = deps.now || (() => new Date().toISOString());
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
    }
  };
}

export function jarvisAcceptedWorkPublisherManifestV1() {
  return { schema: 'aurentara.jarvis.accepted-work-publisher.v1', requires_independent_acceptance: true, commits_locally: true, can_push: false, can_merge: false, can_deploy: false, protected_branches_refused: true, registry_allowlist_rechecked: true, production_deploy: false, hamyren_data_flow: false };
}
