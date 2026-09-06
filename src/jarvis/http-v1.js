import { authorizeOperator } from '../operator-dashboard-http-v1.js';
import { createJarvisSessionV1 } from './session-v1.js';
import { createJarvisMemoryStoreFromEnvV1 } from './memory-store-supabase-v1.js';
import { createMemoryJarvisStoreV1 } from './memory-store-memory-v1.js';
import { handleJarvisRuntimeRequestV1 } from './runtime-v1.js';
import { inferJarvisCalendarWindowV1 } from './calendar-window-v1.js';
import { presentJarvisRuntimeResponseV1 } from './presenter-v1.js';
import { renderJarvisPrivateChatV1 } from './ui-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
let localMemoryStore = null;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    }
  });
}

async function bodyJson(request) {
  if (request.method !== 'POST') return {};
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  try { return await request.json(); } catch { return {}; }
}

function staging(env = {}) {
  return clean(env.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase() === 'staging';
}

function memoryStore(env = {}, options = {}) {
  if (options.memory_store) return options.memory_store;
  const configured = createJarvisMemoryStoreFromEnvV1(env, options);
  if (configured) return configured;
  if (staging(env)) return null;
  if (!localMemoryStore) localMemoryStore = createMemoryJarvisStoreV1();
  return localMemoryStore;
}

function connectorList(options = {}) {
  return Array.isArray(options.connectors) ? options.connectors : [];
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

async function authSession(request, env, ctx, options) {
  const auth = await authorizeOperator(request, env, ctx, { authorize: options.authorize });
  if (!auth.ok) return { ok: false, auth };
  const session = await createJarvisSessionV1(auth, options);
  return session.ok ? { ok: true, auth, session } : { ok: false, auth: { status: 403, error: session.error } };
}

export async function handleJarvisHttpV1(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (!(url.pathname === '/jarvis' || url.pathname === '/jarvis/' || url.pathname.startsWith('/jarvis/api/'))) return null;

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
  const connectors = connectorList(options);

  if (url.pathname === '/jarvis' || url.pathname === '/jarvis/') {
    return html(renderJarvisPrivateChatV1());
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
    return json({
      ok: true,
      schema: 'aurentara.jarvis.private-status.v1',
      core_online: true,
      private_session: true,
      durable_memory_ready: Boolean(store?.durable),
      memory_store_kind: store?.kind || null,
      calendar_read_contract: true,
      calendar_read_bound: calendarReadBound(connectors),
      calendar_write_enabled: false,
      external_writes_enabled: false,
      finance_actions_enabled: false,
      production_deploy: false,
      billing_enabled: false,
      hamyren_data_flow: false
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
    auth: 'cloudflare_access_fail_closed',
    browser_secrets: false,
    durable_memory_required_in_staging: true,
    calendar_read_contract: true,
    calendar_write_enabled: false,
    external_writes_enabled: false,
    hamyren_data_flow: false,
    production_deploy: false
  };
}
