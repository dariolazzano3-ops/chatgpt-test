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
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return { ok: false, error: 'CUSTOMER_JSON_REQUIRED' };
  const raw = await request.text();
  if (raw.length > maxChars) return { ok: false, error: 'CUSTOMER_REQUEST_TOO_LARGE' };
  try { return { ok: true, value: raw ? JSON.parse(raw) : {} }; } catch { return { ok: false, error: 'CUSTOMER_JSON_INVALID' }; }
}

function configFrom(env = {}) {
  const url = clean(env.AURENTARA_CUSTOMER_SUPABASE_URL, 1000);
  const projectRef = clean(env.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, 100);
  const operatorRef = clean(env.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF, 100);
  const publishableKey = clean(env.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY, 1000);
  let urlRef = null;
  try { urlRef = new URL(url).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i)?.[1]?.toLowerCase() || null; } catch {}
  const ok = Boolean(url && projectRef && publishableKey && urlRef === projectRef && projectRef !== operatorRef);
  return { ok, url, project_ref: projectRef, operator_ref: operatorRef, publishable_key: publishableKey, error: ok ? null : 'CUSTOMER_PRODUCTION_AUTH_CONFIG_INCOMPLETE' };
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
  const accessMax = Math.max(60, Math.min(Number(auth.expires_in || 3600), 86400));
  return [
    `${ACCESS_COOKIE}=${encodeURIComponent(access)}; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=${accessMax}`,
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
  if (!accessToken) return { ok: false, status: 401, error: 'CUSTOMER_ACCOUNT_SESSION_REQUIRED' };
  const result = await supabaseJson(fetchImpl, `${config.url}/auth/v1/user`, { method: 'GET', headers: authHeaders(config, accessToken) });
  if (!result.ok) return { ok: false, status: 401, error: 'CUSTOMER_ACCOUNT_SESSION_INVALID' };
  return { ok: true, user: result.body };
}

async function customSchemaRequest(config, accessToken, fetchImpl, path, init = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const profileHeader = ['POST','PATCH','PUT','DELETE'].includes(method) ? 'Content-Profile' : 'Accept-Profile';
  return supabaseJson(fetchImpl, `${config.url}/rest/v1/${path}`, {
    ...init,
    method,
    headers: {
      ...authHeaders(config, accessToken),
      [profileHeader]: SCHEMA,
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

function accountShell() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAMYREN · Your Personal Business AI</title><style>body{font-family:system-ui,sans-serif;background:#f6f5f1;color:#191919;margin:0}.wrap{max-width:720px;margin:8vh auto;padding:24px}.card{background:#fff;border:1px solid #ddd9d0;border-radius:18px;padding:24px}.brand{font-weight:850;letter-spacing:.08em}.maker{font-size:12px;color:#7b7770;margin-top:4px}h1{letter-spacing:-.04em}input,button{font:inherit;padding:11px;border-radius:10px;border:1px solid #d3d0c8;margin:5px 0;width:100%}button{background:#171717;color:#fff;cursor:pointer}.muted{color:#6e6a64;font-size:14px}.status{white-space:pre-wrap;margin-top:14px}.privacy{margin-top:18px;border-top:1px solid #e2ded6;padding-top:14px;font-size:12px;color:#6e6a64}</style></head><body><main class="wrap"><div class="card"><div class="brand">HAMYREN</div><div>Your Personal Business AI</div><div class="maker">by AURENTARA SYSTEMS</div><h1>Dein Business Workspace</h1><p class="muted">Dein Account, Workspace und deine Business-Daten bleiben tenant-isoliert. AI-Verarbeitung echter Kundendaten bleibt bis zur separaten Freigabe deaktiviert.</p><input id="email" type="email" autocomplete="email" placeholder="E-Mail"><input id="password" type="password" autocomplete="current-password" placeholder="Passwort"><button id="signin">Anmelden</button><button id="signup">Account erstellen</button><button id="bootstrap">Workspace initialisieren</button><button id="signout">Abmelden</button><div class="privacy">Privacy-Funktionen für Datenexport, Consent und Kontolöschung sind technisch vorbereitet. Rechtliche Texte und öffentliche Aktivierung bleiben separat freigabepflichtig.</div><pre class="status" id="status"></pre></div></main><script>const s=document.getElementById('status');async function call(path,body){const r=await fetch('/customer/api/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});let j={};try{j=await r.json()}catch{}s.textContent=JSON.stringify(j,null,2);return j}const creds=()=>({email:document.getElementById('email').value,password:document.getElementById('password').value});signin.onclick=()=>call('account/signin',creds());signup.onclick=()=>call('account/signup',creds());bootstrap.onclick=()=>call('account/bootstrap',{business_name:'My Business'});signout.onclick=()=>call('account/signout',{});</script></body></html>`;
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
    real_customer_ai_processing_active: false,
    public_surface_active: false
  };
}

export function createProductionCustomerAccountSurface(options = {}) {
  const fetchImpl = options.fetch_impl || fetch;
  return {
    manifest: productionAccountSurfaceManifest,
    async handle(request, env = {}) {
      const url = new URL(request.url);
      if (!(url.pathname === '/customer' || url.pathname === '/customer/' || url.pathname.startsWith('/customer/api/'))) return null;
      const config = configFrom(env);
      if (!config.ok) return json({ ok: false, error: config.error, production_account_surface: false }, 503);
      const method = request.method.toUpperCase();
      if (['POST','PUT','PATCH','DELETE'].includes(method) && !sameOriginMutation(request)) return json({ ok: false, error: 'CUSTOMER_ORIGIN_MISMATCH' }, 403);
      if ((url.pathname === '/customer' || url.pathname === '/customer/') && method === 'GET') return html(accountShell());
      if (url.pathname === '/customer/api/manifest' && method === 'GET') return json({ ok: true, manifest: productionAccountSurfaceManifest() });

      if (url.pathname === '/customer/api/account/signup' && method === 'POST') {
        const parsed = await readJson(request, 5000); if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
        const email = clean(parsed.value?.email, 320).toLowerCase();
        const password = clean(parsed.value?.password, 300);
        if (!email || !password) return json({ ok: false, error: 'CUSTOMER_EMAIL_PASSWORD_REQUIRED' }, 400);
        const result = await supabaseJson(fetchImpl, `${config.url}/auth/v1/signup`, { method: 'POST', headers: authHeaders(config), body: JSON.stringify({ email, password }) });
        if (!result.ok) return json({ ok: false, error: 'CUSTOMER_SIGNUP_FAILED', status: result.status }, result.status >= 500 ? 502 : 400);
        const response = json({ ok: true, user: safeUser(result.body.user || {}), session_created: Boolean(result.body.access_token), email_confirmation_may_be_required: !result.body.access_token }, 201);
        return withCookies(response, setSessionCookies(result.body));
      }

      if (url.pathname === '/customer/api/account/signin' && method === 'POST') {
        const parsed = await readJson(request, 5000); if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
        const email = clean(parsed.value?.email, 320).toLowerCase();
        const password = clean(parsed.value?.password, 300);
        if (!email || !password) return json({ ok: false, error: 'CUSTOMER_EMAIL_PASSWORD_REQUIRED' }, 400);
        const result = await supabaseJson(fetchImpl, `${config.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: authHeaders(config), body: JSON.stringify({ email, password }) });
        if (!result.ok || !result.body.access_token) return json({ ok: false, error: 'CUSTOMER_SIGNIN_FAILED' }, 401);
        return withCookies(json({ ok: true, user: safeUser(result.body.user || {}), session_created: true }), setSessionCookies(result.body));
      }

      if (url.pathname === '/customer/api/account/refresh' && method === 'POST') {
        const refresh = clean(cookies(request)[REFRESH_COOKIE], 12000);
        if (!refresh) return json({ ok: false, error: 'CUSTOMER_REFRESH_SESSION_REQUIRED' }, 401);
        const result = await supabaseJson(fetchImpl, `${config.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: authHeaders(config), body: JSON.stringify({ refresh_token: refresh }) });
        if (!result.ok || !result.body.access_token) return json({ ok: false, error: 'CUSTOMER_REFRESH_FAILED' }, 401);
        return withCookies(json({ ok: true, refreshed: true }), setSessionCookies(result.body));
      }

      const accessToken = clean(cookies(request)[ACCESS_COOKIE], 12000);
      if (url.pathname === '/customer/api/account/signout' && method === 'POST') {
        if (accessToken) await supabaseJson(fetchImpl, `${config.url}/auth/v1/logout`, { method: 'POST', headers: authHeaders(config, accessToken) });
        return withCookies(json({ ok: true, signed_out: true }), clearSessionCookies());
      }

      const user = await getUser(config, accessToken, fetchImpl);
      if (!user.ok) return json({ ok: false, error: user.error }, user.status || 401);
      if (url.pathname === '/customer/api/account' && method === 'GET') return json({ ok: true, user: safeUser(user.user), operator_access: false });

      if (url.pathname === '/customer/api/account/bootstrap' && method === 'POST') {
        const parsed = await readJson(request, 3000); if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
        const businessName = clean(parsed.value?.business_name || 'My Business', 240);
        const result = await customSchemaRequest(config, accessToken, fetchImpl, 'rpc/bootstrap_personal_workspace', {
          method: 'POST',
          body: JSON.stringify({ p_business_name: businessName })
        });
        if (!result.ok) return json({ ok: false, error: 'CUSTOMER_WORKSPACE_BOOTSTRAP_FAILED', status: result.status }, result.status >= 500 ? 502 : 403);
        return json({ ok: true, workspace: result.body, operator_access: false });
      }

      if (url.pathname === '/customer/api/account/workspace' && method === 'GET') {
        const memberships = await customSchemaRequest(config, accessToken, fetchImpl, `memberships?select=tenant_id,role,status&user_id=eq.${encodeURIComponent(user.user.id)}&status=eq.active`, { method: 'GET' });
        if (!memberships.ok) return json({ ok: false, error: 'CUSTOMER_MEMBERSHIP_READ_FAILED' }, 502);
        const membership = Array.isArray(memberships.body) ? memberships.body[0] : null;
        if (!membership) return json({ ok: true, workspace: null, bootstrap_required: true });
        const businesses = await customSchemaRequest(config, accessToken, fetchImpl, `businesses?select=business_id,name,industry,business_type,country,region,language,currency,business_stage&tenant_id=eq.${encodeURIComponent(membership.tenant_id)}&deleted_at=is.null`, { method: 'GET' });
        if (!businesses.ok) return json({ ok: false, error: 'CUSTOMER_BUSINESS_READ_FAILED' }, 502);
        return json({ ok: true, workspace: { tenant_id: membership.tenant_id, role: membership.role, businesses: Array.isArray(businesses.body) ? businesses.body : [] }, operator_access: false });
      }

      if (url.pathname === '/customer/api/chat' && method === 'POST') {
        return json({ ok: false, error: 'REAL_CUSTOMER_AI_PROCESSING_NOT_APPROVED', operator_gate_required: true, customer_data_sent_to_ai_provider: false }, 503);
      }

      return json({ ok: false, error: 'CUSTOMER_PRODUCTION_ROUTE_NOT_FOUND' }, 404);
    }
  };
}
