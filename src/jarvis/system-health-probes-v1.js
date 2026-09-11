/* JARVIS — system health probe adapters V1.

   Genuine liveness probes for HERMES / JARVIS / ASTRA / CLAUDE / CODEX / BRIDGE.
   (GIT uses the dedicated git-remote-truth resolver.)

   Rules:
     - A probe returns a live state ONLY on a genuine 2xx from a real endpoint
       (or, for JARVIS, a genuine successful dependency call).
     - No endpoint / config only  -> the probe function is simply absent
       -> the domain stays UNKNOWN. Config presence is NEVER liveness.
     - Non-2xx, timeout, network error, unparseable body -> `null` -> UNKNOWN.
     - Read-only GET. Bounded by an AbortController timeout.
     - Returns the probe-envelope the Command Center adapter expects:
       { live: true, state, source_id, observed_at, stale_after_ms? }. */

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_STALE_MS = 60000;

const DOMAIN_STATES = Object.freeze({
  JARVIS: ['ONLINE', 'DEGRADED'],
  HERMES: ['ONLINE', 'OFFLINE'],
  ASTRA: ['AVAILABLE', 'DEGRADED'],
  CLAUDE: ['AVAILABLE', 'BUSY', 'UNAVAILABLE'],
  CODEX: ['STANDBY', 'ACTIVE', 'UNAVAILABLE'],
  BRIDGE: ['HEALTHY', 'DEGRADED', 'OFFLINE']
});

// Only a genuine, healthy 2xx maps to the "good" state; anything else -> null.
const HEALTHY_STATE = Object.freeze({
  JARVIS: 'ONLINE', HERMES: 'ONLINE', ASTRA: 'AVAILABLE',
  CLAUDE: 'AVAILABLE', CODEX: 'STANDBY', BRIDGE: 'HEALTHY'
});

function nowIso(clock) {
  try { return new Date(typeof clock === 'function' ? clock() : Date.now()).toISOString(); }
  catch { return new Date().toISOString(); }
}

/** HTTP health probe. `url` MUST be a real health endpoint. If `state_from` is a
 *  function it may narrow the state from the parsed JSON body, but only within
 *  the domain's allowed non-UNKNOWN states; an invalid mapping -> null. */
export function createHttpHealthProbeV1(config = {}) {
  const domain = clean(config.domain, 20).toUpperCase();
  const url = clean(config.url, 2000);
  const fetchImpl = typeof config.fetch_impl === 'function' ? config.fetch_impl : globalThis.fetch;
  const timeoutMs = Number.isFinite(Number(config.timeout_ms)) && Number(config.timeout_ms) > 0
    ? Math.min(20000, Math.round(Number(config.timeout_ms))) : DEFAULT_TIMEOUT_MS;
  const staleMs = Number.isFinite(Number(config.stale_after_ms)) && Number(config.stale_after_ms) >= 0
    ? Math.round(Number(config.stale_after_ms)) : DEFAULT_STALE_MS;
  const stateFrom = typeof config.state_from === 'function' ? config.state_from : null;
  const sourceId = clean(config.source_id, 200) || `jarvis-health-probe:${domain.toLowerCase()}`;

  if (!DOMAIN_STATES[domain] || !/^https:\/\//i.test(url) || typeof fetchImpl !== 'function') {
    return null; // not a genuine endpoint -> no probe -> UNKNOWN
  }

  const probe = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, { method: 'GET', signal: controller.signal, headers: { accept: 'application/json' } });
    } catch {
      clearTimeout(timer);
      return null; // network / timeout -> UNKNOWN
    }
    clearTimeout(timer);
    if (!response.ok) return null; // non-2xx -> UNKNOWN, never "degraded-from-nothing"

    let body = null;
    try { const text = await response.text(); body = text ? JSON.parse(text) : {}; } catch { body = {}; }

    let state = HEALTHY_STATE[domain];
    if (stateFrom) {
      const narrowed = clean(stateFrom(body, response), 40).toUpperCase();
      if (!DOMAIN_STATES[domain].includes(narrowed)) return null; // bad mapping -> UNKNOWN
      state = narrowed;
    }
    return { live: true, state, source_id: sourceId, observed_at: nowIso(config.clock), stale_after_ms: staleMs };
  };
  probe.domain = domain;
  probe.source_id = sourceId;
  return probe;
}

/** JARVIS self-probe: genuine because it exercises the durable memory store the
 *  runtime depends on. Store reachable -> ONLINE; store present but erroring ->
 *  DEGRADED; no store -> null (UNKNOWN). Never a static claim. */
export function createJarvisSelfProbeV1(config = {}) {
  const store = config.store;
  const ownerId = clean(config.owner_id, 80);
  const ownerRef = clean(config.owner_ref, 320);
  if (!store || typeof store.readAudit !== 'function' || !ownerId || !ownerRef) return null;

  const probe = async () => {
    try {
      await store.readAudit({ owner_id: ownerId, owner_ref: ownerRef, limit: 1 });
      return { live: true, state: 'ONLINE', source_id: 'jarvis-self-probe:memory-store', observed_at: nowIso(config.clock), stale_after_ms: DEFAULT_STALE_MS };
    } catch {
      return { live: true, state: 'DEGRADED', source_id: 'jarvis-self-probe:memory-store', observed_at: nowIso(config.clock), stale_after_ms: DEFAULT_STALE_MS };
    }
  };
  probe.domain = 'JARVIS';
  return probe;
}

/** Build the { jarvis, hermes, astra, claude, codex, bridge } probe map from env
 *  health URLs. Absent URL -> no probe for that domain -> it stays UNKNOWN. */
export function createJarvisSystemHealthProbesFromEnvV1(env = {}, options = {}) {
  const fetchImpl = options.fetch_impl || globalThis.fetch;
  const clock = options.clock;
  const timeout = Number(env.JARVIS_HEALTH_TIMEOUT_MS) || undefined;
  const mk = (domain, url) => createHttpHealthProbeV1({ domain, url: clean(url, 2000), fetch_impl: fetchImpl, clock, timeout_ms: timeout });

  const probes = {};
  // The JARVIS self-probe (a genuine memory-store dependency check) is opt-in so
  // the default runtime-truth response stays fail-closed to UNKNOWN.
  const selfProbeEnabled = options.enable_self_probe === true || clean(env.JARVIS_SELF_PROBE, 10).toLowerCase() === 'on';
  const jarvisSelf = selfProbeEnabled
    ? createJarvisSelfProbeV1({ store: options.store, owner_id: options.owner_id, owner_ref: options.owner_ref, clock })
    : null;
  const jarvisHttp = mk('JARVIS', env.JARVIS_HEALTH_URL);
  if (jarvisSelf || jarvisHttp) probes.jarvis = jarvisSelf || jarvisHttp;

  const hermes = mk('HERMES', env.HERMES_HEALTH_URL);
  if (hermes) probes.hermes = hermes;
  const astra = mk('ASTRA', env.ASTRA_HEALTH_URL);
  if (astra) probes.astra = astra;
  const claude = mk('CLAUDE', env.CLAUDE_HEALTH_URL || env.CLAUDE_CODE_HEALTH_URL);
  if (claude) probes.claude = claude;
  const codex = mk('CODEX', env.CODEX_HEALTH_URL);
  if (codex) probes.codex = codex;
  const bridge = mk('BRIDGE', env.BRIDGE_HEALTH_URL);
  if (bridge) probes.bridge = bridge;

  return probes;
}

export function jarvisSystemHealthProbesManifestV1() {
  return {
    schema: 'aurentara.jarvis.system-health-probes.v1',
    domains: Object.keys(DOMAIN_STATES),
    method: 'GET',
    read_only: true,
    config_presence_implies_liveness: false,
    non_2xx_result: 'UNKNOWN',
    timeout_result: 'UNKNOWN',
    timeout_ms_default: DEFAULT_TIMEOUT_MS,
    jarvis_self_probe: 'exercises the durable memory store (not a static claim)',
    production_deploy: false,
    hamyren_data_flow: false
  };
}
