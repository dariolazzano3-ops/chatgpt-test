import { renderCustomerProductShell } from './shell-v1.js';
import { createPrivateCustomerAiAcceptanceRuntime } from './private-customer-ai-acceptance-v2.js';

const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);
const ACCESS_COOKIE = 'aurentara_customer_access';
const REFRESH_COOKIE = 'aurentara_customer_refresh';
const SCHEMA = 'aurentara_customer_ai';

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
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"
    }
  });
}

function cookies(request) {
  const pairs = String(request.headers.get('cookie') || '').split(';').map((part) => part.trim()).filter(Boolean);
  return Object.fromEntries(pairs.map((pair) => {
    const index = pair.indexOf('=');
    return index < 0 ? [pair, ''] : [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
  }));
}

function sameOriginMutation(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

async function readJson(request, maxChars = 16000) {
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return { ok: false };
  const raw = await request.text();
  if (raw.length > maxChars) return { ok: false };
  try { return { ok: true, value: raw ? JSON.parse(raw) : {} }; } catch { return { ok: false }; }
}

function customerPublishableKey(env = {}) {
  return clean(env.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY || env.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE, 1000);
}

function configFrom(env = {}) {
  const url = clean(env.AURENTARA_CUSTOMER_SUPABASE_URL, 1000);
  const projectRef = clean(env.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, 100);
  const operatorRef = clean(env.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF, 100);
  const publishableKey = customerPublishableKey(env);
  let urlRef = null;
  try { urlRef = new URL(url).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i)?.[1]?.toLowerCase() || null; } catch {}
  const ok = Boolean(url && projectRef && publishableKey && urlRef === projectRef && projectRef !== operatorRef);
  return { ok, url, project_ref: projectRef, operator_ref: operatorRef, publishable_key: publishableKey };
}

function runtimeEnv(env = {}) {
  return { ...env, AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY: customerPublishableKey(env) };
}

function authHeaders(config, accessToken = null) {
  return {
    'content-type': 'application/json',
    'apikey': config.publishable_key,
    ...(accessToken ? { 'authorization': `Bearer ${accessToken}` } : {})
  };
}

function setSessionCookies(auth = {}) {
  const access = clean(auth.access_token, 12000);
  const refresh = clean(auth.refresh_token, 12000);
  if (!access || !refresh) return [];
  const max = Math.max(60, Math.min(Number(auth.expires_in || 3600), 86400));
  return [
    `${ACCESS_COOKIE}=${encodeURIComponent(access)}; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=${max}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(refresh)}; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=2592000`
  ];
}

function clearSessionCookies() {
  return [
    `${ACCESS_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=0`,
    `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=0`
  ];
}

function withCookies(response, values = []) {
  const headers = new Headers(response.headers);
  for (const value of values) headers.append('set-cookie', value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function supabaseJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  let body = {};
  try { body = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, body };
}

async function getUser(config, accessToken, fetchImpl) {
  if (!accessToken) return { ok: false, status: 401 };
  const result = await supabaseJson(fetchImpl, `${config.url}/auth/v1/user`, { method: 'GET', headers: authHeaders(config, accessToken) });
  return result.ok ? { ok: true, user: result.body } : { ok: false, status: 401 };
}

async function customSchemaRequest(config, accessToken, fetchImpl, path, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const profile = ['POST','PATCH','PUT','DELETE'].includes(method) ? 'Content-Profile' : 'Accept-Profile';
  return supabaseJson(fetchImpl, `${config.url}/rest/v1/${path}`, {
    ...init,
    method,
    headers: {
      ...authHeaders(config, accessToken),
      [profile]: SCHEMA,
      ...(init.headers || {})
    }
  });
}

function safeUser(user = {}) {
  return {
    id: clean(user.id, 120),
    email: clean(user.email, 320) || null,
    created_at: user.created_at || null,
    last_sign_in_at: user.last_sign_in_at || null
  };
}

function bool(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function surfaceMode(env = {}) {
  return clean(env.AURENTARA_CUSTOMER_SURFACE_MODE, 40).toLowerCase();
}

function privateAcceptanceEnvironment(env = {}) {
  return surfaceMode(env) === 'private-acceptance'
    && clean(env.RIOSYSTEMS_ENVIRONMENT, 40).toLowerCase() === 'staging'
    && clean(env.RIOSYSTEMS_PRODUCTION_DEPLOY, 20).toLowerCase() === 'false'
    && clean(env.RIOSYSTEMS_EXTERNAL_WRITES, 20).toLowerCase() === 'false'
    && bool(env.AURENTARA_CUSTOMER_PRIVATE_ACCEPTANCE_APPROVED)
    && !bool(env.AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED);
}

function accessVerified(request) {
  return Boolean(clean(request.headers.get('cf-access-jwt-assertion'), 12000));
}

function privateAcceptanceAuthorized(request, env = {}) {
  return privateAcceptanceEnvironment(env) && accessVerified(request);
}

function signupAllowed(request, env = {}) {
  const mode = surfaceMode(env);
  if (!mode) return true;
  return privateAcceptanceAuthorized(request, env);
}

function publicAiFailClosed() {
  return json({
    ok: false,
    error: 'REAL_CUSTOMER_AI_PROCESSING_NOT_APPROVED',
    message: 'Die reale AI-Verarbeitung ist außerhalb des privaten Acceptance-Modus nicht freigegeben.',
    operator_gate_required: true,
    customer_data_sent_to_ai_provider: false
  }, 503);
}

function accountShell() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAMYREN · Private Customer Acceptance</title><style>:root{font-family:Inter,system-ui,sans-serif;background:#f5f4f0;color:#181818}*{box-sizing:border-box}body{margin:0}.wrap{max-width:760px;margin:7vh auto;padding:20px}.card{background:#fff;border:1px solid #dedbd4;border-radius:20px;padding:26px}.brand{font-weight:850;letter-spacing:.09em}.maker,.muted{color:#706d67}.maker{font-size:11px}.muted{font-size:14px}input,button{font:inherit;width:100%;padding:12px;border-radius:11px;border:1px solid #d5d1c8;margin:6px 0}button{background:#181818;color:#fff;cursor:pointer}.secondary{background:#fff;color:#181818}.status{white-space:pre-wrap;font-size:13px;margin-top:12px}.hidden{display:none}@media(max-width:600px){.wrap{margin:0;padding:14px}.card{border-radius:14px;padding:20px}}</style></head><body><main class="wrap"><section class="card"><div class="brand">HAMYREN</div><div>Your Personal Business AI</div><div class="maker">by AURENTARA SYSTEMS</div><h1>Dein privater Business Workspace</h1><p class="muted">Melde dich mit deinem privaten HAMYREN Testaccount an. Dieser Prelaunch ist nicht öffentlich und nimmt keine Zahlungen an.</p><input id="email" type="email" autocomplete="email" placeholder="E-Mail"><input id="password" type="password" autocomplete="current-password" placeholder="Passwort"><button id="signin">Anmelden</button><button class="secondary" id="signup">Privaten Testaccount einmalig erstellen</button><input id="business" placeholder="Unternehmensname" value="Dario Acceptance Business"><button class="secondary" id="bootstrap">Workspace initialisieren</button><button id="open" class="hidden">HAMYREN öffnen</button><button class="secondary" id="signout">Abmelden</button><div class="status" id="status"></div></section></main><script>const s=document.getElementById('status'),open=document.getElementById('open');async function call(path,body,method='POST'){const r=await fetch('/customer/api/'+path,{method,headers:{'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});let j={};try{j=await r.json()}catch{}s.textContent=j.message||j.error||(j.ok?'Erfolgreich.':'Aktion nicht verfügbar.');if(j.ok&&['account/signin','account/bootstrap'].includes(path))open.classList.remove('hidden');return j}const creds=()=>({email:email.value,password:password.value});signin.onclick=()=>call('account/signin',creds());signup.onclick=()=>call('account/signup',creds());bootstrap.onclick=()=>call('account/bootstrap',{business_name:business.value});signout.onclick=()=>call('account/signout',{});open.onclick=()=>location.href='/customer?app=1';call('account',null,'GET').then(j=>{if(j.ok)open.classList.remove('hidden')});</script></body></html>`;
}

export function productionAccountSurfaceManifest() {
  return {
    version: 'aurentara.customer.production-account-surface.v1',
    visible_product_name: 'HAMYREN',
    visible_product_tagline: 'Your Personal Business AI',
    visible_maker: 'AURENTARA SYSTEMS',
    supabase_auth: true,
    http_only_session_cookies: true,
    service_role_in_browser: false,
    workspace_bootstrap_rpc: 'aurentara_customer_ai.bootstrap_personal_workspace',
    custom_schema_rls: true,
    public_signup_active: false,
    public_surface_active: false,
    real_customer_ai_processing_active: false,
    private_acceptance_supported: true,
    private_acceptance_real_ai_enabled: true,
    billing_active: false,
    production_deploy: false
  };
}

export function createProductionCustomerAccountSurface(options = {}) {
  const fetchImpl = options.fetch_impl || fetch;
  const aiRuntime = createPrivateCustomerAiAcceptanceRuntime({ fetch_impl: fetchImpl });
  return {
    manifest: productionAccountSurfaceManifest,
    async handle(request, env = {}) {
      const url = new URL(request.url);
      if (!(url.pathname === '/customer' || url.pathname === '/customer/' || url.pathname.startsWith('/customer/api/'))) return null;
      const cfg = configFrom(env);
      if (!cfg.ok) return json({ ok: false, message: 'HAMYREN ist für diesen privaten Test noch nicht vollständig verbunden.' }, 503);
      const method = request.method.toUpperCase();
      if (['POST','PUT','PATCH','DELETE'].includes(method) && !sameOriginMutation(request)) {
        return json({ ok: false, message: 'Diese Anfrage konnte aus Sicherheitsgründen nicht ausgeführt werden.' }, 403);
      }
      if ((url.pathname === '/customer' || url.pathname === '/customer/') && method === 'GET' && !url.searchParams.has('app')) return html(accountShell());
      if (url.pathname === '/customer/api/manifest' && method === 'GET') {
        return json({ ok: true, manifest: productionAccountSurfaceManifest(), private_acceptance_ai: aiRuntime.manifest() });
      }

      if (url.pathname === '/customer/api/account/signup' && method === 'POST') {
        if (!signupAllowed(request, env)) return json({ ok: false, message: 'Die öffentliche Registrierung ist im Prelaunch geschlossen.' }, 403);
        const parsed = await readJson(request, 5000);
        const email = clean(parsed?.value?.email, 320).toLowerCase();
        const password = clean(parsed?.value?.password, 300);
        if (!parsed?.ok || !email || password.length < 8) return json({ ok: false, message: 'Bitte gib eine gültige E-Mail und ein Passwort mit mindestens 8 Zeichen ein.' }, 400);
        const result = await supabaseJson(fetchImpl, `${cfg.url}/auth/v1/signup`, {
          method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ email, password, data: { hamyren_private_acceptance: privateAcceptanceEnvironment(env) } })
        });
        if (!result.ok) return json({ ok: false, message: 'Der private Testaccount konnte nicht angelegt werden. Bitte prüfe die Eingaben.' }, 400);
        return withCookies(json({
          ok: true,
          message: result.body.access_token ? 'Privater Testaccount erstellt und angemeldet.' : 'Testaccount erstellt. Bitte bestätige gegebenenfalls die E-Mail und melde dich danach an.',
          user: safeUser(result.body.user || {}),
          session_created: Boolean(result.body.access_token)
        }, 201), setSessionCookies(result.body));
      }

      if (url.pathname === '/customer/api/account/signin' && method === 'POST') {
        const parsed = await readJson(request, 5000);
        const email = clean(parsed?.value?.email, 320).toLowerCase();
        const password = clean(parsed?.value?.password, 300);
        if (!parsed?.ok || !email || !password) return json({ ok: false, message: 'Bitte gib E-Mail und Passwort ein.' }, 400);
        const result = await supabaseJson(fetchImpl, `${cfg.url}/auth/v1/token?grant_type=password`, {
          method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ email, password })
        });
        if (!result.ok || !result.body.access_token) return json({ ok: false, message: 'Anmeldung nicht erfolgreich. Bitte prüfe deine Zugangsdaten.' }, 401);
        return withCookies(json({ ok: true, message: 'Angemeldet.', user: safeUser(result.body.user || {}), session_created: true }), setSessionCookies(result.body));
      }

      if (url.pathname === '/customer/api/account/refresh' && method === 'POST') {
        const refresh = clean(cookies(request)[REFRESH_COOKIE], 12000);
        if (!refresh) return json({ ok: false, message: 'Bitte melde dich erneut an.' }, 401);
        const result = await supabaseJson(fetchImpl, `${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST', headers: authHeaders(cfg), body: JSON.stringify({ refresh_token: refresh })
        });
        if (!result.ok || !result.body.access_token) return json({ ok: false, message: 'Bitte melde dich erneut an.' }, 401);
        return withCookies(json({ ok: true, refreshed: true }), setSessionCookies(result.body));
      }

      const accessToken = clean(cookies(request)[ACCESS_COOKIE], 12000);
      if (url.pathname === '/customer/api/account/signout' && method === 'POST') {
        if (accessToken) await supabaseJson(fetchImpl, `${cfg.url}/auth/v1/logout`, { method: 'POST', headers: authHeaders(cfg, accessToken) });
        return withCookies(json({ ok: true, message: 'Abgemeldet.' }), clearSessionCookies());
      }

      const user = await getUser(cfg, accessToken, fetchImpl);
      if (!user.ok) return json({ ok: false, message: 'Bitte melde dich mit deinem HAMYREN Account an.' }, 401);
      if ((url.pathname === '/customer' || url.pathname === '/customer/') && method === 'GET' && url.searchParams.has('app')) {
        return html(renderCustomerProductShell({ product_name: 'HAMYREN', tagline: 'Your Personal Business AI', maker: 'AURENTARA SYSTEMS', private_acceptance: true }));
      }
      if (url.pathname === '/customer/api/account' && method === 'GET') return json({ ok: true, user: safeUser(user.user), private_acceptance: privateAcceptanceEnvironment(env) });

      if (url.pathname === '/customer/api/account/bootstrap' && method === 'POST') {
        const parsed = await readJson(request, 3000);
        const businessName = clean(parsed?.value?.business_name || 'My Business', 240);
        const result = await customSchemaRequest(cfg, accessToken, fetchImpl, 'rpc/bootstrap_personal_workspace', {
          method: 'POST', body: JSON.stringify({ p_business_name: businessName })
        });
        if (!result.ok) return json({ ok: false, message: 'Dein Workspace konnte gerade nicht initialisiert werden.' }, result.status >= 500 ? 502 : 403);
        return json({ ok: true, message: 'Workspace bereit.', workspace: result.body });
      }

      if (url.pathname === '/customer/api/account/workspace' && method === 'GET') {
        const memberships = await customSchemaRequest(cfg, accessToken, fetchImpl, `memberships?select=tenant_id,role,status&user_id=eq.${encodeURIComponent(user.user.id)}&status=eq.active&limit=1`, { method: 'GET' });
        const membership = memberships.ok && Array.isArray(memberships.body) ? memberships.body[0] : null;
        if (!membership) return json({ ok: true, workspace: null, bootstrap_required: true });
        const businesses = await customSchemaRequest(cfg, accessToken, fetchImpl, `businesses?select=*&tenant_id=eq.${encodeURIComponent(membership.tenant_id)}&deleted_at=is.null`, { method: 'GET' });
        return json({ ok: true, workspace: { tenant_id: membership.tenant_id, role: membership.role, businesses: businesses.ok && Array.isArray(businesses.body) ? businesses.body : [] } });
      }

      if (url.pathname === '/customer/api/chat' && !privateAcceptanceAuthorized(request, env)) return publicAiFailClosed();
      if (privateAcceptanceAuthorized(request, env)) {
        const aiResponse = await aiRuntime.handle(request, { env: runtimeEnv(env), access_token: accessToken, user: user.user });
        if (aiResponse) return aiResponse;
      }
      return json({ ok: false, message: 'Diese HAMYREN Funktion ist im privaten Prelaunch noch nicht verfügbar.' }, 404);
    }
  };
}