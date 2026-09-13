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

/** `options.canonical_owner_email` is an OPTIONAL server-side-only owner
 *  namespace override (wired only by a runtime launcher's fixed startup
 *  options — e.g. remote-operator-server-v1.js's JARVIS_CANONICAL_OWNER_EMAIL
 *  — never derived from `request`/`auth`, so no client-controlled header,
 *  query string, or cookie can ever reach it). It exists so a private
 *  remote runtime, authenticated as a real but different Cloudflare Access
 *  identity, can still read/write the same durable JARVIS owner scope an
 *  operator's local runtime already established, without re-authenticating
 *  as that identity.
 *
 *  It remaps ONLY the persistent storage namespace (owner_id / owner_ref).
 *  It never touches: `email` (the real authenticated identity), `principal_id`
 *  (still derived from the real authenticated identity, so audit trails
 *  keep distinguishing who actually acted), or `authentication` (stays
 *  `CLOUDFLARE_ACCESS` — this never simulates local auth). Authentication
 *  has already fully happened (auth.ok === true, checked above) before this
 *  override is even consulted. */
export async function createJarvisSessionV1(auth = {}, options = {}) {
  if (auth.ok !== true) return { ok: false, error: 'JARVIS_SESSION_AUTH_REQUIRED' };
  const email = clean(auth.email, 320).toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'JARVIS_SESSION_EMAIL_REQUIRED' };

  const canonicalOwnerEmail = clean(options.canonical_owner_email, 320).toLowerCase();
  if (canonicalOwnerEmail && !canonicalOwnerEmail.includes('@')) {
    return { ok: false, error: 'JARVIS_SESSION_CANONICAL_OWNER_EMAIL_INVALID' };
  }
  const ownerScopeEmail = canonicalOwnerEmail || email;

  const ownerId = await stableUuid('jarvis.personal.owner.v1:' + ownerScopeEmail);
  const ownerRef = 'jarvis:operator:' + ownerScopeEmail;
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
    canonical_owner_applied: Boolean(canonicalOwnerEmail),
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
    canonical_owner_namespace_override_supported: true,
    canonical_owner_source: 'SERVER_SIDE_OPTIONS_ONLY',
    canonical_owner_client_overridable: false,
    canonical_owner_changes_authenticated_identity: false,
    browser_bearer_token: false,
    credential_storage: false,
    hamyren_session_shared: false,
    production_deploy: false
  };
}
