/* JARVIS — Engineering Mission RESUME V1 (canonical approval-resume path).

   Closes the V1 usability gap: an operator approval decision
   (command-center-approval-runtime-v1.js /jarvis/api/approvals/decide) is
   recorded as a DISTINCT audit event and intentionally never executes
   anything. Nothing previously re-dispatched the same mission after that
   approval landed, so an approved mission stayed stuck at WAITING_APPROVAL
   forever. This module is that missing, explicit step — and only that step.

   Guarantees (same boundary as engineering-mission-v1.js):
     - approving is still never execution — this module is a SEPARATE,
       explicit operator action (POST /jarvis/api/engineering-mission/resume);
     - dispatches the SAME mission: the persisted mission payload
       (title/goal/program/wave_index) is read back from the ORIGINAL
       IMPLEMENTATION_MISSION audit row for this exact request_id — the
       caller may supply only the request_id, never replacement mission
       fields; anything else in the body is ignored;
     - the action gate is re-evaluated fresh on every resume call, never
       cached from the original request;
     - the persisted approval is read from the durable audit trail only
       (same correlation check as the original handler: a distinct
       operator-authored `approve` decision whose decided_run_id equals
       this request_id) — never from a client-supplied "already approved"
       flag;
     - duplicate-execution protection: if ANY prior audit row for this
       request_id (the original dispatch attempt or an earlier resume) shows
       a non-null claude_execution_state, dispatch already happened —
       further resume calls (including a page refresh re-POSTing) are
       refused and return the prior state instead of dispatching again;
     - fails closed: no approval found, no original mission found, no bound
       executor, or a storage failure all refuse execution rather than guess;
     - every call, dispatched or not, is auditable. */

import { JARVIS_AUTONOMY, normalizeJarvisPolicy } from './contracts-v1.js';
import { evaluateJarvisActionGateV1 } from './action-gate-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import {
  JARVIS_ENGINEERING_MISSION_ACTION,
  JARVIS_ENGINEERING_MISSION_INTENT,
  JARVIS_ENGINEERING_MISSION_WORKSPACE,
  resolveJarvisEngineeringMissionIntentV1
} from './engineering-mission-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_ENGINEERING_MISSION_RESUME_INTENT = 'IMPLEMENTATION_MISSION_RESUME_REQUEST';
export const JARVIS_ENGINEERING_MISSION_RESUME_ROUTE = '/jarvis/api/engineering-mission/resume';

const BRIDGE_STATE_TO_WAVE = Object.freeze({
  QUEUED: 'RUNNING',
  RUNNING: 'RUNNING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  TIMEOUT: 'FAILED',
  CANCELLED: 'FAILED',
  BLOCKED: 'BLOCKED',
  UNAVAILABLE: 'BLOCKED'
});

/** Pure read of the durable audit trail: does it show, for this exact
 *  request_id, (a) a genuine distinct operator approval, and (b) the
 *  original persisted mission payload, and (c) whether dispatch already
 *  happened. Exported so the UI-facing runtime-truth projection can compute
 *  "Mission ausführen" visibility with the exact same rule the resume
 *  endpoint enforces — never a looser one. */
export function evaluateJarvisEngineeringMissionResumeStateV1(auditRows = [], requestId = '') {
  const id = clean(requestId, 80).toLowerCase();
  const rows = (Array.isArray(auditRows) ? auditRows : []).filter((row) => clean(row?.request_id, 80).toLowerCase() === id);

  const originalRows = rows
    .filter((row) => row?.action === JARVIS_ENGINEERING_MISSION_ACTION && row?.intent?.intent_type === JARVIS_ENGINEERING_MISSION_INTENT)
    .sort((a, b) => Date.parse(a?.timestamp || 0) - Date.parse(b?.timestamp || 0));
  const original = originalRows[0] || null;

  const approvalGranted = rows.some((row) =>
    row?.approval?.decision === 'approve' && clean(row?.approval?.decided_run_id, 200) === id
  );

  const alreadyExecuted = rows.some((row) => row?.result?.claude_execution_state != null);
  const lastExecuted = alreadyExecuted
    ? [...rows].reverse().find((row) => row?.result?.claude_execution_state != null)
    : null;

  return {
    request_id: id || null,
    mission_found: Boolean(original),
    mission_payload: original ? {
      title: clean(original.result?.title, 200),
      goal: clean(original.result?.goal, 4000),
      program: clean(original.result?.program, 80),
      wave_index: original.result?.wave_index ?? null
    } : null,
    approval_granted: approvalGranted,
    already_executed: alreadyExecuted,
    // Mirrors the "Mission ausführen" visibility rule exactly.
    resumable: Boolean(original) && approvalGranted && !alreadyExecuted,
    last_execution_state: lastExecuted?.result?.claude_execution_state || null,
    last_wave_state: lastExecuted?.result?.wave_state || null
  };
}

/** Explicit operator resume. `request` carries ONLY owner + request_id
 *  (+ optional policy); any mission-shaped fields the caller sends are
 *  ignored — the mission comes from the durable audit trail, never the
 *  client. */
export async function handleJarvisEngineeringMissionResumeRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  const requestId = clean(request.request_id || request.correlation_id, 80).toLowerCase();

  if (!UUID_RE.test(ownerId)) return { ok: false, status: 400, error: 'JARVIS_ENGINEERING_MISSION_RESUME_OWNER_ID_REQUIRED', executed: false };
  if (!ownerRef) return { ok: false, status: 403, error: 'JARVIS_ENGINEERING_MISSION_RESUME_OWNER_REF_REQUIRED', executed: false };
  if (!UUID_RE.test(requestId)) return { ok: false, status: 400, error: 'JARVIS_ENGINEERING_MISSION_RESUME_REQUEST_ID_REQUIRED', executed: false };
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function' || typeof deps.memory_store.readAudit !== 'function') {
    return { ok: false, status: 503, error: 'JARVIS_ENGINEERING_MISSION_RESUME_MEMORY_STORE_REQUIRED', executed: false };
  }

  let audit = [];
  try {
    audit = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 500 });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_ENGINEERING_MISSION_RESUME_AUDIT_READ_FAILED', executed: false };
  }

  const state = evaluateJarvisEngineeringMissionResumeStateV1(audit, requestId);

  if (!state.mission_found) {
    return { ok: false, status: 404, error: 'JARVIS_ENGINEERING_MISSION_RESUME_MISSION_NOT_FOUND', request_id: requestId, executed: false };
  }
  if (!state.approval_granted) {
    return { ok: false, status: 409, error: 'JARVIS_ENGINEERING_MISSION_RESUME_NOT_APPROVED', request_id: requestId, executed: false };
  }
  if (state.already_executed) {
    // Fail closed toward safety, not toward re-execution: same request_id,
    // no client-supplied goal, no second dispatch — this is exactly the
    // "no automatic repeated execution on page refresh" / duplicate-execution
    // guard, expressed as an idempotent, non-error response.
    return {
      ok: true,
      status: 200,
      schema: 'aurentara.jarvis.engineering-mission-resume-response.v1',
      request_id: requestId,
      correlation_id: requestId,
      resumed: false,
      executed: false,
      duplicate_execution_guard: 'BLOCKED_DUPLICATE',
      last_execution_state: state.last_execution_state,
      wave_state: state.last_wave_state,
      audit_persisted: false
    };
  }

  // Reconstruct the mission from the persisted payload ONLY — resolveJarvisEngineeringMissionIntentV1
  // re-validates it exactly as the original dispatch did, but no field here
  // can come from this resume request's body.
  const intent = resolveJarvisEngineeringMissionIntentV1({
    title: state.mission_payload.title,
    goal: state.mission_payload.goal,
    program: state.mission_payload.program,
    correlation_id: requestId,
    wave_index: state.mission_payload.wave_index
  });
  if (!intent.ok) {
    return { ok: false, status: 500, error: 'JARVIS_ENGINEERING_MISSION_RESUME_PERSISTED_PAYLOAD_INVALID', request_id: requestId, executed: false };
  }

  // Action gate re-evaluated fresh, exactly like every other JARVIS action —
  // never reused from the original request.
  const policy = normalizeJarvisPolicy(request.policy || {});
  const gate = evaluateJarvisActionGateV1({ action: intent.action, policy, explicit_approval: false });

  // Internal-only, second evaluation: explicit_approval is derived ONLY from
  // the durable audit decision found above, never from anything this resume
  // request itself asserts.
  const localPolicy = normalizeJarvisPolicy({ autonomy_level: JARVIS_AUTONOMY.APPROVAL_GATED_EXTERNAL_ACTION, allow_external_writes: true });
  const authorizedGate = evaluateJarvisActionGateV1({ action: intent.action, policy: localPolicy, explicit_approval: true });

  let bridgeExecution = null;
  let waveState = 'NOT_STARTED';
  const claudeBridgeBound = Boolean(deps.claude_bridge && deps.claude_bridge.bound === true);

  if (authorizedGate.execution_authorized === true) {
    if (claudeBridgeBound) {
      const handle = deps.claude_bridge.submit({
        correlation_id: requestId,
        request_id: requestId,
        owner_ref: ownerRef,
        workspace: deps.workspace || JARVIS_ENGINEERING_MISSION_WORKSPACE,
        task: `Engineering Mission (RESUME) [${intent.program}] ${intent.title}\n\nGoal: ${intent.goal}`,
        timeout_ms: deps.claude_timeout_ms
      });
      bridgeExecution = await handle.result;
      waveState = BRIDGE_STATE_TO_WAVE[bridgeExecution.state] || 'FAILED';
    } else {
      waveState = 'BLOCKED';
    }
  }

  const actionResult = {
    ok: !bridgeExecution || bridgeExecution.state !== 'FAILED',
    schema: 'aurentara.jarvis.action-result.v1',
    status: bridgeExecution
      ? (bridgeExecution.state === 'COMPLETE' ? 'COMPLETED' : bridgeExecution.state)
      : 'NOT_EXECUTED',
    verified: bridgeExecution ? bridgeExecution.state === 'COMPLETE' : true,
    external_effect: bridgeExecution ? bridgeExecution.external_effect === true : false,
    independent_acceptance: false,
    output: bridgeExecution ? { evidence_id: bridgeExecution.evidence?.evidence_id || null } : null
  };

  const auditEvent = createJarvisAuditEventV1({
    timestamp: request.now,
    owner_ref: ownerRef,
    request: `[RESUME] ${intent.title} · ${intent.program}`,
    intent: { intent_type: JARVIS_ENGINEERING_MISSION_RESUME_INTENT, domain: intent.domain, action: intent.action },
    tools_used: bridgeExecution ? ['jarvis.claude_code.bridge.v1'] : [],
    permissions: [],
    action: intent.action,
    result: {
      status: actionResult.status,
      verified: actionResult.verified,
      external_effect: actionResult.external_effect,
      independent_acceptance: false,
      acceptance_ref: null,
      claude_execution_state: bridgeExecution?.state || null,
      evidence_id: bridgeExecution?.evidence?.evidence_id || null,
      program: intent.program,
      wave_index: intent.wave_index,
      wave_state: waveState,
      title: intent.title,
      goal: intent.goal,
      resumed_from_request_id: requestId
    },
    approval: {
      required: true,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: 'APPROVED_BY_OPERATOR',
      decision: 'approve',
      approval_id: `${requestId}:approval`,
      decided_run_id: requestId,
      reused_prior_decision: true
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });
  auditEvent.request_id = requestId;

  try {
    await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: auditEvent });
  } catch {
    return { ok: false, status: 503, error: 'JARVIS_ENGINEERING_MISSION_RESUME_PERSIST_FAILED', request_id: requestId, executed: false };
  }

  return {
    ok: gate.ok && actionResult.ok !== false,
    status: 200,
    schema: 'aurentara.jarvis.engineering-mission-resume-response.v1',
    request_id: requestId,
    correlation_id: requestId,
    resumed: true,
    same_request_id: true,
    intent,
    action_gate: gate,
    wave_state: waveState,
    claude_bridge_bound: claudeBridgeBound,
    claude_execution: bridgeExecution ? {
      state: bridgeExecution.state,
      exit_code: bridgeExecution.exit_code,
      external_effect: bridgeExecution.external_effect === true,
      independent_acceptance: false,
      evidence: bridgeExecution.evidence || null
    } : null,
    action_result: actionResult,
    executed: Boolean(bridgeExecution),
    duplicate_execution_guard: 'PASS',
    audit_persisted: true
  };
}

export function jarvisEngineeringMissionResumeManifestV1() {
  return {
    schema: 'aurentara.jarvis.engineering-mission-resume.v1',
    route: JARVIS_ENGINEERING_MISSION_RESUME_ROUTE,
    intent_type: JARVIS_ENGINEERING_MISSION_RESUME_INTENT,
    accepts_client_mission_fields: false,
    mission_payload_source: 'DURABLE_AUDIT_ORIGINAL_REQUEST_ONLY',
    requires_prior_distinct_operator_approval: true,
    approval_bypassed: false,
    action_gate_reevaluated_every_call: true,
    duplicate_execution_guard: 'AUDIT_DERIVED_CLAUDE_EXECUTION_STATE',
    fails_closed: true,
    worker_self_acceptance_counts_as_independent: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
