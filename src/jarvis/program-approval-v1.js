/* JARVIS — Program-level Approval V1.

   Every prior approval in this system is per-request_id: one distinct
   operator decision authorizes exactly one dispatch. That is correct for an
   arbitrary, unbounded action, but it means an operator running an entire
   multi-wave program (JARVIS_MASTERARCHITECTURE_V2) has to click "approve"
   once per wave forever. This module adds ONE additional, narrower kind of
   approval: a scoped, named Program Approval that — once genuinely granted
   by the operator — lets program-controller-v1.js authorize dispatch for
   actions that fall STRICTLY within its declared scope, without a fresh
   per-mission click.

   This does NOT weaken the existing per-mission approval path — it adds a
   second, narrower way to satisfy the same "a distinct, persisted operator
   decision must exist" rule. Both paths still require a real, persisted,
   operator-attributed audit event; neither can be self-granted by a worker,
   and neither is inferred from anything ambient (time, prior runs, chat
   text).

   Hard bounds:
     - the grant itself is a DISTINCT, explicit OPERATOR action (same actor
       shape as command-center-approval-runtime-v1.js) — this module never
       grants itself, and http-v1.js never calls it automatically;
     - scope is a fixed, enumerable allowlist AND an explicit denylist
       (JARVIS_PROGRAM_APPROVAL_NEVER_COVERED) that is checked FIRST and
       cannot be overridden by anything the grant call sends — main/master,
       merge, deploy, production, DNS, Cloudflare mutation, billing,
       secrets, public release, destructive DB, HAMYREN, force push are
       structurally never coverable, regardless of what scope a grant call
       requests;
     - a grant is scoped to exactly one target_branch and one repo_dir; an
       action for a different branch/repo is never covered;
     - revocable: a later REVOKE event for the same program supersedes any
       earlier GRANT (latest-wins, like every other audit-derived state in
       this codebase);
     - every grant/revoke is its own auditable event — nothing here is
       inferred, only read back from the durable audit trail. */

import { createJarvisAuditEventV1 } from './audit-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROGRAM_RE = /^[A-Z][A-Z0-9_]{2,79}$/;

export const JARVIS_PROGRAM_APPROVAL_ACTION = 'PROGRAM_APPROVAL';
export const JARVIS_PROGRAM_APPROVAL_GRANT_INTENT = 'PROGRAM_APPROVAL_GRANT';
export const JARVIS_PROGRAM_APPROVAL_REVOKE_INTENT = 'PROGRAM_APPROVAL_REVOKE';
export const JARVIS_PROGRAM_APPROVAL_ROUTE = '/api/program/approve';

// What a Program Approval CAN ever cover, if the grant explicitly names it.
export const JARVIS_PROGRAM_APPROVAL_COVERABLE = Object.freeze([
  'REPO_INTERNAL_READ',
  'REPO_INTERNAL_WRITE',
  'REPO_INTERNAL_TEST',
  'LOCAL_FEATURE_BRANCH_MANAGEMENT',
  'CLAUDE_REPO_BOUND_EXECUTION',
  'INDEPENDENT_VERIFICATION',
  'REPAIR_RETRY',
  'ACCEPTANCE',
  'PROGRESS_ADVANCEMENT',
  'NEXT_WAVE_CONTINUATION'
]);

// What a Program Approval can NEVER cover, no matter what a grant call
// requests. Checked first, unconditionally, in evaluateJarvisProgramApprovalActionV1.
export const JARVIS_PROGRAM_APPROVAL_NEVER_COVERED = Object.freeze([
  'MAIN_MASTER_MUTATION',
  'MERGE',
  'DEPLOY',
  'PRODUCTION_ACTIVATION',
  'DNS_MUTATION',
  'CLOUDFLARE_MUTATION',
  'BILLING',
  'SECRET_ACCESS',
  'PUBLIC_RELEASE',
  'DESTRUCTIVE_DB',
  'HAMYREN_DATA_FLOW',
  'FORCE_PUSH'
]);

/** Pure. Is `capability` (one of JARVIS_PROGRAM_APPROVAL_COVERABLE) actually
 *  authorized by this grant, for this exact program/repo/branch? The
 *  denylist is checked unconditionally FIRST — a grant can never widen past
 *  it, even if a caller (bug or not) put it in `scope`. */
export function evaluateJarvisProgramApprovalActionV1(grant, { capability, program, repo_dir, target_branch } = {}) {
  const cap = clean(capability, 80).toUpperCase();
  if (JARVIS_PROGRAM_APPROVAL_NEVER_COVERED.includes(cap)) {
    return { covered: false, reason: 'NEVER_COVERABLE' };
  }
  if (!grant || grant.granted !== true) {
    return { covered: false, reason: 'NO_PROGRAM_APPROVAL_GRANTED' };
  }
  if (clean(grant.program, 80).toUpperCase() !== clean(program, 80).toUpperCase()) {
    return { covered: false, reason: 'PROGRAM_MISMATCH' };
  }
  if (clean(grant.repo_dir, 400) !== clean(repo_dir, 400)) {
    return { covered: false, reason: 'REPO_DIR_MISMATCH' };
  }
  if (clean(grant.target_branch, 200) !== clean(target_branch, 200)) {
    return { covered: false, reason: 'TARGET_BRANCH_MISMATCH' };
  }
  if (!Array.isArray(grant.scope) || !grant.scope.includes(cap)) {
    return { covered: false, reason: 'CAPABILITY_NOT_IN_GRANTED_SCOPE' };
  }
  return { covered: true, reason: null };
}

/** Pure read of the durable audit trail: the latest GRANT or REVOKE for this
 *  program wins (chronological, not insertion order). */
export function evaluateJarvisProgramApprovalStateV1(auditRows = [], program = '') {
  const programUpper = clean(program, 80).toUpperCase();
  const rows = (Array.isArray(auditRows) ? auditRows : [])
    .filter((row) => row?.action === JARVIS_PROGRAM_APPROVAL_ACTION
      && clean(row?.result?.program, 80).toUpperCase() === programUpper
      && (row?.intent?.intent_type === JARVIS_PROGRAM_APPROVAL_GRANT_INTENT || row?.intent?.intent_type === JARVIS_PROGRAM_APPROVAL_REVOKE_INTENT))
    .sort((a, b) => Date.parse(a?.timestamp || 0) - Date.parse(b?.timestamp || 0));
  const last = rows[rows.length - 1] || null;

  if (!last || last.intent.intent_type === JARVIS_PROGRAM_APPROVAL_REVOKE_INTENT) {
    return { granted: false, program: programUpper || null, scope: [], repo_dir: null, target_branch: null, granted_at: null, revoked: Boolean(last) };
  }
  return {
    granted: true,
    program: programUpper,
    scope: Array.isArray(last.result?.scope) ? last.result.scope : [],
    repo_dir: clean(last.result?.repo_dir, 400) || null,
    target_branch: clean(last.result?.target_branch, 200) || null,
    granted_at: clean(last.timestamp, 80) || null,
    granted_ref: `program-approval:${program}:${last.timestamp}`,
    revoked: false
  };
}

/** Explicit, operator-only grant. `request` must state exactly the scope
 *  being granted; anything in JARVIS_PROGRAM_APPROVAL_NEVER_COVERED is
 *  stripped before persisting, never silently widened. */
export async function handleJarvisProgramApprovalGrantRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const program = clean(request.program, 80).toUpperCase();
  const repoDir = clean(request.repo_dir, 400);
  const targetBranch = clean(request.target_branch, 200);
  const requestedScope = Array.isArray(request.scope) ? request.scope.map((s) => clean(s, 80).toUpperCase()) : [];

  if (!UUID_RE.test(ownerId)) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_APPROVAL_OWNER_ID_REQUIRED' };
  if (!ownerRef) return { ok: false, status: 403, error: 'JARVIS_PROGRAM_APPROVAL_OWNER_REF_REQUIRED' };
  if (!program || !PROGRAM_RE.test(program)) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_APPROVAL_PROGRAM_INVALID' };
  if (!repoDir) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_APPROVAL_REPO_DIR_REQUIRED' };
  if (!targetBranch) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_APPROVAL_TARGET_BRANCH_REQUIRED' };
  if (request.confirm_scope !== true) return { ok: false, status: 400, error: 'JARVIS_PROGRAM_APPROVAL_CONFIRM_SCOPE_REQUIRED' };
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function') {
    return { ok: false, status: 503, error: 'JARVIS_PROGRAM_APPROVAL_MEMORY_STORE_REQUIRED' };
  }

  // Never widened by the request: only capabilities BOTH requested AND on
  // the coverable allowlist are granted; anything on the denylist is
  // dropped even if present in `scope`.
  const grantedScope = requestedScope
    .filter((s) => JARVIS_PROGRAM_APPROVAL_COVERABLE.includes(s))
    .filter((s) => !JARVIS_PROGRAM_APPROVAL_NEVER_COVERED.includes(s));
  const rejectedScope = requestedScope.filter((s) => !grantedScope.includes(s));

  const now = clean(request.now, 80) || new Date().toISOString();
  const auditEvent = createJarvisAuditEventV1({
    timestamp: now,
    owner_ref: ownerRef,
    request: `[PROGRAM APPROVAL] ${program} · ${targetBranch}`,
    intent: { intent_type: JARVIS_PROGRAM_APPROVAL_GRANT_INTENT, domain: 'PROGRAM', action: JARVIS_PROGRAM_APPROVAL_ACTION },
    tools_used: [],
    permissions: [],
    action: JARVIS_PROGRAM_APPROVAL_ACTION,
    result: {
      status: 'GRANTED',
      program,
      repo_dir: repoDir,
      target_branch: targetBranch,
      scope: grantedScope,
      rejected_scope: rejectedScope
    },
    approval: {
      required: true,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: 'PROGRAM_APPROVED_BY_OPERATOR',
      decision: 'approve'
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });

  try {
    await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: auditEvent });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_PROGRAM_APPROVAL_PERSIST_FAILED' };
  }

  return {
    ok: true,
    status: 200,
    schema: 'aurentara.jarvis.program-approval-response.v1',
    program,
    repo_dir: repoDir,
    target_branch: targetBranch,
    granted_scope: grantedScope,
    rejected_scope: rejectedScope,
    audit_persisted: true
  };
}

export function jarvisProgramApprovalManifestV1() {
  return {
    schema: 'aurentara.jarvis.program-approval.v1',
    route: JARVIS_PROGRAM_APPROVAL_ROUTE,
    coverable: [...JARVIS_PROGRAM_APPROVAL_COVERABLE],
    never_covered: [...JARVIS_PROGRAM_APPROVAL_NEVER_COVERED],
    scoped_to_single_repo_dir_and_branch: true,
    grant_requires_explicit_operator_action: true,
    grant_never_issued_automatically: true,
    scope_deny_list_checked_before_allow_list: true,
    revocable: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
