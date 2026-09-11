import { handleJarvisRequestV1 } from './service-v1.js';
import { createJarvisConnectorRegistryV1 } from './connectors-v1.js';
import { executeJarvisConnectorV1 } from './connector-runtime-v1.js';
import { verifyJarvisActionResultV1 } from './result-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { evaluateJarvisActionGateV1 } from './action-gate-v1.js';
import { normalizeJarvisPolicy, JARVIS_AUTONOMY } from './contracts-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function capabilityFor(action = '') {
  if (action === 'READ_CALENDAR') return 'calendar.read';
  return null;
}

export async function handleJarvisRuntimeRequestV1(request = {}, deps = {}) {
  const ownerId = clean(request.owner_id, 80);
  const ownerRef = clean(request.owner_ref, 320);
  if (!UUID.test(ownerId)) return { ok: false, error: 'JARVIS_RUNTIME_OWNER_ID_REQUIRED' };
  if (!ownerRef) return { ok: false, error: 'JARVIS_RUNTIME_OWNER_REF_REQUIRED' };
  if (!deps.memory_store || typeof deps.memory_store.loadMemory !== 'function') {
    return { ok: false, error: 'JARVIS_RUNTIME_MEMORY_STORE_REQUIRED' };
  }

  const memoryEntries = await deps.memory_store.loadMemory({ owner_id: ownerId, owner_ref: ownerRef });
  const core = handleJarvisRequestV1(
    { message: request.message },
    { owner_ref: ownerRef, memory_entries: memoryEntries, now: request.now },
    {
      ...(request.options || {}),
      now: request.now,
      execution_result: {}
    }
  );

  let connectorExecution = null;
  let actionResult = core.action_result;
  const capability = capabilityFor(core.intent?.action);

  if (capability && deps.connectors) {
    const registry = createJarvisConnectorRegistryV1(deps.connectors);
    connectorExecution = await executeJarvisConnectorV1({
      action_plan: core.action_plan,
      connector_registry: registry,
      capability,
      granted_permissions: request.granted_permissions || [],
      owner_ref: ownerRef,
      request_id: clean(request.request_id, 200) || null,
      payload: request.connector_payload || {},
      context: core.context
    });

    actionResult = verifyJarvisActionResultV1(core.action_plan, {
      status: connectorExecution.status,
      external_effect: connectorExecution.external_effect === true,
      output: connectorExecution.result ?? null
    });
  }

  // ── Claude Code bridge routing (local/private only, explicit opt-in) ──
  // Only reachable when the caller injected a genuinely bound bridge (see
  // claude-code-local-runtime-binding-v1.js — default OFF, local Node only,
  // never present in the deployed Worker unless a caller explicitly
  // constructs and injects it). Execution NEVER happens on the same call
  // that first asks: it requires a DISTINCT, already-persisted OPERATOR
  // approval decision correlated to this exact request_id (read back from
  // the durable audit trail, never a client-asserted flag on this request),
  // so approving still can never itself execute and this can never bypass
  // the action gate or let the worker self-accept.
  let bridgeExecution = null;
  const requestId = clean(request.request_id, 200);
  const wantsClaudeCode = core.intent?.action === 'FILE_WRITE' && core.intent?.asks_for_action === true;
  if (wantsClaudeCode && deps.claude_bridge?.bound === true && requestId) {
    let priorAudit = [];
    try {
      priorAudit = await deps.memory_store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 200 });
    } catch { priorAudit = []; }
    const granted = Array.isArray(priorAudit) && priorAudit.some((row) =>
      row?.approval?.decision === 'approve' && clean(row?.approval?.decided_run_id, 200) === requestId
    );

    if (granted) {
      // Re-check the gate with a fixed, local-execution-specific policy and
      // explicit_approval derived only from the persisted decision above —
      // never from anything the caller of this request could set directly.
      const localPolicy = normalizeJarvisPolicy({ autonomy_level: JARVIS_AUTONOMY.APPROVAL_GATED_EXTERNAL_ACTION, allow_external_writes: true });
      const authorizedGate = evaluateJarvisActionGateV1({ action: 'FILE_WRITE', policy: localPolicy, explicit_approval: true });

      if (authorizedGate.execution_authorized === true) {
        const handle = deps.claude_bridge.submit({
          correlation_id: requestId,
          request_id: requestId,
          owner_ref: ownerRef,
          workspace: '/workspace/projects/jarvis-local-execution',
          task: core.intent.raw_message,
          timeout_ms: deps.claude_timeout_ms
        });
        bridgeExecution = await handle.result;

        actionResult = verifyJarvisActionResultV1(core.action_plan, {
          status: bridgeExecution.state === 'COMPLETE' ? 'COMPLETED' : 'FAILED',
          external_effect: bridgeExecution.external_effect === true,
          output: { evidence_id: bridgeExecution.evidence?.evidence_id || null }
        });
      }
    }
  }

  const persistable = core.memory_writeback?.accepted || [];
  for (const decision of persistable) {
    if (!decision?.entry) continue;
    await deps.memory_store.upsertMemory({ owner_id: ownerId, owner_ref: ownerRef, entry: decision.entry });
  }

  // A genuine Claude Code execution in this same call means a distinct,
  // already-persisted operator approval decision was found above (never a
  // client-asserted flag on THIS request) — reflect that honestly in the one
  // audit event this call persists, instead of leaving it showing the
  // original pre-approval gate snapshot.
  const auditEvent = createJarvisAuditEventV1({
    timestamp: request.now,
    owner_ref: ownerRef,
    request: request.message,
    intent: core.intent,
    tools_used: bridgeExecution ? ['jarvis.claude_code.bridge.v1'] : (core.tool_route?.tool?.tool_id ? [core.tool_route.tool.tool_id] : []),
    permissions: core.tool_route?.requires_permissions || [],
    action: core.intent?.action,
    result: {
      status: actionResult?.status || null,
      verified: actionResult?.verified === true,
      connector_status: connectorExecution?.status || null,
      external_effect: connectorExecution?.external_effect === true || bridgeExecution?.external_effect === true,
      claude_execution_state: bridgeExecution?.state || null,
      evidence_id: bridgeExecution?.evidence?.evidence_id || null
    },
    approval: bridgeExecution ? {
      required: true,
      explicit: true,
      actor_type: 'OPERATOR',
      gate_status: 'APPROVED_BY_OPERATOR',
      decision: 'approve',
      approval_id: `${requestId}:approval`,
      decided_run_id: requestId
    } : {
      required: core.action_gate?.approval_required === true,
      explicit: request.options?.explicit_approval === true,
      gate_status: core.action_gate?.status || null
    },
    cost: { estimated_eur: core.action_plan?.estimated_cost_eur || 0, actual_eur: 0 },
    memory_updates: {
      accepted: core.memory_writeback?.accepted?.length || 0,
      proposed: core.memory_writeback?.proposed?.length || 0,
      rejected: core.memory_writeback?.rejected?.length || 0
    }
  });
  auditEvent.request_id = clean(request.request_id, 200) || null;
  await deps.memory_store.appendAudit({ owner_id: ownerId, owner_ref: ownerRef, event: auditEvent });

  return {
    ok: core.ok && (!connectorExecution || connectorExecution.ok) && actionResult?.ok !== false,
    schema: 'aurentara.jarvis.runtime-response.v1',
    core,
    connector_execution: connectorExecution,
    claude_execution: bridgeExecution ? {
      state: bridgeExecution.state,
      exit_code: bridgeExecution.exit_code,
      external_effect: bridgeExecution.external_effect === true,
      independent_acceptance: bridgeExecution.independent_acceptance === true,
      evidence: bridgeExecution.evidence || null
    } : null,
    action_result: actionResult,
    durable_memory_loaded: true,
    accepted_memory_persisted: persistable.length,
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

export function jarvisRuntimeManifestV1() {
  return {
    schema: 'aurentara.jarvis.runtime.v1',
    durable_memory_required: true,
    connector_execution_supported: ['calendar.read'],
    write_connectors_enabled: false,
    external_writes: false,
    hamyren_memory_access: false,
    claude_code_routing_action: 'FILE_WRITE',
    claude_code_requires_injected_bound_bridge: true,
    claude_code_requires_prior_persisted_approval: true,
    claude_code_default_bound: false,
    claude_code_worker_self_accepts: false,
    production_deploy: false
  };
}
