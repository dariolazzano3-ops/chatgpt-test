import app from "./index.js";
import { handleMcp } from "./mcp.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      return handleMcp(request, env);
    }
    return app.fetch(request, env, ctx);
  }
};
