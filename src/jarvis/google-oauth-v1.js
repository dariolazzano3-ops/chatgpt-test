import { createGoogleCalendarReadConnectorV1 } from './google-calendar-read-v1.js';
import {
  createJarvisOAuthStateV1,
  verifyJarvisOAuthStateV1,
  encryptJarvisRefreshTokenV1,
  decryptJarvisRefreshTokenV1
} from './oauth-crypto-v1.js';

const clean = (value, max = 30000) => String(value ?? '').trim().slice(0, max);
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

async function parseJson(response) {
  try { return await response.json(); }
  catch { throw new Error('JARVIS_GOOGLE_OAUTH_RESPONSE_INVALID'); }
}

function safeScopes(value) {
  if (Array.isArray(value)) return value.map((v) => clean(v, 600)).filter(Boolean);
  return clean(value, 4000).split(/\s+/).filter(Boolean);
}

export function jarvisGoogleOAuthConfigFromEnvV1(env = {}) {
  const config = {
    client_id: clean(env.JARVIS_GOOGLE_OAUTH_CLIENT_ID, 2000),
    client_secret: clean(env.JARVIS_GOOGLE_OAUTH_CLIENT_SECRET, 12000),
    root_secret: clean(env.JARVIS_OAUTH_ROOT_SECRET, 12000),
    redirect_uri: clean(env.JARVIS_GOOGLE_OAUTH_REDIRECT_URI, 2000),
    scope: CALENDAR_SCOPE
  };
  return {
    ...config,
    configured: Boolean(config.client_id && config.client_secret && config.root_secret.length >= 32 && /^https:\/\//i.test(config.redirect_uri)),
    client_secret_exposed: false,
    root_secret_exposed: false
  };
}

export function createJarvisGoogleOAuthServiceV1({
  client_id,
  client_secret,
  root_secret,
  redirect_uri,
  oauth_store,
  fetch_impl = globalThis.fetch,
  clock = () => Date.now()
} = {}) {
  const clientId = clean(client_id, 2000);
  const clientSecret = clean(client_secret, 12000);
  const rootSecret = clean(root_secret, 12000);
  const redirectUri = clean(redirect_uri, 2000);

  if (!clientId) throw new Error('JARVIS_GOOGLE_OAUTH_CLIENT_ID_REQUIRED');
  if (!clientSecret) throw new Error('JARVIS_GOOGLE_OAUTH_CLIENT_SECRET_REQUIRED');
  if (rootSecret.length < 32) throw new Error('JARVIS_OAUTH_ROOT_SECRET_TOO_SHORT');
  if (!/^https:\/\//i.test(redirectUri)) throw new Error('JARVIS_GOOGLE_OAUTH_REDIRECT_URI_INVALID');
  if (!oauth_store || typeof oauth_store.loadConnection !== 'function') throw new Error('JARVIS_GOOGLE_OAUTH_STORE_REQUIRED');
  if (typeof fetch_impl !== 'function') throw new Error('JARVIS_GOOGLE_OAUTH_FETCH_REQUIRED');

  async function postToken(params) {
    const response = await fetch_impl(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(params).toString()
    });
    if (!response.ok) throw new Error('JARVIS_GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED:' + response.status);
    return parseJson(response);
  }

  async function authorizationStart(session = {}) {
    const state = await createJarvisOAuthStateV1({
      root_secret: rootSecret,
      owner_id: session.owner_id,
      now_ms: clock()
    });

    const url = new URL(GOOGLE_AUTH);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', CALENDAR_SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return {
      ok: true,
      authorization_url: url.toString(),
      state,
      cookie: '__Host-jarvis_oauth_state=' + state + '; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax',
      scope: CALENDAR_SCOPE,
      calendar_write_requested: false,
      credentials_exposed: false
    };
  }

  async function handleCallback({ session, code, state, cookie_state } = {}) {
    if (!clean(code, 10000)) return { ok: false, error: 'JARVIS_GOOGLE_OAUTH_CODE_REQUIRED' };
    if (!clean(state, 10000) || clean(state, 10000) !== clean(cookie_state, 10000)) {
      return { ok: false, error: 'JARVIS_GOOGLE_OAUTH_COOKIE_STATE_MISMATCH' };
    }

    const stateCheck = await verifyJarvisOAuthStateV1(state, {
      root_secret: rootSecret,
      owner_id: session.owner_id,
      now_ms: clock()
    });
    if (!stateCheck.ok) return stateCheck;

    const token = await postToken({
      code: clean(code, 10000),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const refreshToken = clean(token?.refresh_token, 30000);
    const accessToken = clean(token?.access_token, 30000);
    if (!refreshToken || !accessToken) return { ok: false, error: 'JARVIS_GOOGLE_OAUTH_OFFLINE_TOKEN_REQUIRED' };

    const envelope = await encryptJarvisRefreshTokenV1(refreshToken, {
      root_secret: rootSecret,
      owner_id: session.owner_id,
      owner_ref: session.owner_ref
    });

    const scopes = safeScopes(token?.scope || CALENDAR_SCOPE);
    if (!scopes.includes(CALENDAR_SCOPE)) return { ok: false, error: 'JARVIS_GOOGLE_CALENDAR_READ_SCOPE_MISSING' };

    await oauth_store.upsertConnection({
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      provider: 'google_calendar',
      ciphertext: envelope.ciphertext,
      iv: envelope.iv,
      scopes
    });

    return {
      ok: true,
      connected: true,
      provider: 'google_calendar',
      scope: CALENDAR_SCOPE,
      refresh_token_persisted_plaintext: false,
      access_token_persisted: false,
      calendar_write_enabled: false,
      credentials_exposed: false
    };
  }

  async function isConnected(session = {}) {
    const connection = await oauth_store.loadConnection({
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      provider: 'google_calendar'
    });
    return Boolean(connection);
  }

  async function calendarConnector(session = {}) {
    const connected = await isConnected(session);
    if (!connected) return null;

    return createGoogleCalendarReadConnectorV1({
      fetch_impl,
      access_token_provider: async () => {
        const connection = await oauth_store.loadConnection({
          owner_id: session.owner_id,
          owner_ref: session.owner_ref,
          provider: 'google_calendar'
        });
        if (!connection) throw new Error('JARVIS_GOOGLE_CALENDAR_NOT_CONNECTED');

        const refreshToken = await decryptJarvisRefreshTokenV1(connection, {
          root_secret: rootSecret,
          owner_id: session.owner_id,
          owner_ref: session.owner_ref
        });

        const token = await postToken({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        });
        const accessToken = clean(token?.access_token, 30000);
        if (!accessToken) throw new Error('JARVIS_GOOGLE_OAUTH_ACCESS_TOKEN_REQUIRED');

        await oauth_store.touchConnection({
          owner_id: session.owner_id,
          owner_ref: session.owner_ref,
          provider: 'google_calendar'
        });
        return accessToken;
      }
    });
  }

  return {
    provider: 'google_calendar',
    authorizationStart,
    handleCallback,
    isConnected,
    calendarConnector,
    calendar_write_enabled: false,
    credentials_exposed: false
  };
}

export function jarvisGoogleOAuthManifestV1() {
  return {
    schema: 'aurentara.jarvis.google-oauth.v1',
    authorization_endpoint: GOOGLE_AUTH,
    token_endpoint: GOOGLE_TOKEN,
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state_hmac: true,
    state_http_only_cookie: true,
    refresh_token_encrypted_at_rest: true,
    access_token_persisted: false,
    calendar_write_enabled: false,
    hamyren_data_flow: false,
    production_deploy: false
  };
}
