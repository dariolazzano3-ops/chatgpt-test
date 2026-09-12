/* JARVIS — local runtime binding for genuine Claude Code execution V1.

   THE LOCAL WORKER BINDING BOUNDARY (Phase 1 of Live Runtime Integration).

   The normal JARVIS command runtime (handleJarvisHttpV1 / POST
   /jarvis/api/chat) is a plain Web-standard Request->Response function with
   no Node-only imports, so it runs equally under the deployed Cloudflare
   Worker (standalone-worker-v1.js, pages-worker-v1.js) and under local Node.
   Node's `node:child_process` — required to spawn the real `claude` CLI —
   does not exist in the Cloudflare Workers runtime at all; there is no way
   to make a live local process binding work there, and this module does not
   try to. Cloudflare Workers HTML deploys never see a running local Claude
   Code session.

   This file is Node-only (imports fs/os/path/node:child_process-touching
   code) and is DELIBERATELY never imported by http-v1.js, standalone-worker-v1.js,
   pages-worker-v1.js, command-center-worker-binding-v1.js, or any other module
   that gets bundled into the deployed Worker. It exists to be imported only
   by a LOCAL, operator-run harness (see
   scripts/jarvis-real-command-path-e2e-v1.mjs), which then injects the bridge
   it builds here into handleJarvisHttpV1 via the existing `options.claude_bridge`
   dependency-injection seam — the same seam command-center-runtime-truth-v1.js
   already reads for the System Status "command_chain" projection. The Worker
   code itself never constructs this binding and never imports this file, so
   there is no production dependency and nothing to accidentally ship.

   Bound only when BOTH are true:
     - env.JARVIS_CLAUDE_LOCAL_EXECUTION === 'on' (explicit opt-in; default OFF
       — no config -> CLAUDE_CODE stays NOT_BOUND, exactly as today);
     - this code is genuinely executing under local Node (checked at call
       time, not assumed).

   Each execution gets its OWN fresh disposable workspace inside os.tmpdir(),
   created immediately before that one run and deleted immediately after —
   concurrent/sequential runs never share a workspace. The nested `claude`
   session runs --restricted (no Bash / other code-execution tools / WebFetch;
   file tools confined to that directory), --tools Write,Read,
   --permission-mode acceptEdits, --permission-prompts none (anything a mode
   doesn't already decide is denied, never escalated), --no-session-persistence,
   --strict-mcp-config (no MCP servers), and a bounded --max-budget-usd. The
   bridge's own timeout/AbortController still applies on top and hard-kills
   the child process. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJarvisClaudeCodeBridgeV1, createChildProcessExecutorV1 } from './claude-code-bridge-v1.js';

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const DEFAULT_MAX_BUDGET_USD = 0.5;
const DEFAULT_TIMEOUT_MS = 90000;

export const JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG = 'JARVIS_CLAUDE_LOCAL_EXECUTION';

function isLocalNodeRuntime() {
  return typeof process !== 'undefined' && Boolean(process.versions?.node) && typeof process.cwd === 'function';
}

function isEnabled(env = {}) {
  return clean(env[JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG], 10).toLowerCase() === 'on';
}

/** One executor call = one fresh disposable /tmp workspace, used once, then
 *  deleted. Never a fixed shared directory across calls. */
function perCallExecutor(config = {}) {
  const maxBudgetUsd = Number(config.max_budget_usd) > 0 ? Number(config.max_budget_usd) : DEFAULT_MAX_BUDGET_USD;
  const claudeBin = clean(config.claude_bin, 200) || 'claude';
  const allowedTools = clean(config.allowed_tools, 200) || 'Write,Read';
  // Observability/testing only: if provided, called with the disposable
  // workspace's path and the raw result AFTER the run but BEFORE the
  // workspace is deleted, so a caller can independently verify on-disk
  // output for itself. Never set in normal runtime operation; production
  // behaviour (always clean up) is unchanged whether or not this is given.
  const onBeforeCleanup = typeof config.on_before_cleanup === 'function' ? config.on_before_cleanup : null;

  return async (call) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-claude-runtime-'));
    try {
      const exec = createChildProcessExecutorV1({
        command: claudeBin,
        cwd: dir,
        allow_model_session: true, // explicit, opt-in, this local-only binding only
        pass_task: true,
        args: [
          '--print',
          '--output-format', 'json',
          '--restricted',
          '--allowedTools', allowedTools,
          '--permission-mode', 'acceptEdits',
          '--permission-prompts', 'none',
          '--no-session-persistence',
          '--strict-mcp-config',
          '--max-budget-usd', String(maxBudgetUsd)
        ]
      });
      const result = await exec(call);
      if (onBeforeCleanup) { try { onBeforeCleanup(dir, result); } catch {} }
      return result;
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  };
}

/** Build { bridge, bound, reason }. `bridge` is a real
 *  aurentara.jarvis.claude-code-bridge.v1 instance (see claude-code-bridge-v1.js)
 *  only when genuinely bound; otherwise `bridge` is null and `bound` is false —
 *  never fabricated, and callers must treat a null bridge exactly like "no
 *  executor injected" (which is the bridge's own existing fail-closed default). */
export function createJarvisClaudeLocalRuntimeBindingV1(env = {}, options = {}) {
  if (!isEnabled(env)) {
    return { bridge: null, bound: false, reason: 'JARVIS_CLAUDE_LOCAL_EXECUTION_DISABLED' };
  }
  if (!isLocalNodeRuntime()) {
    return { bridge: null, bound: false, reason: 'NOT_A_LOCAL_NODE_RUNTIME' };
  }

  const executor = perCallExecutor({
    max_budget_usd: Number(env.JARVIS_CLAUDE_MAX_BUDGET_USD) || options.max_budget_usd,
    claude_bin: env.JARVIS_CLAUDE_BIN || options.claude_bin,
    allowed_tools: env.JARVIS_CLAUDE_ALLOWED_TOOLS || options.allowed_tools,
    on_before_cleanup: options.on_before_cleanup
  });
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor,
    timeout_ms: Number(env.JARVIS_CLAUDE_TIMEOUT_MS) || options.timeout_ms || DEFAULT_TIMEOUT_MS
  });
  return { bridge, bound: true, reason: null };
}

export function jarvisClaudeLocalRuntimeBindingManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-local-runtime-binding.v1',
    activation_flag: JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG,
    default: 'off',
    imported_by_deployed_worker: false,
    local_node_runtime_required: true,
    workspace_per_call: 'fresh mkdtemp(os.tmpdir()), deleted immediately after each run',
    restricted_mode: true,
    allowed_tools: 'Write,Read',
    permission_mode: 'acceptEdits',
    permission_prompts: 'none',
    session_persistence: false,
    mcp_servers: 'none (strict-mcp-config, no --mcp-config given)',
    spend_bounded: true,
    fail_closed_when_disabled: true,
    fail_closed_when_not_local_node: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
