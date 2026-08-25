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

function requireDb(env) {
  return Boolean(env.DB);
}

function parseItemId(pathname) {
  const match = pathname.match(/^\/api\/v1\/items\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function validateStatus(value) {
  return value === "active" || value === "archived";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const itemId = parseItemId(url.pathname);

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
      if (!requireDb(env)) {
        return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);
      }

      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({
          ok: result?.ok === 1,
          databaseConfigured: true,
          databaseReachable: result?.ok === 1,
          timestamp: new Date().toISOString()
        });
      } catch {
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
      if (!env.API_TOKEN) return json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, 503);
      if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

      return json({
        ok: true,
        authenticated: true,
        message: "Protected API access granted",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/v1/items" && request.method === "GET") {
      if (!requireDb(env)) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);

      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, status, created_at FROM items ORDER BY id DESC LIMIT 100"
        ).all();
        return json({ ok: true, items: results || [] });
      } catch {
        return json({ ok: false, error: "DB_QUERY_FAILED" }, 500);
      }
    }

    if (itemId !== null && request.method === "GET") {
      if (!requireDb(env)) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);

      try {
        const item = await env.DB.prepare(
          "SELECT id, name, status, created_at FROM items WHERE id = ?"
        ).bind(itemId).first();

        if (!item) return json({ ok: false, error: "ITEM_NOT_FOUND" }, 404);
        return json({ ok: true, item });
      } catch {
        return json({ ok: false, error: "DB_QUERY_FAILED" }, 500);
      }
    }

    if (url.pathname === "/api/v1/items" && request.method === "POST") {
      if (!env.API_TOKEN) return json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, 503);
      if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
      if (!requireDb(env)) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);

      const body = await readJson(request);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const status = body?.status === undefined ? "active" : body.status;

      if (!name || name.length > 120 || !validateStatus(status)) {
        return json({
          ok: false,
          error: "INVALID_BODY",
          message: "Send 'name' (1-120 chars) and optional status 'active' or 'archived'."
        }, 400);
      }

      try {
        const result = await env.DB.prepare(
          "INSERT INTO items (name, status) VALUES (?, ?)"
        ).bind(name, status).run();

        const item = await env.DB.prepare(
          "SELECT id, name, status, created_at FROM items WHERE id = ?"
        ).bind(result.meta.last_row_id).first();

        return json({ ok: true, item }, 201);
      } catch {
        return json({ ok: false, error: "DB_WRITE_FAILED" }, 500);
      }
    }

    if (itemId !== null && (request.method === "PATCH" || request.method === "PUT")) {
      if (!env.API_TOKEN) return json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, 503);
      if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
      if (!requireDb(env)) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);

      const current = await env.DB.prepare(
        "SELECT id, name, status, created_at FROM items WHERE id = ?"
      ).bind(itemId).first();

      if (!current) return json({ ok: false, error: "ITEM_NOT_FOUND" }, 404);

      const body = await readJson(request);
      const nextName = body?.name === undefined ? current.name : String(body.name).trim();
      const nextStatus = body?.status === undefined ? current.status : body.status;

      if (!nextName || nextName.length > 120 || !validateStatus(nextStatus)) {
        return json({
          ok: false,
          error: "INVALID_BODY",
          message: "Use 'name' up to 120 chars and status 'active' or 'archived'."
        }, 400);
      }

      try {
        await env.DB.prepare(
          "UPDATE items SET name = ?, status = ? WHERE id = ?"
        ).bind(nextName, nextStatus, itemId).run();

        const item = await env.DB.prepare(
          "SELECT id, name, status, created_at FROM items WHERE id = ?"
        ).bind(itemId).first();

        return json({ ok: true, item });
      } catch {
        return json({ ok: false, error: "DB_WRITE_FAILED" }, 500);
      }
    }

    if (itemId !== null && request.method === "DELETE") {
      if (!env.API_TOKEN) return json({ ok: false, error: "AUTH_NOT_CONFIGURED" }, 503);
      if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
      if (!requireDb(env)) return json({ ok: false, error: "DB_NOT_CONFIGURED" }, 503);

      const existing = await env.DB.prepare("SELECT id FROM items WHERE id = ?").bind(itemId).first();
      if (!existing) return json({ ok: false, error: "ITEM_NOT_FOUND" }, 404);

      try {
        await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(itemId).run();
        return json({ ok: true, deletedId: itemId });
      } catch {
        return json({ ok: false, error: "DB_WRITE_FAILED" }, 500);
      }
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
          "GET /api/v1/private (Bearer token required)",
          "GET /api/v1/items",
          "GET /api/v1/items/:id",
          "POST /api/v1/items (Bearer token required)",
          "PATCH /api/v1/items/:id (Bearer token required)",
          "DELETE /api/v1/items/:id (Bearer token required)"
        ]
      });
    }

    return json({ ok: false, error: "NOT_FOUND", path: url.pathname }, 404);
  }
};
