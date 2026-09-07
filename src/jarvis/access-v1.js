import { verifyJarvisCloudflareAccessJwtV1 } from './access-jwt-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export async function authorizeJarvisV1(request, env = {}, ctx = {}, options = {}) {
  if (typeof options.authorize === 'function') return options.authorize(request, env, ctx);

  const expectedEmail = clean(env.JARVIS_OPERATOR_EMAIL, 320).toLowerCase();
  const expectedAud = clean(env.JARVIS_ACCESS_AUD, 500);

  if (!expectedEmail || !expectedAud) {
    return { ok: false, status: 503, error: 'JARVIS_PRIVATE_ACCESS_NOT_CONFIGURED' };
  }
  let email = '';
  let authentication = '';

  if (ctx?.access && typeof ctx.access.getIdentity === 'function') {
    if (clean(ctx.access.aud, 500) !== expectedAud) {
      return { ok: false, status: 403, error: 'JARVIS_ACCESS_AUDIENCE_MISMATCH' };
    }
    let identity;
    try { identity = await ctx.access.getIdentity(); }
    catch { return { ok: false, status: 401, error: 'JARVIS_ACCESS_IDENTITY_FAILED' }; }
    email = clean(identity?.email, 320).toLowerCase();
    authentication = 'CLOUDFLARE_ACCESS_CONTEXT';
  } else {
    const verified = await verifyJarvisCloudflareAccessJwtV1({
      token: request.headers.get('cf-access-jwt-assertion'),
      audience: expectedAud,
      team_domain: env.JARVIS_ACCESS_TEAM_DOMAIN,
      fetch_impl: options.fetch_impl || globalThis.fetch
    });
    if (!verified.ok) {
      return { ok: false, status: 401, error: verified.error || 'JARVIS_CLOUDFLARE_ACCESS_REQUIRED' };
    }
    email = clean(verified.email, 320).toLowerCase();
    authentication = 'CLOUDFLARE_ACCESS_JWT';
  }

  if (!email || email !== expectedEmail) {
    return { ok: false, status: 403, error: 'JARVIS_IDENTITY_NOT_ALLOWED' };
  }

  return {
    ok: true,
    operator_id: 'jarvis-operator:' + email,
    email,
    authentication,
    audience_separate_from_operator_dashboard: true
  };
}

export function jarvisAccessManifestV1() {
  return {
    schema: 'aurentara.jarvis.access.v1',
    protected_path: '/',
    internal_adapter_path: '/jarvis',
    dedicated_access_audience_required: true,
    operator_dashboard_audience_reused: false,
    riosystems_identity_fallback: false,
    pages_access_jwt_supported: true,
    access_jwt_signature_validation: true,
    single_operator: true,
    public_access: false,
    hamyren_access_shared: false,
    production_deploy: false
  };
}
