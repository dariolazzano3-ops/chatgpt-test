const clean = (value, max = 240) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export function createMemoryRuntimeStore() {
  const records = new Map();
  return {
    schema: 'riosystems.runtime-store.memory.v1',
    async get(scope, collection, id) {
      return clone(records.get(`${scope}:${collection}:${id}`) ?? null);
    },
    async put(scope, collection, id, value, options = {}) {
      const key = `${scope}:${collection}:${id}`;
      const current = records.get(key);
      const revision = Number(current?.revision || 0);
      if (options.expected_revision !== undefined && Number(options.expected_revision) !== revision) {
        return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: Number(options.expected_revision), actual_revision: revision };
      }
      const next = { revision: revision + 1, value: clone(value) };
      records.set(key, next);
      return { ok: true, revision: next.revision, value: clone(next.value) };
    },
    async list(scope, collection) {
      const prefix = `${scope}:${collection}:`;
      return [...records.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, entry]) => ({ id: key.slice(prefix.length), revision: entry.revision, value: clone(entry.value) }));
    }
  };
}

export function createScopedRuntimeRepository(store, input = {}) {
  const customerId = clean(input.customer_id, 120);
  const projectId = clean(input.project_id, 120);
  if (!customerId || !projectId) return { ok: false, error: 'CUSTOMER_AND_PROJECT_REQUIRED' };
  const scope = `${customerId}:${projectId}`;
  const allowed = new Set(['projects','portfolio','approvals','cost-ledger','execution-runs','audit']);
  return {
    ok: true,
    scope,
    async get(collection, id) {
      if (!allowed.has(collection)) return { ok: false, error: 'COLLECTION_NOT_ALLOWED' };
      const record = await store.get(scope, collection, clean(id, 160));
      return { ok: true, record };
    },
    async put(collection, id, value, options = {}) {
      if (!allowed.has(collection)) return { ok: false, error: 'COLLECTION_NOT_ALLOWED' };
      return store.put(scope, collection, clean(id, 160), value, options);
    },
    async list(collection) {
      if (!allowed.has(collection)) return { ok: false, error: 'COLLECTION_NOT_ALLOWED', records: [] };
      return { ok: true, records: await store.list(scope, collection) };
    },
    manifest() {
      return { schema: 'riosystems.scoped-runtime-repository.v1', scope, collections: [...allowed], tenant_safe_scope: true, production_deploy: false };
    }
  };
}

export function durableRuntimeStoreManifest() {
  return {
    version: 'riosystems.durable-runtime-store.v1',
    adapter_boundary: true,
    current_adapter: 'memory',
    optimistic_revision_control: true,
    customer_project_scope: true,
    production_database_provisioned: false,
    production_deploy: false
  };
}
