/* JARVIS — local Claude Code CLI execution adapter V1 (opt-in, NOT autonomous).

   Binds the Claude Code execution bridge (claude-code-bridge-v1.js) to the
   real, already-authenticated, locally installed `claude` CLI.

   This adapter is never imported by the default JARVIS runtime/service path
   (service-v1.js, command-center-worker-binding-v1.js's default construction,
   etc). It exists only to be constructed explicitly and by hand, one run at a
   time, from an operator-initiated script such as
   scripts/jarvis-live-claude-cli-smoke-v1.mjs. The underlying
   createChildProcessExecutorV1() guard in claude-code-bridge-v1.js still
   refuses any `claude`/`anthropic`-shaped command unless its caller sets
   `allow_model_session: true` — this file does that explicitly, for itself
   only, and does not change that guard's default for anyone else.

   Hard bounds enforced here (on top of the bridge's own bounds):
     - workspace_dir MUST be an absolute path inside the OS temp directory
       (a disposable workspace) — the repo root, cwd, or any other path is
       refused outright;
     - the nested CLI session runs with --restricted (removes Bash / other
       code-execution tools and WebFetch; confines file tools to the
       directory), --tools limited to Write,Read, --permission-mode
       acceptEdits, --permission-prompts none (anything not covered by the
       mode is denied, never escalated), --no-session-persistence, and
       --strict-mcp-config (no MCP servers load);
     - spend is bounded with --max-budget-usd;
     - the bridge's own timeout/AbortController still applies and hard-kills
       the child process. */

import os from 'node:os';
import path from 'node:path';
import { createChildProcessExecutorV1 } from './claude-code-bridge-v1.js';

const DEFAULT_MAX_BUDGET_USD = 0.5;

export function createLocalClaudeCodeCliExecutorV1(config = {}) {
  const workspaceDir = String(config.workspace_dir || '').trim();
  const tmpRoot = path.resolve(os.tmpdir());
  const resolved = workspaceDir ? path.resolve(workspaceDir) : '';

  if (!workspaceDir || !path.isAbsolute(workspaceDir)) {
    throw new Error('LOCAL_CLAUDE_CLI_EXECUTOR_WORKSPACE_DIR_REQUIRED_ABSOLUTE');
  }
  if (resolved === tmpRoot || !(resolved + path.sep).startsWith(tmpRoot + path.sep)) {
    throw new Error('LOCAL_CLAUDE_CLI_EXECUTOR_WORKSPACE_DIR_MUST_BE_DISPOSABLE_TMP');
  }

  const maxBudgetUsd = Number(config.max_budget_usd) > 0 ? Number(config.max_budget_usd) : DEFAULT_MAX_BUDGET_USD;
  const claudeBin = String(config.claude_bin || 'claude');
  const allowedTools = String(config.allowed_tools || 'Write,Read');

  return createChildProcessExecutorV1({
    command: claudeBin,
    cwd: resolved,
    allow_model_session: true, // explicit, opt-in, this adapter only
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
}

export function jarvisLocalClaudeCodeCliExecutorManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-local-cli-executor.v1',
    wired_into_default_runtime: false,
    requires_explicit_opt_in: true,
    workspace_must_be_tmp: true,
    restricted_mode: true,
    allowed_tools: 'Write,Read',
    permission_mode: 'acceptEdits',
    permission_prompts: 'none',
    session_persistence: false,
    mcp_servers: 'none (strict-mcp-config, no --mcp-config given)',
    spend_bounded: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
