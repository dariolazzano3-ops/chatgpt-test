import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { isRiosystemsRoute, renderRiosystems } from "./riosystems.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
    }

    if (request.method === "GET" && isRiosystemsRoute(url.pathname)) {
      const html = renderRiosystems(url.pathname);
      if (html) {
        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=UTF-8",
            "cache-control": "no-store",
            "x-riosystems-preview": "v1"
          }
        });
      }
    }

    return app.fetch(request, env, ctx);
  }
};
