const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export async function authorizeJarvisV1(request, env = {}, ctx = {}, options = {}) {
  if (typeof options.authorize === 'function') return options.authorize(request, env, ctx);

  const expectedEmail = clean(env.JARVIS_OPERATOR_EMAIL || env.RIOSYSTEMS_OPERATOR_EMAIL, 320).toLowerCase();
  const expectedAud = clean(env.JARVIS_ACCESS_AUD, 500);

  if (!expectedEmail || !expectedAud) {
    return { ok: false, status: 503, error: 'JARVIS_PRIVATE_ACCESS_NOT_CONFIGURED' };
  }
  if (!ctx?.access || typeof ctx.access.getIdentity !== 'function') {
    return { ok: false, status: 401, error: 'JARVIS_CLOUDFLARE_ACCESS_REQUIRED' };
  }
  if (clean(ctx.access.aud, 500) !== expectedAud) {
    return { ok: false, status: 403, error: 'JARVIS_ACCESS_AUDIENCE_MISMATCH' };
  }

  let identity;
  try { identity = await ctx.access.getIdentity(); }
  catch { return { ok: false, status: 401, error: 'JARVIS_ACCESS_IDENTITY_FAILED' }; }

  const email = clean(identity?.email, 320).toLowerCase();
  if (!email || email !== expectedEmail) {
    return { ok: false, status: 403, error: 'JARVIS_IDENTITY_NOT_ALLOWED' };
  }

  return {
    ok: true,
    operator_id: 'jarvis-operator:' + email,
    email,
    authentication: 'CLOUDFLARE_ACCESS',
    audience_separate_from_operator_dashboard: true
  };
}

export function jarvisAccessManifestV1() {
  return {
    schema: 'aurentara.jarvis.access.v1',
    protected_path: '/jarvis',
    dedicated_access_audience_required: true,
    operator_dashboard_audience_reused: false,
    single_operator: true,
    public_access: false,
    hamyren_access_shared: false,
    production_deploy: false
  };
}
