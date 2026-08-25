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
        secretValueExposed: false
      });
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

    if (url.pathname === "/") {
      return json({
        message: "Platform foundation online ✅",
        service: "chatgpt-test",
        host: url.hostname,
        endpoints: [
          "GET /",
          "GET /health",
          "GET /secret-check",
          "GET /api/v1/status",
          "POST /api/v1/echo"
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
