import { routeJarvisConnectorV1, validateJarvisConnectorPayloadV1 } from './connectors-v1.js';

const WRITE_CAPABILITIES = new Set([
  'calendar.write',
  'email.send',
  'files.write',
  'tasks.write',
  'reminders.write'
]);

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

function hasRequiredPermissions(required = [], granted = []) {
  const grantedSet = new Set(Array.isArray(granted) ? granted.map((v) => clean(v, 120)).filter(Boolean) : []);
  return required.every((permission) => grantedSet.has(permission));
}

function connectorWithHandler(registry = {}, connectorId = '') {
  return (registry.connectors || []).find((item) => item.connector_id === connectorId) || null;
}

export async function executeJarvisConnectorV1(input = {}) {
  const plan = input.action_plan || {};
  if (!plan.ok) return { ok: false, status: 'BLOCKED', error: 'JARVIS_CONNECTOR_PLAN_REQUIRED' };
  if (plan.safeguards?.financial_actions_enabled === true) {
    return { ok: false, status: 'BLOCKED', error: 'JARVIS_FINANCIAL_CONNECTOR_POLICY_INVALID' };
  }

  const capability = clean(input.capability || plan.tool_capability || input.tool_route?.capability, 120);
  const route = routeJarvisConnectorV1(input.connector_registry, capability);
  if (!route.ok) return { ...route, status: 'UNBOUND' };

  const connector = connectorWithHandler(input.connector_registry, route.connector.connector_id);
  if (!connector || route.execution_ready !== true) {
    return {
      ok: true,
      schema: 'aurentara.jarvis.connector-execution.v1',
      status: 'UNBOUND',
      executed: false,
      connector: route.connector,
      external_effect: false,
      reason: 'CONNECTOR_NOT_AUTHENTICATED_OR_HANDLER_NOT_BOUND'
    };
  }

  if (!hasRequiredPermissions(route.connector.required_permissions || [], input.granted_permissions || [])) {
    return {
      ok: false,
      status: 'BLOCKED',
      error: 'JARVIS_CONNECTOR_PERMISSION_REQUIRED',
      connector: route.connector,
      external_effect: false
    };
  }

  const payloadCheck = validateJarvisConnectorPayloadV1(input.payload || {});
  if (!payloadCheck.ok) {
    return { ...payloadCheck, status: 'BLOCKED', connector: route.connector, external_effect: false };
  }

  const isWrite = WRITE_CAPABILITIES.has(capability);
  if (isWrite && plan.execution_authorized !== true) {
    return {
      ok: false,
      status: 'BLOCKED',
      error: 'JARVIS_CONNECTOR_WRITE_NOT_AUTHORIZED',
      connector: route.connector,
      external_effect: false
    };
  }
  if (isWrite && plan.cost_approval_required === true && input.cost_approved !== true) {
    return {
      ok: false,
      status: 'BLOCKED',
      error: 'JARVIS_CONNECTOR_COST_APPROVAL_REQUIRED',
      connector: route.connector,
      external_effect: false
    };
  }

  try {
    const result = await connector.handler({
      capability,
      payload: payloadCheck.payload,
      context: structuredClone(input.context || {}),
      execution: {
        owner_ref: clean(input.owner_ref, 200) || null,
        request_id: clean(input.request_id, 200) || null,
        write_authorized: isWrite && plan.execution_authorized === true,
        cost_approved: input.cost_approved === true
      }
    });

    return {
      ok: true,
      schema: 'aurentara.jarvis.connector-execution.v1',
      status: 'COMPLETED',
      executed: true,
      connector: route.connector,
      capability,
      external_effect: isWrite,
      result: structuredClone(result ?? null),
      hamyren_data_flow: false,
      credentials_logged: false
    };
  } catch (error) {
    return {
      ok: false,
      schema: 'aurentara.jarvis.connector-execution.v1',
      status: 'FAILED',
      executed: true,
      connector: route.connector,
      capability,
      external_effect: false,
      error: 'JARVIS_CONNECTOR_EXECUTION_FAILED',
      error_detail: clean(error?.message || error, 300),
      hamyren_data_flow: false,
      credentials_logged: false
    };
  }
}
