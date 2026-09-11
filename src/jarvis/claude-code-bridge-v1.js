/* JARVIS — Claude Code Execution Bridge V1 (durable contract).

   Position in the chain:
     Operator → JARVIS/Hermes → Astra → [ Claude Code bridge ] → Bridge (policy
     + evidence) → Git truth → independent verification → Command Center.

   Claude Code is the PRIMARY implementation worker. This module defines the
   smallest durable contract for handing a bounded implementation request to a
   Claude Code executor and normalising the outcome. It NEVER:
     - claims Claude is available unless a genuine `executor` is bound,
     - executes anything itself (the executor is injected),
     - treats worker self-report as independent acceptance,
     - reports an external effect it was not told about by an authorised executor,
     - touches credentials.

   The executor is a plain async function:
     executor({ task, workspace, correlation_id, request_id, signal, env_allowlist })
       -> { exit_code, stdout, stderr, external_effect?, acceptance_ref? }
   A missing / non-function executor keeps the bridge UNAVAILABLE and fail-closed.

   Node-only helpers (createLocalFixtureExecutorV1, createChildProcessExecutorV1)
   are for tests and a future self-hosted runner; they are not used by the
   Cloudflare Worker. */

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const JARVIS_CLAUDE_BRIDGE_STATE = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  BLOCKED: 'BLOCKED',
  UNAVAILABLE: 'UNAVAILABLE'
});

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_TIMEOUT_MS = 900000;
const DEFAULT_MAX_OUTPUT = 200000;

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clampOutput(value, max) {
  const text = String(value ?? '');
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

/** Validate a bounded implementation request. Fail-closed on anything unsafe. */
export function validateJarvisClaudeCodeRequestV1(input = {}) {
  const correlationId = clean(input.correlation_id, 80).toLowerCase();
  const requestId = clean(input.request_id, 200) || correlationId;
  const ownerRef = clean(input.owner_ref, 320);
  const task = clean(input.task, 8000);
  const workspace = clean(input.workspace, 400);
  const rawTimeout = Number(input.timeout_ms);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0
    ? Math.min(MAX_TIMEOUT_MS, Math.max(1000, Math.round(rawTimeout)))
    : DEFAULT_TIMEOUT_MS;

  if (!UUID_RE.test(correlationId)) return { ok: false, error: 'CLAUDE_BRIDGE_CORRELATION_ID_REQUIRED' };
  if (!ownerRef) return { ok: false, error: 'CLAUDE_BRIDGE_OWNER_REF_REQUIRED' };
  if (!task) return { ok: false, error: 'CLAUDE_BRIDGE_TASK_REQUIRED' };
  if (!workspace.startsWith('/workspace/projects/')) return { ok: false, error: 'CLAUDE_BRIDGE_WORKSPACE_OUT_OF_BOUNDS' };
  if (input.protected_branch === true) return { ok: false, error: 'CLAUDE_BRIDGE_PROTECTED_BRANCH_BLOCKED' };
  if (input.production === true) return { ok: false, error: 'CLAUDE_BRIDGE_PRODUCTION_BLOCKED' };
  if (input.allow_external_writes === true) return { ok: false, error: 'CLAUDE_BRIDGE_EXTERNAL_WRITE_NOT_PERMITTED' };

  return {
    ok: true,
    request: {
      correlation_id: correlationId,
      request_id: requestId,
      owner_ref: ownerRef,
      task,
      workspace,
      timeout_ms: timeoutMs,
      bounded: true,
      protected_branch: false,
      production: false
    }
  };
}

function normalizeExecutorResult(raw, maxOutput) {
  const out = clampOutput(raw?.stdout, maxOutput);
  const err = clampOutput(raw?.stderr, maxOutput);
  const exitCode = Number.isInteger(raw?.exit_code) ? raw.exit_code : (raw?.exit_code === 0 ? 0 : null);
  return {
    exit_code: exitCode,
    stdout: out.text,
    stderr: err.text,
    truncated: out.truncated || err.truncated,
    // An external effect only counts if an authorised executor explicitly reports
    // one. The bridge never infers it.
    external_effect: raw?.external_effect === true,
    // A distinct acceptance reference from outside the worker (Bridge / review).
    acceptance_ref: clean(raw?.acceptance_ref, 240) || null,
    // Additive, optional: bridge-side-computed evidence a repo-bound executor
    // (claude-code-repo-bound-executor-v1.js) attaches — never self-reported
    // by the worker itself. Every other executor leaves this null; nothing
    // here changes existing behaviour for them.
    verification: raw?.verification && typeof raw.verification === 'object' ? raw.verification : null
  };
}

async function buildEvidence(request, state, normalized, startedAt, finishedAt) {
  const durationMs = Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)) || 0;
  return {
    evidence_id: `claude-code:${request.correlation_id}`,
    kind: 'CLAUDE_CODE_EXECUTION',
    status: state,
    run_ref: request.request_id,
    correlation_id: request.correlation_id,
    observed_at: finishedAt,
    started_at: startedAt,
    duration_ms: durationMs,
    exit_code: normalized ? normalized.exit_code : null,
    stdout_sha256: normalized ? await sha256Hex(normalized.stdout) : null,
    stderr_sha256: normalized ? await sha256Hex(normalized.stderr) : null,
    stdout_bytes: normalized ? normalized.stdout.length : 0,
    stderr_bytes: normalized ? normalized.stderr.length : 0,
    truncated: normalized ? normalized.truncated : false,
    // Independent acceptance is NEVER granted by the bridge.
    worker_verified: false,
    independent_acceptance: false,
    acceptance_ref: normalized ? normalized.acceptance_ref : null,
    external_effect: normalized ? normalized.external_effect : false,
    verification: normalized ? normalized.verification : null
  };
}

/** Build a durable Claude Code bridge bound to an injected executor.
 *  No executor -> bound:false and every submit() fails closed to UNAVAILABLE. */
export function createJarvisClaudeCodeBridgeV1(config = {}) {
  const executor = typeof config.executor === 'function' ? config.executor : null;
  const clock = typeof config.clock === 'function' ? config.clock : () => new Date().toISOString();
  const defaultTimeout = Number.isFinite(Number(config.timeout_ms)) && Number(config.timeout_ms) > 0
    ? Math.min(MAX_TIMEOUT_MS, Math.round(Number(config.timeout_ms)))
    : DEFAULT_TIMEOUT_MS;
  const maxOutput = Number.isFinite(Number(config.max_output_bytes)) && Number(config.max_output_bytes) > 0
    ? Math.round(Number(config.max_output_bytes))
    : DEFAULT_MAX_OUTPUT;
  const envAllowlist = Array.isArray(config.env_allowlist) ? config.env_allowlist.map((v) => clean(v, 120)).filter(Boolean) : [];
  const seen = new Map(); // correlation_id -> last terminal record (idempotency / duplicate handling)

  async function unavailable(request, reason) {
    const at = clock();
    return {
      ok: false,
      bridge_bound: false,
      state: JARVIS_CLAUDE_BRIDGE_STATE.UNAVAILABLE,
      correlation_id: request?.correlation_id || null,
      request_id: request?.request_id || null,
      reason,
      external_effect: false,
      evidence: request ? await buildEvidence(request, JARVIS_CLAUDE_BRIDGE_STATE.UNAVAILABLE, null, at, at) : null
    };
  }

  return {
    schema: 'aurentara.jarvis.claude-code-bridge.v1',
    bound: Boolean(executor),

    /** Idempotent per correlation_id. Returns { record, cancel } where cancel()
     *  aborts an in-flight run. */
    submit(rawRequest = {}, options = {}) {
      const validated = validateJarvisClaudeCodeRequestV1(rawRequest);
      const controller = new AbortController();
      if (options.signal instanceof AbortSignal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const run = (async () => {
        if (!validated.ok) {
          const at = clock();
          return {
            ok: false,
            bridge_bound: Boolean(executor),
            state: JARVIS_CLAUDE_BRIDGE_STATE.BLOCKED,
            error: validated.error,
            correlation_id: clean(rawRequest.correlation_id, 80).toLowerCase() || null,
            request_id: clean(rawRequest.request_id, 200) || null,
            external_effect: false,
            evidence: null
          };
        }
        const request = validated.request;

        if (seen.has(request.correlation_id)) {
          return { ...seen.get(request.correlation_id), duplicate: true };
        }
        if (!executor) return unavailable(request, 'NO_EXECUTOR_BOUND');

        const startedAt = clock();
        const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(1000, request.timeout_ms || defaultTimeout));
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

        let state = JARVIS_CLAUDE_BRIDGE_STATE.RUNNING;
        let normalized = null;
        let errorDetail = null;
        try {
          const raw = await executor({
            task: request.task,
            workspace: request.workspace,
            correlation_id: request.correlation_id,
            request_id: request.request_id,
            owner_ref: request.owner_ref,
            env_allowlist: envAllowlist,
            timeout_ms: timeoutMs,
            signal: controller.signal
          });
          normalized = normalizeExecutorResult(raw, maxOutput);
          // An executor that resolves after being killed (e.g. a child process
          // exiting on SIGKILL) must still be classified by intent.
          if (timedOut) {
            state = JARVIS_CLAUDE_BRIDGE_STATE.TIMEOUT;
          } else if (controller.signal.aborted) {
            state = JARVIS_CLAUDE_BRIDGE_STATE.CANCELLED;
          } else {
            state = normalized.exit_code === 0
              ? JARVIS_CLAUDE_BRIDGE_STATE.COMPLETE
              : JARVIS_CLAUDE_BRIDGE_STATE.FAILED;
          }
        } catch (error) {
          if (timedOut) {
            state = JARVIS_CLAUDE_BRIDGE_STATE.TIMEOUT;
          } else if (controller.signal.aborted) {
            state = JARVIS_CLAUDE_BRIDGE_STATE.CANCELLED;
          } else {
            state = JARVIS_CLAUDE_BRIDGE_STATE.FAILED;
          }
          errorDetail = clean(error?.message || error, 400);
          normalized = normalizeExecutorResult({ stdout: '', stderr: errorDetail, exit_code: null }, maxOutput);
        } finally {
          clearTimeout(timer);
        }

        const finishedAt = clock();
        const evidence = await buildEvidence(request, state, normalized, startedAt, finishedAt);
        const record = {
          ok: state === JARVIS_CLAUDE_BRIDGE_STATE.COMPLETE,
          bridge_bound: true,
          state,
          correlation_id: request.correlation_id,
          request_id: request.request_id,
          owner_ref: request.owner_ref,
          workspace: request.workspace,
          started_at: startedAt,
          finished_at: finishedAt,
          duration_ms: evidence.duration_ms,
          exit_code: normalized ? normalized.exit_code : null,
          stdout: normalized ? normalized.stdout : '',
          stderr: normalized ? normalized.stderr : '',
          truncated: normalized ? normalized.truncated : false,
          error_detail: errorDetail,
          // Bounded workspace execution -> no external effect unless the executor
          // explicitly (and authorised) reported one; still surfaced honestly.
          external_effect: normalized ? normalized.external_effect === true : false,
          independent_acceptance: false,
          evidence
        };
        if (state !== JARVIS_CLAUDE_BRIDGE_STATE.RUNNING) seen.set(request.correlation_id, record);
        return record;
      })();

      return {
        correlation_id: clean(rawRequest.correlation_id, 80).toLowerCase() || null,
        result: run,
        cancel(reason = 'OPERATOR_CANCELLED') { this._cancelReason = clean(reason, 120); controller.abort(); }
      };
    },

    /** A worker outcome is NEVER independent acceptance on its own. */
    isIndependentlyAccepted(record = {}) {
      return record.independent_acceptance === true && !!clean(record.evidence?.acceptance_ref, 8);
    }
  };
}

export function jarvisClaudeCodeBridgeContractV1(bridge) {
  const bound = bridge && bridge.bound === true;
  return {
    schema: 'aurentara.jarvis.claude-code-bridge.contract.v1',
    primary_worker: 'CLAUDE_CODE',
    bridge_bound: bound,
    executor_injected: bound,
    states: Object.values(JARVIS_CLAUDE_BRIDGE_STATE),
    default_timeout_ms: DEFAULT_TIMEOUT_MS,
    max_timeout_ms: MAX_TIMEOUT_MS,
    workspace_prefix_required: '/workspace/projects/',
    protected_branch_execution: false,
    production_execution: false,
    external_writes: false,
    worker_output_self_accepts: false,
    independent_acceptance_from_bridge: false,
    correlation_id_continuity: true,
    cancellation_supported: true,
    timeout_supported: true,
    duplicate_correlation_is_idempotent: true,
    credentials_touched: false,
    hamyren_data_flow: false,
    production_deploy: false
  };
}

/* ── Node-only executors (tests + future self-hosted runner) ─────────────── */

/** Deterministic fixture executor. `fixtures` maps a substring of the task to a
 *  result: { exit_code, stdout, stderr, delay_ms, throw }. */
export function createLocalFixtureExecutorV1(fixtures = {}) {
  const entries = Object.entries(fixtures);
  return async ({ task, signal }) => {
    const match = entries.find(([key]) => String(task).includes(key));
    const spec = match ? match[1] : { exit_code: 0, stdout: 'fixture: ok', stderr: '' };
    if (spec.delay_ms) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, spec.delay_ms);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
      });
    }
    if (spec.throw) throw new Error(String(spec.throw));
    return {
      exit_code: spec.exit_code ?? 0,
      stdout: spec.stdout ?? '',
      stderr: spec.stderr ?? '',
      external_effect: spec.external_effect === true,
      acceptance_ref: spec.acceptance_ref,
      // Test-only stand-in for what claude-code-repo-bound-executor-v1.js
      // computes for real; lets fixture-based tests exercise the acceptance
      // path without a real git repo.
      verification: spec.verification || null
    };
  };
}

/** Bounded local child-process executor. Node-only. NOT wired to any real
 *  Claude/Claude Code binary in an autonomous run — the command is injected and
 *  a `claude`-shaped command is refused unless `allow_model_session` is set
 *  (which an autonomous run must never do). */
export function createChildProcessExecutorV1(config = {}) {
  const command = clean(config.command, 400);
  const baseArgs = Array.isArray(config.args) ? config.args.map((v) => String(v)) : [];
  const cwd = clean(config.cwd, 400);
  const allowModelSession = config.allow_model_session === true;

  return async ({ task, signal, timeout_ms }) => {
    if (!command) throw new Error('CHILD_PROCESS_EXECUTOR_COMMAND_REQUIRED');
    const base = command.split('/').pop().toLowerCase();
    if (!allowModelSession && /claude|anthropic/.test(base)) {
      throw new Error('CHILD_PROCESS_EXECUTOR_MODEL_SESSION_REFUSED');
    }
    const { spawn } = await import('node:child_process');
    return await new Promise((resolve, reject) => {
      const child = spawn(command, [...baseArgs, ...(config.pass_task === false ? [] : [String(task)])], {
        cwd: cwd || process.cwd(),
        env: { PATH: process.env.PATH },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '', stderr = '';
      const killTimer = setTimeout(() => child.kill('SIGKILL'), Math.max(1000, Number(timeout_ms) || 60000));
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      if (signal) signal.addEventListener('abort', () => child.kill('SIGKILL'), { once: true });
      child.on('error', (e) => { clearTimeout(killTimer); reject(e); });
      child.on('close', (code) => { clearTimeout(killTimer); resolve({ exit_code: code, stdout, stderr }); });
    });
  };
}
