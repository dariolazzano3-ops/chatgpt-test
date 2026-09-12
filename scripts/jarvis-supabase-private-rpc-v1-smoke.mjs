import assert from 'node:assert/strict';
import { createSupabaseJarvisRpcMemoryStoreV1, jarvisRpcMemoryStoreManifestV1 } from '../src/jarvis/memory-store-supabase-rpc-v1.js';
import { createSupabaseJarvisOAuthStoreV1, jarvisOAuthStoreManifestV1 } from '../src/jarvis/oauth-store-supabase-rpc-v1.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const ownerRef = 'jarvis:test';
const calls = [];

async function fakeFetch(url, init = {}) {
  calls.push({ url, init });
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.apikey, 'service-role-test');
  assert.equal(init.headers.authorization, 'Bearer service-role-test');
  assert.doesNotMatch(url, /jarvis_private/);

  const fn = url.split('/').pop();
  const p = JSON.parse(init.body);

  if (fn === 'jarvis_service_memory_load_v1') return new Response(JSON.stringify([]), { status: 200 });
  if (fn === 'jarvis_service_memory_upsert_v1') {
    return new Response(JSON.stringify({
      ...p.p_entry,
      owner_id: p.p_owner_id,
      owner_ref: p.p_owner_ref
    }), { status: 200 });
  }
  if (fn === 'jarvis_service_audit_append_v1') {
    return new Response(JSON.stringify({ event_id: '22222222-2222-4222-8222-222222222222', occurred_at: '2026-09-07T01:00:00Z' }), { status: 200 });
  }
  if (fn === 'jarvis_service_oauth_load_v1') {
    return new Response(JSON.stringify({
      owner_id: ownerId,
      owner_ref: ownerRef,
      provider: 'google_calendar',
      refresh_token_ciphertext: 'ciphertext-test-value',
      refresh_token_iv: 'iv-test-value',
      crypto_version: 1,
      scopes: ['calendar.readonly'],
      status: 'ACTIVE'
    }), { status: 200 });
  }
  if (fn === 'jarvis_service_oauth_upsert_v1') {
    assert.equal(p.p_refresh_token_ciphertext, 'ciphertext-test-value');
    return new Response(JSON.stringify({
      owner_id: ownerId,
      owner_ref: ownerRef,
      provider: 'google_calendar',
      status: 'ACTIVE'
    }), { status: 200 });
  }
  if (fn === 'jarvis_service_oauth_touch_v1' || fn === 'jarvis_service_oauth_delete_v1') {
    return new Response(JSON.stringify(true), { status: 200 });
  }
  return new Response('{}', { status: 404 });
}

const memory = createSupabaseJarvisRpcMemoryStoreV1({
  supabase_url: 'https://synthetic.supabase.co',
  service_role_key: 'service-role-test',
  fetch_impl: fakeFetch
});

assert.deepEqual(await memory.loadMemory({ owner_id: ownerId, owner_ref: ownerRef }), []);
const saved = await memory.upsertMemory({
  owner_id: ownerId,
  owner_ref: ownerRef,
  entry: {
    memory_id: 'jarvis:test:decision',
    owner_ref: ownerRef,
    namespace: 'jarvis.personal',
    category: 'DECISIONS',
    subject: 'Synthetic decision',
    value: 'private',
    source_system: 'jarvis',
    confidence: 1,
    status: 'CONFIRMED',
    sensitivity: 'INTERNAL',
    provenance: {},
    historical: false,
    created_at: '2026-09-07T01:00:00Z',
    updated_at: '2026-09-07T01:00:00Z'
  }
});
assert.equal(saved.ok, true);
assert.equal(saved.entry.owner_ref, ownerRef);

await memory.appendAudit({
  owner_id: ownerId,
  owner_ref: ownerRef,
  event: {
    schema: 'aurentara.jarvis.audit-event.v1',
    timestamp: '2026-09-07T01:00:00Z',
    isolation: { namespace: 'jarvis.personal', hamyren_memory_access: false, hamyren_memory_write: false }
  }
});

const oauth = createSupabaseJarvisOAuthStoreV1({
  supabase_url: 'https://synthetic.supabase.co',
  service_role_key: 'service-role-test',
  fetch_impl: fakeFetch
});

const connection = await oauth.loadConnection({ owner_id: ownerId, owner_ref: ownerRef });
assert.equal(connection.refresh_token_ciphertext, 'ciphertext-test-value');

const upserted = await oauth.upsertConnection({
  owner_id: ownerId,
  owner_ref: ownerRef,
  ciphertext: 'ciphertext-test-value',
  iv: 'iv-test-value',
  scopes: ['calendar.readonly']
});
assert.equal(upserted.ok, true);
assert.equal(JSON.stringify(upserted).includes('ciphertext-test-value'), false);
assert.equal(await oauth.touchConnection({ owner_id: ownerId, owner_ref: ownerRef }), true);

const memoryManifest = jarvisRpcMemoryStoreManifestV1();
assert.equal(memoryManifest.private_schema_exposed_to_postgrest, false);
assert.equal(memoryManifest.public_rpc_functions_service_role_only, true);

const oauthManifest = jarvisOAuthStoreManifestV1();
assert.equal(oauthManifest.refresh_token_plaintext_persisted, false);
assert.equal(oauthManifest.access_token_persisted, false);
assert.equal(oauthManifest.hamyren_data_flow, false);

assert.ok(calls.every((call) => call.url.includes('/rest/v1/rpc/jarvis_service_')));

// ── modern sb_secret_* key: apikey ONLY, never also Authorization: Bearer ──
// (real-world regression: sending both made a real Supabase project 401
// the RPC call even though the key and function were both correct).
{
  let capturedHeaders = null;
  const modernFetch = async (url, init = {}) => {
    capturedHeaders = init.headers;
    return new Response(JSON.stringify([]), { status: 200 });
  };
  const modernMemory = createSupabaseJarvisRpcMemoryStoreV1({
    supabase_url: 'https://synthetic.supabase.co',
    service_role_key: 'sb_secret_fixture_value_not_real',
    fetch_impl: modernFetch
  });
  await modernMemory.loadMemory({ owner_id: ownerId, owner_ref: ownerRef });
  assert.equal(capturedHeaders.apikey, 'sb_secret_fixture_value_not_real');
  assert.equal('authorization' in capturedHeaders, false, 'a modern sb_secret_* key must never also be sent as Authorization: Bearer');
}

console.log('JARVIS Supabase Private RPC Gateway V1 smoke: PASS');
