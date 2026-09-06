import { JARVIS_ACTIONS } from './contracts-v1.js';

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

const DEFAULT_TOOLS = Object.freeze([
  { tool_id: 'jarvis.memory.read.v1', capabilities: ['personal_memory.read', 'personal_context.read'], required_permissions: ['JARVIS_MEMORY_READ'], risk_level: 'LOW', write_scope: 'NONE', cost_profile: 'ZERO', authentication_state: 'INTERNAL', availability: 'AVAILABLE', internal: true },
  { tool_id: 'jarvis.web.search.v1', capabilities: ['web.search'], required_permissions: ['WEB_READ'], risk_level: 'LOW', write_scope: 'NONE', cost_profile: 'VARIABLE', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.files.read.v1', capabilities: ['files.read'], required_permissions: ['FILES_READ'], risk_level: 'LOW', write_scope: 'NONE', cost_profile: 'ZERO_OR_VARIABLE', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.files.write.v1', capabilities: ['files.write'], required_permissions: ['FILES_WRITE'], risk_level: 'HIGH', write_scope: 'EXTERNAL', cost_profile: 'ZERO_OR_VARIABLE', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.calendar.read.v1', capabilities: ['calendar.read', 'calendar.prepare'], required_permissions: ['CALENDAR_READ'], risk_level: 'LOW', write_scope: 'NONE', cost_profile: 'ZERO', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.calendar.write.v1', capabilities: ['calendar.write'], required_permissions: ['CALENDAR_WRITE'], risk_level: 'MEDIUM', write_scope: 'PERSONAL_EXTERNAL', cost_profile: 'ZERO', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.email.draft.v1', capabilities: ['email.draft'], required_permissions: ['EMAIL_READ_OR_COMPOSE'], risk_level: 'LOW', write_scope: 'PREPARE_ONLY', cost_profile: 'ZERO', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.email.send.v1', capabilities: ['email.send'], required_permissions: ['EMAIL_SEND'], risk_level: 'HIGH', write_scope: 'EXTERNAL', cost_profile: 'ZERO', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.tasks.v1', capabilities: ['tasks.prepare', 'tasks.write'], required_permissions: ['TASKS_READ_WRITE'], risk_level: 'MEDIUM', write_scope: 'PERSONAL_EXTERNAL', cost_profile: 'ZERO', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.reminders.v1', capabilities: ['reminders.write'], required_permissions: ['REMINDERS_WRITE'], risk_level: 'LOW', write_scope: 'PERSONAL_EXTERNAL', cost_profile: 'ZERO', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false },
  { tool_id: 'jarvis.devices.v1', capabilities: ['devices.write'], required_permissions: ['DEVICE_CONTROL'], risk_level: 'HIGH', write_scope: 'EXTERNAL', cost_profile: 'ZERO_OR_VARIABLE', authentication_state: 'UNBOUND', availability: 'UNBOUND', internal: false }
]);

export function createJarvisToolRegistryV1(entries = DEFAULT_TOOLS) {
  const tools = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const toolId = clean(entry?.tool_id, 180);
    if (!toolId || /^hamyren[.:/]/i.test(toolId)) continue;
    const capabilities = Array.isArray(entry.capabilities) ? entry.capabilities.map((v) => clean(v, 120)).filter(Boolean) : [];
    if (!capabilities.length || tools.some((tool) => tool.tool_id === toolId)) continue;
    tools.push({
      tool_id: toolId,
      capabilities,
      required_permissions: Array.isArray(entry.required_permissions) ? entry.required_permissions.map((v) => clean(v, 120)).filter(Boolean) : [],
      risk_level: clean(entry.risk_level, 40).toUpperCase() || 'LOW',
      write_scope: clean(entry.write_scope, 80).toUpperCase() || 'NONE',
      cost_profile: clean(entry.cost_profile, 80).toUpperCase() || 'UNKNOWN',
      authentication_state: clean(entry.authentication_state, 80).toUpperCase() || 'UNBOUND',
      availability: clean(entry.availability, 80).toUpperCase() || 'UNBOUND',
      internal: entry.internal === true,
      connector_binding: entry.connector_binding ? structuredClone(entry.connector_binding) : null
    });
  }
  return {
    schema: 'aurentara.jarvis.tool-registry.v1',
    tools,
    hamyren_tools_registered: false,
    shared_tool_memory: false
  };
}

export function routeJarvisToolV1(registry = createJarvisToolRegistryV1(), input = {}) {
  const action = JARVIS_ACTIONS[input.action];
  if (!action) return { ok: false, error: 'JARVIS_TOOL_ACTION_UNKNOWN' };
  if (input.action === 'FINANCIAL_ACTION') return { ok: false, error: 'JARVIS_FINANCIAL_TOOL_ROUTE_BLOCKED' };

  const capability = action.capability;
  const candidates = (registry.tools || [])
    .filter((tool) => !/^hamyren[.:/]/i.test(tool.tool_id))
    .filter((tool) => tool.capabilities.includes(capability))
    .sort((a, b) => {
      const aa = a.availability === 'AVAILABLE' ? 0 : 1;
      const bb = b.availability === 'AVAILABLE' ? 0 : 1;
      return aa - bb || a.tool_id.localeCompare(b.tool_id);
    });

  if (!candidates.length) return { ok: false, error: 'JARVIS_TOOL_ROUTE_NOT_FOUND', capability };
  const selected = candidates[0];
  return {
    ok: true,
    schema: 'aurentara.jarvis.tool-route.v1',
    action: input.action,
    capability,
    tool: structuredClone(selected),
    execution_ready: selected.availability === 'AVAILABLE' && (selected.internal || selected.authentication_state === 'AUTHENTICATED'),
    requires_permissions: [...selected.required_permissions],
    hamyren_boundary_crossed: false
  };
}

export function jarvisToolManifestV1() {
  const registry = createJarvisToolRegistryV1();
  return {
    schema: registry.schema,
    tool_count: registry.tools.length,
    tools: structuredClone(registry.tools),
    live_external_connectors_bound: registry.tools.some((tool) => !tool.internal && tool.availability === 'AVAILABLE'),
    hamyren_connector_registered: false
  };
}
