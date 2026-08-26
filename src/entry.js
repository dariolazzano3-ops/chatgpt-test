import app from "./index.js";
import { handleMcp } from "./mcp.js";
import { SYNTROPIC_SITE } from "./site.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(SYNTROPIC_SITE, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "public, max-age=60"
        }
      });
    }

    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
    }

    return app.fetch(request, env, ctx);
  }
};
