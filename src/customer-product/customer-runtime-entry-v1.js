import { createCustomerLaunchShield } from './prelaunch-security-privacy-v1.js';
import { createProductionCustomerAccountPrivacySurface } from './production-account-privacy-surface-v1.js';
import { enforceCustomerDistributedRateLimit } from './customer-rate-limit-do-v1.js';
import { createCloudflareCustomerObservabilityBinding } from './production-live-bindings-v1.js';
export { AurentaraCustomerRateLimiter } from './customer-rate-limit-do-v1.js';

const productionCustomerAccountSurface = createProductionCustomerAccountPrivacySurface();
const customerLaunchShield = createCustomerLaunchShield({
  production_surface: productionCustomerAccountSurface,
  production_runtime_active: true
});

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

function customerRoute(url) {
  return url.pathname === '/customer'
    || url.pathname === '/customer/'
    || url.pathname.startsWith('/customer/api/');
}

function routeClass(url, method) {
  if (url.pathname === '/customer' || url.pathname === '/customer/') return 'customer_entry';
  if (url.pathname.includes('/chat')) return 'customer_chat';
  return method === 'GET' ? 'customer_read' : 'customer_mutation';
}

function recordEvent(ctx, env, input = {}) {
  if (String(env?.AURENTARA_CUSTOMER_OBSERVABILITY_ACTIVE || '').toLowerCase() !== 'true') return;
  const observability = createCloudflareCustomerObservabilityBinding({ sink_active: true });
  const work = observability.record({
    event_name: input.event_name,
    severity: input.severity || 'info',
    occurred_at: new Date().toISOString(),
    attributes: {
      route_class: input.route_class,
      method: input.method,
      status: Number(input.status || 0),
      mode: String(env?.AURENTARA_CUSTOMER_SURFACE_MODE || 'off').toLowerCase(),
      retry_after_seconds: input.retry_after_seconds || undefined
    }
  }).catch(() => null);
  if (ctx?.waitUntil) ctx.waitUntil(work);
}

function rateLimited(rate) {
  return json({
    ok: false,
    error: rate.error || 'CUSTOMER_RATE_LIMITED',
    retry_after_seconds: Math.max(1, Number(rate.retry_after_seconds || 1)),
    public_active: false
  }, Number(rate.status || 429), {
    'retry-after': String(Math.max(1, Number(rate.retry_after_seconds || 1)))
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!customerRoute(url)) {
      return json({ ok: false, error: 'AURENTARA_CUSTOMER_RUNTIME_ROUTE_NOT_FOUND', public_active: false }, 404);
    }

    const route_class = routeClass(url, request.method);
    const rate = await enforceCustomerDistributedRateLimit(request, env);
    if (!rate.ok) {
      const response = rateLimited(rate);
      recordEvent(ctx, env, {
        event_name: 'customer.rate_limited',
        severity: 'warn',
        route_class,
        method: request.method,
        status: response.status,
        retry_after_seconds: rate.retry_after_seconds
      });
      return response;
    }

    const response = await customerLaunchShield.handle(request, env, ctx);
    if (!response) return json({ ok: false, error: 'AURENTARA_CUSTOMER_RUNTIME_ROUTE_NOT_FOUND', public_active: false }, 404);
    recordEvent(ctx, env, {
      event_name: response.status >= 500 ? 'customer.request.failed' : 'customer.request.completed',
      severity: response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
      route_class,
      method: request.method,
      status: response.status
    });
    return response;
  }
};
