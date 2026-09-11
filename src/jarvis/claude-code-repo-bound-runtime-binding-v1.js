/* JARVIS — repo-bound local runtime binding for genuine Claude Code
   execution V1.

   The sibling of claude-code-local-runtime-binding-v1.js (disposable
   os.tmpdir() workspace, general-purpose). This one binds the Claude Code
   bridge to claude-code-repo-bound-executor-v1.js instead — a real
   repository directory, with the hard bounds documented there (protected
   branch refused every call, no Bash/network tool, nothing ever committed).

   Node-only; DELIBERATELY never imported by http-v1.js, standalone-worker-v1.js,
   pages-worker-v1.js, command-center-worker-binding-v1.js, or any other
   module bundled into the deployed Worker — same import-direction rule as
   claude-code-local-runtime-binding-v1.js, for the same reason (no
   node:child_process in Cloudflare Workers, and a repo-bound worker only
   ever makes sense next to an operator's own real local checkout).

   Bound only when ALL of these are true:
     - env.JARVIS_CLAUDE_REPO_BOUND_EXECUTION === 'on' (explicit opt-in;
       default OFF);
     - env.JARVIS_CLAUDE_REPO_DIR is set to an absolute path (no silent
       default to process.cwd() — an operator must name the repo on purpose);
     - this code is genuinely executing under local Node;
     - the named repo_dir is a real git repository whose CURRENT branch is
       not `main`/`master` (checked by claude-code-repo-bound-executor-v1.js
       itself, at construction AND fresh on every call). */

import { createJarvisClaudeCodeBridgeV1 } from './claude-code-bridge-v1.js';
import { createJarvisRepoBoundClaudeCodeCliExecutorV1 } from './claude-code-repo-bound-executor-v1.js';

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const DEFAULT_TIMEOUT_MS = 300000; // real repo implementation work needs more headroom than a fixture round-trip

export const JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG = 'JARVIS_CLAUDE_REPO_BOUND_EXECUTION';
export const JARVIS_CLAUDE_REPO_DIR_ENV = 'JARVIS_CLAUDE_REPO_DIR';

function isLocalNodeRuntime() {
  return typeof process !== 'undefined' && Boolean(process.versions?.node) && typeof process.cwd === 'function';
}

function isEnabled(env = {}) {
  return clean(env[JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG], 10).toLowerCase() === 'on';
}

/** Build { bridge, bound, reason }. `bridge` is a real
 *  aurentara.jarvis.claude-code-bridge.v1 instance only when genuinely bound
 *  to a real, currently-non-protected-branch repository; otherwise `bridge`
 *  is null and `bound` is false — never fabricated. Any construction-time
 *  failure (no .git, protected branch, bad path) is caught here and reported
 *  as a reason string, never thrown past this function, so the caller can
 *  fail startup closed with a clear message instead of crashing opaquely. */
export function createJarvisClaudeRepoBoundRuntimeBindingV1(env = {}, options = {}) {
  if (!isEnabled(env)) {
    return { bridge: null, bound: false, reason: 'JARVIS_CLAUDE_REPO_BOUND_EXECUTION_DISABLED' };
  }
  if (!isLocalNodeRuntime()) {
    return { bridge: null, bound: false, reason: 'NOT_A_LOCAL_NODE_RUNTIME' };
  }
  const repoDir = clean(env[JARVIS_CLAUDE_REPO_DIR_ENV], 400) || clean(options.repo_dir, 400);
  if (!repoDir) {
    return { bridge: null, bound: false, reason: 'JARVIS_CLAUDE_REPO_DIR_REQUIRED' };
  }

  let executor;
  try {
    executor = createJarvisRepoBoundClaudeCodeCliExecutorV1({
      repo_dir: repoDir,
      expected_branch: clean(env.JARVIS_CLAUDE_REPO_EXPECTED_BRANCH, 200) || options.expected_branch,
      max_budget_usd: Number(env.JARVIS_CLAUDE_MAX_BUDGET_USD) || options.max_budget_usd,
      claude_bin: env.JARVIS_CLAUDE_BIN || options.claude_bin,
      allowed_tools: env.JARVIS_CLAUDE_ALLOWED_TOOLS || options.allowed_tools,
      on_before_return: options.on_before_return
    });
  } catch (error) {
    // Fails closed: no bridge, no fabricated availability. The exact reason
    // (not a git repo / protected branch / branch mismatch) is preserved for
    // the operator to see and act on.
    return { bridge: null, bound: false, reason: clean(error?.message || error, 200) };
  }

  const bridge = createJarvisClaudeCodeBridgeV1({
    executor,
    timeout_ms: Number(env.JARVIS_CLAUDE_TIMEOUT_MS) || options.timeout_ms || DEFAULT_TIMEOUT_MS
  });
  return { bridge, bound: true, reason: null };
}

export function jarvisClaudeRepoBoundRuntimeBindingManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-repo-bound-runtime-binding.v1',
    activation_flag: JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG,
    repo_dir_env: JARVIS_CLAUDE_REPO_DIR_ENV,
    default: 'off',
    repo_dir_has_default: false,
    imported_by_deployed_worker: false,
    local_node_runtime_required: true,
    protected_branch_checked_every_call: true,
    can_commit: false,
    can_push: false,
    can_merge: false,
    can_deploy: false,
    fail_closed_when_disabled: true,
    fail_closed_when_not_local_node: true,
    fail_closed_when_repo_dir_missing: true,
    fail_closed_when_protected_branch: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
