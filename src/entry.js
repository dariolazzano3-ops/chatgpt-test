import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { handleFactory } from "./factory.js";
import { handlePreview } from "./preview.js";
import { handleDiagnostics } from "./diagnostics.js";
import { operatorHumanUxFinalManifest } from "./operator-human-ux-final-v1.js";
import { handleOperatorDashboard } from "./operator-provider-preflight-seal-v1.js";
import { getDurableOperatorRuntimeService } from "./operator-runtime-bootstrap-v1.js";
import { applyOperatorBranding } from "./operator-branding-v1.js";
import { handlePrelaunchCustomerProductSurface } from "./customer-product/prelaunch-security-privacy-v1.js";
import { enforceCustomerDistributedRateLimit } from "./customer-product/customer-rate-limit-do-v1.js";
export { AurentaraCustomerRateLimiter } from "./customer-product/customer-rate-limit-do-v1.js";

// The accepted Human UX final remains the presentation base of the provider-preflight wrapper.
// Importing its manifest here keeps the canonical entry contract explicit and regression-testable.
void operatorHumanUxFinalManifest;

function operatorUnavailable() {
  return new Response(JSON.stringify({ error: "OPERATOR_RUNTIME_DURABILITY_NOT_READY", private_operator_access_required: true, production_deploy: false }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Private Operator Control is resolved first and remains a completely separate surface.
    if (url.pathname === "/operator" || url.pathname === "/operator/" || url.pathname.startsWith("/operator/api/")) {
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

    // Customer Product remains isolated and passes through distributed abuse control before the explicit launch shield.
    if (url.pathname === "/customer" || url.pathname === "/customer/" || url.pathname.startsWith("/customer/api/")) {
      const rate = await enforceCustomerDistributedRateLimit(request, env);
      if (!rate.ok) return customerRateLimited(rate);
      const customerResponse = await handlePrelaunchCustomerProductSurface(request, env, ctx);
      if (customerResponse) return customerResponse;
    }

    if (url.pathname === "/mcp") return handleMcp(request, env);
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