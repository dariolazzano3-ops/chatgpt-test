#!/usr/bin/env node
/* JARVIS — Private Remote Operator Runtime V1.

   The 24/7 sibling of local-operator-server-v1.js, meant to run unattended
   on the operator's own private VPS and be reached ONLY through the
   existing JARVIS Cloudflare Access path (a dedicated Access application +
   audience in front of this process — a Cloudflare Tunnel / private
   reverse proxy to JARVIS_REMOTE_OPERATOR_BIND_HOST, never a directly
   internet-exposed port). It exists because the accepted V2 Program
   Controller needs real Node `git` access (branch-manager-v1.js) and a
   real repo-bound Claude Code worker — neither of which a Cloudflare Worker
   (pages-worker-v1.js / standalone-worker-v1.js as deployed) can provide,
   since Workers have no filesystem or child_process.

   Execution is bound through claude-code-bridge-http-runtime-binding-v1.js
   / claude-code-bridge-http-executor-v1.js: the ONE implementation-worker
   path, delegating to the EXISTING private jarvis-claude Bridge service
   (POST /v1/run) over a private HTTP interface instead of spawning a local
   `claude` CLI process. There is no local-CLI fallback anywhere in this
   file — a Bridge that is unavailable at startup fails startup closed.

   This file is DELIBERATELY independent of local-operator-server-v1.js: it
   never imports it, never references LOCAL_OPERATOR_AUTH, and defines no
   local-identity auth path of its own. It leaves `options.authorize`
   unset, so the standard runtime (http-v1.js's authSession ->
   authorizeJarvisV1 in access-v1.js) runs its real, unmodified default
   path: verify a Cloudflare Access JWT (access-jwt-v1.js,
   RS256/issuer/audience/expiry/signature all checked against the team's
   real JWKS) against env.JARVIS_ACCESS_AUD + env.JARVIS_ACCESS_TEAM_DOMAIN,
   then require the verified email to match env.JARVIS_OPERATOR_EMAIL. A
   request with no valid Access JWT never reaches anything else — there is
   no LOCAL_OPERATOR_AUTH import for it to fall back to even by mistake.

   env.JARVIS_ACCESS_AUD here MUST be a dedicated audience, distinct from
   any other Access application (the Pages Command Center, any business
   surface) — this file does not enforce that distinctness (it cannot see
   other Access apps' config), it is an operator/Cloudflare-dashboard
   responsibility documented in docs/JARVIS_PRIVATE_OPERATOR_RUNTIME_V1.md.

   Like the local operator, this is Node-only (node:http,
   node:child_process, process.env) and is never imported by
   pages-worker-v1.js, standalone-worker-v1.js, or any other module bundled
   into a deployed Cloudflare Worker. It only ever imports from the
   cloud-safe runtime (standalone-worker-v1.js / http-v1.js) and from the
   Node-only Bridge HTTP binding — never the disposable-tmp local binding
   (claude-code-local-runtime-binding-v1.js) nor the local-CLI repo-bound
   binding (claude-code-repo-bound-runtime-binding-v1.js), neither of which
   this file imports at all: the remote runtime offers exactly one
   execution mode, the private Bridge HTTP one, never a local CLI. */

import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { handleJarvisStandaloneWorkerV1 } from './standalone-worker-v1.js';
import { resolveJarvisMemoryStoreV1 } from './http-v1.js';
import { handleJarvisProgramTickRuntimeV1, handleJarvisProgramStateRuntimeV1 } from './program-controller-v1.js';
import { createJarvisBridgeHttpRuntimeBindingV1 } from './claude-code-bridge-http-runtime-binding-v1.js';
import { createJarvisSessionV1 } from './session-v1.js';
import { createJarvisProgramRunnerV1, clampJarvisProgramRunnerIntervalMsV1 } from './program-runner-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const isOn = (value) => ['true', '1', 'on', 'yes'].includes(clean(value, 20).toLowerCase());

export const JARVIS_REMOTE_OPERATOR_DEFAULT_PORT = 8788;
export const JARVIS_REMOTE_OPERATOR_BIND_HOST = '127.0.0.1'; // never 0.0.0.0 — reach it via a private tunnel/reverse proxy in front, terminating Cloudflare Access
export const REMOTE_OPERATOR_AUTHENTICATION_LABEL = 'CLOUDFLARE_ACCESS_JWT';

const REQUIRED_SUPABASE_ENV_KEYS = [
  'JARVIS_PERSONAL_MEMORY_SUPABASE_URL',
  'JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY'
];
const REQUIRED_ACCESS_ENV_KEYS = ['JARVIS_ACCESS_AUD', 'JARVIS_ACCESS_TEAM_DOMAIN', 'JARVIS_OPERATOR_EMAIL'];


export function resolveJarvisRemoteOperatorProgramRunnerConfigV1(env = process.env) {
  const capabilityEnabled = isOn(env.JARVIS_PROGRAM_RUNNER_ENABLED);
  return {
    capability_enabled: capabilityEnabled,
    auto_start: capabilityEnabled && isOn(env.JARVIS_PROGRAM_RUNNER_AUTO_START),
    interval_ms: clampJarvisProgramRunnerIntervalMsV1(env.JARVIS_PROGRAM_RUNNER_INTERVAL_MS),
    max_ticks: env.JARVIS_PROGRAM_RUNNER_MAX_TICKS
  };
}

/* ── 1. safety flags — refuse to start if any hard constitutional line is crossed ── */

export function verifyJarvisRemoteOperatorSafetyFlagsV1(env = process.env) {
  if (isOn(env.JARVIS_PUBLIC_ACCESS)) {
    return { ok: false, error: 'JARVIS_REMOTE_OPERATOR_PUBLIC_ACCESS_FORBIDDEN', message: 'JARVIS_PUBLIC_ACCESS must stay false for this runtime.' };
  }
  if (isOn(env.JARVIS_PRODUCTION_DEPLOY)) {
    return { ok: false, error: 'JARVIS_REMOTE_OPERATOR_PRODUCTION_DEPLOY_FORBIDDEN', message: 'JARVIS_PRODUCTION_DEPLOY must stay false for this runtime.' };
  }
  return { ok: true };
}

/* ── 2. Cloudflare Access — required at startup, not merely at request time ── */

/** Fails closed if the dedicated Access audience/team/operator-email are not
 *  configured. This does not itself verify a JWT (that happens per-request,
 *  for real, inside authorizeJarvisV1) — it only refuses to even start
 *  serving if the enforcement it depends on could not possibly be
 *  configured. There is no bypass: this runtime never sets
 *  `options.authorize` to anything of its own. */
export function verifyJarvisRemoteOperatorAccessConfigV1(env = process.env) {
  const missing = REQUIRED_ACCESS_ENV_KEYS.filter((key) => !clean(env[key], 4000));
  if (missing.length) {
    return {
      ok: false,
      error: 'JARVIS_REMOTE_OPERATOR_ACCESS_CONFIG_MISSING',
      missing,
      message: `Missing required Cloudflare Access env var(s): ${missing.join(', ')}. `
        + 'This runtime refuses to start without real Access enforcement configured — '
        + 'it has no unauthenticated or locally-authenticated fallback.'
    };
  }
  return { ok: true };
}

/* ── 2b. canonical owner namespace — optional, server-side config ONLY ── */

/** JARVIS_CANONICAL_OWNER_EMAIL lets this runtime persist under a durable
 *  JARVIS owner scope that pre-dates this remote runtime's own Cloudflare
 *  Access identity (e.g. the historical `local-operator@localhost` scope
 *  the accepted V2 rollout history already lives under in Supabase) without
 *  weakening authentication in any way: the real Cloudflare Access identity
 *  still must verify first (see authorizeJarvisV1), and this value is never
 *  read from the request — only from process env at startup, then frozen
 *  into the fixed `options` object every request reuses (see
 *  buildJarvisRemoteOperatorOptionsV1 / createJarvisRemoteOperatorServerV1).
 *  There is no seam here a client header, query string, or cookie could
 *  ever reach. Absent (the default): owner scope stays exactly the real
 *  authenticated identity, unchanged from today's behavior. Present but
 *  malformed: fails startup closed rather than silently falling back to the
 *  real identity or to some guessed default. */
export function verifyJarvisRemoteOperatorCanonicalOwnerConfigV1(env = process.env) {
  const raw = clean(env.JARVIS_CANONICAL_OWNER_EMAIL, 320);
  if (!raw) return { ok: true, canonical_owner_email: '' };
  const email = raw.toLowerCase();
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    return {
      ok: false,
      error: 'JARVIS_REMOTE_OPERATOR_CANONICAL_OWNER_EMAIL_INVALID',
      message: 'JARVIS_CANONICAL_OWNER_EMAIL is set but is not a valid email address.'
    };
  }
  return { ok: true, canonical_owner_email: email };
}

/* ── 3. Supabase RPC — same fail-closed rule as the local operator, checked independently ── */

/** Requires the service-role-only RPC gateway (memory-store-supabase-rpc-v1.js),
 *  never the legacy direct-table store — same reasoning as the local
 *  operator's equivalent gate: the legacy store needs jarvis_private
 *  exposed in PostgREST, which this project deliberately never does. This
 *  file intentionally re-states the check (rather than importing it from
 *  local-operator-server-v1.js) so the two entrypoints stay fully
 *  independent, per this runtime's own contract. */
export function verifyJarvisRemoteOperatorSupabaseConfigV1(env = process.env) {
  const mode = clean(env.JARVIS_PERSONAL_MEMORY_STORE, 80).toLowerCase();
  if (mode !== 'supabase-rpc') {
    return {
      ok: false,
      error: 'JARVIS_REMOTE_OPERATOR_SUPABASE_RPC_MODE_REQUIRED',
      message: 'Set JARVIS_PERSONAL_MEMORY_STORE=supabase-rpc. The legacy "supabase" mode is refused here, '
        + 'same as the local operator, since it would require exposing jarvis_private in PostgREST.'
    };
  }
  const missing = REQUIRED_SUPABASE_ENV_KEYS.filter((key) => !clean(env[key], 4000));
  if (missing.length) {
    return { ok: false, error: 'JARVIS_REMOTE_OPERATOR_SUPABASE_ENV_MISSING', missing, message: `Missing required Supabase env var(s): ${missing.join(', ')}.` };
  }
  return { ok: true };
}

/* ── 4. repo truth — required here (unlike the local operator, where it is optional) ── */

/** Unlike resolveJarvisLocalOperatorProgramLocationV1 (which renders "nicht
 *  konfiguriert" when unset), the remote runtime treats an unprovable repo
 *  location as a hard startup failure: a 24/7 remote operator with no real
 *  repo/branch truth has nothing safe to bind the Program Controller to. A
 *  detached HEAD (`git rev-parse --abbrev-ref HEAD` returning the literal
 *  string "HEAD") is treated as unprovable, not as a branch named "HEAD". */
export function resolveJarvisRemoteOperatorProgramLocationV1(env = process.env) {
  const repoDir = clean(env.JARVIS_CLAUDE_REPO_DIR, 400);
  if (!repoDir) {
    return { ok: false, repo_dir: null, target_branch: null, error: 'JARVIS_REMOTE_OPERATOR_REPO_DIR_REQUIRED' };
  }
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoDir, stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim();
    if (!branch || branch === 'HEAD') {
      return { ok: false, repo_dir: null, target_branch: null, error: 'JARVIS_REMOTE_OPERATOR_TARGET_BRANCH_UNPROVABLE' };
    }
    return { ok: true, repo_dir: repoDir, target_branch: branch };
  } catch {
    return { ok: false, repo_dir: null, target_branch: null, error: 'JARVIS_REMOTE_OPERATOR_REPO_DIR_UNAVAILABLE' };
  }
}

/* ── 5. Claude execution — private Bridge HTTP only; no second worker path ── */

/** The remote runtime offers exactly one execution mode: the existing
 *  private Bridge HTTP service (claude-code-bridge-http-runtime-binding-v1.js
 *  / claude-code-bridge-http-executor-v1.js), reached only over its private
 *  interface (never 0.0.0.0, never a public/internet-facing address). It
 *  never imports claude-code-local-runtime-binding-v1.js (disposable-tmp)
 *  or claude-code-repo-bound-runtime-binding-v1.js (local `claude` CLI) —
 *  there is no second implementation-worker path to keep in sync or
 *  accidentally weaken, and no fallback to a local CLI if the Bridge is
 *  unavailable. Execution stays fully opt-in
 *  (JARVIS_BRIDGE_HTTP_EXECUTION=on, default off): a remote operator can
 *  run read-only (status/state/UI) with no Claude binding at all. */
export async function resolveJarvisRemoteOperatorClaudeBridgeV1(env = process.env, options = {}) {
  const binding = await createJarvisBridgeHttpRuntimeBindingV1(env, options.bridge_http_options || options);
  return { bridge: binding.bridge, bound: binding.bound, requested: binding.requested, reason: binding.reason };
}

/* ── runtime wiring shared by the real server and tests ── */

/** Mirrors createJarvisLocalOperatorProgramControllerV1's shape exactly
 *  (same DI seam http-v1.js expects via options.program_controller) but is
 *  defined independently here, per this file's own-entrypoint contract. */
export function createJarvisRemoteOperatorProgramControllerV1(env = process.env, options = {}) {
  const memoryStoreFor = () => options.memory_store || resolveJarvisMemoryStoreV1(env, options);
  return {
    async tick(request) {
      const store = memoryStoreFor();
      if (!store) return { ok: false, status: 503, error: 'JARVIS_PROGRAM_TICK_MEMORY_STORE_REQUIRED' };
      return handleJarvisProgramTickRuntimeV1(request, { memory_store: store, claude_bridge: options.claude_bridge, claude_timeout_ms: options.claude_timeout_ms });
    },
    async state(request) {
      const store = memoryStoreFor();
      if (!store) return { ok: false, status: 503, error: 'JARVIS_PROGRAM_STATE_MEMORY_STORE_REQUIRED' };
      return handleJarvisProgramStateRuntimeV1(request, { memory_store: store });
    }
  };
}

export async function buildJarvisRemoteOperatorOptionsV1(env = process.env, overrides = {}) {
  const claudeBridgeResult = overrides.claude_bridge_result
    || await resolveJarvisRemoteOperatorClaudeBridgeV1(env, overrides.claude_binding_options);
  const programController = overrides.program_controller
    || createJarvisRemoteOperatorProgramControllerV1(env, { memory_store: overrides.memory_store, claude_bridge: claudeBridgeResult.bridge, claude_timeout_ms: overrides.claude_timeout_ms });
  const programLocation = overrides.program_location || resolveJarvisRemoteOperatorProgramLocationV1(env);
  // Resolved once, from server-side config only, by startJarvisRemoteOperatorV1
  // (verifyJarvisRemoteOperatorCanonicalOwnerConfigV1) before this function is
  // ever called for the real entrypoint; a test may also pass one directly.
  // Frozen into the fixed `options` object every request reuses — never
  // re-derived per request, so no request-time input can reach it.
  const canonicalOwnerEmail = clean(overrides.canonical_owner_email, 320).toLowerCase();
  return {
    // `authorize` is intentionally only ever set by a TEST override here.
    // The real entrypoint below never passes one, so authorizeJarvisV1's
    // real Cloudflare Access JWT path always runs in production.
    options: {
      authorize: overrides.authorize,
      claude_bridge: claudeBridgeResult.bridge,
      program_controller: programController,
      program_repo_dir: programLocation.ok ? programLocation.repo_dir : null,
      program_target_branch: programLocation.ok ? programLocation.target_branch : null,
      canonical_owner_email: canonicalOwnerEmail || undefined
    },
    claude_bridge_result: claudeBridgeResult,
    program_location: programLocation
  };
}

/* ── Node http <-> Web Request/Response adapter (independent copy — no Express) ── */

async function readNodeRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function nodeRequestToWebRequestV1(req, base) {
  const url = new URL(req.url, base);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) { for (const item of value) headers.append(key, item); }
    else headers.append(key, value);
  }
  const method = req.method || 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(url, { method, headers, body: hasBody ? await readNodeRequestBody(req) : undefined });
}

async function writeWebResponseToNodeV1(response, res) {
  const headers = {};
  for (const [key, value] of response.headers) headers[key] = value;
  res.writeHead(response.status, headers);
  if (!response.body) { res.end(); return; }
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Handles one Node request through the real JARVIS runtime handler.
 *  Exported so tests can exercise it directly without binding a socket. */
export async function handleJarvisRemoteOperatorRequestV1(req, res, runtimeOptions, host, port) {
  const base = `http://${req.headers.host || `${host}:${port}`}`;
  const request = await nodeRequestToWebRequestV1(req, base);
  const response = await handleJarvisStandaloneWorkerV1(request, process.env, {}, runtimeOptions);
  await writeWebResponseToNodeV1(response, res);
}

/* ── server lifecycle ── */

export function createJarvisRemoteOperatorServerV1(runtimeOptions, host, port) {
  return http.createServer((req, res) => {
    handleJarvisRemoteOperatorRequestV1(req, res, runtimeOptions, host, port).catch((error) => {
      try {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'JARVIS_REMOTE_OPERATOR_INTERNAL_ERROR' }));
      } catch { /* response already sent */ }
      console.error('JARVIS Remote Operator V1: request error —', error?.message || error);
    });
  });
}

export async function startJarvisRemoteOperatorV1(env = process.env, overrides = {}) {
  const port = Number(env.JARVIS_REMOTE_PORT) > 0 ? Number(env.JARVIS_REMOTE_PORT) : JARVIS_REMOTE_OPERATOR_DEFAULT_PORT;
  const host = JARVIS_REMOTE_OPERATOR_BIND_HOST;

  const safetyCheck = overrides.safety_check || verifyJarvisRemoteOperatorSafetyFlagsV1(env);
  if (!safetyCheck.ok) return { ok: false, error: safetyCheck.error, message: safetyCheck.message };

  const accessCheck = overrides.access_check || verifyJarvisRemoteOperatorAccessConfigV1(env);
  if (!accessCheck.ok) return { ok: false, error: accessCheck.error, missing: accessCheck.missing, message: accessCheck.message };

  const supabaseCheck = overrides.supabase_check || verifyJarvisRemoteOperatorSupabaseConfigV1(env);
  if (!supabaseCheck.ok) return { ok: false, error: supabaseCheck.error, missing: supabaseCheck.missing, message: supabaseCheck.message };

  const canonicalOwnerCheck = overrides.canonical_owner_check || verifyJarvisRemoteOperatorCanonicalOwnerConfigV1(env);
  if (!canonicalOwnerCheck.ok) return { ok: false, error: canonicalOwnerCheck.error, message: canonicalOwnerCheck.message };

  const { options, claude_bridge_result, program_location } = await buildJarvisRemoteOperatorOptionsV1(env, {
    ...overrides,
    canonical_owner_email: overrides.canonical_owner_email ?? canonicalOwnerCheck.canonical_owner_email
  });

  if (!program_location.ok) {
    return {
      ok: false,
      error: program_location.error,
      message: 'Real, provable repo/branch truth (JARVIS_CLAUDE_REPO_DIR pointing at a real git checkout, '
        + 'currently on a resolvable, non-detached branch) is required for this runtime to start.'
    };
  }

  if (claude_bridge_result.requested && !claude_bridge_result.bound) {
    return {
      ok: false,
      error: 'JARVIS_BRIDGE_HTTP_EXECUTION_REQUESTED_BUT_UNBOUND',
      message: `JARVIS_BRIDGE_HTTP_EXECUTION=on but the private Bridge did not bind (${claude_bridge_result.reason}). `
        + 'Fix the Bridge URL/token/availability, or unset JARVIS_BRIDGE_HTTP_EXECUTION to run read-only. There is no local-CLI fallback.'
    };
  }

  const resolvedStore = overrides.memory_store || resolveJarvisMemoryStoreV1(env, overrides);
  const memoryStoreKind = resolvedStore?.kind || null;
  const durableMemoryReady = resolvedStore?.durable === true;

  const runnerConfig = resolveJarvisRemoteOperatorProgramRunnerConfigV1(env);
  const runnerSession = await createJarvisSessionV1(
    { ok: true, email: clean(env.JARVIS_OPERATOR_EMAIL, 320) },
    { canonical_owner_email: options.canonical_owner_email }
  );
  if (!runnerSession.ok) {
    return { ok: false, error: 'JARVIS_PROGRAM_RUNNER_OWNER_SCOPE_UNAVAILABLE' };
  }
  const programRunner = overrides.program_runner || createJarvisProgramRunnerV1({
    owner_id: runnerSession.owner_id,
    owner_ref: runnerSession.owner_ref,
    program: 'JARVIS_MASTERARCHITECTURE_V2',
    repo_dir: options.program_repo_dir,
    target_branch: options.program_target_branch,
    enabled: runnerConfig.capability_enabled,
    interval_ms: runnerConfig.interval_ms,
    max_ticks: runnerConfig.max_ticks
  }, { controller: options.program_controller });
  options.program_runner = programRunner;

  const server = overrides.server || createJarvisRemoteOperatorServerV1(options, host, port);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  if (runnerConfig.auto_start) programRunner.start({ confirm_run: true });

  return {
    ok: true,
    server,
    host,
    port,
    url: `http://${host}:${port}`,
    program_repo_dir: options.program_repo_dir,
    program_target_branch: options.program_target_branch,
    memory_store_kind: memoryStoreKind,
    durable_memory_ready: durableMemoryReady,
    canonical_owner_email: options.canonical_owner_email || null,
    claude_bridge_result,
    program_runner_state: programRunner.state(),
    options
  };
}

export function jarvisRemoteOperatorManifestV1() {
  return {
    schema: 'aurentara.jarvis.remote-operator-server.v1',
    imported_by_deployed_worker: false,
    bind_address: JARVIS_REMOTE_OPERATOR_BIND_HOST,
    default_port: JARVIS_REMOTE_OPERATOR_DEFAULT_PORT,
    auth: REMOTE_OPERATOR_AUTHENTICATION_LABEL,
    local_operator_auth_accepted: false,
    canonical_owner_namespace_supported: true,
    canonical_owner_source: 'SERVER_SIDE_ENV_ONLY',
    canonical_owner_client_overridable: false,
    canonical_owner_changes_authenticated_identity: false,
    auth_header_derived: true,
    production_auth_modified: false,
    execution_mode: 'PRIVATE_BRIDGE_HTTP_ONLY',
    local_claude_cli_required: false,
    disposable_tmp_execution_available: false,
    riosystems_durable_object_dependency: false,
    hamyren_data_flow: false,
    production_deploy: false,
    public_access: false,
    external_writes: false,
    program_runner_capability_env: 'JARVIS_PROGRAM_RUNNER_ENABLED',
    program_runner_auto_start_env: 'JARVIS_PROGRAM_RUNNER_AUTO_START',
    program_runner_enabled_by_default: false,
    program_runner_single_flight: true
  };
}

/* ── entrypoint ── */

const isMainModule = (() => {
  try { return process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href; }
  catch { return false; }
})();

if (isMainModule) {
  const result = await startJarvisRemoteOperatorV1(process.env);
  if (!result.ok) {
    console.error(`JARVIS Remote Operator V1: startup failed — ${result.error}`);
    if (result.message) console.error(result.message);
    process.exitCode = 1;
  } else {
    console.log('JARVIS Remote Operator V1');
    console.log(`Command Center (private, behind Access): ${result.url}`);
    console.log(`Repo truth: ${result.program_repo_dir} @ ${result.program_target_branch}`);
    console.log(`Memory store: ${result.memory_store_kind} (durable: ${result.durable_memory_ready})`);
    console.log(`Claude Code (private Bridge HTTP): ${result.claude_bridge_result.bound ? 'BOUND' : 'NOT_BOUND'}`);
    console.log(`Canonical owner namespace: ${result.canonical_owner_email || '(none — using real authenticated identity)'}`);
    console.log(`Program runner capability: ${result.program_runner_state.capability_enabled ? 'ENABLED' : 'DISABLED'} (active: ${result.program_runner_state.active})`);
    console.log('Mode: PRIVATE_REMOTE — public_access=false, production_deploy=false');

    const shutdown = (signal) => {
      console.log(`\nJARVIS Remote Operator V1: received ${signal}, shutting down...`);
      result.options.program_runner?.stop({ confirm_stop: true, reason: 'SERVER_SHUTDOWN' });
      result.server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}
