import { createProductionCustomerAccountSurface, productionAccountSurfaceManifest } from './production-account-surface-v1.js';
import { handleProductionCustomerPrivacyRoute, productionPrivacySurfaceManifest } from './production-privacy-surface-v1.js';

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const ACCESS_COOKIE = 'aurentara_customer_access';

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

function cookies(request) {
  const out = {};
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const item = part.trim();
    if (!item) continue;
    const index = item.indexOf('=');
    if (index < 0) continue;
    out[item.slice(0, index)] = decodeURIComponent(item.slice(index + 1));
  }
  return out;
}

function clearCookies(response) {
  const headers = new Headers(response.headers);
  headers.append('set-cookie', 'aurentara_customer_access=; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=0');
  headers.append('set-cookie', 'aurentara_customer_refresh=; HttpOnly; Secure; SameSite=Lax; Path=/customer; Max-Age=0');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function configFrom(env = {}) {
  const url = clean(env.AURENTARA_CUSTOMER_SUPABASE_URL, 1000);
  const projectRef = clean(env.AURENTARA_CUSTOMER_SUPABASE_PROJECT_REF, 100);
  const operatorRef = clean(env.AURENTARA_OPERATOR_SUPABASE_PROJECT_REF, 100);
  const publishableKey = clean(env.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY, 1000);
  let urlRef = null;
  try { urlRef = new URL(url).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i)?.[1]?.toLowerCase() || null; } catch {}
  const ok = Boolean(url && projectRef && publishableKey && urlRef === projectRef && projectRef !== operatorRef);
  return { ok, url, project_ref: projectRef, operator_ref: operatorRef, publishable_key: publishableKey };
}

function sameOriginMutation(request) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method.toUpperCase())) return true;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

async function getUser(config, accessToken, fetchImpl) {
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: { 'apikey': config.publishable_key, 'authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function isPrivacyRoute(pathname) {
  return pathname.startsWith('/customer/api/privacy/') || pathname === '/customer/api/account/delete';
}

export function productionAccountPrivacySurfaceManifest() {
  return {
    version: 'aurentara.customer.production-account-privacy-surface.v1',
    account: productionAccountSurfaceManifest(),
    privacy: productionPrivacySurfaceManifest(),
    service_role_in_worker: false,
    public_customer_surface_active: false,
    real_customer_ai_processing_active: false
  };
}

export function createProductionCustomerAccountPrivacySurface(options = {}) {
  const fetchImpl = options.fetch_impl || fetch;
  const accountSurface = createProductionCustomerAccountSurface({ fetch_impl: fetchImpl });
  return {
    manifest: productionAccountPrivacySurfaceManifest,
    async handle(request, env = {}, ctx = null) {
      const url = new URL(request.url);
      if (!isPrivacyRoute(url.pathname)) return accountSurface.handle(request, env, ctx);
      if (!sameOriginMutation(request)) return json({ ok: false, error: 'CUSTOMER_ORIGIN_MISMATCH' }, 403);

      const config = configFrom(env);
      if (!config.ok) return json({ ok: false, error: 'CUSTOMER_PRODUCTION_AUTH_CONFIG_INCOMPLETE' }, 503);
      const accessToken = clean(cookies(request)[ACCESS_COOKIE], 12000);
      if (!accessToken) return json({ ok: false, error: 'CUSTOMER_ACCOUNT_SESSION_REQUIRED' }, 401);
      const user = await getUser(config, accessToken, fetchImpl);
      if (!user?.id) return json({ ok: false, error: 'CUSTOMER_ACCOUNT_SESSION_INVALID' }, 401);

      const handled = await handleProductionCustomerPrivacyRoute(request, {
        config,
        access_token: accessToken,
        user,
        fetch_impl: fetchImpl
      });
      if (!handled) return json({ ok: false, error: 'CUSTOMER_PRODUCTION_ROUTE_NOT_FOUND' }, 404);
      return handled.clear_session ? clearCookies(handled.response) : handled.response;
    }
  };
}
