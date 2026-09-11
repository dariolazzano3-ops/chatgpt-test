import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createLocalClaudeCodeCliExecutorV1 } from '../src/jarvis/claude-code-local-cli-executor-v1.js';

/* Static/bounds regression for the opt-in local Claude Code CLI executor
   adapter. This does NOT invoke the `claude` CLI — that happens exactly once,
   deliberately, in scripts/jarvis-live-claude-cli-smoke-v1.mjs. Here we only
   verify the adapter's own hard bounds refuse anything outside a disposable
   /tmp workspace, and never weaken by default. */

// ── refuses a missing / relative / non-tmp workspace_dir ──
assert.throws(() => createLocalClaudeCodeCliExecutorV1({}), /WORKSPACE_DIR_REQUIRED_ABSOLUTE/);
assert.throws(() => createLocalClaudeCodeCliExecutorV1({ workspace_dir: 'relative/dir' }), /WORKSPACE_DIR_REQUIRED_ABSOLUTE/);
assert.throws(() => createLocalClaudeCodeCliExecutorV1({ workspace_dir: process.cwd() }), /MUST_BE_DISPOSABLE_TMP/);
assert.throws(() => createLocalClaudeCodeCliExecutorV1({ workspace_dir: '/etc' }), /MUST_BE_DISPOSABLE_TMP/);
assert.throws(() => createLocalClaudeCodeCliExecutorV1({ workspace_dir: path.resolve(os.tmpdir()) }), /MUST_BE_DISPOSABLE_TMP/);

// ── accepts a genuine disposable subdirectory of the OS temp dir ──
const validDir = path.join(os.tmpdir(), 'jarvis-local-cli-executor-smoke-check');
const executor = createLocalClaudeCodeCliExecutorV1({ workspace_dir: validDir });
assert.equal(typeof executor, 'function');

console.log('JARVIS local Claude Code CLI executor V1 smoke: PASS');
