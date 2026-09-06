import { buildJarvisContextV1 } from './context-v1.js';
import { resolveJarvisIntentV1 } from './intent-v1.js';
import { evaluateJarvisActionGateV1 } from './action-gate-v1.js';
import { jarvisContractsManifestV1, normalizeJarvisPolicy } from './contracts-v1.js';
import { applyJarvisMemoryWritebackV1, jarvisMemoryManifestV1, retrieveJarvisMemoryV1 } from './memory-v1.js';
import { createJarvisToolRegistryV1, jarvisToolManifestV1, routeJarvisToolV1 } from './tools-v1.js';
import { buildJarvisActionPlanV1 } from './planner-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { verifyJarvisActionResultV1 } from './result-v1.js';

const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);

export function handleJarvisRequestV1(input = {}, personalState = {}, options = {}) {
  const intent = resolveJarvisIntentV1(input);
  if (!intent.ok) return { ok: false, status: 'BLOCKED', error: intent.error };

  const policy = normalizeJarvisPolicy(options.policy || {});
  const memoryRetrieval = retrieveJarvisMemoryV1(
    personalState.memory_entries || [],
    intent.raw_message,
    {
      owner_ref: personalState.owner_ref,
      allow_sensitive: policy.allow_sensitive_context,
      max_items: options.max_memory_items || 20
    }
  );

  const context = buildJarvisContextV1({
    ...personalState,
    query: intent.raw_message,
    now: options.now || personalState.now,
    memory_items: memoryRetrieval.items
  }, {
    allow_sensitive_context: policy.allow_sensitive_context
  });

  const gate = evaluateJarvisActionGateV1({
    action: intent.action,
    policy,
    explicit_approval: options.explicit_approval === true
  });

  const toolRegistry = createJarvisToolRegistryV1(options.tools);
  const toolRoute = routeJarvisToolV1(toolRegistry, { action: intent.action });
  const actionPlan = buildJarvisActionPlanV1({
    intent,
    context,
    action_gate: gate,
    tool_route: toolRoute,
    estimated_cost_eur: options.estimated_cost_eur,
    high_cost_threshold_eur: policy.high_cost_threshold_eur
  });

  const writeback = applyJarvisMemoryWritebackV1(
    personalState.memory_entries || [],
    options.memory_candidates || [],
    {
      owner_ref: personalState.owner_ref,
      now: options.now || personalState.now,
      allow_memory_writeback: policy.allow_memory_writeback,
      allow_sensitive_memory_writeback: policy.allow_sensitive_memory_writeback
    }
  );

  const actionResult = verifyJarvisActionResultV1(actionPlan, options.execution_result || {});
  const auditEvent = createJarvisAuditEventV1({
    timestamp: options.now || personalState.now,
    owner_ref: personalState.owner_ref,
    request: intent.raw_message,
    intent,
    tools_used: toolRoute.ok && toolRoute.tool?.tool_id ? [toolRoute.tool.tool_id] : [],
    permissions: toolRoute.requires_permissions || [],
    action: intent.action,
    result: { status: actionResult.status, verified: actionResult.verified, external_effect: actionResult.external_effect },
    approval: { required: gate.approval_required === true, explicit: options.explicit_approval === true, gate_status: gate.status },
    cost: { estimated_eur: actionPlan.estimated_cost_eur, actual_eur: options.actual_cost_eur ?? null },
    memory_updates: { accepted: writeback.accepted.length, proposed: writeback.proposed.length, rejected: writeback.rejected.length }
  });

  return {
    ok: gate.ok && actionPlan.ok && writeback.ok,
    schema: 'aurentara.jarvis.response.v1',
    status: gate.status,
    message: clean(intent.raw_message),
    intent,
    context,
    memory_retrieval: memoryRetrieval,
    action_gate: gate,
    tool_route: toolRoute,
    action_plan: actionPlan,
    action_result: actionResult,
    memory_writeback: writeback,
    audit_event: auditEvent,
    isolation: {
      personal_memory_namespace: 'jarvis.personal',
      hamyren_memory_access: false,
      hamyren_memory_write: false,
      automatic_data_flow_to_hamyren: false,
      hamyren_connector_enabled: false
    },
    safeguards: {
      financial_actions_enabled: false,
      production_actions_enabled: false,
      billing_actions_enabled: false,
      credential_actions_enabled: false,
      live_external_connectors_bound: jarvisToolManifestV1().live_external_connectors_bound
    }
  };
}

export function jarvisServiceManifestV1() {
  return {
    ...jarvisContractsManifestV1(),
    service: 'handleJarvisRequestV1',
    current_stage: 'V1_CORE_FOUNDATION',
    memory: jarvisMemoryManifestV1(),
    tools: jarvisToolManifestV1(),
    live_connectors_bound: jarvisToolManifestV1().live_external_connectors_bound,
    voice_bound: false,
    proactive_mode_bound: false
  };
}
