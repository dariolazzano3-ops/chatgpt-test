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
import { renderJarvisCommandCenterV1 } from './command-center-v1.js';
import { createJarvisAuditEventV1 } from './audit-v1.js';
import { createJarvisGoogleOAuthServiceV1, jarvisGoogleOAuthConfigFromEnvV1 } from './google-oauth-v1.js';
import {
  createJarvisCommandCenterTruthSnapshotV1,
  createJarvisCommandCenterLiveProbeBindingsV1
} from './command-center-runtime-truth-v1.js';
import { createJarvisCommandCenterReadBindingsV1 } from './command-center-read-bindings-v1.js';
import { jarvisCommandCenterWorkerChainV1 } from './command-center-worker-binding-v1.js';
import { evaluateJarvisApprovalDecisionV1 } from './command-center-approval-runtime-v1.js';
import { handleJarvisEngineeringMissionRuntimeV1 } from './engineering-mission-v1.js';
import { createJarvisGitRemoteTruthProbeFromEnvV1 } from './git-remote-truth-v1.js';
import { createJarvisSystemHealthProbesFromEnvV1 } from './system-health-probes-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

// The accepted Command Center injects its own <style> and pulls webfonts via
// an @import inside that style block. Allow only Google Fonts origins on top of
// the private baseline; everything else stays 'self'. No script origin is added
// (the bundle is delivered inline).
function commandCenterHtml(body, status = 200, extraHeaders = {}) {
  return html(body, status, {
    'content-security-policy':
      "default-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...extraHeaders
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
    return commandCenterHtml(renderJarvisCommandCenterV1({ base_path: options.ui_base_path === '' ? '' : '/jarvis' }));
  }

  if (url.pathname === '/jarvis/legacy' && request.method === 'GET') {
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
    // Injected probes (tests) take precedence; otherwise build genuine probes
    // from env. Every one fails closed to UNKNOWN when the source is absent.
    const injectedProbes = options.command_center_probes && typeof options.command_center_probes === 'object'
      ? options.command_center_probes
      : {};
    const envHealthProbes = createJarvisSystemHealthProbesFromEnvV1(env, {
      fetch_impl: options.fetch_impl,
      store,
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      clock: options.now ? () => options.now : undefined
    });
    const gitProbe = createJarvisGitRemoteTruthProbeFromEnvV1(env, {
      fetch_impl: options.fetch_impl,
      clock: options.now ? () => options.now : undefined
    });
    const probes = { ...envHealthProbes, ...(gitProbe ? { git: gitProbe } : {}), ...injectedProbes };

    // Wave 4/5: real Runs / Activity / Approvals / Evidence projected from the
    // owner-scoped persisted JARVIS audit log. Absent store.readAudit -> no
    // binding -> those domains fail closed to NOT_CONNECTED.
    const readBindings = createJarvisCommandCenterReadBindingsV1({
      store,
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      now: options.now
    });
    const bindings = {
      ...createJarvisCommandCenterLiveProbeBindingsV1(probes, { now: options.now }),
      ...readBindings
    };
    const snapshot = await createJarvisCommandCenterTruthSnapshotV1(bindings, { now: options.now });
    return json({
      ok: true,
      private: true,
      read_only: true,
      production_deploy: false,
      hamyren_data_flow: false,
      command_chain: jarvisCommandCenterWorkerChainV1({
        claude_bridge: options.claude_bridge || null,
        codex_bridge: options.codex_bridge || null,
        git_remote_truth_bound: Boolean(gitProbe && gitProbe.configured)
      }),
      ...snapshot
    });
  }

  if (url.pathname === '/jarvis/api/approvals/decide' && request.method === 'POST') {
    if (!store || typeof store.readAudit !== 'function') {
      return json({ ok: false, error: 'JARVIS_APPROVAL_RUNTIME_UNAVAILABLE', executed: false, external_effect: false }, 503);
    }
    const body = await bodyJson(request);
    const readBindings = createJarvisCommandCenterReadBindingsV1({
      store, owner_id: session.owner_id, owner_ref: session.owner_ref, now: options.now
    });
    let approvals = [];
    try {
      const env0 = typeof readBindings.approvals === 'function' ? await readBindings.approvals() : null;
      approvals = Array.isArray(env0?.data) ? env0.data : [];
    } catch {
      return json({ ok: false, error: 'JARVIS_APPROVAL_PROJECTION_UNAVAILABLE', executed: false, external_effect: false }, 503);
    }

    const evaluation = evaluateJarvisApprovalDecisionV1({
      approvals,
      approval_id: clean(body.approval_id, 240),
      run_id: clean(body.run_id, 200),
      decision: clean(body.decision, 20),
      correlation_id: clean(body.correlation_id, 80),
      owner_ref: session.owner_ref,
      now: options.now || new Date().toISOString()
    });
    if (!evaluation.ok) {
      return json({ ok: false, error: evaluation.error, executed: false, external_effect: false, ...evaluation }, evaluation.status || 409);
    }

    try {
      await store.appendAudit({ owner_id: session.owner_id, owner_ref: session.owner_ref, event: evaluation.audit_event });
    } catch {
      return json({ ok: false, error: 'JARVIS_APPROVAL_PERSIST_FAILED', executed: false, external_effect: false }, 503);
    }

    return json({
      ok: true,
      schema: 'aurentara.jarvis.approval-decision-response.v1',
      approval_id: evaluation.approval_id,
      run_id: evaluation.run_id,
      decision: evaluation.decision,
      gate_status: evaluation.gate_status,
      execution_authorized: false,
      external_effect: false,
      executed: false,
      action_gate_bypassed: false,
      production_deploy: false,
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

    // Wave 6: the Command Center supplies a correlation id so its optimistic run
    // and the persisted audit projection share one id. Only a well-formed UUID is
    // accepted; anything else is replaced with a server-generated id.
    const clientCorrelation = clean(body.correlation_id || body.request_id, 80);
    const correlationId = UUID_RE.test(clientCorrelation) ? clientCorrelation.toLowerCase() : crypto.randomUUID();

    const now = new Date().toISOString();
    const timezone = clean(env.JARVIS_TIMEZONE, 120) || 'Europe/Berlin';
    const window = inferJarvisCalendarWindowV1(message, { now, timezone });
    const connectors = await connectorsFor(session, oauth, options);

    const runtime = await handleJarvisRuntimeRequestV1({
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      request_id: correlationId,
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
      connectors,
      // Local/private-only, explicit opt-in (default undefined -> stays
      // NOT_BOUND). Never constructed here: http-v1.js has no Node-only
      // imports and never spawns a process itself. A caller that wants
      // genuine Claude Code execution must inject an already-built, already-
      // bound bridge via options.claude_bridge — see
      // claude-code-local-runtime-binding-v1.js (Node-only, never imported
      // by this file or any deployed-Worker entry point).
      claude_bridge: options.claude_bridge || null,
      claude_timeout_ms: options.claude_timeout_ms
    });

    const presentation = presentJarvisRuntimeResponseV1(runtime, { timezone });
    const gate = runtime.core?.action_gate || {};
    const approvalRequired = gate.approval_required === true;
    const blocked = gate.ok === false || runtime.core?.status === 'BLOCKED';
    const claudeExecution = runtime.claude_execution || null;
    const claudeCompleted = claudeExecution?.state === 'COMPLETE';
    const claudeFailedTerminal = claudeExecution && !claudeCompleted
      && ['FAILED', 'TIMEOUT', 'CANCELLED', 'BLOCKED', 'UNAVAILABLE'].includes(claudeExecution.state);
    return json({
      ok: runtime.ok,
      schema: 'aurentara.jarvis.private-chat-response.v1',
      request_id: correlationId,
      correlation_id: correlationId,
      answer: presentation.text,
      tone: presentation.tone,
      intent: runtime.core?.intent?.intent_type || runtime.core?.intent?.type || null,
      action: runtime.core?.intent?.action || null,
      gate_status: gate.status || (blocked ? 'BLOCKED' : null),
      approval_required: approvalRequired,
      blocked,
      run_state: blocked ? 'BLOCKED'
        : claudeCompleted ? 'COMPLETE'
        : claudeFailedTerminal ? 'FAILED'
        : approvalRequired ? 'WAITING_APPROVAL'
        : (runtime.connector_execution?.status === 'COMPLETED' ? 'COMPLETE' : 'RUNNING'),
      connector_status: runtime.connector_execution?.status || null,
      claude_execution: claudeExecution,
      memory_loaded: runtime.core?.memory_retrieval?.count || 0,
      audit_persisted: runtime.audit_persisted === true,
      external_effect: runtime.connector_execution?.external_effect === true || claudeExecution?.external_effect === true,
      independent_acceptance: claudeExecution?.independent_acceptance === true,
      production_deploy: false,
      hamyren_data_flow: false
    }, runtime.ok ? 200 : 409);
  }

  if (url.pathname === '/jarvis/api/engineering-mission' && request.method === 'POST') {
    // Dedicated, explicit dispatch path (Part 1 of the V1 usability-gap
    // mission). Never reuses the free-text intent resolver, never
    // READ_PERSONAL_CONTEXT — see engineering-mission-v1.js for why.
    if (!store) {
      return json({
        ok: false,
        error: 'JARVIS_DURABLE_MEMORY_NOT_READY',
        message: 'JARVIS Memory ist in dieser Staging-Runtime noch nicht gebunden.',
        production_deploy: false
      }, 503);
    }

    const body = await bodyJson(request);
    const clientCorrelation = clean(body.correlation_id || body.request_id, 80);
    const correlationId = UUID_RE.test(clientCorrelation) ? clientCorrelation.toLowerCase() : crypto.randomUUID();
    const now = new Date().toISOString();

    const mission = await handleJarvisEngineeringMissionRuntimeV1({
      owner_id: session.owner_id,
      owner_ref: session.owner_ref,
      request_id: correlationId,
      correlation_id: correlationId,
      title: body.title,
      goal: body.goal,
      program: body.program,
      wave_index: body.wave_index,
      now
    }, {
      memory_store: store,
      claude_bridge: options.claude_bridge || null,
      claude_timeout_ms: options.claude_timeout_ms
    });

    if (!mission.audit_persisted) {
      // Nothing was persisted: a malformed mission (bad title/goal/program/
      // correlation_id) or an owner/store precondition failure.
      return json({ ok: false, error: mission.error || 'JARVIS_ENGINEERING_MISSION_REJECTED', executed: false, external_effect: false }, 400);
    }

    const gate = mission.action_gate || {};
    const approvalRequired = gate.approval_required === true;
    // gate.ok is only false for a hard policy block (unknown / financial /
    // critical action); an approved-but-unbound bridge is a distinct,
    // fail-closed outcome carried honestly in wave_state instead.
    const blocked = gate.ok === false || mission.wave_state === 'BLOCKED';
    const claudeExecution = mission.claude_execution || null;
    const claudeCompleted = claudeExecution?.state === 'COMPLETE';
    const claudeFailedTerminal = claudeExecution && !claudeCompleted
      && ['FAILED', 'TIMEOUT', 'CANCELLED', 'BLOCKED', 'UNAVAILABLE'].includes(claudeExecution.state);

    return json({
      ok: mission.ok,
      schema: 'aurentara.jarvis.engineering-mission-response.v1',
      request_id: correlationId,
      correlation_id: correlationId,
      title: mission.intent?.title || null,
      goal: mission.intent?.goal || null,
      program: mission.intent?.program || null,
      wave_index: mission.intent?.wave_index ?? null,
      wave_state: mission.wave_state || null,
      intent: mission.intent?.intent_type || null,
      action: mission.intent?.action || null,
      gate_status: gate.status || (blocked ? 'BLOCKED' : null),
      approval_required: approvalRequired,
      blocked,
      run_state: blocked ? 'BLOCKED'
        : claudeCompleted ? 'COMPLETE'
        : claudeFailedTerminal ? 'FAILED'
        : mission.wave_state === 'RUNNING' ? 'RUNNING'
        : approvalRequired ? 'WAITING_APPROVAL'
        : 'RUNNING',
      claude_bridge_bound: mission.claude_bridge_bound === true,
      claude_execution: claudeExecution,
      audit_persisted: mission.audit_persisted === true,
      external_effect: claudeExecution?.external_effect === true,
      independent_acceptance: false,
      action_gate_bypassed: false,
      production_deploy: false,
      hamyren_data_flow: false
    }, mission.ok ? 200 : 409);
  }

  return json({ ok: false, error: 'JARVIS_ROUTE_NOT_FOUND', production_deploy: false }, 404);
}

export function jarvisHttpManifestV1() {
  return {
    schema: 'aurentara.jarvis.private-http.v1',
    route: '/jarvis',
    auth: 'dedicated_cloudflare_access_fail_closed',
    command_center_route: '/jarvis',
    command_center_visual_baseline: 'ACCEPTED',
    command_center_legacy_blue_route: '/jarvis/legacy',
    command_center_runtime_truth_route: '/jarvis/api/runtime-truth',
    command_center_runtime_truth_fail_closed: true,
    command_center_command_route: '/jarvis/api/chat',
    command_center_command_correlation_id: true,
    command_center_command_approval_gated: true,
    command_center_command_external_writes: false,
    command_center_command_claude_routing_action: 'FILE_WRITE',
    command_center_command_claude_routing_requires_injected_bound_bridge: true,
    command_center_command_claude_routing_default_bound: false,
    command_center_command_claude_routing_requires_prior_persisted_approval: true,
    command_center_approval_decide_route: '/jarvis/api/approvals/decide',
    command_center_approval_decide_records_audit: true,
    command_center_approval_decide_bypasses_gate: false,
    command_center_approval_decide_external_effect: false,
    command_center_engineering_mission_route: '/jarvis/api/engineering-mission',
    command_center_engineering_mission_intent: 'IMPLEMENTATION_MISSION_REQUEST',
    command_center_engineering_mission_action: 'IMPLEMENTATION_MISSION',
    command_center_engineering_mission_bypasses_keyword_intent_resolver: true,
    command_center_engineering_mission_reuses_read_personal_context: false,
    command_center_engineering_mission_approval_gated: true,
    command_center_engineering_mission_external_writes: false,
    command_center_engineering_mission_claude_routing_requires_injected_bound_bridge: true,
    command_center_engineering_mission_claude_routing_default_bound: false,
    command_center_engineering_mission_requires_prior_persisted_approval: true,
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
