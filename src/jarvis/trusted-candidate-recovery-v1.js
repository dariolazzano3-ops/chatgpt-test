/* JARVIS — Trusted Candidate Recovery V1.
   Recovers repo work left behind by a failed V3 worker only when durable
   same-wave provenance + the current registry allowlist + fresh trusted
   checks all agree. It NEVER grants Independent Acceptance. */

import { execFileSync } from 'node:child_process';
import { JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE } from './repo-bound-contract-v1.js';
export { JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE } from './repo-bound-contract-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { getJarvisWaveRegistryEntryV1 } from './wave-registry-v1.js';
import { computeJarvisWorkingTreeWaveEvidenceV1 } from './working-tree-wave-evidence-v1.js';
import { JARVIS_V3_PROGRAM_ID } from './program-catalog-v1.js';
import {
  JARVIS_ENGINEERING_MISSION_ACTION,
  JARVIS_ENGINEERING_MISSION_INTENT,
  JARVIS_ENGINEERING_MISSION_DOMAIN
} from './engineering-mission-v1.js';

const clean = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const at = (row) => Date.parse(row?.occurred_at || row?.timestamp || 0) || 0;
const sameSet = (a = [], b = []) => {
  const aa = [...new Set(a.map(String))].sort();
  const bb = [...new Set(b.map(String))].sort();
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
};
function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).toString('utf8').trim();
}

function syntaxCheck(repo, files) {
  const results = [];
  for (const file of files.filter((f) => /\.(?:mjs|js)$/.test(f))) {
    try {
      execFileSync(process.execPath, ['--check', file], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
      results.push({ file, passed: true });
    } catch (error) {
      results.push({ file, passed: false, error: clean(error?.stderr?.toString() || error?.message, 300) });
    }
  }
  return { passed: results.every((r) => r.passed), checked: results.length, results };
}

function programWaveRows(audit, program, waveIndex) {
  return (Array.isArray(audit) ? audit : [])
    .filter((row) => row?.action === JARVIS_ENGINEERING_MISSION_ACTION)
    .filter((row) => clean(row?.result?.program, 80).toUpperCase() === program)
    .filter((row) => Number(row?.result?.wave_index) === Number(waveIndex))
    .sort((a, b) => at(a) - at(b));
}
export function evaluateJarvisTrustedCandidateRecoveryV1({
  audit = [], program, wave_index, repo_dir, target_branch, max_repair_attempts = 3
} = {}) {
  const programId = clean(program, 80).toUpperCase();
  const waveIndex = Number(wave_index);
  const repo = clean(repo_dir, 400);
  const branch = clean(target_branch, 200);
  if (programId !== JARVIS_V3_PROGRAM_ID) return { eligible: false, reason: 'PROGRAM_NOT_SUPPORTED' };
  const entry = getJarvisWaveRegistryEntryV1(programId, waveIndex);
  if (!entry) return { eligible: false, reason: 'WAVE_NOT_REGISTERED' };
  if (!repo || !branch || ['main', 'master'].includes(branch.toLowerCase())) return { eligible: false, reason: 'UNSAFE_REPO_OR_BRANCH' };

  const rows = programWaveRows(audit, programId, waveIndex);
  if (rows.some((r) => r?.result?.independent_acceptance === true && clean(r?.result?.acceptance_ref, 240))) {
    return { eligible: false, reason: 'WAVE_ALREADY_ACCEPTED' };
  }
  const failed = rows.filter((r) => ['FAILED', 'BLOCKED', 'INTERRUPTED'].includes(clean(r?.result?.status, 40).toUpperCase()));
  const failedRequestIds = [...new Set(failed.map((r) => clean(r?.request_id, 80)).filter(Boolean))];
  if (failedRequestIds.length < Math.max(1, Number(max_repair_attempts) || 3)) {
    return { eligible: false, reason: 'REPAIR_BUDGET_NOT_EXHAUSTED', failed_attempts: failedRequestIds.length };
  }

  const publications = (Array.isArray(audit) ? audit : [])
    .filter((r) => r?.action === 'ACCEPTED_WORK_PUBLICATION')
    .filter((r) => clean(r?.result?.program, 80).toUpperCase() === programId)
    .sort((a, b) => at(a) - at(b));
  const depPublications = entry.depends_on.map((dep) => publications.filter((r) => Number(r?.result?.wave_index) === Number(dep)).at(-1));
  if (entry.depends_on.length && depPublications.some((r) => !r)) return { eligible: false, reason: 'DEPENDENCY_PUBLICATION_MISSING' };
  if (publications.some((r) => Number(r?.result?.wave_index) === waveIndex)) return { eligible: false, reason: 'WAVE_ALREADY_PUBLISHED' };
  const provenanceFloor = depPublications.length ? Math.max(...depPublications.map(at)) : 0;
  const firstPrepared = rows.find((r) => at(r) > provenanceFloor && clean(r?.result?.status, 40).toUpperCase() === 'PREPARED');
  if (!firstPrepared) return { eligible: false, reason: 'FIRST_PREPARED_AFTER_DEPENDENCY_NOT_FOUND' };

  const expected = [...entry.expected_files];
  const retryEvidenceRow = failed.find((r) => {
    if (at(r) <= at(firstPrepared)) return false;
    const verification = r?.result?.verification;
    return verification && sameSet(verification.pre_existing_dirty_files || [], expected);
  });
  if (!retryEvidenceRow) return { eligible: false, reason: 'SAME_WAVE_DIRTY_PROVENANCE_MISSING' };

  let head;
  try { head = git(repo, ['rev-parse', 'HEAD']); }
  catch { return { eligible: false, reason: 'GIT_TRUTH_UNAVAILABLE' }; }
  const syntax = syntaxCheck(repo, expected);
  if (!syntax.passed) return { eligible: false, reason: 'SYNTAX_CHECK_FAILED', syntax_check: syntax };
  const verification = {
    at: new Date().toISOString(), branch, branch_drift: false,
    schema: 'aurentara.jarvis.trusted-candidate-recovery-verification.v1',
    repo_dir: repo, files_changed: expected, pre_existing_dirty_files: [], syntax_check: syntax
  };
  const evidence = computeJarvisWorkingTreeWaveEvidenceV1({ repo_dir: repo, target_branch: branch, program: programId, wave_index: waveIndex, verification });
  if (!evidence.sufficient) return { eligible: false, reason: `TRUSTED_EVIDENCE_${evidence.reason}`, evidence };

  const candidateRequestId = failedRequestIds.at(-1);
  const candidateRows = rows.filter((r) => clean(r?.request_id, 80) === candidateRequestId);
  const missionRow = candidateRows.find((r) => clean(r?.result?.title, 200) && clean(r?.result?.goal, 4000)) || firstPrepared;
  return {
    eligible: true,
    reason: null,
    program: programId,
    wave_index: waveIndex,
    request_id: candidateRequestId,
    title: clean(missionRow?.result?.title, 200) || entry.title,
    goal: clean(missionRow?.result?.goal, 4000) || entry.goal,
    head,
    verification,
    evidence,
    provenance: {
      dependency_publications: depPublications.map((r) => ({ wave_index: Number(r?.result?.wave_index), commit: clean(r?.result?.commit, 80) || null, at: r?.occurred_at || r?.timestamp || null })),
      first_prepared_request_id: clean(firstPrepared?.request_id, 80),
      failed_request_ids: failedRequestIds,
      retry_evidence_request_id: clean(retryEvidenceRow?.request_id, 80),
      exact_expected_files: expected
    }
  };
}

export function createJarvisTrustedCandidateRecovererV1(config = {}, deps = {}) {
  const store = deps.memory_store || null;
  const now = deps.now || (() => new Date().toISOString());
  return {
    async recover(request = {}) {      const ownerId = clean(request.owner_id, 80);
      const ownerRef = clean(request.owner_ref, 320);
      if (!store || typeof store.readAudit !== 'function' || typeof store.appendAudit !== 'function') {
        return { ok: false, status: 503, error: 'TRUSTED_CANDIDATE_RECOVERY_STORE_REQUIRED' };
      }
      let audit;
      try { audit = await store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 }); }
      catch { return { ok: false, status: 503, error: 'TRUSTED_CANDIDATE_RECOVERY_AUDIT_READ_FAILED' }; }

      const evaluation = evaluateJarvisTrustedCandidateRecoveryV1({
        audit,
        program: request.program,
        wave_index: request.wave_index,
        repo_dir: request.repo_dir,
        target_branch: request.target_branch,
        max_repair_attempts: request.max_repair_attempts
      });
      if (!evaluation.eligible) {
        return { ok: false, status: 409, error: 'TRUSTED_CANDIDATE_RECOVERY_INELIGIBLE', reason: evaluation.reason, evaluation };
      }

      const evidenceId = `trusted-candidate:${evaluation.request_id}:wave-${evaluation.wave_index}:${evaluation.head.slice(0, 12)}`;
      const event = createJarvisAuditEventV1({
        timestamp: now(), owner_ref: ownerRef,
        request: `[TRUSTED CANDIDATE RECOVERY] ${evaluation.title} · ${evaluation.program}`,
        intent: { intent_type: JARVIS_ENGINEERING_MISSION_INTENT, domain: JARVIS_ENGINEERING_MISSION_DOMAIN, action: JARVIS_ENGINEERING_MISSION_ACTION },
        tools_used: [], permissions: ['REPAIR_RETRY'], action: JARVIS_ENGINEERING_MISSION_ACTION,        result: {
          status: 'COMPLETED', verified: true, external_effect: false,
          independent_acceptance: false, acceptance_ref: null,
          claude_execution_state: JARVIS_TRUSTED_CANDIDATE_RECOVERY_STATE,
          evidence_id: evidenceId, program: evaluation.program,
          wave_index: evaluation.wave_index, wave_state: 'COMPLETE',
          title: evaluation.title, goal: evaluation.goal,
          verification: evaluation.verification,
          trusted_candidate_recovery: true,
          recovery_provenance: evaluation.provenance
        },
        approval: {
          required: false, explicit: false, actor_type: 'SYSTEM',
          gate_status: 'TRUSTED_CANDIDATE_RECOVERY_EVIDENCE_ONLY'
        },
        cost: { estimated_eur: 0, actual_eur: 0 },
        memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
      });
      event.request_id = evaluation.request_id;
      try { await store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event }); }
      catch { return { ok: false, status: 503, error: 'TRUSTED_CANDIDATE_RECOVERY_PERSIST_FAILED' }; }
      return {
        ok: true, status: 200, recovered: true,
        program: evaluation.program, wave_index: evaluation.wave_index,
        request_id: evaluation.request_id, evidence_id: evidenceId,
        independent_acceptance: false, acceptance_ref: null
      };
    }
  };
}

export function jarvisTrustedCandidateRecoveryManifestV1() {
  return {
    schema: 'aurentara.jarvis.trusted-candidate-recovery.v1',
    v3_only: true, requires_exhausted_repair_budget: true,
    requires_exact_registry_dirty_set: true, requires_same_wave_provenance: true,
    reruns_registry_checks: true, grants_independent_acceptance: false,
    commits: false, pushes: false, merges: false, deploys: false,
    production_deploy: false, hamyren_data_flow: false
  };
}