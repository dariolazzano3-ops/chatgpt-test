const MCP_PROTOCOL_VERSION = "2025-03-26";

const TOOLS = [
  {
    name: "list_items",
    title: "List items",
    description: "List up to 100 items from the D1 database.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "get_item",
    title: "Get item",
    description: "Read one item by numeric id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer", minimum: 1 } },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "create_item",
    title: "Create item",
    description: "Create a new item.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        status: { type: "string", enum: ["active", "archived"], default: "active" }
      },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "update_item",
    title: "Update item",
    description: "Update an existing item by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", minimum: 1 },
        name: { type: "string", minLength: 1, maxLength: 120 },
        status: { type: "string", enum: ["active", "archived"] }
      },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "delete_item",
    title: "Delete item",
    description: "Delete an item by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer", minimum: 1 } },
      required: ["id"],
      additionalProperties: false
    }
  }
];

function rpcResult(id, result) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" }
  });
}

function rpcError(id, code, message, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" }
  });
}

function authorized(request, env) {
  if (!env.API_TOKEN) return false;
  return (request.headers.get("authorization") || "") === `Bearer ${env.API_TOKEN}`;
}

function asToolContent(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value
  };
}

async function callTool(name, args, env) {
  if (!env.DB) throw new Error("DB_NOT_CONFIGURED");

  if (name === "list_items") {
    const { results } = await env.DB.prepare(
      "SELECT id, name, status, created_at FROM items ORDER BY id DESC LIMIT 100"
    ).all();
    return asToolContent({ items: results || [] });
  }

  if (name === "get_item") {
    const id = Number(args?.id);
    if (!Number.isInteger(id) || id < 1) throw new Error("INVALID_ID");
    const item = await env.DB.prepare(
      "SELECT id, name, status, created_at FROM items WHERE id = ?"
    ).bind(id).first();
    if (!item) throw new Error("ITEM_NOT_FOUND");
    return asToolContent({ item });
  }

  if (name === "create_item") {
    const itemName = typeof args?.name === "string" ? args.name.trim() : "";
    const status = args?.status === undefined ? "active" : args.status;
    if (!itemName || itemName.length > 120 || !["active", "archived"].includes(status)) {
      throw new Error("INVALID_ARGUMENTS");
    }
    const insert = await env.DB.prepare(
      "INSERT INTO items (name, status) VALUES (?, ?)"
    ).bind(itemName, status).run();
    const item = await env.DB.prepare(
      "SELECT id, name, status, created_at FROM items WHERE id = ?"
    ).bind(insert.meta.last_row_id).first();
    return asToolContent({ item });
  }

  if (name === "update_item") {
    const id = Number(args?.id);
    if (!Number.isInteger(id) || id < 1) throw new Error("INVALID_ID");
    const current = await env.DB.prepare(
      "SELECT id, name, status, created_at FROM items WHERE id = ?"
    ).bind(id).first();
    if (!current) throw new Error("ITEM_NOT_FOUND");

    const nextName = args?.name === undefined ? current.name : String(args.name).trim();
    const nextStatus = args?.status === undefined ? current.status : args.status;
    if (!nextName || nextName.length > 120 || !["active", "archived"].includes(nextStatus)) {
      throw new Error("INVALID_ARGUMENTS");
    }

    await env.DB.prepare(
      "UPDATE items SET name = ?, status = ? WHERE id = ?"
    ).bind(nextName, nextStatus, id).run();
    const item = await env.DB.prepare(
      "SELECT id, name, status, created_at FROM items WHERE id = ?"
    ).bind(id).first();
    return asToolContent({ item });
  }

  if (name === "delete_item") {
    const id = Number(args?.id);
    if (!Number.isInteger(id) || id < 1) throw new Error("INVALID_ID");
    const existing = await env.DB.prepare("SELECT id FROM items WHERE id = ?").bind(id).first();
    if (!existing) throw new Error("ITEM_NOT_FOUND");
    await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
    return asToolContent({ deletedId: id });
  }

  throw new Error("TOOL_NOT_FOUND");
}

export async function handleMcp(request, env) {
  if (request.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      service: "chatgpt-test-mcp",
      transport: "stateless-streamable-http",
      endpoint: "/mcp"
    }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" }
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
  }

  if (!env.API_TOKEN) return rpcError(null, -32001, "AUTH_NOT_CONFIGURED", 503);
  if (!authorized(request, env)) return rpcError(null, -32000, "UNAUTHORIZED", 401);

  let message;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "Invalid Request", 400);
  }

  if (message.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  if (message.method === "initialize") {
    return rpcResult(message.id, {
      protocolVersion: message.params?.protocolVersion || MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "chatgpt-test-mcp", version: "0.1.0" }
    });
  }

  if (message.method === "ping") {
    return rpcResult(message.id, {});
  }

  if (message.method === "tools/list") {
    return rpcResult(message.id, { tools: TOOLS });
  }

  if (message.method === "tools/call") {
    const toolName = message.params?.name;
    const args = message.params?.arguments || {};
    try {
      const result = await callTool(toolName, args, env);
      return rpcResult(message.id, result);
    } catch (error) {
      return rpcResult(message.id, {
        content: [{ type: "text", text: error?.message || "TOOL_CALL_FAILED" }],
        isError: true
      });
    }
  }

  return rpcError(message.id, -32601, "Method not found");
}
