#!/usr/bin/env node
/* JARVIS — Local Operator Launcher V1.

   ONE clean local launcher that binds the accepted JARVIS Live System V1
   pieces together for an operator running on their own machine:

     npm run jarvis:local

   This file is Node-only (node:http, node:child_process, process.env) and is
   DELIBERATELY never imported by pages-worker-v1.js, standalone-worker-v1.js,
   or any other module bundled into a deployed Cloudflare Worker. It only
   ever IMPORTS from the cloud-safe runtime (standalone-worker-v1.js /
   http-v1.js, which have no Node-only imports and are identical to what the
   deployed Worker runs) and from the Node-only local Claude binding
   (claude-code-local-runtime-binding-v1.js, which is itself already
   documented as never imported by any deployed entrypoint). The direction of
   the import graph never runs the other way.

   Production Cloudflare Access auth (src/jarvis/access-v1.js) is untouched
   and unused here. This launcher injects its own LOCAL_OPERATOR_AUTH
   function through the existing options.authorize dependency-injection seam
   (see authorizeJarvisV1 in access-v1.js) — a fixed, deterministic, local
   operator identity that never reads request headers for identity and can
   never be spoofed by an arbitrary client. It is not exported for reuse by
   any deployed-Worker code path. */

import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { handleJarvisStandaloneWorkerV1 } from './standalone-worker-v1.js';
import {
  createJarvisClaudeLocalRuntimeBindingV1,
  JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG
} from './claude-code-local-runtime-binding-v1.js';
import {
  createJarvisClaudeRepoBoundRuntimeBindingV1,
  JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG
} from './claude-code-repo-bound-runtime-binding-v1.js';
import { resolveJarvisMemoryStoreV1 } from './http-v1.js';
import { handleJarvisProgramTickRuntimeV1, handleJarvisProgramStateRuntimeV1 } from './program-controller-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

export const JARVIS_LOCAL_OPERATOR_DEFAULT_PORT = 8787;
export const JARVIS_LOCAL_OPERATOR_BIND_HOST = '127.0.0.1'; // never 0.0.0.0
export const LOCAL_OPERATOR_AUTH_LABEL = 'LOCAL_OPERATOR_AUTH';

const REQUIRED_SUPABASE_ENV_KEYS = [
  'JARVIS_PERSONAL_MEMORY_SUPABASE_URL',
  'JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY'
];

/* ── 3. LOCAL AUTH — local-only, deterministic, never header-derived ─────── */

export function jarvisLocalOperatorEmailV1(env = process.env) {
  const configured = clean(env.JARVIS_LOCAL_OPERATOR_EMAIL || env.JARVIS_OPERATOR_EMAIL, 320).toLowerCase();
  return configured || 'local-operator@localhost';
}

/** Builds the LOCAL_OPERATOR_AUTH function injected via options.authorize.
 *  It ignores the incoming request entirely (no header, cookie, or query
 *  string is ever read for identity) — the operator identity is fixed by
 *  server-side config at process start, not by anything a client can send.
 *  This is intentionally incompatible with production use: it is never
 *  imported by access-v1.js, never passed to a deployed Worker's options,
 *  and production auth (Cloudflare Access) is not modified by this file. */
export function createJarvisLocalOperatorAuthorizeV1(env = process.env) {
  const email = jarvisLocalOperatorEmailV1(env);
  return async function LOCAL_OPERATOR_AUTH() {
    return {
      ok: true,
      operator_id: 'jarvis-operator:' + email,
      email,
      authentication: LOCAL_OPERATOR_AUTH_LABEL,
      audience_separate_from_operator_dashboard: true,
      local_only: true,
      production_deploy: false
    };
  };
}

/* ── 5. SUPABASE — fail closed with one concise error, never a secret ────── */

export function verifyJarvisLocalOperatorSupabaseConfigV1(env = process.env) {
  const mode = clean(env.JARVIS_PERSONAL_MEMORY_STORE, 80).toLowerCase();
  if (mode !== 'supabase') {
    return {
      ok: false,
      error: 'JARVIS_LOCAL_OPERATOR_SUPABASE_MODE_REQUIRED',
      message: 'Set JARVIS_PERSONAL_MEMORY_STORE=supabase before running npm run jarvis:local.'
    };
  }
  const missing = REQUIRED_SUPABASE_ENV_KEYS.filter((key) => !clean(env[key], 4000));
  if (missing.length) {
    return {
      ok: false,
      error: 'JARVIS_LOCAL_OPERATOR_SUPABASE_ENV_MISSING',
      missing,
      message: `Missing required Supabase env var(s): ${missing.join(', ')}.`
    };
  }
  return { ok: true, schema: clean(env.JARVIS_PERSONAL_MEMORY_SUPABASE_SCHEMA, 80) || 'jarvis_private' };
}

/* ── 4. CLAUDE CODE BINDING — genuine only, fail closed, never simulated ─── */

function preflightJarvisClaudeCliV1(env = process.env) {
  const bin = clean(env.JARVIS_CLAUDE_BIN, 200) || 'claude';
  try {
    execFileSync(bin, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 5000 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 200) };
  }
}

/** Resolves { bridge, bound, requested, reason, worker_kind }. Never
 *  fabricates `bound`: when either execution mode is requested but the CLI,
 *  the local Node binding, or (repo-bound only) the repo/branch bounds are
 *  unavailable, `bound` stays false and the caller (main, below) fails
 *  startup closed rather than simulating availability.
 *
 *  Two independent opt-ins exist:
 *    - JARVIS_CLAUDE_LOCAL_EXECUTION=on       -> disposable os.tmpdir() worker
 *    - JARVIS_CLAUDE_REPO_BOUND_EXECUTION=on  -> real-repo worker (JARVIS_CLAUDE_REPO_DIR)
 *  Repo-bound takes precedence when both are set — it is the strictly more
 *  specific, more consequential opt-in, so an operator who sets both is
 *  read as wanting the real-repo worker, not silently getting the weaker
 *  one instead. */
export function resolveJarvisLocalOperatorClaudeBridgeV1(env = process.env, options = {}) {
  const repoBoundRequested = clean(env[JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG], 10).toLowerCase() === 'on';
  if (repoBoundRequested) {
    const preflight = options.skip_cli_preflight ? { ok: true } : preflightJarvisClaudeCliV1(env);
    if (!preflight.ok) {
      return { bridge: null, bound: false, requested: true, worker_kind: 'REPO_BOUND', reason: 'JARVIS_CLAUDE_CLI_UNAVAILABLE: ' + preflight.error };
    }
    const binding = createJarvisClaudeRepoBoundRuntimeBindingV1(env, options.repo_bound_options || options);
    return { bridge: binding.bridge, bound: binding.bound, requested: true, worker_kind: 'REPO_BOUND', reason: binding.reason };
  }

  const requested = clean(env[JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG], 10).toLowerCase() === 'on';
  if (!requested) {
    return { bridge: null, bound: false, requested: false, worker_kind: null, reason: 'JARVIS_CLAUDE_LOCAL_EXECUTION_DISABLED' };
  }
  const preflight = options.skip_cli_preflight ? { ok: true } : preflightJarvisClaudeCliV1(env);
  if (!preflight.ok) {
    return { bridge: null, bound: false, requested: true, worker_kind: 'DISPOSABLE_TMP', reason: 'JARVIS_CLAUDE_CLI_UNAVAILABLE: ' + preflight.error };
  }
  const binding = createJarvisClaudeLocalRuntimeBindingV1(env, options);
  return { bridge: binding.bridge, bound: binding.bound, requested: true, worker_kind: 'DISPOSABLE_TMP', reason: binding.reason };
}

/* ── runtime wiring shared by the real server and tests ──────────────────── */

/** The Program Controller (program-controller-v1.js) is Node-only (real
 *  `git` access via branch-manager-v1.js) and is never imported by http-v1.js
 *  itself — this is the one place that constructs it and injects it through
 *  the same options seam claude_bridge already uses. It re-resolves the
 *  memory store from `env` on every call via resolveJarvisMemoryStoreV1 —
 *  the exact same resolution http-v1.js itself would perform for a plain
 *  request — so ticking never drifts from what the running server would
 *  otherwise persist. */
export function createJarvisLocalOperatorProgramControllerV1(env = process.env, options = {}) {
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

export function buildJarvisLocalOperatorOptionsV1(env = process.env, overrides = {}) {
  const authorize = overrides.authorize || createJarvisLocalOperatorAuthorizeV1(env);
  const claudeBridgeResult = overrides.claude_bridge_result
    || resolveJarvisLocalOperatorClaudeBridgeV1(env, overrides.claude_binding_options);
  const programController = overrides.program_controller
    || createJarvisLocalOperatorProgramControllerV1(env, { memory_store: overrides.memory_store, claude_bridge: claudeBridgeResult.bridge, claude_timeout_ms: overrides.claude_timeout_ms });
  return {
    options: { authorize, claude_bridge: claudeBridgeResult.bridge, program_controller: programController },
    claude_bridge_result: claudeBridgeResult
  };
}

/* ── Node http <-> Web Request/Response adapter (no Express) ─────────────── */

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

/** Handles one Node request through the real JARVIS runtime handler. Exported
 *  so tests can exercise it directly without binding a socket. */
export async function handleJarvisLocalOperatorRequestV1(req, res, runtimeOptions, host, port) {
  const base = `http://${req.headers.host || `${host}:${port}`}`;
  const request = await nodeRequestToWebRequestV1(req, base);
  const response = await handleJarvisStandaloneWorkerV1(request, process.env, {}, runtimeOptions);
  await writeWebResponseToNodeV1(response, res);
}

/* ── server lifecycle ─────────────────────────────────────────────────────── */

export function createJarvisLocalOperatorServerV1(runtimeOptions, host, port) {
  return http.createServer((req, res) => {
    handleJarvisLocalOperatorRequestV1(req, res, runtimeOptions, host, port).catch((error) => {
      try {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'JARVIS_LOCAL_OPERATOR_INTERNAL_ERROR' }));
      } catch { /* response already sent */ }
      console.error('JARVIS Local Operator V1: request error —', error?.message || error);
    });
  });
}

export async function startJarvisLocalOperatorV1(env = process.env, overrides = {}) {
  const port = Number(env.JARVIS_LOCAL_PORT) > 0 ? Number(env.JARVIS_LOCAL_PORT) : JARVIS_LOCAL_OPERATOR_DEFAULT_PORT;
  const host = JARVIS_LOCAL_OPERATOR_BIND_HOST;

  const supabaseCheck = overrides.supabase_check || verifyJarvisLocalOperatorSupabaseConfigV1(env);
  if (!supabaseCheck.ok) {
    return { ok: false, error: supabaseCheck.error, message: supabaseCheck.message };
  }

  const { options, claude_bridge_result } = buildJarvisLocalOperatorOptionsV1(env, overrides);
  if (claude_bridge_result.requested && !claude_bridge_result.bound) {
    return {
      ok: false,
      error: 'JARVIS_CLAUDE_LOCAL_EXECUTION_REQUESTED_BUT_UNBOUND',
      message: `JARVIS_CLAUDE_LOCAL_EXECUTION=on but the local Claude bridge did not bind (${claude_bridge_result.reason}). Fix the local Claude CLI / Node runtime, or unset JARVIS_CLAUDE_LOCAL_EXECUTION to run without it.`
    };
  }

  const server = overrides.server || createJarvisLocalOperatorServerV1(options, host, port);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return {
    ok: true,
    server,
    host,
    port,
    url: `http://${host}:${port}`,
    operator_email: jarvisLocalOperatorEmailV1(env),
    supabase_schema: supabaseCheck.schema,
    claude_bridge_result,
    options
  };
}

export function jarvisLocalOperatorManifestV1() {
  return {
    schema: 'aurentara.jarvis.local-operator-server.v1',
    imported_by_deployed_worker: false,
    bind_address: JARVIS_LOCAL_OPERATOR_BIND_HOST,
    default_port: JARVIS_LOCAL_OPERATOR_DEFAULT_PORT,
    auth: LOCAL_OPERATOR_AUTH_LABEL,
    auth_header_derived: false,
    production_auth_modified: false,
    riosystems_durable_object_dependency: false,
    hamyren_data_flow: false,
    production_deploy: false,
    external_writes: false
  };
}

/* ── entrypoint ────────────────────────────────────────────────────────────── */

const isMainModule = (() => {
  try { return process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href; }
  catch { return false; }
})();

if (isMainModule) {
  const result = await startJarvisLocalOperatorV1(process.env);
  if (!result.ok) {
    console.error(`JARVIS Local Operator V1: startup failed — ${result.error}`);
    if (result.message) console.error(result.message);
    process.exitCode = 1;
  } else {
    console.log('JARVIS Local Operator V1');
    console.log(`Command Center: ${result.url}`);
    console.log(`Supabase: BOUND (schema: ${result.supabase_schema})`);
    console.log(`Claude Code: ${result.claude_bridge_result.bound ? `BOUND (${result.claude_bridge_result.worker_kind})` : 'NOT_BOUND'}`);
    console.log(`Local operator: ${result.operator_email}`);
    console.log('Mode: LOCAL_PRIVATE');

    const shutdown = (signal) => {
      console.log(`\nJARVIS Local Operator V1: received ${signal}, shutting down...`);
      result.server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}
