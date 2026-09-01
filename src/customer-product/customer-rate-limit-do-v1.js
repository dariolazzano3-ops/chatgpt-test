const enc = new TextEncoder();

function clean(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function asInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value || '')));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

export class AurentaraCustomerRateLimiter {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
    let input = {};
    try { input = await request.json(); } catch { return json({ ok: false, error: 'INVALID_JSON' }, 400); }

    const limit = asInt(input.limit, 30, 1, 1000);
    const windowMs = asInt(input.window_ms, 60_000, 1000, 86_400_000);
    const cost = asInt(input.cost_units, 1, 1, 100);
    const routeClass = clean(input.route_class, 80) || 'customer';
    const nowMs = Date.now();

    let bucket = await this.ctx.storage.get('bucket');
    if (!bucket || Number(bucket.reset_at || 0) <= nowMs || Number(bucket.window_ms || 0) !== windowMs) {
      bucket = { count: 0, reset_at: nowMs + windowMs, window_ms: windowMs, route_class: routeClass };
    }

    const nextCount = Number(bucket.count || 0) + cost;
    const limited = nextCount > limit;
    bucket.count = nextCount;
    await this.ctx.storage.put('bucket', bucket);

    const retryAfterSeconds = limited ? Math.max(1, Math.ceil((bucket.reset_at - nowMs) / 1000)) : 0;
    return json({
      ok: !limited,
      limited,
      remaining: Math.max(0, limit - nextCount),
      retry_after_seconds: retryAfterSeconds,
      reset_at: new Date(bucket.reset_at).toISOString(),
      route_class: routeClass
    }, limited ? 429 : 200);
  }
}

function mode(env = {}) {
  return clean(env.AURENTARA_CUSTOMER_SURFACE_MODE || 'off', 40).toLowerCase();
}

function routeClass(url, method) {
  if (url.pathname === '/customer' || url.pathname === '/customer/') return 'customer_entry';
  if (url.pathname.includes('/chat')) return 'customer_chat';
  if (method === 'GET') return 'customer_read';
  return 'customer_mutation';
}

function routeLimit(route) {
  if (route === 'customer_chat') return { limit: 60, window_ms: 3_600_000 };
  if (route === 'customer_mutation') return { limit: 40, window_ms: 3_600_000 };
  if (route === 'customer_entry') return { limit: 30, window_ms: 3_600_000 };
  return { limit: 120, window_ms: 3_600_000 };
}

function clientAddress(request) {
  return clean(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown', 120);
}

export async function enforceCustomerDistributedRateLimit(request, env = {}) {
  const customerMode = mode(env);
  if (!['controlled-prelaunch', 'public'].includes(customerMode)) {
    return { ok: true, skipped: true, reason: 'CUSTOMER_SURFACE_NOT_ACTIVE_FOR_DISTRIBUTED_RATE' };
  }

  if (String(env.AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE || '').toLowerCase() !== 'true') {
    return customerMode === 'public'
      ? { ok: false, status: 503, error: 'CUSTOMER_DISTRIBUTED_RATE_LIMIT_REQUIRED' }
      : { ok: true, skipped: true, reason: 'CONTROLLED_PRELAUNCH_RATE_BINDING_NOT_ENABLED' };
  }
  if (!env.CUSTOMER_RATE_LIMITER) return { ok: false, status: 503, error: 'CUSTOMER_RATE_LIMITER_BINDING_MISSING' };

  const url = new URL(request.url);
  const route = routeClass(url, request.method);
  const addressHash = await sha256(`aurentara:v1:${clientAddress(request)}`);
  const objectName = `${route}:${addressHash}`;
  const id = env.CUSTOMER_RATE_LIMITER.idFromName(objectName);
  const stub = env.CUSTOMER_RATE_LIMITER.get(id);
  const limits = routeLimit(route);
  const response = await stub.fetch('https://rate.internal/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...limits, cost_units: 1, route_class: route })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.limited === true) {
    return {
      ok: false,
      status: 429,
      error: 'CUSTOMER_RATE_LIMITED',
      retry_after_seconds: Math.max(1, Number(body.retry_after_seconds || 1))
    };
  }
  return { ok: true, skipped: false, remaining: Math.max(0, Number(body.remaining || 0)), route_class: route };
}
