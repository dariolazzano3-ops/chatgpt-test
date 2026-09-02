const SESSION_COOKIE = 'aurentara_guest_session';
const SYNTHETIC_MODE = 'synthetic-staging';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);

function customerMode(env = {}) {
  return clean(env.AURENTARA_CUSTOMER_SURFACE_MODE, 40).toLowerCase();
}

function readCookie(header = '', name = SESSION_COOKIE) {
  const match = clean(header).match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, 'i'));
  return match ? clean(match[1], 240) : '';
}

function replaceCookie(header = '', name, value) {
  const kept = clean(header).split(';').map((part) => part.trim()).filter(Boolean).filter((part) => !part.toLowerCase().startsWith(`${name.toLowerCase()}=`));
  kept.push(`${name}=${value}`);
  return kept.join('; ');
}

async function sessionRequired(response) {
  if (!response || response.status !== 401) return false;
  try {
    const payload = await response.clone().json();
    return payload?.error === 'CUSTOMER_SESSION_REQUIRED';
  } catch {
    return false;
  }
}

function withBootstrapHeader(response, setCookie) {
  const headers = new Headers(response.headers);
  headers.set('x-aurentara-synthetic-session-bootstrap', 'recovered');
  if (setCookie) headers.append('set-cookie', setCookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function syntheticSessionBootstrapManifest() {
  return {
    schema: 'aurentara.hamyren.synthetic-session-bootstrap.v1',
    mode: SYNTHETIC_MODE,
    stale_cookie_recovery_only: true,
    anonymous_bypass: false,
    public_mode_supported: false,
    billing_active: false,
    real_customer_data_allowed: false,
    external_write_required: false,
    production_deploy_required: false,
    paid_provider_required: false
  };
}

export async function handleSyntheticSessionBootstrap(input = {}) {
  const launchShield = input.launch_shield;
  const request = input.request;
  const env = input.env || {};
  const ctx = input.ctx || null;
  if (!launchShield?.handle || !(request instanceof Request)) throw new Error('SYNTHETIC_SESSION_BOOTSTRAP_RUNTIME_REQUIRED');

  const replayable = request.clone();
  const first = await launchShield.handle(request, env, ctx);

  // This repair is deliberately unreachable from off, controlled-prelaunch and public modes.
  if (customerMode(env) !== SYNTHETIC_MODE) return first;
  if (!(await sessionRequired(first))) return first;

  // A missing cookie remains a normal unauthenticated guest state. The browser must explicitly create it.
  const staleToken = readCookie(replayable.headers.get('cookie') || '');
  if (!staleToken) return first;

  const originalUrl = new URL(replayable.url);
  const bootstrapRequest = new Request(new URL('/customer/api/guest-session', originalUrl.origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: originalUrl.origin
    },
    body: '{}'
  });
  const bootstrap = await launchShield.handle(bootstrapRequest, env, ctx);
  if (!bootstrap || bootstrap.status !== 201) return first;

  const setCookie = clean(bootstrap.headers.get('set-cookie'), 2000);
  const freshToken = readCookie(setCookie);
  if (!freshToken) return first;

  const retryHeaders = new Headers(replayable.headers);
  retryHeaders.set('cookie', replaceCookie(retryHeaders.get('cookie') || '', SESSION_COOKIE, freshToken));
  const retryRequest = new Request(replayable, { headers: retryHeaders });
  const retried = await launchShield.handle(retryRequest, env, ctx);
  return withBootstrapHeader(retried, setCookie);
}
