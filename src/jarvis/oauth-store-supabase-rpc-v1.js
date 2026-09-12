import { jarvisSupabaseServiceAuthHeadersV1 } from './supabase-service-auth-headers-v1.js';

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function endpoint(baseUrl, fn) {
  const base = clean(baseUrl, 2000).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new Error('JARVIS_OAUTH_RPC_SUPABASE_URL_INVALID');
  return base + '/rest/v1/rpc/' + fn;
}

// Header selection lives centrally in supabase-service-auth-headers-v1.js —
// see that file for why a modern sb_secret_* key and a legacy service_role
// JWT are NOT interchangeable at the wire level.
function authHeaders(key) {
  return jarvisSupabaseServiceAuthHeadersV1(
    key,
    { 'content-type': 'application/json', accept: 'application/json' },
    'JARVIS_OAUTH_RPC_SERVICE_ROLE_KEY_REQUIRED'
  );
}

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error('JARVIS_OAUTH_RPC_INVALID_RESPONSE'); }
}

function scope(ownerId, ownerRef) {
  if (!UUID.test(clean(ownerId, 80))) throw new Error('JARVIS_OAUTH_RPC_OWNER_ID_REQUIRED');
  if (!clean(ownerRef, 320)) throw new Error('JARVIS_OAUTH_RPC_OWNER_REF_REQUIRED');
}

export function createSupabaseJarvisOAuthStoreV1({
  supabase_url,
  service_role_key,
  fetch_impl = globalThis.fetch
} = {}) {
  const url = clean(supabase_url, 2000).replace(/\/+$/, '');
  const key = clean(service_role_key, 12000);
  if (!url) throw new Error('JARVIS_OAUTH_RPC_SUPABASE_URL_REQUIRED');
  if (!key) throw new Error('JARVIS_OAUTH_RPC_SERVICE_ROLE_KEY_REQUIRED');
  if (typeof fetch_impl !== 'function') throw new Error('JARVIS_OAUTH_RPC_FETCH_REQUIRED');

  async function call(fn, payload) {
    let response;
    try {
      response = await fetch_impl(endpoint(url, fn), {
        method: 'POST',
        headers: authHeaders(key),
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw new Error('JARVIS_OAUTH_RPC_UNAVAILABLE:' + clean(error?.message || error, 200));
    }
    if (!response.ok) throw new Error('JARVIS_OAUTH_RPC_FAILED:' + fn + ':' + response.status);
    return parse(response);
  }

  return {
    kind: 'supabase-jarvis-oauth-rpc',
    encrypted_envelopes_only: true,

    async loadConnection({ owner_id, owner_ref, provider = 'google_calendar' } = {}) {
      scope(owner_id, owner_ref);
      if (provider !== 'google_calendar') throw new Error('JARVIS_OAUTH_PROVIDER_REJECTED');
      const row = await call('jarvis_service_oauth_load_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_provider: provider
      });
      if (!row) return null;
      if (row.owner_id !== clean(owner_id, 80) || row.owner_ref !== clean(owner_ref, 320)) {
        throw new Error('JARVIS_OAUTH_SCOPE_MISMATCH');
      }
      return row;
    },

    async upsertConnection({ owner_id, owner_ref, provider = 'google_calendar', ciphertext, iv, scopes = [] } = {}) {
      scope(owner_id, owner_ref);
      if (provider !== 'google_calendar') throw new Error('JARVIS_OAUTH_PROVIDER_REJECTED');
      if (!clean(ciphertext, 30000) || !clean(iv, 500)) throw new Error('JARVIS_OAUTH_ENVELOPE_REQUIRED');
      const row = await call('jarvis_service_oauth_upsert_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_provider: provider,
        p_refresh_token_ciphertext: clean(ciphertext, 30000),
        p_refresh_token_iv: clean(iv, 500),
        p_scopes: Array.isArray(scopes) ? scopes.map((v) => clean(v, 500)).filter(Boolean) : []
      });
      if (row && ('refresh_token_ciphertext' in row || 'refresh_token_iv' in row)) {
        throw new Error('JARVIS_OAUTH_RPC_SECRET_ENVELOPE_RETURNED');
      }
      return { ok: true, connection: row || null };
    },

    async touchConnection({ owner_id, owner_ref, provider = 'google_calendar' } = {}) {
      scope(owner_id, owner_ref);
      return Boolean(await call('jarvis_service_oauth_touch_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_provider: provider
      }));
    },

    async deleteConnection({ owner_id, owner_ref, provider = 'google_calendar' } = {}) {
      scope(owner_id, owner_ref);
      return Boolean(await call('jarvis_service_oauth_delete_v1', {
        p_owner_id: clean(owner_id, 80),
        p_owner_ref: clean(owner_ref, 320),
        p_provider: provider
      }));
    }
  };
}

export function createJarvisOAuthStoreFromEnvV1(env = {}, options = {}) {
  if (!env.JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY) return null;
  return createSupabaseJarvisOAuthStoreV1({
    supabase_url: env.JARVIS_PERSONAL_MEMORY_SUPABASE_URL,
    service_role_key: env.JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY,
    fetch_impl: options.fetch_impl || globalThis.fetch
  });
}

export function jarvisOAuthStoreManifestV1() {
  return {
    schema: 'aurentara.jarvis.oauth-store.supabase-rpc.v1',
    refresh_token_plaintext_persisted: false,
    access_token_persisted: false,
    client_secret_persisted: false,
    authenticated_browser_access: false,
    service_role_rpc_only: true,
    hamyren_data_flow: false,
    production_deploy: false
  };
}
