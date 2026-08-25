function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "chatgpt-test",
        host: url.hostname,
        timestamp: new Date().toISOString()
      });
    }

    return json({
      message: "Platform foundation online ✅",
      service: "chatgpt-test",
      host: url.hostname,
      endpoints: ["/", "/health"]
    });
  }
};
