import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createJarvisRepoBoundClaudeCodeCliExecutorV1,
  JARVIS_REPO_BOUND_PROTECTED_BRANCHES,
  jarvisRepoBoundClaudeCodeCliExecutorManifestV1
} from '../src/jarvis/claude-code-repo-bound-executor-v1.js';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }

function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-repo-bound-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['branch', '-m', 'main']); // deterministic protected-branch name regardless of git's default
  return dir;
}

/** A fake `claude` binary: a small executable script that mutates the
 *  repo it's invoked in, standing in for the real CLI so this smoke test is
 *  deterministic and needs no network / model access. */
function makeFixtureClaudeBin(scriptBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-repo-bound-bin-'));
  const bin = path.join(dir, 'fake-claude');
  fs.writeFileSync(bin, `#!/bin/bash\n${scriptBody}\n`, { mode: 0o755 });
  return bin;
}

// ── 1. Construction refuses a directory that is not a git repo ──
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-repo-bound-notgit-'));
  assert.throws(() => createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: dir }), /NOT_A_GIT_REPO/);
}

// ── 2. Construction refuses a relative path ──
{
  assert.throws(() => createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: './relative' }), /REPO_DIR_REQUIRED_ABSOLUTE/);
}

// ── 3. Construction refuses the protected branch (main), even though the repo is otherwise valid ──
{
  const repo = makeFixtureRepo(); // left on 'main' after step above
  assert.throws(() => createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: repo }), /PROTECTED_BRANCH_BLOCKED:main/);
}

// ── 4. A non-main feature branch is accepted, and the executor genuinely writes a real file + reports it in verification ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'feature/v2-wave-0']);
  const claudeBin = makeFixtureClaudeBin(`echo 'module.exports = { ok: true };' > new-feature.js; echo '{"type":"result","result":"ok"}'; exit 0`);

  const executor = createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: repo, claude_bin: claudeBin, allowed_tools: 'Read,Write,Edit,Glob,Grep' });
  const result = await executor({ task: 'implement wave 0', signal: undefined, timeout_ms: 5000 });

  assert.equal(result.exit_code, 0);
  assert.equal(result.external_effect, true, 'a real file genuinely changed in the real repo');
  assert.ok(result.verification, 'verification evidence is present');
  assert.equal(result.verification.branch, 'feature/v2-wave-0');
  assert.equal(result.verification.branch_drift, false);
  assert.deepEqual(result.verification.files_changed, ['new-feature.js']);
  assert.equal(result.verification.syntax_check.passed, true, 'the file the fixture wrote is syntactically valid JS');
  assert.ok(fs.existsSync(path.join(repo, 'new-feature.js')), 'the file genuinely exists on disk in the real repo');

  // Nothing was ever committed — real-repo write access never implies commit access.
  const status = git(repo, ['status', '--porcelain']);
  assert.match(status, /new-feature\.js/, 'the change is still an ordinary uncommitted working-tree change');
  const log = git(repo, ['log', '--oneline']);
  assert.equal(log.split('\n').length, 1, 'no new commit was created by the executor');
}

// ── 5. A change that breaks syntax is still reported honestly (never hidden), with syntax_check.passed === false ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'feature/broken']);
  const claudeBin = makeFixtureClaudeBin(`echo 'function broken( {' > broken.js; exit 0`);
  const executor = createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: repo, claude_bin: claudeBin });
  const result = await executor({ task: 'break something', timeout_ms: 5000 });
  assert.equal(result.verification.syntax_check.passed, false);
  assert.equal(result.verification.syntax_check.results[0].passed, false);
}

// ── 6. A no-op run (no files touched) reports files_changed: [] and external_effect: false ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'feature/noop']);
  const claudeBin = makeFixtureClaudeBin(`echo '{"type":"result"}'; exit 0`);
  const executor = createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: repo, claude_bin: claudeBin });
  const result = await executor({ task: 'do nothing', timeout_ms: 5000 });
  assert.deepEqual(result.verification.files_changed, []);
  assert.equal(result.external_effect, false);
}

// ── 7. A file already dirty BEFORE the run is never attributed to the run itself ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'feature/pre-dirty']);
  fs.writeFileSync(path.join(repo, 'README.md'), '# fixture (locally edited before the run)\n');
  const claudeBin = makeFixtureClaudeBin(`echo 'module.exports = {};' > fresh.js; exit 0`);
  const executor = createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: repo, claude_bin: claudeBin });
  const result = await executor({ task: 'add a file', timeout_ms: 5000 });
  assert.deepEqual(result.verification.files_changed, ['fresh.js'], 'the pre-existing README.md edit is excluded');
  assert.deepEqual(result.verification.pre_existing_dirty_files, ['README.md']);
}

// ── 8. --tools passed to the nested CLI never includes Bash / WebFetch / WebSearch / NotebookEdit ──
{
  const repo = makeFixtureRepo();
  git(repo, ['checkout', '-q', '-b', 'feature/tools-check']);
  let capturedArgs = null;
  const wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-repo-bound-argspy-'));
  const argsFile = path.join(wrapperDir, 'args.json');
  const claudeBin = makeFixtureClaudeBin(`printf '%s\\n' "$@" > "${argsFile}"; echo ok; exit 0`);
  const executor = createJarvisRepoBoundClaudeCodeCliExecutorV1({ repo_dir: repo, claude_bin: claudeBin });
  await executor({ task: 'noop', timeout_ms: 5000 });
  capturedArgs = fs.readFileSync(argsFile, 'utf8');
  assert.match(capturedArgs, /Read,Write,Edit,Glob,Grep/);
  assert.doesNotMatch(capturedArgs, /\bBash\b/);
  assert.doesNotMatch(capturedArgs, /WebFetch/);
  assert.doesNotMatch(capturedArgs, /WebSearch/);
  assert.match(capturedArgs, /--restricted/);
  assert.match(capturedArgs, /--permission-mode\nacceptEdits/);
  assert.match(capturedArgs, /--strict-mcp-config/);
}

// ── 9. Manifest / safety invariants ──
{
  const man = jarvisRepoBoundClaudeCodeCliExecutorManifestV1();
  assert.deepEqual(man.protected_branches, ['main', 'master']);
  assert.equal(man.shell_tool_available, false);
  assert.equal(man.network_tool_available, false);
  assert.equal(man.can_commit, false);
  assert.equal(man.can_push, false);
  assert.equal(man.can_merge, false);
  assert.equal(man.can_deploy, false);
  assert.equal(man.requires_explicit_opt_in, true);
  assert.equal(man.wired_into_default_runtime, false);
  assert.deepEqual(JARVIS_REPO_BOUND_PROTECTED_BRANCHES, ['main', 'master']);
}

console.log('JARVIS repo-bound Claude Code executor V1 smoke: PASS');
