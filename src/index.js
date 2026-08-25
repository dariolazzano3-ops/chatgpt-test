function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isAuthorized(request, env) {
  if (!env.API_TOKEN) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${env.API_TOKEN}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "chatgpt-test",
        host: url.hostname,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/secret-check" && request.method === "GET") {
      return json({
        ok: true,
        secretConfigured: Boolean(env.TEST_SECRET),
        apiTokenConfigured: Boolean(env.API_TOKEN),
        secretValueExposed: false
      });
    }

    if (url.pathname === "/db-check" && request.method === "GET") {
      if (!env.DB) {
        return json({
          ok: false,
          error: "DB_NOT_CONFIGURED"
        }, 503);
      }

      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({
          ok: result?.ok === 1,
          databaseConfigured: true,
          databaseReachable: result?.ok === 1,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return json({
          ok: false,
          databaseConfigured: true,
          databaseReachable: false,
          error: "DB_QUERY_FAILED"
        }, 500);
      }
    }

    if (url.pathname === "/api/v1/status" && request.method === "GET") {
      return json({
        ok: true,
        api: "v1",
        service: "chatgpt-test",
        environment: url.hostname.startsWith("staging-") ? "staging" : "production",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/v1/echo" && request.method === "POST") {
      const body = await readJson(request);

      if (!body || typeof body.message !== "string" || !body.message.trim()) {
        return json({
          ok: false,
          error: "INVALID_BODY",
          message: "Send JSON with a non-empty string field named 'message'."
        }, 400);
      }

      return json({
        ok: true,
        echo: body.message.trim(),
        receivedAt: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/v1/private" && request.method === "GET") {
      if (!env.API_TOKEN) {
        return json({
          ok: false,
          error: "AUTH_NOT_CONFIGURED"
        }, 503);
      }

      if (!isAuthorized(request, env)) {
        return json({
          ok: false,
          error: "UNAUTHORIZED"
        }, 401);
      }

      return json({
        ok: true,
        authenticated: true,
        message: "Protected API access granted",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/") {
      return json({
        message: "Platform foundation online ✅",
        service: "chatgpt-test",
        host: url.hostname,
        endpoints: [
          "GET /",
          "GET /health",
          "GET /secret-check",
          "GET /db-check",
          "GET /api/v1/status",
          "POST /api/v1/echo",
          "GET /api/v1/private (Bearer token required)"
        ]
      });
    }

    return json({
      ok: false,
      error: "NOT_FOUND",
      path: url.pathname
    }, 404);
  }
};
