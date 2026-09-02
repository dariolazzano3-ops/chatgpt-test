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

function isStaging(env = {}) {
  return String(env.RIOSYSTEMS_ENVIRONMENT || "").toLowerCase() === "staging"
    && String(env.RIOSYSTEMS_PRODUCTION_DEPLOY || "").toLowerCase() === "false"
    && String(env.RIOSYSTEMS_EXTERNAL_WRITES || "").toLowerCase() === "false";
}

function safeFailure(status) {
  if (status === 401) return "CREDENTIAL_INVALID";
  if (status === 403) return "AUTHORIZATION_DENIED_OR_SCOPE_INSUFFICIENT";
  if (status === 404) return "ENDPOINT_UNAVAILABLE";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status >= 500) return "PROVIDER_SERVER_FAILURE";
  return "UNKNOWN_PROVIDER_FAILURE";
}

export function finalProviderPresenceManifest(env = {}) {
  const staging = isStaging(env);
  return Object.freeze({
    schema: "aurentara.final-provider-connection-presence.v1",
    runtime: staging ? "riosystems-staging" : "non-staging",
    webflow: Object.freeze({
      provider_id: "webflow-api",
      credential_ref: "env://WEBFLOW_SITE_TOKEN",
      credential_present: staging && Boolean(env.WEBFLOW_SITE_TOKEN)
    }),
    activepieces: Object.freeze({
      provider_id: "activepieces-cloud-free",
      credential_ref: "env://ACTIVEPIECES_API_KEY",
      credential_present: staging && Boolean(env.ACTIVEPIECES_API_KEY)
    }),
    secret_value_exposed: false,
    provider_requests: 0,
    provider_writes: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    variable_cost_eur: 0
  });
}

async function probeWebflow(token, fetchFn) {
  let status = null;
  let body = null;
  try {
    const response = await fetchFn("https://api.webflow.com/v2/sites", {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`
      }
    });
    status = response.status;
    try { body = await response.json(); } catch { body = null; }
    const authenticated = response.ok;
    const sites = Array.isArray(body?.sites) ? body.sites : [];
    return {
      ok: authenticated && sites.length >= 1,
      status,
      credential_valid: response.ok ? true : response.status === 401 ? false : null,
      authenticated,
      site_accessible: authenticated && sites.length >= 1,
      site_metadata_read: authenticated && sites.length >= 1,
      error: response.ok && sites.length < 1 ? "ACCOUNT_ACCESS_DENIED_OR_NO_SITE_VISIBLE" : response.ok ? null : safeFailure(response.status)
    };
  } catch {
    return {
      ok: false,
      status,
      credential_valid: null,
      authenticated: false,
      site_accessible: false,
      site_metadata_read: false,
      error: "RUNTIME_NETWORK_FAILURE"
    };
  }
}

async function probeActivepieces(token, fetchFn) {
  let status = null;
  try {
    const response = await fetchFn("https://cloud.activepieces.com/api/v1/projects?limit=1&types=PERSONAL", {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`
      }
    });
    status = response.status;
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    const authenticated = response.ok;
    const responseShapeValid = authenticated && Array.isArray(body?.data);
    return {
      ok: responseShapeValid,
      status,
      credential_valid: response.ok ? true : response.status === 401 ? false : null,
      authenticated,
      api_accessible: responseShapeValid,
      error: response.ok && !responseShapeValid ? "UNKNOWN_PROVIDER_FAILURE" : response.ok ? null : safeFailure(response.status)
    };
  } catch {
    return {
      ok: false,
      status,
      credential_valid: null,
      authenticated: false,
      api_accessible: false,
      error: "RUNTIME_NETWORK_FAILURE"
    };
  }
}

function baseResult(providerId, credentialRef, credentialPresent) {
  return {
    runtime: "riosystems-staging",
    worker_reached: true,
    provider_id: providerId,
    credential_ref: credentialRef,
    credential_present: credentialPresent,
    secret_value_exposed: false,
    provider_writes: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    variable_cost_eur: 0
  };
}

export async function handleFinalProviderConnectionDiagnostic(request, env = {}, options = {}) {
  const url = new URL(request.url);
  const isWebflow = url.pathname === "/factory/diagnostics/webflow-connection";
  const isActivepieces = url.pathname === "/factory/diagnostics/activepieces-connection";
  if (!isWebflow && !isActivepieces) return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (!isStaging(env)) return json({ ok: false, error: "STAGING_ONLY_EXTERNAL_WRITES_OFF_REQUIRED", production_deploy: false, provider_writes: 0 }, 403);

  const presence = finalProviderPresenceManifest(env);
  const provider = isWebflow ? presence.webflow : presence.activepieces;
  const verify = String(url.searchParams.get("verify") || "").toLowerCase();

  if (!verify) {
    return json({
      ok: provider.credential_present,
      service: isWebflow ? "aurentara-webflow-connection-presence-v1" : "aurentara-activepieces-connection-presence-v1",
      ...baseResult(provider.provider_id, provider.credential_ref, provider.credential_present),
      provider_requests: 0
    });
  }

  const expectedMode = isWebflow ? "sites" : "projects";
  if (verify !== expectedMode) return json({ ok: false, error: "UNSUPPORTED_VERIFICATION_MODE" }, 400);

  if (!provider.credential_present) {
    return json({
      ok: false,
      service: isWebflow ? "aurentara-webflow-readonly-connection-v1" : "aurentara-activepieces-readonly-connection-v1",
      ...baseResult(provider.provider_id, provider.credential_ref, false),
      credential_valid: null,
      authenticated: false,
      connected_staging: false,
      provider_requests: 0,
      error: isWebflow ? "WEBFLOW_SITE_TOKEN_NOT_CONFIGURED" : "ACTIVEPIECES_API_KEY_NOT_CONFIGURED"
    });
  }

  const fetchFn = typeof options.fetch === "function" ? options.fetch : fetch;
  if (isWebflow) {
    const result = await probeWebflow(env.WEBFLOW_SITE_TOKEN, fetchFn);
    return json({
      ok: result.ok,
      service: "aurentara-webflow-readonly-connection-v1",
      schema: "aurentara.webflow-readonly-connection.v1",
      ...baseResult("webflow-api", "env://WEBFLOW_SITE_TOKEN", true),
      credential_valid: result.credential_valid,
      authenticated: result.authenticated,
      site_accessible: result.site_accessible,
      site_metadata_read: result.site_metadata_read,
      connected_staging: result.ok,
      verification_method: "GET /v2/sites",
      provider_requests: 1,
      staging_write_verified: false,
      publish_verified: false,
      publish_performed: false,
      error: result.error
    });
  }

  const result = await probeActivepieces(env.ACTIVEPIECES_API_KEY, fetchFn);
  return json({
    ok: result.ok,
    service: "aurentara-activepieces-readonly-connection-v1",
    schema: "aurentara.activepieces-readonly-connection.v1",
    ...baseResult("activepieces-cloud-free", "env://ACTIVEPIECES_API_KEY", true),
    credential_valid: result.credential_valid,
    authenticated: result.authenticated,
    api_accessible: result.api_accessible,
    connected_staging: result.ok,
    verification_method: "GET /api/v1/projects?limit=1&types=PERSONAL",
    provider_requests: 1,
    flow_execution_performed: false,
    error: result.error
  });
}
