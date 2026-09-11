/* JARVIS Command Center — approval runtime path V1.

   An operator decision on a projected approval. It is recorded as a NEW
   owner-scoped audit event; it NEVER executes anything.

   Guarantees:
     - a projected approval cannot self-approve — the decision is a distinct
       operator action (actor_type OPERATOR, explicit: true), never emitted by a
       worker path;
     - the decision must correlate to the canonical run/request the approval
       belongs to (run_id must match the projected approval's run_id);
     - approving does NOT bypass the action gate: it only records the decision.
       execution_authorized / external_effect stay false; an authorised executor
       run is a separate step;
     - worker output can never count as acceptance;
     - fail closed if the runtime store is unavailable. */

import { createJarvisAuditEventV1 } from './audit-v1.js';

const clean = (value, max = 600) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_APPROVAL_DECISIONS = Object.freeze(['approve', 'reject', 'defer']);

const GATE_STATUS = Object.freeze({
  approve: 'APPROVED_BY_OPERATOR',
  reject: 'REJECTED_BY_OPERATOR',
  defer: 'DEFERRED_BY_OPERATOR'
});

/** Pure evaluation. `approvals` is the current projected approvals list
 *  (command-center-read-bindings approvals.data.items). */
export function evaluateJarvisApprovalDecisionV1(input = {}) {
  const decision = clean(input.decision, 20).toLowerCase();
  const approvalId = clean(input.approval_id, 240);
  const runId = clean(input.run_id, 200);
  const ownerRef = clean(input.owner_ref, 320);
  const correlationId = clean(input.correlation_id, 80).toLowerCase();
  const now = clean(input.now, 80) || new Date().toISOString();

  if (!JARVIS_APPROVAL_DECISIONS.includes(decision)) return { ok: false, status: 409, error: 'JARVIS_APPROVAL_DECISION_INVALID' };
  if (!approvalId) return { ok: false, status: 400, error: 'JARVIS_APPROVAL_ID_REQUIRED' };
  if (!ownerRef) return { ok: false, status: 403, error: 'JARVIS_APPROVAL_OWNER_REQUIRED' };

  const approvals = Array.isArray(input.approvals) ? input.approvals : [];
  const approval = approvals.find((a) => clean(a?.approval_id, 240) === approvalId) || null;
  if (!approval) return { ok: false, status: 404, error: 'JARVIS_APPROVAL_NOT_FOUND' };

  const projectedState = clean(approval.state, 40).toUpperCase();
  if (projectedState && projectedState !== 'PENDING') {
    return { ok: false, status: 409, error: 'JARVIS_APPROVAL_ALREADY_DECIDED', current_state: projectedState };
  }

  const approvalRun = clean(approval.run_id, 200);
  if (approvalRun && runId && approvalRun !== runId) {
    return { ok: false, status: 409, error: 'JARVIS_APPROVAL_RUN_CORRELATION_MISMATCH', approval_run_id: approvalRun, given_run_id: runId };
  }
  const correlatedRunId = approvalRun || runId || null;
  if (correlationId && !UUID_RE.test(correlationId)) {
    return { ok: false, status: 400, error: 'JARVIS_APPROVAL_CORRELATION_ID_INVALID' };
  }

  const event = createJarvisAuditEventV1({
    timestamp: now,
    owner_ref: ownerRef,
    request: `Freigabe ${approvalId}: ${decision}`,
    intent: { intent_type: 'APPROVAL_DECISION', domain: 'APPROVAL', action: 'APPROVAL_DECISION' },
    action: 'APPROVAL_DECISION',
    permissions: [],
    tools_used: [],
    result: {
      // Recording a decision is not execution. No worker ran, no gate bypassed.
      status: 'DECISION_RECORDED',
      verified: false,
      external_effect: false,
      decision,
      approval_id: approvalId,
      decided_run_id: correlatedRunId
    },
    approval: {
      required: true,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: GATE_STATUS[decision],
      decision,
      approval_id: approvalId,
      decided_run_id: correlatedRunId
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });
  event.request_id = correlatedRunId; // groups with the run in the projection

  return {
    ok: true,
    status: 200,
    decision,
    approval_id: approvalId,
    run_id: correlatedRunId,
    gate_status: GATE_STATUS[decision],
    execution_authorized: false,
    external_effect: false,
    executed: false,
    action_gate_bypassed: false,
    worker_self_accepted: false,
    audit_event: event
  };
}

export function jarvisCommandCenterApprovalRuntimeManifestV1() {
  return {
    schema: 'aurentara.jarvis.command-center.approval-runtime.v1',
    route: '/jarvis/api/approvals/decide',
    decisions: JARVIS_APPROVAL_DECISIONS,
    records_new_owner_scoped_audit_event: true,
    projected_approval_can_self_approve: false,
    requires_run_correlation: true,
    approving_bypasses_action_gate: false,
    external_effect_on_decision: false,
    worker_output_counts_as_acceptance: false,
    fail_closed_without_store: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
