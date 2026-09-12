import assert from 'node:assert/strict';
import {
  isJarvisModernSupabaseSecretKeyV1,
  jarvisSupabaseServiceAuthHeadersV1,
  jarvisSupabaseServiceAuthHeadersManifestV1
} from '../src/jarvis/supabase-service-auth-headers-v1.js';

// ── 1. Format detection ──
{
  assert.equal(isJarvisModernSupabaseSecretKeyV1('sb_secret_abcDEF123'), true);
  assert.equal(isJarvisModernSupabaseSecretKeyV1('sb_publishable_abcDEF123'), true);
  assert.equal(isJarvisModernSupabaseSecretKeyV1('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fixture.sig'), false);
  assert.equal(isJarvisModernSupabaseSecretKeyV1(''), false);
  assert.equal(isJarvisModernSupabaseSecretKeyV1(undefined), false);
  // An unrecognized-but-nonempty format falls back to the historically
  // correct legacy behavior (apikey + Authorization) rather than silently
  // dropping the Authorization header it always used to send.
  assert.equal(isJarvisModernSupabaseSecretKeyV1('some-other-token-shape'), false);
}

// ── 2. Modern sb_secret_* key -> apikey ONLY, never Authorization ──
{
  const headers = jarvisSupabaseServiceAuthHeadersV1('sb_secret_fixture_value_not_real', { 'content-type': 'application/json' });
  assert.equal(headers.apikey, 'sb_secret_fixture_value_not_real');
  assert.equal('authorization' in headers, false, 'a modern key must NEVER also be sent as Authorization: Bearer');
  assert.equal(headers['content-type'], 'application/json', 'extra headers pass through untouched');
}

// ── 3. Legacy service_role JWT -> apikey AND Authorization: Bearer ──
{
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fixture-payload.fixture-signature';
  const headers = jarvisSupabaseServiceAuthHeadersV1(jwt, { accept: 'application/json' });
  assert.equal(headers.apikey, jwt);
  assert.equal(headers.authorization, 'Bearer ' + jwt);
  assert.equal(headers.accept, 'application/json');
}

// ── 4. Missing key -> throws the caller's named error, never proceeds unauthenticated ──
{
  assert.throws(() => jarvisSupabaseServiceAuthHeadersV1('', {}, 'CUSTOM_MISSING_KEY_ERROR'), /CUSTOM_MISSING_KEY_ERROR/);
  assert.throws(() => jarvisSupabaseServiceAuthHeadersV1(undefined), /JARVIS_RPC_SERVICE_ROLE_KEY_REQUIRED/, 'default error when the caller does not name one');
}

// ── 5. Never exposes the key beyond using it as a header value ──
{
  const headers = jarvisSupabaseServiceAuthHeadersV1('sb_secret_should_never_be_logged');
  const src = JSON.stringify(headers);
  // The key legitimately appears once, as the apikey header value itself —
  // this asserts the module has no OTHER field (a log line, a debug echo)
  // that would duplicate or expose it.
  assert.equal((src.match(/sb_secret_should_never_be_logged/g) || []).length, 1);
}

// ── 6. Manifest ──
{
  const manifest = jarvisSupabaseServiceAuthHeadersManifestV1();
  assert.equal(manifest.modern_key_sends_apikey_only, true);
  assert.equal(manifest.legacy_jwt_sends_apikey_and_bearer, true);
  assert.equal(manifest.logs_or_returns_key_value, false);
}

console.log('JARVIS Supabase service auth header selection V1 smoke: PASS');
