import { connect as connectFramer } from "framer-api";

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

export function framerConnectionPresenceManifest(env = {}) {
  const staging = isStaging(env);
  return Object.freeze({
    schema: "aurentara.framer-connection-presence.v1",
    provider_id: "framer-server-api",
    runtime: staging ? "riosystems-staging" : "non-staging",
    project_ref: "env://FRAMER_PROJECT_URL",
    credential_ref: "env://FRAMER_API_KEY",
    project_binding_present: staging && Boolean(env.FRAMER_PROJECT_URL),
    credential_present: staging && Boolean(env.FRAMER_API_KEY),
    secret_value_exposed: false,
    provider_request_performed: false,
    provider_writes: 0,
    publish_performed: false,
    deploy_performed: false,
    production_deploy: false,
    real_customer_data: false,
    variable_cost_eur: 0
  });
}

async function probeFramerProject(projectUrl, apiKey, connectFn = connectFramer) {
  let framer = null;
  let projectMetadataRead = false;
  let disconnectCompleted = false;

  try {
    framer = await connectFn(projectUrl, apiKey);
    const projectInfo = await framer.getProjectInfo();
    projectMetadataRead = Boolean(projectInfo && typeof projectInfo === "object");
  } catch {
    // Deliberately do not surface raw SDK errors because they may contain sensitive context.
  } finally {
    if (framer && typeof framer.disconnect === "function") {
      try {
        await framer.disconnect();
        disconnectCompleted = true;
      } catch {
        disconnectCompleted = false;
      }
    }
  }

  return {
    ok: projectMetadataRead && disconnectCompleted,
    project_metadata_read: projectMetadataRead,
    disconnect_completed: disconnectCompleted
  };
}

export async function handleFramerConnectionDiagnostic(request, env = {}, options = {}) {
  const url = new URL(request.url);
  if (url.pathname !== "/factory/diagnostics/framer-connection") return null;
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isAuthorized(request, env)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
  if (!isStaging(env)) {
    return json({
      ok: false,
      error: "STAGING_ONLY_EXTERNAL_WRITES_OFF_REQUIRED",
      production_deploy: false,
      provider_writes: 0
    }, 403);
  }

  const presence = framerConnectionPresenceManifest(env);
  const verify = String(url.searchParams.get("verify") || "").toLowerCase();

  if (!verify) {
    return json({
      ok: presence.project_binding_present && presence.credential_present,
      service: "aurentara-framer-connection-presence-v1",
      ...presence
    }, 200);
  }

  if (verify !== "project-info") {
    return json({ ok: false, error: "UNSUPPORTED_VERIFICATION_MODE" }, 400);
  }

  if (!presence.project_binding_present || !presence.credential_present) {
    return json({
      ok: false,
      service: "aurentara-framer-readonly-connection-v1",
      schema: "aurentara.framer-readonly-connection.v1",
      provider_id: "framer-server-api",
      runtime: "riosystems-staging",
      project_ref: "env://FRAMER_PROJECT_URL",
      credential_ref: "env://FRAMER_API_KEY",
      project_binding_present: presence.project_binding_present,
      credential_present: presence.credential_present,
      credential_valid: null,
      authenticated: false,
      project_accessible: false,
      project_metadata_read: false,
      connected_staging: false,
      disconnect_completed: false,
      verification_method: "getProjectInfo",
      provider_requests: 0,
      provider_writes: 0,
      publish_performed: false,
      deploy_performed: false,
      secret_value_exposed: false,
      production_deploy: false,
      real_customer_data: false,
      variable_cost_eur: 0,
      error: presence.project_binding_present ? "FRAMER_API_KEY_NOT_CONFIGURED" : "FRAMER_PROJECT_URL_NOT_CONFIGURED"
    }, 200);
  }

  const result = await probeFramerProject(
    env.FRAMER_PROJECT_URL,
    env.FRAMER_API_KEY,
    typeof options.connect === "function" ? options.connect : connectFramer
  );

  return json({
    ok: result.ok,
    service: "aurentara-framer-readonly-connection-v1",
    schema: "aurentara.framer-readonly-connection.v1",
    provider_id: "framer-server-api",
    runtime: "riosystems-staging",
    project_ref: "env://FRAMER_PROJECT_URL",
    credential_ref: "env://FRAMER_API_KEY",
    project_binding_present: true,
    credential_present: true,
    credential_valid: result.project_metadata_read ? true : null,
    authenticated: result.project_metadata_read,
    project_accessible: result.project_metadata_read,
    project_metadata_read: result.project_metadata_read,
    connected_staging: result.ok,
    disconnect_completed: result.disconnect_completed,
    connection_method: "framer-server-api",
    verification_method: "getProjectInfo",
    provider_requests: 1,
    provider_writes: 0,
    staging_write_verified: false,
    publish_verified: false,
    publish_performed: false,
    deploy_performed: false,
    secret_value_exposed: false,
    production_deploy: false,
    real_customer_data: false,
    variable_cost_eur: 0,
    framer_agent_codex_path: "UNCHANGED",
    error: result.ok ? null : "FRAMER_READONLY_CONNECTION_VERIFICATION_FAILED"
  }, 200);
}
