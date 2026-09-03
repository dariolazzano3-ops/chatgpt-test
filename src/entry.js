import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { handleFactory } from "./factory.js";
import { handlePreview } from "./preview.js";
import { handleDiagnostics } from "./diagnostics.js";
import { handleOpenAiSecretPresence } from "./openai-secret-presence-v1.js";
import { handleFramerConnectionDiagnostic } from "./framer-connection-diagnostic-v1.js";
import { handleFinalProviderConnectionDiagnostic } from "./final-provider-connection-diagnostics-v1.js";
import { operatorHumanUxFinalManifest } from "./operator-human-ux-final-v1.js";
import { handleOperatorDashboard } from "./operator-controlled-paid-staging-dashboard-v1.js";
import { getDurableOperatorRuntimeService } from "./operator-runtime-bootstrap-v1.js";
import { applyOperatorBranding } from "./operator-branding-v1.js";
import { createCustomerLaunchShield } from "./customer-product/prelaunch-security-privacy-v1.js";
import { createProductionCustomerAccountPrivacySurface } from "./customer-product/production-account-privacy-surface-v1.js";
import { enforceCustomerDistributedRateLimit } from "./customer-product/customer-rate-limit-do-v1.js";
import { createCloudflareCustomerObservabilityBinding } from "./customer-product/production-live-bindings-v1.js";
import { handleSyntheticSessionBootstrap } from "./customer-product/synthetic-session-bootstrap-v1.js";
export { AurentaraCustomerRateLimiter } from "./customer-product/customer-rate-limit-do-v1.js";

void operatorHumanUxFinalManifest;

const productionCustomerAccountSurface = createProductionCustomerAccountPrivacySurface();
const customerLaunchShield = createCustomerLaunchShield({
  production_surface: productionCustomerAccountSurface,
  production_runtime_active: true
});

function operatorUnavailable() {
  return new Response(JSON.stringify({ error: "OPERATOR_RUNTIME_DURABILITY_NOT_READY", private_operator_access_required: true, production_deploy: false }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

function customerJson(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...headers
    }
  });
}

function customerRateLimited(result = {}) {
  return new Response(JSON.stringify({
    ok: false,
    error: result.error || "CUSTOMER_RATE_LIMITED",
    retry_after_seconds: Number(result.retry_after_seconds || 1),
    public_active: false
  }), {
    status: Number(result.status || 429),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "retry-after": String(Math.max(1, Number(result.retry_after_seconds || 1)))
    }
  });
}

function customerMode(env = {}) {
  return String(env?.AURENTARA_CUSTOMER_SURFACE_MODE || "off").toLowerCase();
}

function bool(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function privateAcceptanceAllowed(request, env = {}) {
  return customerMode(env) === "private-acceptance"
    && String(env?.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() === "staging"
    && String(env?.RIOSYSTEMS_PRODUCTION_DEPLOY || "").toLowerCase() === "false"
    && String(env?.RIOSYSTEMS_EXTERNAL_WRITES || "").toLowerCase() === "false"
    && bool(env?.AURENTARA_CUSTOMER_PRIVATE_ACCEPTANCE_APPROVED)
    && !bool(env?.AURENTARA_CUSTOMER_PUBLIC_ACTIVATION_APPROVED)
    && Boolean(String(request.headers.get("cf-access-jwt-assertion") || "").trim());
}

function withPrivateAcceptanceHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("x-aurentara-customer-mode", "private-acceptance");
  headers.set("x-aurentara-public-active", "false");
  headers.set("x-aurentara-production-deploy", "false");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function customerRouteClass(url, method) {
  if (["/customer", "/customer/"].includes(url.pathname)) return "customer_entry";
  if (url.pathname.includes("/chat")) return "customer_chat";
  if (method === "GET") return "customer_read";
  return "customer_mutation";
}

function recordCustomerEvent(ctx, env, input = {}) {
  if (String(env?.AURENTARA_CUSTOMER_OBSERVABILITY_ACTIVE || "").toLowerCase() !== "true") return;
  const observability = createCloudflareCustomerObservabilityBinding({ sink_active: true });
  const work = observability.record({
    event_name: input.event_name,
    severity: input.severity || "info",
    occurred_at: new Date().toISOString(),
    attributes: {
      route_class: input.route_class,
      method: input.method,
      status: Number(input.status || 0),
      mode: input.mode,
      retry_after_seconds: input.retry_after_seconds || undefined
    }
  }).catch(() => null);
  if (ctx?.waitUntil) ctx.waitUntil(work);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/operator" || url.pathname === "/operator/" || url.pathname.startsWith("/operator/api/") || url.pathname.startsWith("/operator/workspace/")) {
      let runtimeService = null;
      try {
        runtimeService = getDurableOperatorRuntimeService(env);
      } catch (error) {
        if (String(env?.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() === "staging") return operatorUnavailable();
        throw error;
      }
      const operatorResponse = await handleOperatorDashboard(request, env, ctx, runtimeService ? { runtime_service: runtimeService } : {});
      if (operatorResponse) return applyOperatorBranding(operatorResponse);
    }

    if (url.pathname === "/customer" || url.pathname === "/customer/" || url.pathname.startsWith("/customer/api/")) {
      const routeClass = customerRouteClass(url, request.method);
      const mode = customerMode(env);
      const rate = await enforceCustomerDistributedRateLimit(request, env);
      if (!rate.ok) {
        const response = customerRateLimited(rate);
        recordCustomerEvent(ctx, env, {
          event_name: "customer.rate_limited",
          severity: "warn",
          route_class: routeClass,
          method: request.method,
          status: response.status,
          mode,
          retry_after_seconds: rate.retry_after_seconds
        });
        return response;
      }

      let customerResponse = null;
      if (mode === "private-acceptance") {
        if (!privateAcceptanceAllowed(request, env)) {
          customerResponse = customerJson({
            ok: false,
            message: "Dieser private HAMYREN Acceptance-Bereich ist nur über den geschützten Zugang verfügbar.",
            public_active: false,
            production_deploy: false
          }, 403);
        } else {
          customerResponse = await productionCustomerAccountSurface.handle(request, env, ctx);
          if (customerResponse) customerResponse = withPrivateAcceptanceHeaders(customerResponse);
        }
      } else {
        customerResponse = await handleSyntheticSessionBootstrap({
          launch_shield: customerLaunchShield,
          request,
          env,
          ctx
        });
      }

      if (customerResponse) {
        recordCustomerEvent(ctx, env, {
          event_name: customerResponse.status >= 500 ? "customer.request.failed" : "customer.request.completed",
          severity: customerResponse.status >= 500 ? "error" : customerResponse.status >= 400 ? "warn" : "info",
          route_class: routeClass,
          method: request.method,
          status: customerResponse.status,
          mode
        });
        return customerResponse;
      }
    }

    if (url.pathname === "/mcp") return handleMcp(request, env);
    if (url.pathname === "/factory/diagnostics/openai-secret-presence") {
      const presenceResponse = handleOpenAiSecretPresence(request, env);
      if (presenceResponse) return presenceResponse;
    }
    if (url.pathname === "/factory/diagnostics/framer-connection") {
      const framerResponse = await handleFramerConnectionDiagnostic(request, env);
      if (framerResponse) return framerResponse;
    }
    if (url.pathname === "/factory/diagnostics/webflow-connection" || url.pathname === "/factory/diagnostics/activepieces-connection") {
      const providerResponse = await handleFinalProviderConnectionDiagnostic(request, env);
      if (providerResponse) return providerResponse;
    }
    if (url.pathname.startsWith("/factory/diagnostics")) {
      const diagnosticsResponse = await handleDiagnostics(request, env);
      if (diagnosticsResponse) return diagnosticsResponse;
    }
    if (url.pathname === "/factory/preview" || url.pathname.startsWith("/factory/preview/")) {
      const previewResponse = await handlePreview(request, env);
      if (previewResponse) return previewResponse;
    }
    if (url.pathname === "/factory" || url.pathname.startsWith("/factory/")) {
      const response = await handleFactory(request, env, ctx);
      if (response) return response;
    }
    return app.fetch(request, env, ctx);
  }
};
