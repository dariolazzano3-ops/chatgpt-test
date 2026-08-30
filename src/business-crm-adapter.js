import { CRM_PHYSICAL_TABLES } from './business-crm-model.js';

const TABLES = new Set(Object.values(CRM_PHYSICAL_TABLES));
const clone = (value) => structuredClone(value ?? null);

function validateOperation(table, projectId) {
  if (!TABLES.has(table)) return { ok: false, error: 'CRM_TABLE_NOT_ALLOWED' };
  if (!projectId || typeof projectId !== 'string') return { ok: false, error: 'CRM_PROJECT_SCOPE_REQUIRED' };
  return { ok: true };
}

export function createInMemoryCrmAdapter() {
  const stores = new Map([...TABLES].map((table) => [table, []]));
  let seq = 0;
  const nextId = (table) => `${table}-synthetic-${++seq}`;
  return {
    provider: 'memory-synthetic',
    async create(table, projectId, record = {}) {
      const valid = validateOperation(table, projectId); if (!valid.ok) return valid;
      if (record.project_id && record.project_id !== projectId) return { ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' };
      const rows = stores.get(table);
      if (record.idempotency_key) {
        const existing = rows.find((row) => row.project_id === projectId && row.idempotency_key === record.idempotency_key);
        if (existing) return { ok: true, row: clone(existing), idempotent_replay: true };
      }
      const row = { id: record.id || nextId(table), ...clone(record), project_id: projectId };
      rows.push(row);
      return { ok: true, row: clone(row), idempotent_replay: false };
    },
    async read(table, projectId, id) {
      const valid = validateOperation(table, projectId); if (!valid.ok) return valid;
      const row = stores.get(table).find((item) => item.project_id === projectId && item.id === id);
      return row ? { ok: true, row: clone(row) } : { ok: false, error: 'CRM_RECORD_NOT_FOUND' };
    },
    async update(table, projectId, id, patch = {}) {
      const valid = validateOperation(table, projectId); if (!valid.ok) return valid;
      if (patch.project_id && patch.project_id !== projectId) return { ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' };
      const rows = stores.get(table); const index = rows.findIndex((item) => item.project_id === projectId && item.id === id);
      if (index < 0) return { ok: false, error: 'CRM_RECORD_NOT_FOUND' };
      rows[index] = { ...rows[index], ...clone(patch), id, project_id: projectId };
      return { ok: true, row: clone(rows[index]) };
    },
    async query(table, projectId, filters = {}) {
      const valid = validateOperation(table, projectId); if (!valid.ok) return valid;
      if (filters.project_id && filters.project_id !== projectId) return { ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' };
      const rows = stores.get(table).filter((row) => row.project_id === projectId && Object.entries(filters).every(([key, value]) => key === 'project_id' || row[key] === value));
      return { ok: true, rows: clone(rows) };
    },
    async controlledDelete() { return { ok: false, error: 'CRM_DESTRUCTIVE_DELETE_DISABLED' }; },
    snapshot() { return Object.fromEntries([...stores.entries()].map(([table, rows]) => [table, clone(rows)])); }
  };
}

export function createSupabaseCrmAdapter(config = {}) {
  if (typeof config.transport !== 'function') throw new TypeError('SUPABASE_CRM_TRANSPORT_REQUIRED');
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeRuntime = config.production !== true && config.real_customer_data !== true && Number(config.max_variable_cost_eur) === 0;
  const resolveProjectUuid = async (projectId) => {
    let value = null;
    if (typeof config.resolve_project_uuid === 'function') value = await config.resolve_project_uuid(projectId);
    else if (config.project_id === projectId) value = config.project_uuid;
    const projectUuid = String(value || '').trim().toLowerCase();
    return UUID.test(projectUuid) ? { ok: true, project_uuid: projectUuid } : { ok: false, error: 'SUPABASE_CRM_PROJECT_BINDING_REQUIRED' };
  };
  const call = async (operation, table, projectId, payload = {}) => {
    const valid = validateOperation(table, projectId); if (!valid.ok) return valid;
    if (!safeRuntime) return { ok: false, error: 'SUPABASE_CRM_SAFETY_GATE_REJECTED' };
    const binding = await resolveProjectUuid(projectId); if (!binding.ok) return binding;
    const result = await config.transport({ provider: 'supabase', operation, table, project_key: projectId, project_id: binding.project_uuid, ...clone(payload) });
    return result?.ok === true ? result : { ok: false, error: result?.error || 'SUPABASE_CRM_OPERATION_FAILED' };
  };
  return {
    provider: 'supabase',
    read: (table, projectId, id) => call('read', table, projectId, { id }),
    create: async (table, projectId, record = {}) => {
      if (record.project_id && record.project_id !== projectId) return { ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' };
      const binding = await resolveProjectUuid(projectId); if (!binding.ok) return binding;
      if (!safeRuntime) return { ok: false, error: 'SUPABASE_CRM_SAFETY_GATE_REJECTED' };
      const persistedRecord = table === CRM_PHYSICAL_TABLES.projects
        ? { ...clone(record), id: binding.project_uuid }
        : { ...clone(record), project_id: binding.project_uuid };
      delete persistedRecord.project_key;
      const result = await config.transport({ provider: 'supabase', operation: 'create', table, project_key: projectId, project_id: binding.project_uuid, record: persistedRecord });
      return result?.ok === true ? result : { ok: false, error: result?.error || 'SUPABASE_CRM_OPERATION_FAILED' };
    },
    update: (table, projectId, id, patch = {}) => {
      if (patch.project_id && patch.project_id !== projectId) return Promise.resolve({ ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' });
      return call('update', table, projectId, { id, patch: clone(patch) });
    },
    query: (table, projectId, filters = {}) => {
      if (filters.project_id && filters.project_id !== projectId) return Promise.resolve({ ok: false, error: 'CRM_PROJECT_SCOPE_MISMATCH' });
      return call('query', table, projectId, { filters: clone(filters) });
    },
    controlledDelete: async (table, projectId, id, runtime = {}) => {
      if (config.destructive_delete !== true || runtime.confirmation !== 'ALLOW_DESTRUCTIVE_STAGING_DELETE_ONCE') return { ok: false, error: 'CRM_DESTRUCTIVE_DELETE_DISABLED' };
      if (runtime.synthetic_test_data_only !== true || runtime.production === true) return { ok: false, error: 'CRM_DESTRUCTIVE_DELETE_SCOPE_REJECTED' };
      return call('controlled_delete', table, projectId, { id, synthetic_test_data_only: true });
    }
  };
}
