const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const TELEMETRY_EVENT = "riosystems_factory_operation";
const TELEMETRY_VERSION = "1";

const TRACKED_FACTORY_ROUTES = new Map([
  ["/factory/plan", "plan"],
  ["/factory/generate/run", "generate_run"],
  ["/factory/rebuild/run", "rebuild_run"],
  ["/factory/evolve/apply", "evolve_apply"],
  ["/factory/materialize", "materialize"]
]);

function normalizeHost(value) {
  const raw = String(value || DEFAULT_POSTHOG_HOST).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_POSTHOG_HOST;
}

export function telemetryConfiguration(env = {}) {
  const enabled = String(env.POSTHOG_TELEMETRY_ENABLED || "").toLowerCase() === "true";
  const tokenConfigured = typeof env.POSTHOG_PROJECT_TOKEN === "string" && env.POSTHOG_PROJECT_TOKEN.trim().length > 0;

  return {
    enabled: enabled && tokenConfigured,
    requested: enabled,
    token_configured: tokenConfigured,
    host: normalizeHost(env.POSTHOG_HOST)
  };
}

export function factoryTelemetryDescriptor(request, response, env = {}) {
  const config = telemetryConfiguration(env);
  if (!config.enabled) return null;
  if (!request || request.method !== "POST") return null;

  const url = new URL(request.url);
  const operation = TRACKED_FACTORY_ROUTES.get(url.pathname);
  if (!operation) return null;

  const statusCode = Number(response?.status || 0);
  const outcome = statusCode >= 200 && statusCode < 400 ? "success" : "failure";

  return {
    endpoint: `${config.host}/i/v0/e/`,
    payload: {
      api_key: env.POSTHOG_PROJECT_TOKEN,
      event: TELEMETRY_EVENT,
      distinct_id: "riosystems-control-plane",
      properties: {
        $process_person_profile: false,
        operation,
        route: url.pathname,
        method: "POST",
        status_code: statusCode,
        outcome,
        environment: String(env.RIOSYSTEMS_ENV || "unknown").slice(0, 40),
        source: "cloudflare-worker",
        telemetry_version: TELEMETRY_VERSION
      }
    }
  };
}

export async function captureFactoryTelemetry(request, response, env = {}, fetchImpl = fetch) {
  const descriptor = factoryTelemetryDescriptor(request, response, env);
  if (!descriptor) return { sent: false, reason: "disabled_or_untracked" };

  try {
    const ingestionResponse = await fetchImpl(descriptor.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(descriptor.payload)
    });

    if (!ingestionResponse.ok) {
      return { sent: false, reason: "ingestion_rejected", status: ingestionResponse.status };
    }

    return { sent: true, status: ingestionResponse.status };
  } catch {
    return { sent: false, reason: "transport_error" };
  }
}

export function scheduleFactoryTelemetry(request, response, env = {}, ctx = {}) {
  const descriptor = factoryTelemetryDescriptor(request, response, env);
  if (!descriptor) return false;

  const task = captureFactoryTelemetry(request, response, env);
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(task);
  } else {
    task.catch(() => {});
  }
  return true;
}

export const posthogTelemetryContract = Object.freeze({
  event: TELEMETRY_EVENT,
  tracked_routes: Object.fromEntries(TRACKED_FACTORY_ROUTES),
  sensitive_fields_collected: false,
  person_profiles_created: false,
  default_host: DEFAULT_POSTHOG_HOST
});
