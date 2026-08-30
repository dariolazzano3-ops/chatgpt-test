const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function validRuntime(runtime = {}) {
  return runtime?.schema === 'riosystems.operator-runtime.v1'
    && clean(runtime.operator_id, 160)
    && Number.isInteger(runtime.revision)
    && runtime.revision >= 1;
}

function safeTableName(value) {
  const name = clean(value || 'riosystems_operator_runtime_v1', 120);
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('OPERATOR_RUNTIME_TABLE_NAME_INVALID');
  return name;
}

function runtimeUrl(baseUrl, tableName, query = '') {
  const base = clean(baseUrl, 2000).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new Error('OPERATOR_RUNTIME_SUPABASE_URL_INVALID');
  return `${base}/rest/v1/${tableName}${query ? `?${query}` : ''}`;
}

function authHeaders(serviceRoleKey, extras = {}) {
  const key = clean(serviceRoleKey, 4000);
  if (!key) throw new Error('OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY_REQUIRED');
  return { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...extras };
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('OPERATOR_RUNTIME_STORE_INVALID_RESPONSE'); }
}

function normalizeRow(row, operatorId = null) {
  if (!row || typeof row !== 'object' || !validRuntime(row.runtime)) throw new Error('OPERATOR_RUNTIME_STORE_INVALID_ROW');
  if (operatorId && row.runtime.operator_id !== operatorId) throw new Error('OPERATOR_RUNTIME_STORE_SCOPE_MISMATCH');
  if (!Number.isInteger(Number(row.revision)) || Number(row.revision) !== row.runtime.revision) throw new Error('OPERATOR_RUNTIME_STORE_REVISION_MISMATCH');
  return clone(row.runtime);
}

export function createSupabaseOperatorRuntimeStore({ supabase_url, service_role_key, table_name = 'riosystems_operator_runtime_v1', fetch_impl = globalThis.fetch, clock = () => new Date().toISOString() } = {}) {
  const supabaseUrl = clean(supabase_url, 2000).replace(/\/+$/, '');
  const serviceRoleKey = clean(service_role_key, 4000);
  const tableName = safeTableName(table_name);
  if (!supabaseUrl) throw new Error('OPERATOR_RUNTIME_SUPABASE_URL_REQUIRED');
  if (!serviceRoleKey) throw new Error('OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY_REQUIRED');
  if (typeof fetch_impl !== 'function') throw new Error('OPERATOR_RUNTIME_FETCH_REQUIRED');
  runtimeUrl(supabaseUrl, tableName);

  async function request(query, init = {}) {
    let response;
    try {
      response = await fetch_impl(runtimeUrl(supabaseUrl, tableName, query), { ...init, headers: authHeaders(serviceRoleKey, init.headers || {}) });
    } catch (error) {
      throw new Error(`OPERATOR_RUNTIME_STORE_UNAVAILABLE:${clean(error?.message || error, 240)}`);
    }
    return response;
  }

  const store = {
    kind: 'supabase', durable: true,
    async load(operatorId) {
      const key = clean(operatorId, 160);
      if (!key) throw new Error('OPERATOR_ID_REQUIRED');
      const response = await request(`operator_id=eq.${encodeURIComponent(key)}&select=operator_id,revision,runtime&limit=1`, { method: 'GET', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`OPERATOR_RUNTIME_STORE_LOAD_FAILED:${response.status}`);
      const rows = await parseJson(response);
      if (!Array.isArray(rows)) throw new Error('OPERATOR_RUNTIME_STORE_INVALID_RESPONSE');
      if (rows.length === 0) return null;
      if (rows.length !== 1) throw new Error('OPERATOR_RUNTIME_STORE_DUPLICATE_ROWS');
      return normalizeRow(rows[0], key);
    },
    async create(runtime) {
      if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
      const at = clean(clock(), 80) || new Date().toISOString();
      const response = await request('', { method: 'POST', headers: { prefer: 'return=representation', accept: 'application/json' }, body: JSON.stringify({ operator_id: runtime.operator_id, revision: runtime.revision, runtime: clone(runtime), created_at: at, updated_at: at }) });
      if (response.status === 409) return { ok: false, error: 'OPERATOR_RUNTIME_ALREADY_EXISTS' };
      if (!response.ok) throw new Error(`OPERATOR_RUNTIME_STORE_CREATE_FAILED:${response.status}`);
      const rows = await parseJson(response);
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('OPERATOR_RUNTIME_STORE_INVALID_RESPONSE');
      return { ok: true, runtime: normalizeRow(rows[0], runtime.operator_id) };
    },
    async compareAndSwap(runtime, expectedRevision) {
      if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
      const expected = Number(expectedRevision);
      if (!Number.isInteger(expected)) return { ok: false, error: 'STORE_EXPECTED_REVISION_REQUIRED' };
      if (runtime.revision !== expected + 1) return { ok: false, error: 'STORE_NEXT_REVISION_INVALID', expected_next_revision: expected + 1, actual_next_revision: runtime.revision };
      const at = clean(clock(), 80) || new Date().toISOString();
      const response = await request(`operator_id=eq.${encodeURIComponent(runtime.operator_id)}&revision=eq.${expected}&select=operator_id,revision,runtime`, { method: 'PATCH', headers: { prefer: 'return=representation', accept: 'application/json' }, body: JSON.stringify({ revision: runtime.revision, runtime: clone(runtime), updated_at: at }) });
      if (!response.ok) throw new Error(`OPERATOR_RUNTIME_STORE_CAS_FAILED:${response.status}`);
      const rows = await parseJson(response);
      if (!Array.isArray(rows)) throw new Error('OPERATOR_RUNTIME_STORE_INVALID_RESPONSE');
      if (rows.length === 1) return { ok: true, runtime: normalizeRow(rows[0], runtime.operator_id) };
      if (rows.length > 1) throw new Error('OPERATOR_RUNTIME_STORE_DUPLICATE_ROWS');
      const current = await store.load(runtime.operator_id);
      if (!current) return { ok: false, error: 'OPERATOR_RUNTIME_NOT_FOUND' };
      return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: expected, actual_revision: current.revision };
    }
  };
  return store;
}

export function createOperatorRuntimeStoreFromEnv(env = {}, options = {}) {
  const mode = clean(env.RIOSYSTEMS_OPERATOR_RUNTIME_STORE || options.mode || 'memory', 80).toLowerCase();
  if (mode === 'memory') {
    if (clean(env.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase() === 'staging') throw new Error('OPERATOR_RUNTIME_DURABLE_STORE_REQUIRED_IN_STAGING');
    return null;
  }
  if (mode !== 'supabase') throw new Error('OPERATOR_RUNTIME_STORE_MODE_UNSUPPORTED');
  return createSupabaseOperatorRuntimeStore({ supabase_url: env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL, service_role_key: env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY, table_name: env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_TABLE || 'riosystems_operator_runtime_v1', fetch_impl: options.fetch_impl || globalThis.fetch, clock: options.clock || (() => new Date().toISOString()) });
}

export function supabaseOperatorRuntimeStoreManifest() {
  return { schema: 'riosystems.operator-runtime-store.supabase.v1', contract: ['load','create','compareAndSwap'], optimistic_concurrency: true, durable: true, project_scope_preserved_inside_authoritative_runtime: true, browser_credentials: false, automatic_fallback_to_memory_in_staging: false, production_deploy: false };
}
