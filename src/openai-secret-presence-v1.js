function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function isAuthorized(request, env = {}) {
  if (!env.API_TOKEN) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${env.API_TOKEN}`;
}

function clean(value, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function probeOpenAiModels(apiKey) {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        "user-agent": "aurentara-openai-connection-diagnostics/1.0"
      }
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      reachable: true,
      status: response.status,
      model_count: response.ok && Array.isArray(body?.data) ? body.data.length : null,
      error_type: response.ok ? null : clean(body?.error?.type || body?.error?.code || `OPENAI_HTTP_${response.status}`),
      error_message: response.ok ? null : clean(body?.error?.message || `OPENAI_HTTP_${response.status}`)
    };
  } catch (error) {
    return {
      ok: false,
      reachable: false,
      status: null,
      model_count: null,
      error_type: "OPENAI_NETWORK_ERROR",
      error_message: clean(error?.message || "OPENAI_NETWORK_ERROR")
    };
  }
}

export function openAiSecretPresenceManifest(env = {}) {
  const staging = String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() === "staging";
  return Object.freeze({
    schema: "aurentara.openai-secret-presence.v1",
    provider_id: "openai-api",
    runtime: staging ? "riosystems-staging" : "non-staging",
    credential_ref: "env://OPENAI_API_KEY",
    secret_present: staging && Boolean(env.OPENAI_API_KEY),
    secret_value_exposed: false,
    external_request_performed: false,
    openai_api_called: false,
    paid_execution_approved: false,
    production_deploy: false
  });
}

export async function handleOpenAiSecretPresence(request, env = {}) {
  const url = new URL(request.url);
  if (url.pathname !== "/factory/diagnostics/openai-secret-presence") return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() !== "staging") {
    return json({ ok: false, error: "STAGING_ONLY", production_deploy: false }, 403);
  }

  const presence = openAiSecretPresenceManifest(env);
  const verify = String(url.searchParams.get("verify") || "").toLowerCase();

  if (!verify) {
    return json({
      ok: presence.secret_present,
      service: "aurentara-openai-secret-presence-v1",
      ...presence
    }, 200);
  }

  if (verify !== "models") {
    return json({ ok: false, error: "UNSUPPORTED_VERIFICATION_MODE" }, 400);
  }

  if (!presence.secret_present) {
    return json({
      ok: false,
      service: "aurentara-openai-connection-check-v1",
      schema: "aurentara.openai-connection-check.v1",
      provider_id: "openai-api",
      runtime: "riosystems-staging",
      credential_ref: "env://OPENAI_API_KEY",
      credential_present: false,
      credential_valid: null,
      connected_staging: false,
      secret_value_exposed: false,
      external_request_performed: false,
      openai_api_called: false,
      inference_performed: false,
      paid_execution_approved: false,
      production_deploy: false,
      variable_cost_eur: 0,
      error: "OPENAI_API_KEY_NOT_CONFIGURED"
    }, 200);
  }

  const probe = await probeOpenAiModels(env.OPENAI_API_KEY);
  return json({
    ok: probe.ok,
    service: "aurentara-openai-connection-check-v1",
    schema: "aurentara.openai-connection-check.v1",
    provider_id: "openai-api",
    runtime: "riosystems-staging",
    credential_ref: "env://OPENAI_API_KEY",
    credential_present: true,
    credential_valid: probe.ok ? true : probe.status === 401 ? false : null,
    connected_staging: probe.ok,
    endpoint: "GET /v1/models",
    secret_value_exposed: false,
    external_request_performed: true,
    openai_api_called: true,
    inference_performed: false,
    prompt_submitted: false,
    token_generation_requested: false,
    paid_execution_approved: false,
    production_deploy: false,
    variable_cost_eur: 0,
    check: {
      reachable: probe.reachable,
      status: probe.status,
      authenticated: probe.ok,
      model_count: probe.model_count,
      error_type: probe.error_type,
      error_message: probe.error_message
    }
  }, 200);
}
