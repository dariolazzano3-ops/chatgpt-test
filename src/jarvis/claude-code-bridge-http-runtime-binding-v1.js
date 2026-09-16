/* JARVIS — Bridge HTTP runtime binding V1.

   The sibling of claude-code-repo-bound-runtime-binding-v1.js, for the
   EXISTING private Bridge HTTP service instead of a local `claude` CLI.
   Node-only; DELIBERATELY never imported by http-v1.js, standalone-worker-
   v1.js, pages-worker-v1.js, or any other module bundled into the deployed
   Worker — same import-direction rule as every other Node-only V2 module
   (this file uses real network fetch calls to a private, non-public
   endpoint, which only makes sense next to an operator's own runtime).

   Bound only when ALL of these are true:
     - env.JARVIS_BRIDGE_HTTP_EXECUTION === 'on' (explicit opt-in; default
       OFF — never activated by merely being configured);
     - env.JARVIS_BRIDGE_URL and env.JARVIS_BRIDGE_TOKEN are both set
       (no default URL, no default token — an operator must name the real
       private Bridge on purpose; the token is read from server-side env
       only, never a request/task value);
     - a real GET <url>/health preflight succeeds (bounded timeout) — a
       Bridge that cannot even answer /health is never reported as bound,
       exactly like the local CLI preflight this replaces. */

import { createJarvisClaudeCodeBridgeV1 } from './claude-code-bridge-v1.js';
import { createJarvisBridgeHttpExecutorV1 } from './claude-code-bridge-http-executor-v1.js';

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
export const BRIDGE_SERVER_WORKER_TIMEOUT_MS = 900000; // verified Bridge V5 bridge.py subprocess.run timeout
export const BRIDGE_HTTP_MIN_TIMEOUT_MS = 930000; // client must outlive the server worker deadline
export const BRIDGE_HTTP_DEFAULT_TIMEOUT_MS = 930000;
export const BRIDGE_HTTP_MAX_TIMEOUT_MS = 960000; // matches the durable Claude bridge cap

export function resolveBridgeHttpTimeoutMsV1(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return BRIDGE_HTTP_DEFAULT_TIMEOUT_MS;
  return Math.min(BRIDGE_HTTP_MAX_TIMEOUT_MS, Math.max(BRIDGE_HTTP_MIN_TIMEOUT_MS, Math.trunc(n)));
}
const DEFAULT_HEALTH_TIMEOUT_MS = 5000;
const DEFAULT_PROJECT = 'chatgpt-test';

export const JARVIS_BRIDGE_HTTP_EXECUTION_FLAG = 'JARVIS_BRIDGE_HTTP_EXECUTION';
export const JARVIS_BRIDGE_URL_ENV = 'JARVIS_BRIDGE_URL';
export const JARVIS_BRIDGE_TOKEN_ENV = 'JARVIS_BRIDGE_TOKEN';

function isEnabled(env = {}) {
  return clean(env[JARVIS_BRIDGE_HTTP_EXECUTION_FLAG], 10).toLowerCase() === 'on';
}

/** GET `${url}/health`, bounded timeout, never throws past this function.
 *  Returns { ok, reason }. A non-2xx, malformed-JSON, or non-`ok:true`
 *  health body is treated as unavailable — never optimistically assumed
 *  healthy from a mere connection success. */
export async function preflightJarvisBridgeHttpV1(url, options = {}) {
  const fetchImpl = typeof options.fetch_impl === 'function' ? options.fetch_impl : globalThis.fetch;
  const timeoutMs = Number(options.timeout_ms) > 0 ? Number(options.timeout_ms) : DEFAULT_HEALTH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${url}/health`, { method: 'GET', signal: controller.signal });
    if (!response.ok) return { ok: false, reason: `BRIDGE_HEALTH_HTTP_${response.status}` };
    let body;
    try { body = await response.json(); } catch { return { ok: false, reason: 'BRIDGE_HEALTH_RESPONSE_NOT_JSON' }; }
    if (!body || body.ok !== true) return { ok: false, reason: 'BRIDGE_HEALTH_NOT_OK' };
    return { ok: true, reason: null, service: clean(body.service, 200), version: body.version ?? null };
  } catch (error) {
    return { ok: false, reason: 'BRIDGE_HEALTH_UNREACHABLE: ' + clean(error?.message || error, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves { bridge, bound, requested, reason }. Never fabricates `bound`:
 *  when execution is requested but the URL/token are missing or the health
 *  preflight fails, `bound` stays false and the caller (the remote operator
 *  launcher) fails startup closed rather than simulating availability —
 *  same contract createJarvisClaudeRepoBoundRuntimeBindingV1 already
 *  established for the local-CLI path this replaces. There is no fallback
 *  to a local CLI anywhere in this file. */
export async function createJarvisBridgeHttpRuntimeBindingV1(env = {}, options = {}) {
  if (!isEnabled(env)) {
    return { bridge: null, bound: false, requested: false, reason: 'JARVIS_BRIDGE_HTTP_EXECUTION_DISABLED' };
  }

  const bridgeUrl = clean(env[JARVIS_BRIDGE_URL_ENV], 400) || clean(options.bridge_url, 400);
  if (!bridgeUrl) {
    return { bridge: null, bound: false, requested: true, reason: 'JARVIS_BRIDGE_URL_REQUIRED' };
  }
  const bridgeToken = typeof env[JARVIS_BRIDGE_TOKEN_ENV] === 'string' && env[JARVIS_BRIDGE_TOKEN_ENV]
    ? env[JARVIS_BRIDGE_TOKEN_ENV]
    : (typeof options.bridge_token === 'string' ? options.bridge_token : '');
  if (!bridgeToken) {
    return { bridge: null, bound: false, requested: true, reason: 'JARVIS_BRIDGE_TOKEN_REQUIRED' };
  }
  const project = clean(env.JARVIS_BRIDGE_PROJECT, 200) || clean(options.project, 200) || DEFAULT_PROJECT;

  const preflight = options.skip_health_preflight
    ? { ok: true }
    : await preflightJarvisBridgeHttpV1(bridgeUrl, { fetch_impl: options.fetch_impl, timeout_ms: options.health_timeout_ms });
  if (!preflight.ok) {
    return { bridge: null, bound: false, requested: true, reason: 'BRIDGE_UNAVAILABLE: ' + preflight.reason };
  }

  // Optional, but always present in real remote-operator usage: the same
  // JARVIS_CLAUDE_REPO_DIR the runtime already resolves real branch truth
  // from. Passed through so the executor can compute canonical
  // repo-bound-verification-v1.js evidence (branch/files_changed/
  // syntax_check) itself — see that executor's own file header. An
  // invalid/missing repo_dir here degrades to an empty/unproven
  // verification (handled fail-closed by the acceptance path that reads
  // it), never a crash.
  const repoDir = clean(env.JARVIS_CLAUDE_REPO_DIR, 400) || clean(options.repo_dir, 400) || null;

  let executor;
  try {
    executor = createJarvisBridgeHttpExecutorV1({
      bridge_url: bridgeUrl,
      bridge_token: bridgeToken,
      project,
      repo_dir: repoDir,
      fetch_impl: options.fetch_impl
    });
  } catch (error) {
    return { bridge: null, bound: false, requested: true, reason: clean(error?.message || error, 200) };
  }

  const bridge = createJarvisClaudeCodeBridgeV1({
    executor,
    timeout_ms: resolveBridgeHttpTimeoutMsV1(env.JARVIS_BRIDGE_TIMEOUT_MS || options.timeout_ms)
  });
  return { bridge, bound: true, requested: true, reason: null };
}

export function jarvisBridgeHttpRuntimeBindingManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-bridge-http-runtime-binding.v1',
    activation_flag: JARVIS_BRIDGE_HTTP_EXECUTION_FLAG,
    url_env: JARVIS_BRIDGE_URL_ENV,
    token_env: JARVIS_BRIDGE_TOKEN_ENV,
    repo_dir_env: 'JARVIS_CLAUDE_REPO_DIR',
    canonical_verification_wired: true,
    default: 'off',
    url_has_default: false,
    token_has_default: false,
    health_preflight_required: true,
    imported_by_deployed_worker: false,
    fail_closed_when_disabled: true,
    fail_closed_when_url_missing: true,
    fail_closed_when_token_missing: true,
    fail_closed_when_health_check_fails: true,
    local_cli_fallback: false,
    bridge_server_worker_timeout_ms: BRIDGE_SERVER_WORKER_TIMEOUT_MS,
    minimum_timeout_ms: BRIDGE_HTTP_MIN_TIMEOUT_MS,
    default_timeout_ms: BRIDGE_HTTP_DEFAULT_TIMEOUT_MS,
    maximum_timeout_ms: BRIDGE_HTTP_MAX_TIMEOUT_MS,
    configured_timeout_cannot_preempt_server_worker: BRIDGE_HTTP_MIN_TIMEOUT_MS > BRIDGE_SERVER_WORKER_TIMEOUT_MS,
    client_timeout_exceeds_server_worker_timeout: BRIDGE_HTTP_DEFAULT_TIMEOUT_MS > BRIDGE_SERVER_WORKER_TIMEOUT_MS,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
