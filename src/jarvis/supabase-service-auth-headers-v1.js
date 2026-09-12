/* JARVIS — Supabase service-credential header selection V1.

   ONE central place that decides how a Supabase service-role-style secret
   is sent as HTTP headers, for every JARVIS Supabase RPC client
   (memory-store-supabase-rpc-v1.js, oauth-store-supabase-rpc-v1.js). Never
   logs, returns, or otherwise exposes the key itself beyond using it as a
   header value the caller already had.

   Supabase has two service-credential formats in the wild, and they are
   NOT interchangeable at the wire level:

     - the modern API key system: `sb_secret_...` (and `sb_publishable_...`
       for the anon-equivalent) — an opaque token the API gateway verifies
       from the `apikey` header alone. Also sending it as
       `Authorization: Bearer sb_secret_...` can make the gateway try to
       parse THAT header as a JWT too and fail closed with 401 — so for this
       format `apikey` is sent ALONE, with no `authorization` header.
     - the legacy service_role JSON Web Token: a base64url-encoded JWT,
       always starting with `eyJ` (the `{"alg":...}` header segment) — this
       format authenticates via BOTH `apikey` and `Authorization: Bearer
       <jwt>`, as Supabase/PostgREST has always required.

   Selection is by the key's own format, never by a configured mode flag —
   a rotated key (either direction) is then handled correctly with zero
   config changes anywhere else. */

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);

/** Pure. True for the modern `sb_secret_...` / `sb_publishable_...` key
 *  format; false for a legacy JWT (or anything else — treated as legacy,
 *  the historically-correct behavior, so an unrecognized format never
 *  silently drops the Authorization header it always used to send). */
export function isJarvisModernSupabaseSecretKeyV1(key) {
  return /^sb_(secret|publishable)_/.test(clean(key, 200));
}

/** Pure. Builds the exact header object to send for one Supabase
 *  service-role-style call. `extra` (e.g. content-type/accept) is merged in
 *  untouched. Throws the given `missingKeyError` if `key` is empty — never
 *  silently proceeds unauthenticated. */
export function jarvisSupabaseServiceAuthHeadersV1(key, extra = {}, missingKeyError = 'JARVIS_RPC_SERVICE_ROLE_KEY_REQUIRED') {
  const cleanKey = clean(key, 12000);
  if (!cleanKey) throw new Error(missingKeyError);
  const headers = { apikey: cleanKey, ...extra };
  if (!isJarvisModernSupabaseSecretKeyV1(cleanKey)) {
    headers.authorization = 'Bearer ' + cleanKey;
  }
  return headers;
}

export function jarvisSupabaseServiceAuthHeadersManifestV1() {
  return {
    schema: 'aurentara.jarvis.supabase-service-auth-headers.v1',
    modern_key_prefixes: ['sb_secret_', 'sb_publishable_'],
    modern_key_sends_apikey_only: true,
    legacy_jwt_sends_apikey_and_bearer: true,
    selection_basis: 'key_format',
    logs_or_returns_key_value: false
  };
}
