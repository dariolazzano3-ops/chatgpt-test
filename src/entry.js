import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { handleFactory } from "./factory.js";
import { handlePreview } from "./preview.js";
import { handleDiagnostics } from "./diagnostics.js";
import { handleOperatorDashboard } from "./operator-human-ux-final-v1.js";
import { getDurableOperatorRuntimeService } from "./operator-runtime-bootstrap-v1.js";
import { applyOperatorBranding } from "./operator-branding-v1.js";
import { handleCustomerProductSurface } from "./customer-product/surface-v1.js";

function operatorUnavailable() {
  return new Response(JSON.stringify({ error: "OPERATOR_RUNTIME_DURABILITY_NOT_READY", private_operator_access_required: true, production_deploy: false }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
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

    // Customer Product has its own namespace and cannot receive /operator requests.
    if (url.pathname === "/customer" || url.pathname === "/customer/" || url.pathname.startsWith("/customer/api/")) {
      const customerResponse = await handleCustomerProductSurface(request, env, ctx);
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