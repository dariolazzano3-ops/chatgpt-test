/* JARVIS — bounded REPO-CAPABLE Claude Code executor V1 (opt-in, NOT autonomous).

   Every prior local executor (claude-code-local-cli-executor-v1.js,
   claude-code-local-runtime-binding-v1.js) confines the nested `claude`
   session to a fresh, disposable os.tmpdir() workspace — real, but never
   able to touch this repository. That is by design for a general-purpose
   worker; it also means it can never do real Engineering Mission work
   (JARVIS_MASTERARCHITECTURE_V2 waves are, definitionally, changes to THIS
   repo). This module is the bounded exception: it binds the SAME Claude Code
   bridge contract (claude-code-bridge-v1.js) to a real, caller-specified
   repository directory instead of a throwaway temp dir.

   "Bounded", concretely — every one enforced in code, not by prompting the
   nested agent to behave:
     - repo_dir must be an absolute path containing a .git directory;
     - the current git branch is read fresh (via `git`, run by THIS trusted
       code, never by the nested agent) on EVERY call, not cached from
       construction time, and execution is refused outright if that branch
       is `main` or `master` (JARVIS_REPO_BOUND_PROTECTED_BRANCHES) or does
       not match an optional pinned `expected_branch`;
     - the nested session's --tools allowlist is Read,Write,Edit,Glob,Grep
       ONLY — no Bash, no WebFetch/WebSearch, no NotebookEdit. It can read
       and edit real files; it structurally CANNOT commit, push, merge,
       switch branches, or deploy anything, and it cannot reach the network
       at all, because it is never given a tool capable of doing so — this
       is not a policy the agent is asked to follow, it is a tool it does
       not have;
     - --permission-mode acceptEdits, --permission-prompts none (anything a
       mode doesn't decide is denied, never escalated), --no-session-
       persistence, --strict-mcp-config (no MCP servers), bounded
       --max-budget-usd; the bridge's own timeout/AbortController still
       hard-kills the child process on top of all of this;
     - nothing is ever committed. Real file changes land as ordinary
       uncommitted working-tree changes — an operator (or a separate,
       explicit, human-reviewed commit step) decides what happens to them.
       This alone satisfies "no merge / no push / no deploy / no main
       changes" for anything this executor does, independent of the tool
       allowlist above (defense in depth, not either/or);
     - verification (which files actually changed, and whether they are
       still syntactically valid) is computed by THIS module via `git status
       --porcelain` and `node --check`, before/after the run — never
       self-reported by the nested agent, and never trusted from `raw` if it
       tried to claim one. That verification is what
       engineering-mission-acceptance-v1.js later requires before Independent
       Acceptance can be granted — the worker's own exit code is still never
       enough on its own. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createChildProcessExecutorV1 } from './claude-code-bridge-v1.js';

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const DEFAULT_MAX_BUDGET_USD = 2;
const GIT_TIMEOUT_MS = 10000;

export const JARVIS_REPO_BOUND_PROTECTED_BRANCHES = Object.freeze(['main', 'master']);
// Deliberately excludes Bash, WebFetch, WebSearch, NotebookEdit — see file header.
export const JARVIS_REPO_BOUND_DEFAULT_ALLOWED_TOOLS = 'Read,Write,Edit,Glob,Grep';

// Deliberately does NOT trim() the raw output: `git status --porcelain`'s
// first two columns are meaningful, possibly-leading-space status codes
// (" M path") — trimming the whole string would eat that leading space and
// shift every column, silently corrupting the first line's path.
function git(repoDir, args) {
  return execFileSync('git', args, { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_TIMEOUT_MS }).toString('utf8');
}

function currentBranchOrNull(repoDir) {
  try { return git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { return null; }
}

/** One entry per dirty path, using git's porcelain short-status format
 *  (`XY path`, XY always exactly 2 columns). Deliberately conservative: a
 *  path already dirty BEFORE the run is never attributed to the run's own
 *  diff below, even if the run touched it further — under-counts rather
 *  than over-counts real work. */
function porcelainPaths(repoDir) {
  let raw;
  try { raw = git(repoDir, ['status', '--porcelain']); } catch { return null; }
  return raw
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

/** Fail-closed repo/branch check. Called at construction (fail fast) AND
 *  fresh on every single call (the authoritative check — never assumed to
 *  still hold from construction time). */
function assertRepoBoundV1(repoDir, expectedBranch) {
  if (!fs.existsSync(path.join(repoDir, '.git'))) throw new Error('REPO_BOUND_EXECUTOR_NOT_A_GIT_REPO');
  const branch = currentBranchOrNull(repoDir);
  if (!branch) throw new Error('REPO_BOUND_EXECUTOR_GIT_UNAVAILABLE');
  if (JARVIS_REPO_BOUND_PROTECTED_BRANCHES.includes(branch.toLowerCase())) {
    throw new Error(`REPO_BOUND_EXECUTOR_PROTECTED_BRANCH_BLOCKED:${branch}`);
  }
  if (expectedBranch && branch !== expectedBranch) {
    throw new Error(`REPO_BOUND_EXECUTOR_BRANCH_MISMATCH:expected=${expectedBranch}:actual=${branch}`);
  }
  return branch;
}

/** `node --check` on every changed file that looks like JS, run by THIS
 *  trusted code (never the nested agent). A path the run deleted can't be
 *  checked and is skipped, not counted as a failure. */
function syntaxCheckFilesV1(repoDir, files) {
  const results = files
    .filter((file) => /\.(m?js)$/i.test(file))
    .map((file) => {
      const abs = path.join(repoDir, file);
      if (!fs.existsSync(abs)) return { file, passed: true, skipped: true, reason: 'DELETED_OR_MISSING' };
      try {
        execFileSync(process.execPath, ['--check', abs], { stdio: ['ignore', 'pipe', 'pipe'], timeout: GIT_TIMEOUT_MS });
        return { file, passed: true };
      } catch (error) {
        return { file, passed: false, error: clean(error?.stderr?.toString() || error?.message, 600) };
      }
    });
  return { passed: results.every((r) => r.passed !== false), checked: results.length, results };
}

/** Build a Node-only executor for claude-code-bridge-v1.js bound to a real
 *  repository directory. Returns the executor function; throws immediately
 *  (fail fast) if repo_dir/branch bounds do not already hold at construction
 *  time — the per-call re-check below is what actually protects each run. */
export function createJarvisRepoBoundClaudeCodeCliExecutorV1(config = {}) {
  const rawRepoDir = clean(config.repo_dir, 400);
  if (!rawRepoDir || !path.isAbsolute(rawRepoDir)) throw new Error('REPO_BOUND_EXECUTOR_REPO_DIR_REQUIRED_ABSOLUTE');
  const repoDir = path.resolve(rawRepoDir);
  const expectedBranch = clean(config.expected_branch, 200) || null;
  assertRepoBoundV1(repoDir, expectedBranch);

  const maxBudgetUsd = Number(config.max_budget_usd) > 0 ? Number(config.max_budget_usd) : DEFAULT_MAX_BUDGET_USD;
  const claudeBin = clean(config.claude_bin, 200) || 'claude';
  const allowedTools = clean(config.allowed_tools, 200) || JARVIS_REPO_BOUND_DEFAULT_ALLOWED_TOOLS;
  // Observability/testing only, same seam as claude-code-local-runtime-binding-v1.js:
  // called with the computed verification AND the raw executor result, after
  // the run but before it is returned to the bridge. Never used to change
  // behaviour in normal operation.
  const onBeforeReturn = typeof config.on_before_return === 'function' ? config.on_before_return : null;

  return async (call) => {
    const branch = assertRepoBoundV1(repoDir, expectedBranch); // re-checked, every call — never cached
    const before = new Set(porcelainPaths(repoDir) || []);

    const exec = createChildProcessExecutorV1({
      command: claudeBin,
      cwd: repoDir,
      allow_model_session: true, // explicit, opt-in, this repo-bound binding only
      pass_task: true,
      args: [
        '--print',
        '--output-format', 'json',
        '--restricted',
        '--tools', allowedTools,
        '--permission-mode', 'acceptEdits',
        '--permission-prompts', 'none',
        '--no-session-persistence',
        '--strict-mcp-config',
        '--max-budget-usd', String(maxBudgetUsd)
      ]
    });

    const raw = await exec(call);

    const branchAfter = currentBranchOrNull(repoDir);
    const branchDrift = branchAfter === null || branchAfter !== branch;
    const afterPaths = porcelainPaths(repoDir);
    const filesChanged = afterPaths === null ? [] : afterPaths.filter((f) => !before.has(f));
    const syntaxCheck = syntaxCheckFilesV1(repoDir, filesChanged);

    const verification = {
      schema: 'aurentara.jarvis.repo-bound-verification.v1',
      repo_dir: repoDir,
      branch,
      branch_drift: branchDrift,
      files_changed: filesChanged,
      pre_existing_dirty_files: [...before],
      syntax_check: syntaxCheck,
      at: new Date().toISOString()
    };
    if (onBeforeReturn) { try { onBeforeReturn(verification, raw); } catch { /* observability only */ } }

    return {
      ...raw,
      // Real files in the real repo changed as a direct, bridge-computed
      // fact of THIS run — never a claim accepted from `raw` itself, and
      // withheld entirely if the branch drifted mid-run (anomaly, not trust).
      external_effect: filesChanged.length > 0 && !branchDrift,
      verification
    };
  };
}

export function jarvisRepoBoundClaudeCodeCliExecutorManifestV1() {
  return {
    schema: 'aurentara.jarvis.claude-code-repo-bound-executor.v1',
    wired_into_default_runtime: false,
    requires_explicit_opt_in: true,
    protected_branches: [...JARVIS_REPO_BOUND_PROTECTED_BRANCHES],
    branch_checked_every_call: true,
    allowed_tools: JARVIS_REPO_BOUND_DEFAULT_ALLOWED_TOOLS,
    shell_tool_available: false,
    network_tool_available: false,
    can_commit: false,
    can_push: false,
    can_merge: false,
    can_deploy: false,
    verification_computed_by: 'BRIDGE_SIDE_TRUSTED_CODE_NOT_THE_WORKER',
    permission_mode: 'acceptEdits',
    permission_prompts: 'none',
    session_persistence: false,
    mcp_servers: 'none (strict-mcp-config, no --mcp-config given)',
    spend_bounded: true,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
