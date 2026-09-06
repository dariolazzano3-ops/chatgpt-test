import assert from 'node:assert/strict';
import { createJarvisGoogleOAuthServiceV1, jarvisGoogleOAuthManifestV1 } from '../src/jarvis/google-oauth-v1.js';
import { jarvisOAuthCryptoManifestV1 } from '../src/jarvis/oauth-crypto-v1.js';
import { jarvisAccessManifestV1 } from '../src/jarvis/access-v1.js';

const session = {
  owner_id: '11111111-1111-4111-8111-111111111111',
  owner_ref: 'jarvis:operator:private@example.invalid'
};
let connection = null;
let touched = 0;
const oauthStore = {
  async loadConnection() { return connection; },
  async upsertConnection(input) {
    assert.notEqual(input.ciphertext, 'synthetic-refresh-token');
    assert.notEqual(input.iv, 'synthetic-refresh-token');
    connection = {
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      provider: 'google_calendar',
      refresh_token_ciphertext: input.ciphertext,
      refresh_token_iv: input.iv,
      crypto_version: 1,
      scopes: input.scopes,
      status: 'ACTIVE'
    };
    return { ok: true, connection: { provider: 'google_calendar', status: 'ACTIVE' } };
  },
  async touchConnection() { touched += 1; return true; }
};

const requests = [];
async function fakeFetch(url, init = {}) {
  requests.push({ url, init });
  if (url === 'https://oauth2.googleapis.com/token') {
    const form = new URLSearchParams(init.body);
    assert.equal(init.method, 'POST');
    if (form.get('grant_type') === 'authorization_code') {
      assert.equal(form.get('client_secret'), 'synthetic-client-secret');
      return new Response(JSON.stringify({
        access_token: 'synthetic-access-token',
        refresh_token: 'synthetic-refresh-token',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        token_type: 'Bearer',
        expires_in: 3600
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (form.get('grant_type') === 'refresh_token') {
      assert.equal(form.get('refresh_token'), 'synthetic-refresh-token');
      return new Response(JSON.stringify({
        access_token: 'synthetic-refreshed-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  }

  if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events?')) {
    assert.equal(init.headers.authorization, 'Bearer synthetic-refreshed-access-token');
    return new Response(JSON.stringify({
      items: [{
        id: 'evt-1',
        summary: 'Synthetic OAuth calendar event',
        start: { dateTime: '2026-09-08T10:00:00+02:00' },
        end: { dateTime: '2026-09-08T10:30:00+02:00' },
        status: 'confirmed'
      }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  return new Response('{}', { status: 404 });
}

let now = 1_800_000_000_000;
const oauth = createJarvisGoogleOAuthServiceV1({
  client_id: 'synthetic-client-id.apps.googleusercontent.com',
  client_secret: 'synthetic-client-secret',
  root_secret: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  redirect_uri: 'https://private.example.invalid/jarvis/oauth/google/callback',
  oauth_store: oauthStore,
  fetch_impl: fakeFetch,
  clock: () => now
});

const start = await oauth.authorizationStart(session);
assert.equal(start.ok, true);
assert.equal(start.calendar_write_requested, false);
assert.match(start.authorization_url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
const authUrl = new URL(start.authorization_url);
assert.equal(authUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.readonly');
assert.equal(authUrl.searchParams.get('access_type'), 'offline');
assert.equal(authUrl.searchParams.get('prompt'), 'consent');
assert.equal(start.authorization_url.includes('synthetic-client-secret'), false);
assert.equal(start.authorization_url.includes('0123456789abcdefghijklmnopqrstuvwxyz'), false);
assert.match(start.cookie, /HttpOnly/);
assert.match(start.cookie, /SameSite=Lax/);

const state = authUrl.searchParams.get('state');
const callback = await oauth.handleCallback({
  session,
  code: 'synthetic-code',
  state,
  cookie_state: state
});
assert.equal(callback.ok, true);
assert.equal(callback.connected, true);
assert.equal(callback.refresh_token_persisted_plaintext, false);
assert.equal(callback.access_token_persisted, false);
assert.equal(callback.calendar_write_enabled, false);
assert.equal(JSON.stringify(callback).includes('synthetic-refresh-token'), false);
assert.equal(JSON.stringify(connection).includes('synthetic-refresh-token'), false);

const wrongCookie = await oauth.handleCallback({
  session,
  code: 'synthetic-code',
  state,
  cookie_state: 'wrong'
});
assert.equal(wrongCookie.ok, false);
assert.equal(wrongCookie.error, 'JARVIS_GOOGLE_OAUTH_COOKIE_STATE_MISMATCH');

const connector = await oauth.calendarConnector(session);
assert.ok(connector);
assert.deepEqual(connector.capabilities, ['calendar.read']);
assert.equal(connector.write_scope, 'NONE');
const calendar = await connector.handler({
  capability: 'calendar.read',
  payload: {
    calendar_id: 'primary',
    time_min: '2026-09-08T00:00:00+02:00',
    time_max: '2026-09-09T00:00:00+02:00'
  }
});
assert.equal(calendar.count, 1);
assert.equal(calendar.events[0].summary, 'Synthetic OAuth calendar event');
assert.equal(calendar.external_effect, false);
assert.equal(touched, 1);

await assert.rejects(
  () => connector.handler({
    capability: 'calendar.write',
    payload: {
      time_min: '2026-09-08T00:00:00+02:00',
      time_max: '2026-09-09T00:00:00+02:00'
    }
  }),
  /READ_ONLY/
);

const oauthManifest = jarvisGoogleOAuthManifestV1();
assert.equal(oauthManifest.calendar_write_enabled, false);
assert.equal(oauthManifest.refresh_token_encrypted_at_rest, true);
assert.equal(oauthManifest.access_token_persisted, false);

const cryptoManifest = jarvisOAuthCryptoManifestV1();
assert.equal(cryptoManifest.refresh_token_encryption, 'AES-256-GCM');
assert.equal(cryptoManifest.plaintext_refresh_token_persisted, false);

const accessManifest = jarvisAccessManifestV1();
assert.equal(accessManifest.dedicated_access_audience_required, true);
assert.equal(accessManifest.operator_dashboard_audience_reused, false);

console.log('JARVIS Google OAuth V1 smoke: PASS');
