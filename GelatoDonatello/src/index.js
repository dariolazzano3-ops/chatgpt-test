const ORIGIN = "https://gelato-donatello.pages.dev";

function proxyHeaders(headers) {
  const out = new Headers(headers);
  out.delete("content-security-policy");
  out.delete("content-security-policy-report-only");
  out.delete("x-frame-options");
  out.set("x-gelatodonatello-mirror", "1");
  return out;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, ORIGIN);

    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      redirect: "manual"
    };

    init.headers.set("host", target.host);
    init.headers.set("origin", ORIGIN);
    init.headers.set("referer", ORIGIN + "/");

    if (!["GET", "HEAD"].includes(request.method)) {
      init.body = request.body;
    }

    const response = await fetch(target.toString(), init);
    const headers = proxyHeaders(response.headers);

    const location = headers.get("location");
    if (location) {
      try {
        const resolved = new URL(location, ORIGIN);
        if (resolved.origin === ORIGIN) {
          headers.set("location", resolved.pathname + resolved.search + resolved.hash);
        }
      } catch {}
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
