/* JARVIS — Commit-Range Independent Acceptance V1.

   Explicit, distinct operator (or operator-authorized) acceptance for
   engineering work that was implemented and committed BEFORE any live
   repo-bound dispatch could observe it as a working-tree diff (see
   commit-range-evidence-v1.js's header for why that is a distinct, equally
   strict evidence type — never a looser one). Mirrors
   engineering-mission-acceptance-v1.js's guarantees:
     - never a worker's self-report — evidence is computed by trusted code
       from real git history and real, just-executed checks;
     - still gated on a real, persisted Program Approval covering ACCEPTANCE
       for this exact program + repo_dir + target_branch — never granted by
       this module itself;
     - idempotent — a repeat call against an already-accepted wave never
       grants a second, redundant acceptance row;
     - `expected_files` and `required_checks` are read ONLY from the fixed,
       reviewed wave-registry-v1.js entry — never accepted as caller-
       supplied parameters, which would let a caller weaken or skip its own
       verification;
     - the resulting audit row has the SAME shape v2-progress-v1.js already
       reads (action IMPLEMENTATION_MISSION, result.wave_state COMPLETE,
       result.independent_acceptance true, result.acceptance_ref present) —
       no change to v2-progress-v1.js or command-center-read-bindings-v1.js
       was needed or made.

   Node-only (commit-range-evidence-v1.js runs real git/child_process calls)
   — same import-direction rule as the rest of V2's Node-only modules: never
   imported by http-v1.js, standalone-worker-v1.js, or any deployed-Worker
   entrypoint. */

import { createJarvisAuditEventV1 } from './audit-v1.js';
import { evaluateJarvisProgramApprovalStateV1, evaluateJarvisProgramApprovalActionV1 } from './program-approval-v1.js';
import { getJarvisWaveRegistryEntryV1 } from './wave-registry-v1.js';
import { computeJarvisCommitRangeEvidenceV1 } from './commit-range-evidence-v1.js';
import { JARVIS_ENGINEERING_MISSION_ACTION, JARVIS_ENGINEERING_MISSION_DOMAIN } from './engineering-mission-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_COMMIT_RANGE_ACCEPTANCE_INTENT = 'COMMIT_RANGE_MISSION_ACCEPTANCE';

function newAuditRequestIdV1() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** The one mutating entry point for this evidence path. `request` carries
 *  owner + program + repo_dir + target_branch + wave_index + commit_sha
 *  ONLY — never expected_files/required_checks (those come from the fixed
 *  registry entry, see the file header). */
export async function handleJarvisCommitRangeAcceptanceRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const program = clean(request.program, 80).toUpperCase();
  const repoDir = clean(request.repo_dir, 400);
  const targetBranch = clean(request.target_branch, 200);
  const waveIndex = Number(request.wave_index);
  const commitSha = clean(request.commit_sha, 80);
  const now = clean(request.now, 80) || new Date().toISOString();

  if (!UUID_RE.test(ownerId)) return { ok: false, status: 400, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_OWNER_ID_REQUIRED', accepted: false };
  if (!ownerRef) return { ok: false, status: 403, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_OWNER_REF_REQUIRED', accepted: false };
  if (!program || !repoDir || !targetBranch) return { ok: false, status: 400, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_REQUEST_INVALID', accepted: false };
  if (!Number.isInteger(waveIndex) || waveIndex < 0) return { ok: false, status: 400, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_WAVE_INDEX_REQUIRED', accepted: false };
  if (!commitSha) return { ok: false, status: 400, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_COMMIT_SHA_REQUIRED', accepted: false };
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function' || typeof deps.memory_store.readAudit !== 'function') {
    return { ok: false, status: 503, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_MEMORY_STORE_REQUIRED', accepted: false };
  }

  const entry = getJarvisWaveRegistryEntryV1(program, waveIndex);
  if (!entry) return { ok: false, status: 404, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_WAVE_NOT_REGISTERED', accepted: false };

  let audit = [];
  try {
    audit = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_AUDIT_READ_FAILED', accepted: false };
  }

  // Program Approval must ALREADY cover ACCEPTANCE for this exact
  // program+repo_dir+target_branch — this module never grants that itself.
  const approvalState = evaluateJarvisProgramApprovalStateV1(audit, program);
  const acceptCheck = evaluateJarvisProgramApprovalActionV1(approvalState, {
    capability: 'ACCEPTANCE', program, repo_dir: repoDir, target_branch: targetBranch
  });
  if (!acceptCheck.covered) {
    return {
      ok: false, status: 403, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_NOT_COVERED_BY_PROGRAM_APPROVAL',
      reason: acceptCheck.reason, accepted: false
    };
  }

  // Idempotent duplicate guard: never a second, redundant acceptance row for
  // a wave already independently accepted, by ANY evidence path.
  const alreadyAccepted = audit.some((row) =>
    row?.action === JARVIS_ENGINEERING_MISSION_ACTION
    && clean(row?.result?.program, 80).toUpperCase() === program
    && row?.result?.wave_index === waveIndex
    && row?.result?.independent_acceptance === true
  );
  if (alreadyAccepted) {
    return {
      ok: true, status: 200, schema: 'aurentara.jarvis.commit-range-acceptance-response.v1',
      program, wave_index: waveIndex, accepted: false, duplicate_acceptance_guard: 'ALREADY_ACCEPTED', audit_persisted: false
    };
  }

  const evidence = computeJarvisCommitRangeEvidenceV1({
    repo_dir: repoDir,
    target_branch: targetBranch,
    commit_sha: commitSha,
    expected_files: entry.expected_files,
    required_checks: entry.required_checks,
    generated_files: entry.generated_files
  });

  if (!evidence.sufficient) {
    return {
      ok: false, status: 409, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_VERIFICATION_INSUFFICIENT',
      reason: evidence.reason, evidence, accepted: false
    };
  }

  const acceptanceRef = `commit-range:${evidence.commit}`;

  const auditEvent = createJarvisAuditEventV1({
    timestamp: now,
    owner_ref: ownerRef,
    request: `[INDEPENDENT ACCEPTANCE · COMMIT RANGE] ${entry.title} · ${program}`,
    intent: { intent_type: JARVIS_COMMIT_RANGE_ACCEPTANCE_INTENT, domain: JARVIS_ENGINEERING_MISSION_DOMAIN, action: JARVIS_ENGINEERING_MISSION_ACTION },
    tools_used: [],
    permissions: [],
    action: JARVIS_ENGINEERING_MISSION_ACTION,
    result: {
      status: 'COMPLETED',
      verified: true,
      external_effect: false,
      independent_acceptance: true,
      acceptance_ref: acceptanceRef,
      claude_execution_state: null, // this row records acceptance from historical commit evidence, not a live dispatch
      evidence_id: acceptanceRef,
      program,
      wave_index: waveIndex,
      wave_state: 'COMPLETE',
      title: entry.title,
      goal: entry.goal,
      commit_sha: evidence.commit,
      verification: evidence
    },
    approval: {
      required: false,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: 'INDEPENDENTLY_ACCEPTED_BY_OPERATOR_VIA_COMMIT_RANGE',
      decision: 'accept',
      decided_run_id: acceptanceRef
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });
  auditEvent.request_id = newAuditRequestIdV1();

  try {
    await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: auditEvent });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_COMMIT_RANGE_ACCEPTANCE_PERSIST_FAILED', accepted: false };
  }

  return {
    ok: true,
    status: 200,
    schema: 'aurentara.jarvis.commit-range-acceptance-response.v1',
    program,
    wave_index: waveIndex,
    accepted: true,
    acceptance_ref: acceptanceRef,
    wave_state: 'COMPLETE',
    commit: evidence.commit,
    parent_commit: evidence.parent_commit,
    files_changed: evidence.files_changed,
    check_results: evidence.check_results,
    audit_persisted: true
  };
}

export function jarvisCommitRangeAcceptanceManifestV1() {
  return {
    schema: 'aurentara.jarvis.commit-range-acceptance.v1',
    acceptance_without_program_approval_ever: false,
    acceptance_is_worker_self_report: false,
    duplicate_acceptance_guarded: true,
    evidence_source: 'historical_commit_diff',
    expected_files_and_required_checks_caller_suppliable: false,
    grants_own_program_approval: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
