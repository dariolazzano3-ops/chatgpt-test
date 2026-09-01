import { createCustomerAiFoundation } from '../customer-ai/foundation-v1.js';
import { createTrustedBusinessAiRuntime } from '../customer-ai/trusted-runtime-v1.js';
import { renderCustomerProductShell } from './shell-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const now = () => new Date().toISOString();
const SESSION_COOKIE = 'aurentara_guest_session';
const SESSION_TTL_SECONDS = 60 * 60 * 2;
const MAX_SYNTHETIC_SESSIONS = 200;

function randomId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id.replaceAll('-', '').slice(0, 24)}`;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...headers
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
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"
    }
  });
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

async function readJson(request, maxChars = 24_000) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) return { ok: false, error: 'CUSTOMER_JSON_REQUIRED' };
  const raw = await request.text();
  if (raw.length > maxChars) return { ok: false, error: 'CUSTOMER_REQUEST_TOO_LARGE' };
  try { return { ok: true, value: raw ? JSON.parse(raw) : {} }; } catch { return { ok: false, error: 'CUSTOMER_JSON_INVALID' }; }
}

function sameOriginMutation(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function modeActive(env = {}, options = {}) {
  return options.force_synthetic === true || clean(env.AURENTARA_CUSTOMER_SURFACE_MODE, 40).toLowerCase() === 'synthetic-staging';
}

function safeSession(session = {}) {
  return {
    session_id: session.session_id,
    kind: session.kind,
    tenant_id: session.tenant_id,
    business_id: session.business_id,
    conversation_id: session.conversation_id,
    business_name: session.business_name,
    synthetic: session.synthetic === true,
    expires_at: session.expires_at,
    customer_surface: true,
    operator_access: false
  };
}

function boundedCorrectionValue(value) {
  if (typeof value === 'string') return value.slice(0, 6000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 6000) return undefined;
    return JSON.parse(serialized);
  } catch {
    return undefined;
  }
}

export function customerProductSurfaceManifest() {
  return {
    version: 'aurentara.personal-business-ai.customer-product-surface.v1',
    brand: 'AURENTARA SYSTEMS',
    base_path: '/customer',
    api_path: '/customer/api',
    operator_route_exposed: false,
    operator_modules_imported: false,
    customer_operator_plane_separation: true,
    guest_session: { implemented: true, synthetic_only: true, durable: false, ttl_seconds: SESSION_TTL_SECONDS },
    account_auth: { production_active: false, provider_active: false },
    business_ai_chat: true,
    conversation_history: true,
    memory_transparency: true,
    memory_correction: true,
    goals_read: true,
    decisions_read: true,
    usage_view: true,
    billing_active: false,
    live_research_adapter_active: false,
    customer_supplied_research_accepted: false,
    production_active: false,
    variable_cost_ceiling_eur: 0
  };
}

export function createCustomerProductSurface(options = {}) {
  const foundation = options.foundation || createCustomerAiFoundation({ store: options.foundation_store });
  const runtime = options.runtime || createTrustedBusinessAiRuntime({
    foundation,
    store: options.chat_store,
    providers: Array.isArray(options.providers) ? options.providers : []
  });
  const sessions = options.sessions || new Map();

  function pruneSessions() {
    const timestamp = Date.now();
    for (const [token, session] of sessions) if (Date.parse(session.expires_at) <= timestamp) sessions.delete(token);
    if (sessions.size <= MAX_SYNTHETIC_SESSIONS) return;
    const oldest = [...sessions.entries()].sort((a, b) => Date.parse(a[1].created_at) - Date.parse(b[1].created_at));
    for (const [token] of oldest.slice(0, sessions.size - MAX_SYNTHETIC_SESSIONS)) sessions.delete(token);
  }

  function resolveSession(request) {
    pruneSessions();
    const cookies = parseCookies(request.headers.get('cookie') || '');
    const token = clean(cookies[SESSION_COOKIE], 180);
    const session = token ? sessions.get(token) : null;
    if (!session || Date.parse(session.expires_at) <= Date.now()) return null;
    session.last_seen_at = now();
    return session;
  }

  async function createGuestSession() {
    pruneSessions();
    const token = randomId('gst');
    const sessionId = randomId('session');
    const tenantId = randomId('guest-tenant');
    const userId = randomId('guest-user');
    const businessId = randomId('guest-business');
    const conversationId = randomId('conversation');
    const tenantCreated = await foundation.createTenant({ tenant_id: tenantId, owner_user_id: userId, name: 'AURENTARA Guest Workspace' });
    if (!tenantCreated.ok) return tenantCreated;
    const ctx = { tenant_id: tenantId, user_id: userId };
    const businessCreated = await foundation.createBusiness(ctx, {
      business_id: businessId,
      name: 'My Synthetic Business',
      industry: 'demo',
      business_type: 'synthetic_guest',
      country: 'DE', language: 'de', currency: 'EUR', business_stage: 'exploration',
      profile: { synthetic: true, source: 'customer_surface_guest_v1' }
    });
    if (!businessCreated.ok) return businessCreated;
    const memoryCreated = await foundation.addConfirmedMemory(ctx, businessId, {
      fact_key: 'surface_mode', subject: 'Workspace mode', value: 'Synthetic Guest Demo', category: 'SYSTEM',
      source_type: 'structured_business_input', confirmed_by_user: true, confidence: 1
    });
    if (!memoryCreated.ok) return memoryCreated;
    const conversationCreated = await runtime.createConversation(ctx, businessId, {
      conversation_id: conversationId,
      title: 'Personal Business AI',
      data_sensitivity: 'synthetic'
    });
    if (!conversationCreated.ok) return conversationCreated;
    const createdAt = now();
    const session = {
      session_id: sessionId,
      token,
      kind: 'guest',
      tenant_id: tenantId,
      user_id: userId,
      business_id: businessId,
      business_name: businessCreated.business.name,
      conversation_id: conversationId,
      synthetic: true,
      created_at: createdAt,
      last_seen_at: createdAt,
      expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
    };
    sessions.set(token, session);
    return { ok: true, token, session };
  }

  function ctxFor(session) {
    return { tenant_id: session.tenant_id, user_id: session.user_id };
  }

  async function requireSession(request) {
    const session = resolveSession(request);
    return session ? { ok: true, session } : { ok: false, response: json({ ok: false, error: 'CUSTOMER_SESSION_REQUIRED' }, 401) };
  }

  async function handle(request, env = {}, _ctx = null) {
    const url = new URL(request.url);
    if (!(url.pathname === '/customer' || url.pathname === '/customer/' || url.pathname.startsWith('/customer/api/'))) return null;
    if (!modeActive(env, options)) {
      return json({ ok: false, error: 'CUSTOMER_SURFACE_NOT_ACTIVATED', production_active: false }, 404);
    }
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !sameOriginMutation(request)) {
      return json({ ok: false, error: 'CUSTOMER_ORIGIN_MISMATCH' }, 403);
    }

    if ((url.pathname === '/customer' || url.pathname === '/customer/') && method === 'GET') {
      return html(renderCustomerProductShell({ brand: 'AURENTARA SYSTEMS' }));
    }
    if (url.pathname === '/customer/api/manifest' && method === 'GET') return json({ ok: true, manifest: customerProductSurfaceManifest() });
    if (url.pathname === '/customer/api/account' && ['GET', 'POST'].includes(method)) {
      return json({ ok: false, error: 'CUSTOMER_ACCOUNT_AUTH_NOT_ACTIVATED', operator_access: false, production_active: false }, 501);
    }
    if (url.pathname === '/customer/api/guest-session' && method === 'POST') {
      const input = await readJson(request, 2000);
      if (!input.ok) return json({ ok: false, error: input.error }, 400);
      const created = await createGuestSession();
      if (!created.ok) return json(created, 500);
      return json({ ok: true, session: safeSession(created.session) }, 201, {
        'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(created.token)}; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=${SESSION_TTL_SECONDS}`
      });
    }

    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const customerCtx = ctxFor(session);

    if (url.pathname === '/customer/api/session' && method === 'GET') return json({ ok: true, session: safeSession(session) });
    if (url.pathname === '/customer/api/history' && method === 'GET') {
      const result = await runtime.getMessages(customerCtx, session.business_id, session.conversation_id, { limit: 100 });
      return json(result, result.ok ? 200 : 403);
    }
    if (url.pathname === '/customer/api/chat' && method === 'POST') {
      const parsed = await readJson(request);
      if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
      const input = parsed.value || {};
      if ('research_sources' in input || 'trusted_research' in input) {
        return json({ ok: false, error: 'CUSTOMER_SUPPLIED_RESEARCH_NOT_TRUSTED', trusted_research_required: false }, 400);
      }
      const message = clean(input.message, 12_000);
      if (!message) return json({ ok: false, error: 'CUSTOMER_MESSAGE_REQUIRED' }, 400);
      const result = await runtime.submitTrustedTurn(customerCtx, session.business_id, session.conversation_id, { message });
      if (!result.ok) {
        const trustedResearchRequired = Boolean(result.risk_classification?.trusted_research_required || result.trusted_research?.risk?.trusted_research_required);
        const status = trustedResearchRequired ? 409 : result.error === 'CHAT_AI_PROVIDER_NOT_CONFIGURED' ? 503 : 400;
        return json({ ...result, trusted_research_required: trustedResearchRequired, operator_access: false }, status);
      }
      return json({
        ok: true,
        answer: result.answer,
        intent: result.intent,
        risk_classification: result.risk_classification,
        trusted_research: result.trusted_research,
        memory_candidate_ids: result.memory_candidate_ids || [],
        action_executed: false,
        operator_access: false,
        production: false
      });
    }
    if (url.pathname === '/customer/api/memory' && method === 'GET') {
      const result = await foundation.searchMemory(customerCtx, session.business_id, { query: '', include_historical: url.searchParams.get('history') === '1' });
      return json(result, result.ok ? 200 : 403);
    }
    if (url.pathname === '/customer/api/memory/correct' && method === 'POST') {
      const parsed = await readJson(request, 10_000);
      if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
      if (parsed.value?.user_confirmed !== true) return json({ ok: false, error: 'MEMORY_CORRECTION_REQUIRES_USER_CONFIRMATION' }, 400);
      const memoryId = clean(parsed.value.memory_id, 180);
      const value = boundedCorrectionValue(parsed.value.value);
      if (!memoryId || value === undefined) return json({ ok: false, error: 'MEMORY_CORRECTION_INVALID' }, 400);
      const result = await foundation.correctMemory(customerCtx, session.business_id, memoryId, {
        value,
        subject: clean(parsed.value.subject, 240) || undefined,
        source_type: 'user_statement',
        source_reference: `customer_surface:${session.session_id}`,
        confirmed_by_user: true
      });
      return json(result, result.ok ? 200 : 400);
    }
    if (url.pathname === '/customer/api/goals' && method === 'GET') {
      const result = await foundation.getGoals(customerCtx, session.business_id);
      return json(result, result.ok ? 200 : 403);
    }
    if (url.pathname === '/customer/api/decisions' && method === 'GET') {
      const result = await foundation.getDecisions(customerCtx, session.business_id);
      return json(result, result.ok ? 200 : 403);
    }
    if (url.pathname === '/customer/api/usage' && method === 'GET') {
      const conversation = await runtime.getConversation(customerCtx, session.business_id, session.conversation_id);
      if (!conversation.ok) return json(conversation, 403);
      const attribution = Object.values(conversation.conversation.cost_state?.attribution || {});
      const variableCost = attribution.reduce((sum, item) => sum + Math.max(0, Number(item.actual_cost_units || 0)), 0);
      return json({
        ok: true,
        plan: {
          id: 'guest-starter-v1',
          label: 'Free · Synthetic Starter Experience',
          description: 'V1 preview entitlement. Billing and paid compute are not active.',
          upgrade_available: false,
          production_billing_active: false
        },
        usage: {
          ai_turns: Number(conversation.conversation.turn_count || 0),
          messages: Number(conversation.conversation.message_count || 0),
          variable_cost_eur: variableCost,
          compute_budget_enforced: true,
          variable_cost_ceiling_eur: 0
        },
        operator_access: false
      });
    }
    return json({ ok: false, error: 'CUSTOMER_ROUTE_NOT_FOUND', operator_access: false }, 404);
  }

  return {
    manifest: customerProductSurfaceManifest,
    handle,
    session_count: () => sessions.size,
    _unsafe_test_sessions: options.expose_test_state === true ? sessions : undefined
  };
}

let defaultSurface = null;
export async function handleCustomerProductSurface(request, env, ctx) {
  if (!defaultSurface) defaultSurface = createCustomerProductSurface();
  return defaultSurface.handle(request, env, ctx);
}
