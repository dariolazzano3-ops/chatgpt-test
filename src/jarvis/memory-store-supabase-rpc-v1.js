import { normalizeJarvisMemoryEntryV1 } from './memory-v1.js';
import { redactJarvisSensitiveDataV1 } from './audit-v1.js';
import { jarvisSupabaseServiceAuthHeadersV1 } from './supabase-service-auth-headers-v1.js';

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function endpoint(baseUrl, fn) {
  const base = clean(baseUrl, 2000).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new Error('JARVIS_RPC_SUPABASE_URL_INVALID');
  if (!/^jarvis_service_[a-z0-9_]+_v1$/.test(fn)) throw new Error('JARVIS_RPC_FUNCTION_INVALID');
  return base + '/rest/v1/rpc/' + fn;
}

// Header selection (apikey-only for a modern sb_secret_* key, apikey +
// Authorization: Bearer for a legacy service_role JWT) lives centrally in
// supabase-service-auth-headers-v1.js — see that file for why the two
// formats are NOT interchangeable at the wire level.
function headers(serviceRoleKey) {
  return jarvisSupabaseServiceAuthHeadersV1(
    serviceRoleKey,
    { 'content-type': 'application/json', accept: 'application/json' },
    'JARVIS_RPC_SERVICE_ROLE_KEY_REQUIRED'
  );
}

async function body(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('JARVIS_RPC_INVALID_RESPONSE'); }
}

function requireScope(ownerId, ownerRef) {
  if (!UUID.test(clean(ownerId, 80))) throw new Error('JARVIS_RPC_OWNER_ID_REQUIRED');
  if (!clean(ownerRef, 320)) throw new Error('JARVIS_RPC_OWNER_REF_REQUIRED');
}

function normalizeEntry(row, ownerRef) {
  const normalized = normalizeJarvisMemoryEntryV1({
    ...row,
    owner_ref: row?.owner_ref || ownerRef
  }, { owner_ref: ownerRef, now: row?.updated_at || row?.created_at });
  if (!normalized.ok) throw new Error(normalized.error);
  if (normalized.entry.owner_ref !== ownerRef) throw new Error('JARVIS_RPC_OWNER_REF_MISMATCH');
  return normalized.entry;
}

export function createSupabaseJarvisRpcMemoryStoreV1({
  supabase_url,
  service_role_key,
  fetch_impl = globalThis.fetch
} = {}) {
  const supabaseUrl = clean(supabase_url, 2000).replace(/\/+$/, '');
  const serviceRoleKey = clean(service_role_key, 12000);
  if (!supabaseUrl) throw new Error('JARVIS_RPC_SUPABASE_URL_REQUIRED');
  if (!serviceRoleKey) throw new Error('JARVIS_RPC_SERVICE_ROLE_KEY_REQUIRED');
  if (typeof fetch_impl !== 'function') throw new Error('JARVIS_RPC_FETCH_REQUIRED');

  async function call(fn, payload) {
    let response;
    try {
      response = await fetch_impl(endpoint(supabaseUrl, fn), {
        method: 'POST',
        headers: headers(serviceRoleKey),
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw new Error('JARVIS_RPC_UNAVAILABLE:' + clean(error?.message || error, 200));
    }
    if (!response.ok) throw new Error('JARVIS_RPC_FAILED:' + fn + ':' + response.status);
    return body(response);
  }

  return {
    kind: 'supabase-jarvis-rpc-memory',
    durable: true,
    auth_mode: 'service_role_private_rpc',

    async loadMemory({ owner_id, owner_ref, limit = 200 } = {}) {
      requireScope(owner_id, owner_ref);
      const rows = await call('jarvis_service_memory_load_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_limit: Math.max(1, Math.min(500, Number(limit) || 200))
      });
      if (!Array.isArray(rows)) throw new Error('JARVIS_RPC_MEMORY_LOAD_INVALID');
      return rows.map((row) => normalizeEntry(row, clean(owner_ref, 320)));
    },

    async upsertMemory({ owner_id, owner_ref, entry } = {}) {
      requireScope(owner_id, owner_ref);
      const ownerRef = clean(owner_ref, 320);
      if (entry?.owner_ref && clean(entry.owner_ref, 320) !== ownerRef) throw new Error('JARVIS_MEMORY_OWNER_REF_MISMATCH');
      const normalized = normalizeJarvisMemoryEntryV1({ ...entry, owner_ref: ownerRef }, {
        owner_ref: ownerRef,
        now: entry?.updated_at || entry?.created_at
      });
      if (!normalized.ok) throw new Error(normalized.error);
      const row = await call('jarvis_service_memory_upsert_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: ownerRef,
        p_entry: normalized.entry
      });
      return { ok: true, entry: normalizeEntry(row, ownerRef) };
    },

    async appendAudit({ owner_id, owner_ref, event } = {}) {
      requireScope(owner_id, owner_ref);
      const redacted = redactJarvisSensitiveDataV1(event);
      if (redacted?.isolation?.namespace !== 'jarvis.personal') throw new Error('JARVIS_RPC_AUDIT_NAMESPACE_INVALID');
      if (redacted?.isolation?.hamyren_memory_access === true || redacted?.isolation?.hamyren_memory_write === true) {
        throw new Error('JARVIS_RPC_AUDIT_HAMYREN_ISOLATION_INVALID');
      }
      const row = await call('jarvis_service_audit_append_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_event: redacted
      });
      return {
        ok: true,
        event_id: clean(row?.event_id, 120) || null,
        occurred_at: clean(row?.occurred_at, 80) || null,
        isolation: clone(redacted.isolation)
      };
    },

    // Bounded, owner-scoped, read-only audit reader (Wave 4). Requires the
    // service-role RPC jarvis_service_audit_read_v1 (see migration
    // 20260911_jarvis_audit_read_v1.sql). Fails closed if the function or the
    // durable store is unavailable — never returns a fabricated empty success.
    async readAudit({ owner_id, owner_ref, limit = 50 } = {}) {
      requireScope(owner_id, owner_ref);
      const rows = await call('jarvis_service_audit_read_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_limit: Math.max(1, Math.min(200, Number(limit) || 50))
      });
      if (!Array.isArray(rows)) throw new Error('JARVIS_RPC_AUDIT_READ_INVALID');
      return rows.map((row) => ({
        event_id: clean(row?.event_id, 120) || null,
        owner_ref: clean(row?.owner_ref, 320) || clean(owner_ref, 320),
        request_id: clean(row?.request_id, 200) || null,
        intent: clone(row?.intent),
        tools_used: Array.isArray(row?.tools_used) ? clone(row.tools_used) : [],
        permissions: Array.isArray(row?.permissions) ? clone(row.permissions) : [],
        action: clean(row?.action, 120) || null,
        result: clone(row?.result),
        approval: clone(row?.approval),
        cost: clone(row?.cost),
        memory_updates: clone(row?.memory_updates),
        isolation: clone(row?.isolation),
        timestamp: clean(row?.occurred_at, 80) || null,
        occurred_at: clean(row?.occurred_at, 80) || null
      }));
    }
  };
}

export function createJarvisRpcMemoryStoreFromEnvV1(env = {}, options = {}) {
  const mode = clean(env.JARVIS_PERSONAL_MEMORY_STORE || options.mode || '', 80).toLowerCase();
  if (mode !== 'supabase-rpc') return null;
  if (!env.JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseJarvisRpcMemoryStoreV1({
    supabase_url: env.JARVIS_PERSONAL_MEMORY_SUPABASE_URL,
    service_role_key: env.JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY,
    fetch_impl: options.fetch_impl || globalThis.fetch
  });
}

export function jarvisRpcMemoryStoreManifestV1() {
  return {
    schema: 'aurentara.jarvis.memory-store.supabase-rpc.v1',
    private_schema_exposed_to_postgrest: false,
    public_rpc_functions_service_role_only: true,
    browser_service_role_exposed: false,
    hamyren_tables_referenced: false,
    durable: true,
    production_deploy: false
  };
}
