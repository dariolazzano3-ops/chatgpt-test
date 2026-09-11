/* JARVIS — Engineering Mission INDEPENDENT ACCEPTANCE V1.

   Closes the last V1→V2 gap: a genuinely COMPLETE Claude Code dispatch
   (engineering-mission-v1.js / engineering-mission-resume-v1.js) still never
   counts toward V2 progress on its own — v2-progress-v1.js requires
   independent_acceptance === true AND a non-empty acceptance_ref on a
   COMPLETE wave row, and the bridge itself always sets
   independent_acceptance: false (claude-code-bridge-v1.js). Nothing before
   this module could ever produce the row that flips that to true, so an
   approved-and-dispatched mission could reach COMPLETE and still contribute
   0% forever.

   This module is that missing, explicit, SEPARATE step — and only that step.
   It grants nothing on its own report:
     - it requires a real, already-persisted dispatch for this exact
       request_id whose claude_execution_state is COMPLETE;
     - it requires that dispatch to carry `verification` evidence computed by
       claude-code-repo-bound-executor-v1.js (bridge-side, trusted, computed
       from real `git status --porcelain` / `node --check` output) showing:
         - the branch did not drift mid-run,
         - at least one real file in the real repo actually changed, and
         - every changed .js/.mjs file still passes a syntax check.
       A disposable-tmp-workspace dispatch (verification === null) can NEVER
       be accepted through this path — only real, repo-bound implementation
       work can advance V2 progress, by construction, not by convention;
     - the acceptance itself is a DISTINCT, explicit OPERATOR action (actor_type
       OPERATOR, explicit: true) — the exact same shape as the approval
       decision in command-center-approval-runtime-v1.js — never emitted
       automatically when a dispatch completes, and never accepted from
       anything the caller of this route asserts about its own work;
     - idempotent: a request_id already accepted is refused, not re-granted;
     - fails closed on no dispatch, insufficient verification, or a storage
       error. */

import { createJarvisAuditEventV1 } from './audit-v1.js';
import {
  JARVIS_ENGINEERING_MISSION_ACTION,
  JARVIS_ENGINEERING_MISSION_INTENT,
  JARVIS_ENGINEERING_MISSION_DOMAIN
} from './engineering-mission-v1.js';
import { JARVIS_REPO_BOUND_PROTECTED_BRANCHES } from './claude-code-repo-bound-executor-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_ENGINEERING_MISSION_ACCEPTANCE_INTENT = 'IMPLEMENTATION_MISSION_ACCEPTANCE';
export const JARVIS_ENGINEERING_MISSION_ACCEPTANCE_ROUTE = '/jarvis/api/engineering-mission/accept';

/** Pure. Is this dispatch's verification evidence strong enough to ever be
 *  accepted — regardless of who is asking? The SAME rule the acceptance
 *  endpoint enforces, exported so the UI-facing projection can compute
 *  "Als abgenommen markieren" visibility identically — never a looser one. */
export function evaluateJarvisRepoBoundVerificationV1(verification) {
  if (!verification || typeof verification !== 'object') {
    return { sufficient: false, reason: 'NO_VERIFICATION_EVIDENCE_NOT_REPO_BOUND' };
  }
  if (verification.branch_drift === true) return { sufficient: false, reason: 'BRANCH_DRIFT_DETECTED' };
  const branch = clean(verification.branch, 200).toLowerCase();
  if (!branch || JARVIS_REPO_BOUND_PROTECTED_BRANCHES.includes(branch)) {
    return { sufficient: false, reason: 'PROTECTED_OR_MISSING_BRANCH' };
  }
  const filesChanged = Array.isArray(verification.files_changed) ? verification.files_changed : [];
  if (filesChanged.length === 0) return { sufficient: false, reason: 'NO_REAL_FILES_CHANGED' };
  if (!verification.syntax_check || verification.syntax_check.passed !== true) {
    return { sufficient: false, reason: 'SYNTAX_CHECK_FAILED_OR_MISSING' };
  }
  return { sufficient: true, reason: null };
}

/** Pure read of the durable audit trail for this exact request_id: does it
 *  show a real mission, a genuine COMPLETE dispatch with sufficient
 *  bridge-computed verification, and has it already been accepted? */
export function evaluateJarvisEngineeringMissionAcceptanceStateV1(auditRows = [], requestId = '') {
  const id = clean(requestId, 80).toLowerCase();
  const rows = (Array.isArray(auditRows) ? auditRows : []).filter((row) => clean(row?.request_id, 80).toLowerCase() === id);

  const missionRows = rows
    .filter((row) => row?.action === JARVIS_ENGINEERING_MISSION_ACTION && row?.intent?.intent_type === JARVIS_ENGINEERING_MISSION_INTENT)
    .sort((a, b) => Date.parse(a?.timestamp || 0) - Date.parse(b?.timestamp || 0));
  const original = missionRows[0] || null;

  const dispatchRows = rows
    .filter((row) => row?.result?.claude_execution_state != null)
    .sort((a, b) => Date.parse(a?.timestamp || 0) - Date.parse(b?.timestamp || 0));
  const lastDispatch = dispatchRows[dispatchRows.length - 1] || null;
  const dispatched = Boolean(lastDispatch) && lastDispatch.result.claude_execution_state === 'COMPLETE';

  const verification = lastDispatch?.result?.verification || null;
  const verificationCheck = evaluateJarvisRepoBoundVerificationV1(verification);

  const alreadyAccepted = rows.some((row) => row?.intent?.intent_type === JARVIS_ENGINEERING_MISSION_ACCEPTANCE_INTENT);

  return {
    request_id: id || null,
    mission_found: Boolean(original),
    mission_payload: original ? {
      title: clean(original.result?.title, 200),
      goal: clean(original.result?.goal, 4000),
      program: clean(original.result?.program, 80),
      wave_index: original.result?.wave_index ?? null
    } : null,
    dispatched,
    verification,
    verification_sufficient: verificationCheck.sufficient,
    verification_insufficient_reason: verificationCheck.sufficient ? null : verificationCheck.reason,
    already_accepted: alreadyAccepted,
    evidence_id: lastDispatch?.result?.evidence_id || null,
    // Mirrors the acceptance endpoint's own gate exactly.
    acceptable: Boolean(original) && dispatched && verificationCheck.sufficient && !alreadyAccepted
  };
}

/** Explicit, distinct operator acceptance. `request` carries ONLY owner +
 *  request_id; the mission and its verification evidence are both read back
 *  from the durable audit trail — this call can never assert its own
 *  acceptance basis. */
export async function handleJarvisEngineeringMissionAcceptanceRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const requestId = clean(request.request_id || request.correlation_id, 80).toLowerCase();

  if (!UUID_RE.test(ownerId)) return { ok: false, status: 400, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_OWNER_ID_REQUIRED', accepted: false };
  if (!ownerRef) return { ok: false, status: 403, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_OWNER_REF_REQUIRED', accepted: false };
  if (!UUID_RE.test(requestId)) return { ok: false, status: 400, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_REQUEST_ID_REQUIRED', accepted: false };
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function' || typeof deps.memory_store.readAudit !== 'function') {
    return { ok: false, status: 503, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_MEMORY_STORE_REQUIRED', accepted: false };
  }

  let audit = [];
  try {
    audit = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_AUDIT_READ_FAILED', accepted: false };
  }

  const state = evaluateJarvisEngineeringMissionAcceptanceStateV1(audit, requestId);

  if (!state.mission_found) {
    return { ok: false, status: 404, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_MISSION_NOT_FOUND', request_id: requestId, accepted: false };
  }
  if (!state.dispatched) {
    return { ok: false, status: 409, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_NOT_DISPATCHED', request_id: requestId, accepted: false };
  }
  if (state.already_accepted) {
    // Idempotent, not an error: a repeated accept call never grants a second,
    // redundant acceptance row.
    return {
      ok: true,
      status: 200,
      schema: 'aurentara.jarvis.engineering-mission-acceptance-response.v1',
      request_id: requestId,
      accepted: false,
      duplicate_acceptance_guard: 'ALREADY_ACCEPTED',
      audit_persisted: false
    };
  }
  if (!state.verification_sufficient) {
    return {
      ok: false,
      status: 409,
      error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_VERIFICATION_INSUFFICIENT',
      reason: state.verification_insufficient_reason,
      request_id: requestId,
      accepted: false
    };
  }

  const now = clean(request.now, 80) || new Date().toISOString();
  // Deterministic, non-secret, derived only from data already in the durable
  // audit trail (never a value the caller supplies) — a real, checkable
  // pointer back to the exact verification evidence being accepted, not an
  // arbitrary token.
  const acceptanceRef = `accept:${requestId}:${state.evidence_id || 'no-evidence'}`;

  const auditEvent = createJarvisAuditEventV1({
    timestamp: now,
    owner_ref: ownerRef,
    request: `[INDEPENDENT ACCEPTANCE] ${state.mission_payload.title} · ${state.mission_payload.program}`,
    intent: { intent_type: JARVIS_ENGINEERING_MISSION_ACCEPTANCE_INTENT, domain: JARVIS_ENGINEERING_MISSION_DOMAIN, action: JARVIS_ENGINEERING_MISSION_ACTION },
    tools_used: [],
    permissions: [],
    action: JARVIS_ENGINEERING_MISSION_ACTION,
    result: {
      status: 'COMPLETED',
      verified: true,
      external_effect: false,
      independent_acceptance: true,
      acceptance_ref: acceptanceRef,
      claude_execution_state: null, // this row records acceptance, not a dispatch
      evidence_id: state.evidence_id,
      program: state.mission_payload.program,
      wave_index: state.mission_payload.wave_index,
      wave_state: 'COMPLETE',
      title: state.mission_payload.title,
      goal: state.mission_payload.goal,
      accepted_from_request_id: requestId,
      verification: state.verification
    },
    approval: {
      required: false,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: 'INDEPENDENTLY_ACCEPTED_BY_OPERATOR',
      decision: 'accept',
      decided_run_id: requestId
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });
  auditEvent.request_id = requestId;

  try {
    await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: auditEvent });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_ENGINEERING_MISSION_ACCEPTANCE_PERSIST_FAILED', request_id: requestId, accepted: false };
  }

  return {
    ok: true,
    status: 200,
    schema: 'aurentara.jarvis.engineering-mission-acceptance-response.v1',
    request_id: requestId,
    accepted: true,
    acceptance_ref: acceptanceRef,
    program: state.mission_payload.program,
    wave_index: state.mission_payload.wave_index,
    wave_state: 'COMPLETE',
    verification_summary: {
      files_changed: state.verification?.files_changed || [],
      syntax_checked: state.verification?.syntax_check?.checked ?? 0
    },
    audit_persisted: true
  };
}

export function jarvisEngineeringMissionAcceptanceManifestV1() {
  return {
    schema: 'aurentara.jarvis.engineering-mission-acceptance.v1',
    route: JARVIS_ENGINEERING_MISSION_ACCEPTANCE_ROUTE,
    intent_type: JARVIS_ENGINEERING_MISSION_ACCEPTANCE_INTENT,
    requires_prior_complete_dispatch: true,
    requires_repo_bound_verification: true,
    requires_real_files_changed: true,
    requires_syntax_check_pass: true,
    requires_no_branch_drift: true,
    protected_branches: [...JARVIS_REPO_BOUND_PROTECTED_BRANCHES],
    self_acceptance_by_worker: false,
    distinct_operator_action_required: true,
    idempotent_on_repeat: true,
    fails_closed: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
