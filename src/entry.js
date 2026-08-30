import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { handleFactory } from "./factory.js";
import { handlePreview } from "./preview.js";
import { handleDiagnostics } from "./diagnostics.js";
import { handleOperatorDashboard } from "./operator-dashboard-completeness-v1.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/operator" || url.pathname === "/operator/" || url.pathname.startsWith("/operator/api/")) {
      const operatorResponse = await handleOperatorDashboard(request, env, ctx);
      if (operatorResponse) return operatorResponse;
    }

    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
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
