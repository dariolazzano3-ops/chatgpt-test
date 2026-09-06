const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function hex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function stableUuid(seed) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = hex(bytes);
  return value.slice(0, 8) + '-' + value.slice(8, 12) + '-' + value.slice(12, 16) + '-' + value.slice(16, 20) + '-' + value.slice(20);
}

export async function createJarvisSessionV1(auth = {}, options = {}) {
  if (auth.ok !== true) return { ok: false, error: 'JARVIS_SESSION_AUTH_REQUIRED' };
  const email = clean(auth.email, 320).toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'JARVIS_SESSION_EMAIL_REQUIRED' };
  const ownerId = await stableUuid('jarvis.personal.owner.v1:' + email);
  const ownerRef = 'jarvis:operator:' + email;
  const principalHash = await stableUuid('jarvis.personal.principal.v1:' + email);

  return {
    ok: true,
    schema: 'aurentara.jarvis.session.v1',
    owner_id: ownerId,
    owner_ref: ownerRef,
    principal_id: principalHash,
    display_name: clean(options.display_name, 120) || email.split('@')[0],
    email,
    authenticated: true,
    authentication: 'CLOUDFLARE_ACCESS',
    memory_namespace: 'jarvis.personal',
    browser_session_secret_issued: false,
    credentials_exposed: false,
    hamyren_session_shared: false,
    production_deploy: false
  };
}

export function jarvisSessionManifestV1() {
  return {
    schema: 'aurentara.jarvis.session.v1',
    authentication: 'CLOUDFLARE_ACCESS',
    deterministic_owner_scope: true,
    browser_bearer_token: false,
    credential_storage: false,
    hamyren_session_shared: false,
    production_deploy: false
  };
}
