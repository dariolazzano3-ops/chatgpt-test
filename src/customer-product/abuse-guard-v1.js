import { createCustomerProductSurface } from './surface-v1.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export const CUSTOMER_ABUSE_POLICY_V1 = Object.freeze({
  guest_session: Object.freeze({ limit: 8, window_ms: 10 * 60_000 }),
  chat: Object.freeze({ limit: 10, window_ms: 60_000 }),
  mutation: Object.freeze({ limit: 30, window_ms: 60_000 })
});

function json(body, status = 429, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}

function parseCookieToken(request) {
  const cookie = clean(request.headers.get('cookie'), 2000);
  const match = cookie.match(/(?:^|;\s*)aurentara_guest_session=([^;]+)/i);
  return match ? clean(match[1], 220) : '';
}

function clientAddress(request) {
  const direct = clean(request.headers.get('cf-connecting-ip'), 120);
  if (direct) return direct;
  const forwarded = clean(request.headers.get('x-forwarded-for'), 240).split(',')[0]?.trim();
  return forwarded || 'anonymous';
}

function routeClass(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (url.pathname === '/customer/api/guest-session' && method === 'POST') return 'guest_session';
  if (url.pathname === '/customer/api/chat' && method === 'POST') return 'chat';
  if (url.pathname.startsWith('/customer/api/') && ['POST','PUT','PATCH','DELETE'].includes(method)) return 'mutation';
  return null;
}

function identityFor(request, kind) {
  const ip = clientAddress(request);
  if (kind === 'guest_session') return `ip:${ip}`;
  const session = parseCookieToken(request);
  return session ? `session:${session}:ip:${ip}` : `ip:${ip}`;
}

function policyFor(kind, overrides = {}) {
  const base = CUSTOMER_ABUSE_POLICY_V1[kind];
  const candidate = overrides?.[kind] || {};
  return {
    limit: Math.max(1, Math.min(Number(candidate.limit || base.limit), 10_000)),
    window_ms: Math.max(1000, Math.min(Number(candidate.window_ms || base.window_ms), 86_400_000))
  };
}

export function customerAbuseGuardManifest() {
  return {
    version: 'aurentara.customer-product.abuse-guard.v1',
    local_burst_guard_active: true,
    distributed_rate_limit_active: false,
    production_edge_rate_limit_required: true,
    protected_classes: Object.keys(CUSTOMER_ABUSE_POLICY_V1),
    customer_operator_boundary_preserved: true,
    production_active: false
  };
}

export function createCustomerAbuseGuard(options = {}) {
  const buckets = options.buckets || new Map();
  const clock = typeof options.now === 'function' ? options.now : () => Date.now();
  const overrides = options.policy || {};
  const maxBuckets = Math.max(100, Math.min(Number(options.max_buckets || 5000), 50_000));

  function prune(timestamp) {
    for (const [key, bucket] of buckets) if (bucket.reset_at <= timestamp) buckets.delete(key);
    if (buckets.size <= maxBuckets) return;
    const oldest = [...buckets.entries()].sort((a, b) => a[1].reset_at - b[1].reset_at);
    for (const [key] of oldest.slice(0, buckets.size - maxBuckets)) buckets.delete(key);
  }

  function check(request) {
    const kind = routeClass(request);
    if (!kind) return { ok: true, limited: false, kind: null };
    const timestamp = Number(clock());
    prune(timestamp);
    const policy = policyFor(kind, overrides);
    const identity = identityFor(request, kind);
    const key = `${kind}:${identity}`;
    const current = buckets.get(key);
    const bucket = !current || current.reset_at <= timestamp
      ? { count: 0, reset_at: timestamp + policy.window_ms }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > policy.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.reset_at - timestamp) / 1000));
      return {
        ok: false,
        limited: true,
        error: 'CUSTOMER_RATE_LIMITED',
        kind,
        retry_after_seconds: retryAfterSeconds,
        limit: policy.limit,
        window_ms: policy.window_ms
      };
    }
    return {
      ok: true,
      limited: false,
      kind,
      remaining: Math.max(0, policy.limit - bucket.count),
      reset_at_ms: bucket.reset_at
    };
  }

  return { check, manifest: customerAbuseGuardManifest, bucket_count: () => buckets.size };
}

export function createHardenedCustomerProductSurface(options = {}) {
  const surface = options.surface || createCustomerProductSurface(options);
  const guard = options.guard || createCustomerAbuseGuard(options.abuse_guard_options || {});

  async function handle(request, env = {}, ctx = null) {
    const url = new URL(request.url);
    if (!(url.pathname === '/customer' || url.pathname === '/customer/' || url.pathname.startsWith('/customer/api/'))) {
      return surface.handle(request, env, ctx);
    }
    const gate = guard.check(request);
    if (!gate.ok) {
      return json({
        ok: false,
        error: gate.error,
        rate_limit_class: gate.kind,
        retry_after_seconds: gate.retry_after_seconds,
        operator_access: false
      }, 429, { 'retry-after': String(gate.retry_after_seconds) });
    }
    return surface.handle(request, env, ctx);
  }

  return {
    manifest() {
      return {
        ...surface.manifest(),
        abuse_guard: guard.manifest(),
        preferred_public_handler: true
      };
    },
    handle,
    surface,
    guard,
    economics: surface.economics,
    session_count: surface.session_count
  };
}

let hardenedDefault = null;
export async function handleHardenedCustomerProductSurface(request, env, ctx) {
  if (!hardenedDefault) hardenedDefault = createHardenedCustomerProductSurface();
  return hardenedDefault.handle(request, env, ctx);
}
