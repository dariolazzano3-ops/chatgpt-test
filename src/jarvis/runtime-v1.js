import { handleJarvisRequestV1 } from './service-v1.js';
import { createJarvisConnectorRegistryV1 } from './connectors-v1.js';
import { executeJarvisConnectorV1 } from './connector-runtime-v1.js';
import { verifyJarvisActionResultV1 } from './result-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';

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

  const persistable = core.memory_writeback?.accepted || [];
  for (const decision of persistable) {
    if (!decision?.entry) continue;
    await deps.memory_store.upsertMemory({ owner_id: ownerId, owner_ref: ownerRef, entry: decision.entry });
  }

  const auditEvent = createJarvisAuditEventV1({
    timestamp: request.now,
    owner_ref: ownerRef,
    request: request.message,
    intent: core.intent,
    tools_used: core.tool_route?.tool?.tool_id ? [core.tool_route.tool.tool_id] : [],
    permissions: core.tool_route?.requires_permissions || [],
    action: core.intent?.action,
    result: {
      status: actionResult?.status || null,
      verified: actionResult?.verified === true,
      connector_status: connectorExecution?.status || null,
      external_effect: connectorExecution?.external_effect === true
    },
    approval: {
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
    production_deploy: false
  };
}
