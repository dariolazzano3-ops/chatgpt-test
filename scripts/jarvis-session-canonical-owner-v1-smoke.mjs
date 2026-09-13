/* JARVIS session-v1.js — canonical owner namespace override, targeted smoke.

   Pure session-level tests (no HTTP, no Supabase, no Cloudflare Access
   network call). Proves the canonical-owner override remaps ONLY the
   persistent owner_id/owner_ref scope, never the authenticated identity
   (email/principal_id/authentication), and that it never changes existing
   behavior when unset. */
import assert from 'node:assert/strict';
import { createJarvisSessionV1, jarvisSessionManifestV1 } from '../src/jarvis/session-v1.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

const REAL_AUTH = { ok: true, email: 'Real.User@Example.INVALID', authentication: 'CLOUDFLARE_ACCESS' };

// ── A. normal session behavior is unchanged when no canonical owner is set ──
await check('A. no canonical owner set -> owner scope is the real authenticated identity, as before', async () => {
  const session = await createJarvisSessionV1(REAL_AUTH, {});
  assert.equal(session.ok, true);
  assert.equal(session.email, 'real.user@example.invalid');
  assert.equal(session.owner_ref, 'jarvis:operator:real.user@example.invalid');
  assert.equal(session.canonical_owner_applied, false);

  const withoutOption = await createJarvisSessionV1(REAL_AUTH, undefined);
  assert.deepEqual(withoutOption, session, 'omitting options entirely behaves identically to {}');
});

// ── B. verified Cloudflare email remains session.email / authenticated identity ──
await check('B. session.email stays the real authenticated Cloudflare email even with a canonical owner set', async () => {
  const session = await createJarvisSessionV1(REAL_AUTH, { canonical_owner_email: 'local-operator@localhost' });
  assert.equal(session.email, 'real.user@example.invalid');
  assert.equal(session.authenticated, true);
});

// ── C. canonical owner email deterministically resolves to the known historical owner_id ──
await check('C. canonical_owner_email=local-operator@localhost -> owner_id 8048e3a6-941f-5ea7-ac74-11f9929d2523', async () => {
  const session = await createJarvisSessionV1(REAL_AUTH, { canonical_owner_email: 'local-operator@localhost' });
  assert.equal(session.owner_id, '8048e3a6-941f-5ea7-ac74-11f9929d2523');
  assert.equal(session.canonical_owner_applied, true);

  // Case-insensitive, matching the same normalization the real email already gets.
  const upper = await createJarvisSessionV1(REAL_AUTH, { canonical_owner_email: 'Local-Operator@Localhost' });
  assert.equal(upper.owner_id, '8048e3a6-941f-5ea7-ac74-11f9929d2523');
});

// ── D. canonical owner_ref resolves to the exact expected historical scope ──
await check('D. canonical owner_ref = jarvis:operator:local-operator@localhost', async () => {
  const session = await createJarvisSessionV1(REAL_AUTH, { canonical_owner_email: 'local-operator@localhost' });
  assert.equal(session.owner_ref, 'jarvis:operator:local-operator@localhost');
});

// ── E. principal identity remains based on the actual Cloudflare user, not the canonical owner ──
await check('E. principal_id is derived from the real authenticated identity, unaffected by canonical owner', async () => {
  const withoutCanonical = await createJarvisSessionV1(REAL_AUTH, {});
  const withCanonical = await createJarvisSessionV1(REAL_AUTH, { canonical_owner_email: 'local-operator@localhost' });
  assert.equal(withCanonical.principal_id, withoutCanonical.principal_id, 'principal_id must not shift with the owner-scope override');
  assert.notEqual(withCanonical.principal_id, withCanonical.owner_id, 'principal (who acted) and owner scope (where it is stored) are deliberately distinct once a canonical owner is applied');

  // A different real user, same canonical owner -> same owner scope, different principal.
  const otherUser = await createJarvisSessionV1({ ok: true, email: 'someone-else@example.invalid' }, { canonical_owner_email: 'local-operator@localhost' });
  assert.equal(otherUser.owner_id, withCanonical.owner_id, 'owner scope is shared');
  assert.notEqual(otherUser.principal_id, withCanonical.principal_id, 'principal still distinguishes who actually acted');
  assert.equal(otherUser.email, 'someone-else@example.invalid');
});

// ── malformed canonical owner config fails closed at the session layer too ──
await check('malformed canonical_owner_email fails closed, never silently falls back', async () => {
  const bad = await createJarvisSessionV1(REAL_AUTH, { canonical_owner_email: 'not-an-email' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'JARVIS_SESSION_CANONICAL_OWNER_EMAIL_INVALID');
});

// ── unauthenticated input is still refused before any owner-scope logic runs ──
await check('unauthenticated auth is refused before canonical owner logic ever runs', async () => {
  const result = await createJarvisSessionV1({ ok: false }, { canonical_owner_email: 'local-operator@localhost' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'JARVIS_SESSION_AUTH_REQUIRED');
});

// ── manifest is honest about this capability ──
await check('manifest declares the canonical owner override as server-side-only, non-identity-changing', () => {
  const manifest = jarvisSessionManifestV1();
  assert.equal(manifest.canonical_owner_namespace_override_supported, true);
  assert.equal(manifest.canonical_owner_source, 'SERVER_SIDE_OPTIONS_ONLY');
  assert.equal(manifest.canonical_owner_client_overridable, false);
  assert.equal(manifest.canonical_owner_changes_authenticated_identity, false);
});

console.log(JSON.stringify({
  schema: 'aurentara.jarvis.session-canonical-owner.smoke.v1',
  passed,
  supabase_mutated: false,
  live_network_call: false
}, null, 2));
