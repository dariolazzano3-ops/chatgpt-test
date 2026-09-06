import { normalizeJarvisMemoryEntryV1 } from './memory-v1.js';
import { redactJarvisSensitiveDataV1 } from './audit-v1.js';

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

function safeIdentifier(value, fallback) {
  const name = clean(value || fallback, 120);
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('JARVIS_USER_MEMORY_IDENTIFIER_INVALID');
  return name;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value, 80));
}

function endpoint(baseUrl, tableName, query = '') {
  const base = clean(baseUrl, 2000).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new Error('JARVIS_USER_MEMORY_SUPABASE_URL_INVALID');
  return `${base}/rest/v1/${tableName}${query ? `?${query}` : ''}`;
}

async function accessToken(provider) {
  if (typeof provider !== 'function') throw new Error('JARVIS_USER_MEMORY_ACCESS_TOKEN_PROVIDER_REQUIRED');
  const token = clean(await provider(), 12000);
  if (!token) throw new Error('JARVIS_USER_MEMORY_ACCESS_TOKEN_REQUIRED');
  return token;
}

async function headersFor(publishableKey, tokenProvider, schema, extras = {}) {
  const key = clean(publishableKey, 12000);
  if (!key) throw new Error('JARVIS_USER_MEMORY_PUBLISHABLE_KEY_REQUIRED');
  const token = await accessToken(tokenProvider);
  return {
    apikey: key,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'accept-profile': schema,
    'content-profile': schema,
    ...extras
  };
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('JARVIS_USER_MEMORY_STORE_INVALID_RESPONSE'); }
}

function memoryRow(ownerId, ownerRef, entry) {
  if (!validUuid(ownerId)) throw new Error('JARVIS_USER_MEMORY_OWNER_ID_REQUIRED');
  const owner = clean(ownerRef, 320);
  if (!owner) throw new Error('JARVIS_USER_MEMORY_OWNER_REF_REQUIRED');
  const entryOwner = clean(entry?.owner_ref, 320);
  if (entryOwner && entryOwner !== owner) throw new Error('JARVIS_MEMORY_OWNER_REF_MISMATCH');

  const normalized = normalizeJarvisMemoryEntryV1(
    { ...entry, owner_ref: owner },
    { owner_ref: owner, now: entry?.updated_at || entry?.created_at }
  );
  if (!normalized.ok) throw new Error(normalized.error);

  const value = normalized.entry;
  return {
    owner_id: ownerId,
    owner_ref: owner,
    memory_id: value.memory_id,
    namespace: value.namespace,
    category: value.category,
    subject: value.subject,
    value: clone(value.value),
    source: clone(value.source),
    source_system: value.source_system,
    confidence: value.confidence,
    status: value.status,
    sensitivity: value.sensitivity,
    provenance: clone(value.provenance),
    valid_from: value.valid_from,
    valid_until: value.valid_until,
    historical: value.historical,
    created_at: value.created_at,
    updated_at: value.updated_at
  };
}

function memoryEntry(row, expected = {}) {
  if (!row || typeof row !== 'object') throw new Error('JARVIS_USER_MEMORY_STORE_INVALID_ROW');
  if (expected.owner_id && row.owner_id !== expected.owner_id) throw new Error('JARVIS_USER_MEMORY_OWNER_ID_MISMATCH');
  if (expected.owner_ref && row.owner_ref !== expected.owner_ref) throw new Error('JARVIS_USER_MEMORY_OWNER_REF_MISMATCH');
  const normalized = normalizeJarvisMemoryEntryV1({
    memory_id: row.memory_id,
    owner_ref: row.owner_ref,
    namespace: row.namespace,
    category: row.category,
    subject: row.subject,
    value: row.value,
    source: row.source,
    source_system: row.source_system,
    confidence: row.confidence,
    status: row.status,
    sensitivity: row.sensitivity,
    provenance: row.provenance,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    historical: row.historical,
    created_at: row.created_at,
    updated_at: row.updated_at
  });
  if (!normalized.ok) throw new Error(normalized.error);
  return normalized.entry;
}

function auditRow(ownerId, ownerRef, event = {}, at) {
  if (!validUuid(ownerId)) throw new Error('JARVIS_USER_AUDIT_OWNER_ID_REQUIRED');
  const owner = clean(ownerRef, 320);
  if (!owner) throw new Error('JARVIS_USER_AUDIT_OWNER_REF_REQUIRED');
  const redacted = redactJarvisSensitiveDataV1(event);
  if (redacted?.isolation?.namespace !== 'jarvis.personal') throw new Error('JARVIS_USER_AUDIT_NAMESPACE_INVALID');
  if (redacted?.isolation?.hamyren_memory_access === true || redacted?.isolation?.hamyren_memory_write === true) {
    throw new Error('JARVIS_USER_AUDIT_HAMYREN_ISOLATION_INVALID');
  }
  return {
    owner_id: ownerId,
    owner_ref: owner,
    schema_id: 'aurentara.jarvis.audit-event.v1',
    request_id: clean(redacted.request_id, 200) || null,
    intent: clone(redacted.intent),
    tools_used: clone(redacted.tools_used || []),
    permissions: clone(redacted.permissions || []),
    action: clean(redacted.action, 120) || null,
    result: clone(redacted.result),
    approval: clone(redacted.approval),
    cost: clone(redacted.cost),
    memory_updates: clone(redacted.memory_updates),
    isolation: clone(redacted.isolation),
    occurred_at: clean(redacted.timestamp || at, 80) || null
  };
}

export function createSupabaseJarvisUserMemoryStoreV1({
  supabase_url,
  publishable_key,
  access_token_provider,
  schema = 'jarvis_private',
  memory_table = 'personal_memory_v1',
  audit_table = 'audit_events_v1',
  fetch_impl = globalThis.fetch,
  clock = () => new Date().toISOString()
} = {}) {
  const supabaseUrl = clean(supabase_url, 2000).replace(/\/+$/, '');
  const publishableKey = clean(publishable_key, 12000);
  const schemaName = safeIdentifier(schema, 'jarvis_private');
  const memoryTable = safeIdentifier(memory_table, 'personal_memory_v1');
  const auditTable = safeIdentifier(audit_table, 'audit_events_v1');
  if (!supabaseUrl) throw new Error('JARVIS_USER_MEMORY_SUPABASE_URL_REQUIRED');
  if (!publishableKey) throw new Error('JARVIS_USER_MEMORY_PUBLISHABLE_KEY_REQUIRED');
  if (typeof access_token_provider !== 'function') throw new Error('JARVIS_USER_MEMORY_ACCESS_TOKEN_PROVIDER_REQUIRED');
  if (typeof fetch_impl !== 'function') throw new Error('JARVIS_USER_MEMORY_FETCH_REQUIRED');

  async function request(table, query, init = {}) {
    try {
      return await fetch_impl(endpoint(supabaseUrl, table, query), {
        ...init,
        headers: await headersFor(publishableKey, access_token_provider, schemaName, init.headers || {})
      });
    } catch (error) {
      if (/^JARVIS_USER_MEMORY_/.test(String(error?.message || ''))) throw error;
      throw new Error(`JARVIS_USER_MEMORY_STORE_UNAVAILABLE:${clean(error?.message || error, 240)}`);
    }
  }

  return {
    kind: 'supabase-jarvis-user-memory',
    durable: true,
    auth_mode: 'authenticated_user_rls',
    schema: schemaName,

    async loadMemory({ owner_id, owner_ref, limit = 200 } = {}) {
      const ownerId = clean(owner_id, 80);
      const ownerRef = clean(owner_ref, 320);
      if (!validUuid(ownerId)) throw new Error('JARVIS_USER_MEMORY_OWNER_ID_REQUIRED');
      if (!ownerRef) throw new Error('JARVIS_USER_MEMORY_OWNER_REF_REQUIRED');
      const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
      const query = [
        `owner_id=eq.${encodeURIComponent(ownerId)}`,
        `owner_ref=eq.${encodeURIComponent(ownerRef)}`,
        'namespace=eq.jarvis.personal',
        'select=owner_id,owner_ref,memory_id,namespace,category,subject,value,source,source_system,confidence,status,sensitivity,provenance,valid_from,valid_until,historical,created_at,updated_at',
        'order=updated_at.desc',
        `limit=${safeLimit}`
      ].join('&');
      const response = await request(memoryTable, query, { method: 'GET', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`JARVIS_USER_MEMORY_STORE_LOAD_FAILED:${response.status}`);
      const rows = await parseJson(response);
      if (!Array.isArray(rows)) throw new Error('JARVIS_USER_MEMORY_STORE_INVALID_RESPONSE');
      return rows.map((row) => memoryEntry(row, { owner_id: ownerId, owner_ref: ownerRef }));
    },

    async upsertMemory({ owner_id, owner_ref, entry } = {}) {
      const row = memoryRow(clean(owner_id, 80), clean(owner_ref, 320), entry);
      const response = await request(memoryTable, 'on_conflict=owner_id,memory_id', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=representation', accept: 'application/json' },
        body: JSON.stringify(row)
      });
      if (!response.ok) throw new Error(`JARVIS_USER_MEMORY_STORE_UPSERT_FAILED:${response.status}`);
      const rows = await parseJson(response);
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('JARVIS_USER_MEMORY_STORE_INVALID_RESPONSE');
      return { ok: true, entry: memoryEntry(rows[0], { owner_id: row.owner_id, owner_ref: row.owner_ref }) };
    },

    async appendAudit({ owner_id, owner_ref, event } = {}) {
      const row = auditRow(clean(owner_id, 80), clean(owner_ref, 320), event, clock());
      const response = await request(auditTable, '', {
        method: 'POST',
        headers: { prefer: 'return=representation', accept: 'application/json' },
        body: JSON.stringify(row)
      });
      if (!response.ok) throw new Error(`JARVIS_USER_AUDIT_STORE_APPEND_FAILED:${response.status}`);
      const rows = await parseJson(response);
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error('JARVIS_USER_MEMORY_STORE_INVALID_RESPONSE');
      return { ok: true, event_id: clean(rows[0].event_id, 120) || null, isolation: clone(row.isolation) };
    }
  };
}

export function jarvisUserMemoryStoreManifestV1() {
  return {
    schema: 'aurentara.jarvis.memory-store.supabase-user.v1',
    data_schema: 'jarvis_private',
    auth_mode: 'authenticated_user_rls',
    service_role_required: false,
    browser_service_role_exposed: false,
    access_token_persisted: false,
    rls_owner_scope_required: true,
    hamyren_tables_referenced: false,
    production_deploy: false
  };
}
