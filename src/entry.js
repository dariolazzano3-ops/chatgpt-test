import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { handleFactory } from "./factory.js";
import { handlePreview } from "./preview.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
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
