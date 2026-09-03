function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer"
    }
  });
}

function isAuthorized(request, env = {}) {
  if (!env.API_TOKEN) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${env.API_TOKEN}`;
}

export function hamyrenOpenAiSecretPresenceManifest(env = {}) {
  const staging = String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() === "staging";
  return Object.freeze({
    schema: "hamyren.openai-secret-presence.v1",
    provider_id: "openai",
    runtime: staging ? "riosystems-staging" : "non-staging",
    credential_ref: "env://HAMYREN_OPENAI_API_KEY",
    secret_present: staging && Boolean(env.HAMYREN_OPENAI_API_KEY),
    secret_value_exposed: false,
    external_request_performed: false,
    openai_api_called: false,
    inference_performed: false,
    production_deploy: false,
    variable_cost_eur: 0
  });
}

export function handleHamyrenOpenAiSecretPresence(request, env = {}) {
  const url = new URL(request.url);
  if (url.pathname !== "/factory/diagnostics/hamyren-openai-secret-presence") return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() !== "staging") {
    return json({ ok: false, error: "STAGING_ONLY", production_deploy: false }, 403);
  }

  const presence = hamyrenOpenAiSecretPresenceManifest(env);
  return json({
    ok: presence.secret_present,
    service: "hamyren-openai-secret-presence-v1",
    ...presence
  }, 200);
}
