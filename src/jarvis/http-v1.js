import { authorizeJarvisV1 } from './access-v1.js';
import { createJarvisSessionV1 } from './session-v1.js';
import { createJarvisMemoryStoreFromEnvV1 } from './memory-store-supabase-v1.js';
import { createJarvisRpcMemoryStoreFromEnvV1 } from './memory-store-supabase-rpc-v1.js';
import { createJarvisOAuthStoreFromEnvV1 } from './oauth-store-supabase-rpc-v1.js';
import { createMemoryJarvisStoreV1 } from './memory-store-memory-v1.js';
import { handleJarvisRuntimeRequestV1 } from './runtime-v1.js';
import { inferJarvisCalendarWindowV1 } from './calendar-window-v1.js';
import { presentJarvisRuntimeResponseV1 } from './presenter-v1.js';
import { renderJarvisPrivateChatV1 } from './ui-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { createJarvisGoogleOAuthServiceV1, jarvisGoogleOAuthConfigFromEnvV1 } from './google-oauth-v1.js';
import {
  createJarvisCommandCenterTruthSnapshotV1,
  createJarvisCommandCenterLiveProbeBindingsV1
} from './command-center-runtime-truth-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
let localMemoryStore = null;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...extraHeaders
    }
  });
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      ...extraHeaders
    }
  });
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }
  });
}

async function bodyJson(request) {
  if (request.method !== 'POST') return {};
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.json(); } catch { return {}; }
}

function staging(env = {}) {
  const mode = clean(env.JARVIS_ENVIRONMENT, 80).toLowerCase();
  return mode === 'staging' || mode === 'private-staging';
}

function memoryStore(env = {}, options = {}) {
  if (options.memory_store) return options.memory_store;

  const mode = clean(env.JARVIS_PERSONAL_MEMORY_STORE || options.mode || '', 80).toLowerCase();

  const rpc = createJarvisRpcMemoryStoreFromEnvV1(env, options);
  if (rpc) return rpc;

  if (mode === 'supabase') {
    const legacy = createJarvisMemoryStoreFromEnvV1(env, options);
    if (legacy) return legacy;
  }

  if (staging(env)) return null;
  if (!localMemoryStore) localMemoryStore = createMemoryJarvisStoreV1();
  return localMemoryStore;
}

function baseConnectors(options = {}) {
  return Array.isArray(options.connectors) ? [...options.connectors] : [];
}

function calendarReadBound(connectors = []) {
  return connectors.some((item) =>
    item?.availability === 'AVAILABLE'
    && item?.authentication_state === 'AUTHENTICATED'
    && Array.isArray(item?.capabilities)
    && item.capabilities.includes('calendar.read')
    && typeof item.handler === 'function'
  );
}

function cookieValue(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function oauthService(env, options = {}) {
  if (options.oauth_service) return options.oauth_service;
  const config = jarvisGoogleOAuthConfigFromEnvV1(env);
  if (!config.configured) return null;
  const store = options.oauth_store || createJarvisOAuthStoreFromEnvV1(env, options);
  if (!store) return null;
  return createJarvisGoogleOAuthServiceV1({
    client_id: config.client_id,
    client_secret: config.client_secret,
    root_secret: config.root_secret,
    redirect_uri: config.redirect_uri,
    oauth_store: store,
    fetch_impl: options.fetch_impl || globalThis.fetch,
    clock: options.clock_ms || (() => Date.now())
  });
}

async function authSession(request, env, ctx, options) {
  const auth = await authorizeJarvisV1(request, env, ctx, { authorize: options.authorize });
  if (!auth.ok) return { ok: false, auth };
  const session = await createJarvisSessionV1(auth, options);
  return session.ok ? { ok: true, auth, session } : { ok: false, auth: { status: 403, error: session.error } };
}

async function connectorsFor(session, oauth, options = {}) {
  const connectors = baseConnectors(options);
  if (oauth) {
    const google = await oauth.calendarConnector(session);
    if (google && !connectors.some((item) => item?.connector_id === google.connector_id)) connectors.push(google);
  }
  return connectors;
}

export async function handleJarvisHttpV1(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!(url.pathname === '/jarvis' || url.pathname === '/jarvis/' || url.pathname.startsWith('/jarvis/'))) return null;

  const resolved = await authSession(request, env, ctx, options);
  if (!resolved.ok) {
    const status = resolved.auth?.status || 403;
    if (url.pathname.startsWith('/jarvis/api/')) {
      return json({ ok: false, error: resolved.auth?.error || 'JARVIS_PRIVATE_ACCESS_REQUIRED', private: true }, status);
    }
    return html('<!doctype html><meta charset="utf-8"><title>JARVIS Private</title><body style="background:#05090e;color:#eaf7ff;font-family:system-ui;padding:3rem"><h1>JARVIS Private</h1><p>Private authentication is required.</p></body>', status);
  }

  const session = resolved.session;
  const store = memoryStore(env, options);
  const oauth = oauthService(env, options);

  if (url.pathname === '/jarvis/connect/google' && request.method === 'GET') {
    if (!oauth) return html('<!doctype html><meta charset="utf-8"><title>JARVIS Google</title><body style="background:#05090e;color:#eaf7ff;font-family:system-ui;padding:3rem"><h1>Google Calendar</h1><p>OAuth credentials are not configured yet.</p><p><a href="/jarvis" style="color:#8bd2ff">Back to JARVIS</a></p></body>', 503);
    const start = await oauth.authorizationStart(session);
    return redirect(start.authorization_url, { 'set-cookie': start.cookie });
  }

  if (url.pathname === '/jarvis/oauth/google/callback' && request.method === 'GET') {
    const clearCookie = '__Host-jarvis_oauth_state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';
    if (!oauth) return html('<!doctype html><meta charset="utf-8"><title>JARVIS Google</title><body>OAuth not configured.</body>', 503, { 'set-cookie': clearCookie });
    if (url.searchParams.get('error')) {
      return redirect('/jarvis?google=cancelled', { 'set-cookie': clearCookie });
    }

    const result = await oauth.handleCallback({
      session,
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      cookie_state: cookieValue(request, '__Host-jarvis_oauth_state')
    });

    if (!result.ok) {
      return redirect('/jarvis?google=error', { 'set-cookie': clearCookie });
    }

    if (store) {
      const event = createJarvisAuditEventV1({
        timestamp: new Date().toISOString(),
        owner_ref: session.owner_ref,
        request: 'Connect Google Calendar',
        intent: { intent_type: 'APPROVAL_REQUEST', domain: 'CALENDAR', action: 'CONNECT_GOOGLE_CALENDAR' },
        tools_used: ['jarvis.google-calendar.read.v1'],
        permissions: ['CALENDAR_READ'],
        action: 'CONNECT_GOOGLE_CALENDAR',
        result: { status: 'COMPLETED', verified: true, external_effect: false },
        approval: { required: true, explicit: true, gate_status: 'APPROVED_BY_OAUTH_CONSENT' },
        cost: { estimated_eur: 0, actual_eur: 0 },
        memory_updates: { accepted: 0, proposed: 0, rejected: 0 }
      });
      try {
        await store.appendAudit({ owner_id: session.owner_id, owner_ref: session.owner_ref, event });
      } catch {}
    }

    return redirect('/jarvis?google=connected', { 'set-cookie': clearCookie });
  }

  if (url.pathname === '/jarvis' || url.pathname === '/jarvis/') {
    return html(renderJarvisPrivateChatV1({ base_path: options.ui_base_path === '' ? '' : '/jarvis' }));
  }

  if (url.pathname === '/jarvis/api/session' && request.method === 'GET') {
    return json({
      ok: true,
      schema: session.schema,
      principal_id: session.principal_id,
      display_name: session.display_name,
      authenticated: true,
      authentication: session.authentication,
      memory_namespace: session.memory_namespace,
      credentials_exposed: false,
      hamyren_session_shared: false,
      production_deploy: false
    });
  }

  if (url.pathname === '/jarvis/api/status' && request.method === 'GET') {
    const connectors = baseConnectors(options);
    const googleConnected = oauth ? await oauth.isConnected(session) : false;
    return json({
      ok: true,
      schema: 'aurentara.jarvis.private-status.v1',
      core_online: true,
      private_session: true,
      dedicated_access_audience: true,
      durable_memory_ready: Boolean(store?.durable),
      memory_store_kind: store?.kind || null,
      google_oauth_configured: Boolean(oauth),
      google_calendar_connected: googleConnected,
      calendar_read_contract: true,
      calendar_read_bound: googleConnected || calendarReadBound(connectors),
      calendar_write_enabled: false,
      external_writes_enabled: false,
      finance_actions_enabled: false,
      production_deploy: false,
      billing_enabled: false,
      hamyren_data_flow: false
    });
  }

  if (url.pathname === '/jarvis/api/runtime-truth' && request.method === 'GET') {
    const probes = options.command_center_probes && typeof options.command_center_probes === 'object'
      ? options.command_center_probes
      : {};
    const bindings = createJarvisCommandCenterLiveProbeBindingsV1(probes, { now: options.now });
    const snapshot = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: options.now });
    return json({
      ok: true,
      private: true,
      read_only: true,
      production_deploy: false,
      hamyren_data_flow: false,
      ...snapshot
    });
  }

  if (url.pathname === '/jarvis/api/chat' && request.method === 'POST') {
    if (!store) {
      return json({
        ok: false,
        error: 'JARVIS_DURABLE_MEMORY_NOT_READY',
        message: 'JARVIS Memory ist in dieser Staging-Runtime noch nicht gebunden.',
        production_deploy: false
      }, 503);
    }

    const body = await bodyJson(request);
    const message = clean(body.message, 4000);
    if (!message) return json({ ok: false, error: 'JARVIS_MESSAGE_REQUIRED' }, 400);

    const now = new Date().toISOString();
    const timezone = clean(env.JARVIS_TIMEZONE, 120) || 'Europe/Berlin';
    const window = inferJarvisCalendarWindowV1(message, { now, timezone });
    const connectors = await connectorsFor(session, oauth, options);

    const runtime = await handleJarvisRuntimeRequestV1({
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      request_id: crypto.randomUUID(),
      message,
      now,
      granted_permissions: ['CALENDAR_READ'],
      connector_payload: window.ok ? {
        calendar_id: window.calendar_id,
        time_min: window.time_min,
        time_max: window.time_max,
        max_results: window.max_results
      } : {}
    }, {
      memory_store: store,
      connectors
    });

    const presentation = presentJarvisRuntimeResponseV1(runtime, { timezone });
    return json({
      ok: runtime.ok,
      schema: 'aurentara.jarvis.private-chat-response.v1',
      answer: presentation.text,
      tone: presentation.tone,
      intent: runtime.core?.intent?.intent_type || runtime.core?.intent?.type || null,
      action: runtime.core?.intent?.action || null,
      connector_status: runtime.connector_execution?.status || null,
      memory_loaded: runtime.core?.memory_retrieval?.count || 0,
      audit_persisted: runtime.audit_persisted === true,
      external_effect: runtime.connector_execution?.external_effect === true,
      production_deploy: false,
      hamyren_data_flow: false
    }, runtime.ok ? 200 : 409);
  }

  return json({ ok: false, error: 'JARVIS_ROUTE_NOT_FOUND', production_deploy: false }, 404);
}

export function jarvisHttpManifestV1() {
  return {
    schema: 'aurentara.jarvis.private-http.v1',
    route: '/jarvis',
    auth: 'dedicated_cloudflare_access_fail_closed',
    command_center_runtime_truth_route: '/jarvis/api/runtime-truth',
    command_center_runtime_truth_fail_closed: true,
    operator_dashboard_audience_reused: false,
    browser_secrets: false,
    durable_memory_required_in_staging: true,
    google_oauth_supported: true,
    calendar_read_contract: true,
    calendar_write_enabled: false,
    external_writes_enabled: false,
    hamyren_data_flow: false,
    production_deploy: false
  };
}
