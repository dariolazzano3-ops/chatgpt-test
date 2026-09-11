import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createJarvisClaudeRepoBoundRuntimeBindingV1,
  JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG,
  JARVIS_CLAUDE_REPO_DIR_ENV,
  jarvisClaudeRepoBoundRuntimeBindingManifestV1
} from '../src/jarvis/claude-code-repo-bound-runtime-binding-v1.js';
import { resolveJarvisLocalOperatorClaudeBridgeV1 } from '../src/jarvis/local-operator-server-v1.js';
import { JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG } from '../src/jarvis/claude-code-local-runtime-binding-v1.js';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepo(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-repo-bound-binding-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', branch === 'main' ? 'main' : 'main']);
  if (branch !== 'main') git(dir, ['checkout', '-q', '-b', branch]);
  return dir;
}

// ── 1. Disabled by default ──
{
  const r = createJarvisClaudeRepoBoundRuntimeBindingV1({});
  assert.equal(r.bound, false);
  assert.equal(r.reason, 'JARVIS_CLAUDE_REPO_BOUND_EXECUTION_DISABLED');
}

// ── 2. Enabled but no repo dir named -> fails closed, never defaults to cwd ──
{
  const r = createJarvisClaudeRepoBoundRuntimeBindingV1({ [JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG]: 'on' });
  assert.equal(r.bound, false);
  assert.equal(r.reason, 'JARVIS_CLAUDE_REPO_DIR_REQUIRED');
}

// ── 3. Enabled, repo dir named, but repo is on a protected branch -> fails closed with the real reason, never fabricated ──
{
  const repo = makeFixtureRepo('main');
  const r = createJarvisClaudeRepoBoundRuntimeBindingV1({
    [JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG]: 'on',
    [JARVIS_CLAUDE_REPO_DIR_ENV]: repo
  });
  assert.equal(r.bound, false);
  assert.match(r.reason, /PROTECTED_BRANCH_BLOCKED:main/);
}

// ── 4. Enabled, real repo, non-main branch -> genuinely binds ──
{
  const repo = makeFixtureRepo('feature/v2-wave-0');
  const r = createJarvisClaudeRepoBoundRuntimeBindingV1({
    [JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG]: 'on',
    [JARVIS_CLAUDE_REPO_DIR_ENV]: repo
  });
  assert.equal(r.bound, true);
  assert.equal(r.bridge.bound, true);
  assert.equal(r.reason, null);
}

// ── 5. Local-operator resolver: repo-bound takes precedence when both flags are set, and never invokes the real CLI preflight in tests via skip_cli_preflight ──
{
  const repo = makeFixtureRepo('feature/v2-wave-0');
  const r = resolveJarvisLocalOperatorClaudeBridgeV1({
    [JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG]: 'on',
    [JARVIS_CLAUDE_REPO_BOUND_EXECUTION_FLAG]: 'on',
    [JARVIS_CLAUDE_REPO_DIR_ENV]: repo
  }, { skip_cli_preflight: true });
  assert.equal(r.worker_kind, 'REPO_BOUND');
  assert.equal(r.bound, true);
}

// ── 6. Local-operator resolver: disposable-tmp mode still works unchanged when repo-bound is not requested ──
{
  const r = resolveJarvisLocalOperatorClaudeBridgeV1({
    [JARVIS_CLAUDE_LOCAL_EXECUTION_FLAG]: 'on'
  }, { skip_cli_preflight: true });
  assert.equal(r.worker_kind, 'DISPOSABLE_TMP');
  assert.equal(r.bound, true);
}

// ── 7. Local-operator resolver: neither flag set -> not bound, not requested (unchanged default) ──
{
  const r = resolveJarvisLocalOperatorClaudeBridgeV1({}, { skip_cli_preflight: true });
  assert.equal(r.bound, false);
  assert.equal(r.requested, false);
  assert.equal(r.worker_kind, null);
}

// ── 8. Manifest / safety invariants ──
{
  const man = jarvisClaudeRepoBoundRuntimeBindingManifestV1();
  assert.equal(man.default, 'off');
  assert.equal(man.repo_dir_has_default, false);
  assert.equal(man.imported_by_deployed_worker, false);
  assert.equal(man.can_commit, false);
  assert.equal(man.can_push, false);
  assert.equal(man.can_merge, false);
  assert.equal(man.can_deploy, false);
  assert.equal(man.fail_closed_when_protected_branch, true);
  assert.equal(man.production_deploy, false);
  assert.equal(man.hamyren_data_flow, false);
}

console.log('JARVIS repo-bound Claude Code runtime binding V1 (+ local-operator wiring) smoke: PASS');
