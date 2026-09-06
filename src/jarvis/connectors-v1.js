const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

const SECRET_KEY = /(password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|cookie|credential|secret)/i;
const SECRET_TEXT = /\b(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,})\b/i;

export const JARVIS_CONNECTOR_FAMILIES = Object.freeze([
  'CALENDAR',
  'EMAIL',
  'FILES',
  'TASKS',
  'REMINDERS'
]);

export const JARVIS_CONNECTOR_CAPABILITIES = Object.freeze([
  'calendar.read',
  'calendar.write',
  'email.draft',
  'email.send',
  'files.read',
  'files.write',
  'tasks.prepare',
  'tasks.write',
  'reminders.write'
]);

const DEFAULT_CATALOG = Object.freeze([
  { connector_id: 'jarvis.calendar.connector.v1', family: 'CALENDAR', provider: 'UNBOUND', capabilities: ['calendar.read', 'calendar.write'], required_permissions: ['CALENDAR_READ', 'CALENDAR_WRITE'], risk_level: 'MEDIUM', write_scope: 'PERSONAL_EXTERNAL', authentication_state: 'UNBOUND', availability: 'UNBOUND', cost_profile: 'ZERO' },
  { connector_id: 'jarvis.email.connector.v1', family: 'EMAIL', provider: 'UNBOUND', capabilities: ['email.draft', 'email.send'], required_permissions: ['EMAIL_READ_OR_COMPOSE', 'EMAIL_SEND'], risk_level: 'HIGH', write_scope: 'EXTERNAL', authentication_state: 'UNBOUND', availability: 'UNBOUND', cost_profile: 'ZERO' },
  { connector_id: 'jarvis.files.connector.v1', family: 'FILES', provider: 'UNBOUND', capabilities: ['files.read', 'files.write'], required_permissions: ['FILES_READ', 'FILES_WRITE'], risk_level: 'HIGH', write_scope: 'EXTERNAL', authentication_state: 'UNBOUND', availability: 'UNBOUND', cost_profile: 'ZERO_OR_VARIABLE' },
  { connector_id: 'jarvis.tasks.connector.v1', family: 'TASKS', provider: 'UNBOUND', capabilities: ['tasks.prepare', 'tasks.write'], required_permissions: ['TASKS_READ_WRITE'], risk_level: 'MEDIUM', write_scope: 'PERSONAL_EXTERNAL', authentication_state: 'UNBOUND', availability: 'UNBOUND', cost_profile: 'ZERO' },
  { connector_id: 'jarvis.reminders.connector.v1', family: 'REMINDERS', provider: 'UNBOUND', capabilities: ['reminders.write'], required_permissions: ['REMINDERS_WRITE'], risk_level: 'LOW', write_scope: 'PERSONAL_EXTERNAL', authentication_state: 'UNBOUND', availability: 'UNBOUND', cost_profile: 'ZERO' }
]);

function containsSecret(value, key = '') {
  if (SECRET_KEY.test(key)) return value !== undefined && value !== null && clean(value, 200).length > 0;
  if (typeof value === 'string') return SECRET_TEXT.test(value);
  if (Array.isArray(value)) return value.some((item) => containsSecret(item));
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => containsSecret(v, k));
  return false;
}

function publicConnector(connector = {}) {
  const { handler, ...rest } = connector;
  return { ...structuredClone(rest), handler_configured: typeof handler === 'function' };
}

export function createJarvisConnectorRegistryV1(entries = DEFAULT_CATALOG) {
  const connectors = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const connectorId = clean(entry?.connector_id, 180);
    const family = clean(entry?.family, 80).toUpperCase();
    const provider = clean(entry?.provider, 120) || 'UNBOUND';
    if (!connectorId || /^hamyren[.:/]/i.test(connectorId) || /^hamyren$/i.test(provider)) continue;
    if (!JARVIS_CONNECTOR_FAMILIES.includes(family)) continue;
    if (containsSecret(entry)) continue;

    const capabilities = Array.isArray(entry.capabilities)
      ? entry.capabilities.map((v) => clean(v, 120)).filter((v) => JARVIS_CONNECTOR_CAPABILITIES.includes(v))
      : [];
    if (!capabilities.length || connectors.some((item) => item.connector_id === connectorId)) continue;

    connectors.push({
      connector_id: connectorId,
      family,
      provider,
      capabilities,
      required_permissions: Array.isArray(entry.required_permissions)
        ? entry.required_permissions.map((v) => clean(v, 120)).filter(Boolean)
        : [],
      risk_level: clean(entry.risk_level, 40).toUpperCase() || 'LOW',
      write_scope: clean(entry.write_scope, 80).toUpperCase() || 'NONE',
      authentication_state: clean(entry.authentication_state, 80).toUpperCase() || 'UNBOUND',
      availability: clean(entry.availability, 80).toUpperCase() || 'UNBOUND',
      cost_profile: clean(entry.cost_profile, 80).toUpperCase() || 'UNKNOWN',
      handler: typeof entry.handler === 'function' ? entry.handler : null
    });
  }

  return {
    schema: 'aurentara.jarvis.connector-registry.v1',
    connectors,
    hamyren_connector_registered: false,
    credentials_embedded: false
  };
}

export function routeJarvisConnectorV1(registry = createJarvisConnectorRegistryV1(), capability = '') {
  const required = clean(capability, 120);
  if (!JARVIS_CONNECTOR_CAPABILITIES.includes(required)) {
    return { ok: false, error: 'JARVIS_CONNECTOR_CAPABILITY_INVALID', capability: required || null };
  }

  const candidates = (registry.connectors || [])
    .filter((connector) => !/^hamyren[.:/]/i.test(connector.connector_id))
    .filter((connector) => connector.capabilities.includes(required))
    .sort((a, b) => {
      const ar = a.availability === 'AVAILABLE' ? 0 : 1;
      const br = b.availability === 'AVAILABLE' ? 0 : 1;
      return ar - br || a.connector_id.localeCompare(b.connector_id);
    });

  if (!candidates.length) return { ok: false, error: 'JARVIS_CONNECTOR_NOT_FOUND', capability: required };

  const selected = candidates[0];
  return {
    ok: true,
    schema: 'aurentara.jarvis.connector-route.v1',
    capability: required,
    connector: publicConnector(selected),
    execution_ready: selected.availability === 'AVAILABLE'
      && selected.authentication_state === 'AUTHENTICATED'
      && typeof selected.handler === 'function',
    hamyren_boundary_crossed: false
  };
}

export function validateJarvisConnectorPayloadV1(payload = {}) {
  if (containsSecret(payload)) {
    return { ok: false, error: 'JARVIS_CONNECTOR_SECRET_IN_PAYLOAD_BLOCKED' };
  }
  if (clean(payload?.source_system, 120).toLowerCase() === 'hamyren') {
    return { ok: false, error: 'JARVIS_HAMYREN_CONNECTOR_PAYLOAD_BLOCKED' };
  }
  return { ok: true, payload: structuredClone(payload ?? {}) };
}

export function jarvisConnectorManifestV1() {
  const registry = createJarvisConnectorRegistryV1();
  return {
    schema: registry.schema,
    connector_count: registry.connectors.length,
    connectors: registry.connectors.map(publicConnector),
    supported_families: [...JARVIS_CONNECTOR_FAMILIES],
    supported_capabilities: [...JARVIS_CONNECTOR_CAPABILITIES],
    live_connectors_bound: registry.connectors.some((item) =>
      item.availability === 'AVAILABLE'
      && item.authentication_state === 'AUTHENTICATED'
      && typeof item.handler === 'function'
    ),
    credentials_embedded: false,
    hamyren_connector_registered: false
  };
}
