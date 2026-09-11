/* JARVIS — Engineering Mission dispatch V1.

   A dedicated, explicit route for an operator to hand JARVIS a bounded
   engineering/implementation mission (POST /jarvis/api/engineering-mission),
   separate from the free-text Command Center chat input.

   Why this exists: the generic chat path (http-v1.js /jarvis/api/chat ->
   intent-v1.js resolveJarvisIntentV1) classifies free text with a small
   keyword-regex table. A large engineering prompt can fall through every
   rule and land on the READ_PERSONAL_CONTEXT fallback — a real ambiguity
   bug, not a security one. This module removes the ambiguity structurally:
   it is never invoked by the chat path, never runs a keyword classifier over
   free text, and always resolves to one explicit action, IMPLEMENTATION_MISSION
   (contracts-v1.js), which intent-v1.js's actionFor() never returns.

   Safety (same boundary as the rest of JARVIS Live Binding V1):
     - same local-operator auth as every other /jarvis/api/* route (see
       http-v1.js authSession / access-v1.js) — no separate, weaker auth path;
     - runs through the same action gate as every other action
       (action-gate-v1.js evaluateJarvisActionGateV1) — never bypassed;
     - execution requires a DISTINCT, already-persisted OPERATOR approval
       decision correlated to this exact request_id, read back from the
       durable audit trail — approving is never itself execution, and this
       call never accepts a client-asserted "already approved" flag;
     - dispatch only ever reaches CLAUDE_CODE (src/jarvis/claude-code-bridge-v1.js).
       No bridge injected -> claude_bridge_bound stays false and the mission
       fails closed (wave_state BLOCKED once approved), never simulated;
     - the bridge's own exit code is NEVER treated as independent acceptance
       (independent_acceptance stays false here, always) — see
       v2-progress-v1.js for how that keeps V2 progress honest;
     - every call, approved or not, is auditable (Runs / Activity / Evidence). */

import { JARVIS_AUTONOMY, normalizeJarvisPolicy } from './contracts-v1.js';
import { evaluateJarvisActionGateV1 } from './action-gate-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROGRAM_RE = /^[A-Z][A-Z0-9_]{2,79}$/;

export const JARVIS_ENGINEERING_MISSION_ACTION = 'IMPLEMENTATION_MISSION';
export const JARVIS_ENGINEERING_MISSION_INTENT = 'IMPLEMENTATION_MISSION_REQUEST';
export const JARVIS_ENGINEERING_MISSION_DOMAIN = 'ENGINEERING';
export const JARVIS_ENGINEERING_MISSION_WORKSPACE = '/workspace/projects/jarvis-engineering-mission';

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

/** Explicit, unambiguous resolver. Unlike resolveJarvisIntentV1 (intent-v1.js)
 *  this NEVER classifies free text — the caller states the mission fields
 *  directly and this only validates + normalises them. Fail-closed on
 *  anything malformed. */
export function resolveJarvisEngineeringMissionIntentV1(input = {}) {
  const title = clean(input.title, 200);
  const goal = clean(input.goal, 4000);
  const program = clean(input.program, 80).toUpperCase();
  const correlationId = clean(input.correlation_id || input.request_id, 80).toLowerCase();
  const waveIndexRaw = input.wave_index;
  const waveIndex = waveIndexRaw === undefined || waveIndexRaw === null || waveIndexRaw === ''
    ? null
    : Number(waveIndexRaw);

  if (!title) return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_TITLE_REQUIRED' };
  if (!goal) return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_GOAL_REQUIRED' };
  if (!program || !PROGRAM_RE.test(program)) return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_PROGRAM_INVALID' };
  if (!UUID_RE.test(correlationId)) return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_CORRELATION_ID_REQUIRED' };
  if (waveIndex !== null && (!Number.isInteger(waveIndex) || waveIndex < 0 || waveIndex > 12)) {
    return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_WAVE_INDEX_OUT_OF_RANGE' };
  }

  return {
    ok: true,
    schema: 'aurentara.jarvis.engineering-mission-intent.v1',
    intent_type: JARVIS_ENGINEERING_MISSION_INTENT,
    domain: JARVIS_ENGINEERING_MISSION_DOMAIN,
    action: JARVIS_ENGINEERING_MISSION_ACTION,
    asks_for_action: true,
    financial_intent: false,
    title,
    goal,
    program,
    correlation_id: correlationId,
    wave_index: waveIndex,
    raw_message: `[ENGINEERING MISSION] ${program} · ${title} — ${goal}`
  };
}

/** Runs the mission through the same action-gate + audit spine as every
 *  other JARVIS action, and — only on a distinct, already-persisted operator
 *  approval for this exact request_id — dispatches to the Claude Code bridge
 *  if (and only if) one is genuinely bound. */
export async function handleJarvisEngineeringMissionRuntimeV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  if (!UUID_RE.test(ownerId)) return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_OWNER_ID_REQUIRED' };
  if (!ownerRef) return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_OWNER_REF_REQUIRED' };
  if (!deps.memory_store || typeof deps.memory_store.appendAudit !== 'function') {
    return { ok: false, error: 'JARVIS_ENGINEERING_MISSION_MEMORY_STORE_REQUIRED' };
  }

  const intent = resolveJarvisEngineeringMissionIntentV1(request);
  if (!intent.ok) return { ok: false, status: 'BLOCKED', error: intent.error };

  const policy = normalizeJarvisPolicy(request.policy || {});
  const gate = evaluateJarvisActionGateV1({ action: intent.action, policy, explicit_approval: false });

  const requestId = intent.correlation_id;
  let priorAudit = [];
  if (typeof deps.memory_store.readAudit === 'function') {
    try {
      priorAudit = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 200 });
    } catch { priorAudit = []; }
  }
  const approvalGranted = Array.isArray(priorAudit) && priorAudit.some((row) =>
    row?.approval?.decision === 'approve' && clean(row?.approval?.decided_run_id, 200) === requestId
  );

  let bridgeExecution = null;
  let waveState = 'NOT_STARTED';
  const claudeBridgeBound = Boolean(deps.claude_bridge && deps.claude_bridge.bound === true);

  if (approvalGranted) {
    // Re-check the gate with a fixed, local-execution-specific policy and
    // explicit_approval derived only from the persisted decision above —
    // never from anything the caller of THIS request could set directly.
    // `gate` (the initial, pre-approval evaluation) stays the one returned to
    // the caller as action_gate, exactly like runtime-v1.js's FILE_WRITE path
    // — this second, internal-only evaluation only decides whether dispatch
    // may proceed.
    const localPolicy = normalizeJarvisPolicy({ autonomy_level: JARVIS_AUTONOMY.APPROVAL_GATED_EXTERNAL_ACTION, allow_external_writes: true });
    const authorizedGate = evaluateJarvisActionGateV1({ action: intent.action, policy: localPolicy, explicit_approval: true });

    if (authorizedGate.execution_authorized === true) {
      if (claudeBridgeBound) {
        const handle = deps.claude_bridge.submit({
          correlation_id: requestId,
          request_id: requestId,
          owner_ref: ownerRef,
          workspace: deps.workspace || JARVIS_ENGINEERING_MISSION_WORKSPACE,
          task: `Engineering Mission [${intent.program}] ${intent.title}\n\nGoal: ${intent.goal}`,
          timeout_ms: deps.claude_timeout_ms
        });
        bridgeExecution = await handle.result;
        waveState = BRIDGE_STATE_TO_WAVE[bridgeExecution.state] || 'FAILED';
      } else {
        // Approved, but no genuine executor is bound. Never fabricate a
        // dispatch: fail closed.
        waveState = 'BLOCKED';
      }
    }
  }

  const actionResult = {
    ok: !bridgeExecution || bridgeExecution.state !== 'FAILED',
    schema: 'aurentara.jarvis.action-result.v1',
    status: bridgeExecution
      ? (bridgeExecution.state === 'COMPLETE' ? 'COMPLETED' : bridgeExecution.state)
      : (gate.approval_required ? 'PREPARED' : 'NOT_EXECUTED'),
    verified: bridgeExecution ? bridgeExecution.state === 'COMPLETE' : true,
    external_effect: bridgeExecution ? bridgeExecution.external_effect === true : false,
    // Independent acceptance is NEVER granted from the worker's own report.
    independent_acceptance: false,
    output: bridgeExecution ? { evidence_id: bridgeExecution.evidence?.evidence_id || null } : null
  };

  const auditEvent = createJarvisAuditEventV1({
    timestamp: request.now,
    owner_ref: ownerRef,
    request: `${intent.title} · ${intent.program}`,
    intent: { intent_type: intent.intent_type, domain: intent.domain, action: intent.action },
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
      // Bridge-side-computed evidence only (never a worker self-report) —
      // null unless a repo-bound executor was genuinely bound. Read back by
      // engineering-mission-acceptance-v1.js as the ONLY basis for whether
      // Independent Acceptance may be granted.
      verification: bridgeExecution?.evidence?.verification || null
    },
    approval: approvalGranted ? {
      required: true,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: 'APPROVED_BY_OPERATOR',
      decision: 'approve',
      approval_id: `${requestId}:approval`,
      decided_run_id: requestId
    } : {
      required: gate.approval_required === true,
      explicit: false,
      gate_status: gate.status || null
    },
    cost: { estimated_eur: 0, actual_eur: 0 },
    memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
  });
  auditEvent.request_id = requestId;
  await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: auditEvent });

  return {
    ok: gate.ok && actionResult.ok !== false,
    schema: 'aurentara.jarvis.engineering-mission-runtime-response.v1',
    request_id: requestId,
    correlation_id: requestId,
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
    audit_persisted: true,
    isolation: {
      namespace: 'jarvis.personal',
      hamyren_memory_access: false,
      hamyren_memory_write: false,
      hamyren_connector_enabled: false
    },
    safeguards: {
      production_actions_enabled: false,
      billing_actions_enabled: false,
      financial_actions_enabled: false
    }
  };
}

export function jarvisEngineeringMissionManifestV1() {
  return {
    schema: 'aurentara.jarvis.engineering-mission.v1',
    route: '/jarvis/api/engineering-mission',
    intent_type: JARVIS_ENGINEERING_MISSION_INTENT,
    domain: JARVIS_ENGINEERING_MISSION_DOMAIN,
    action: JARVIS_ENGINEERING_MISSION_ACTION,
    bypasses_keyword_intent_resolver: true,
    reuses_read_personal_context: false,
    requires_action_gate: true,
    action_gate_bypassed: false,
    requires_prior_persisted_approval_before_dispatch: true,
    worker: 'CLAUDE_CODE',
    worker_self_acceptance_counts_as_independent: false,
    default_claude_bridge_bound: false,
    fails_closed_without_claude_bridge: true,
    fabricates_worker_availability: false,
    wave_states: ['NOT_STARTED', 'RUNNING', 'BLOCKED', 'FAILED', 'COMPLETE'],
    production_deploy: false,
    hamyren_data_flow: false
  };
}
