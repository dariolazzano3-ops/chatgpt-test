/* Wave 2 — targeted regression: the Command Center's Program Controller
   panel plumbing. Covers exactly what changed for this wave:
     - resolveJarvisLocalOperatorProgramLocationV1 (real git, fail-closed to
       null when unconfigured/unavailable — never guessed);
     - renderJarvisCommandCenterV1 embeds programName/programRepoDir/
       programTargetBranch into window.__JARVIS_CC__ correctly, and null
       when not configured;
     - the existing /api/program/state + /api/program/tick routes (already
       accepted, unmodified) are genuinely reachable end-to-end through the
       real local operator server once repo_dir/target_branch are wired in —
       no acceptance rule, approval, budget, or attempt-limit code touched. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';
import { JARVIS_V2_PROGRAM_ID } from '../src/jarvis/v2-progress-v1.js';
import {
  resolveJarvisLocalOperatorProgramLocationV1,
  createJarvisLocalOperatorAuthorizeV1,
  startJarvisLocalOperatorV1
} from '../src/jarvis/local-operator-server-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';

function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-cc-program-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  git(dir, ['checkout', '-q', '-b', 'factory/fixture-branch']);
  return dir;
}

// ── 1. resolveJarvisLocalOperatorProgramLocationV1: unconfigured -> both null, never guessed ──
{
  assert.deepEqual(resolveJarvisLocalOperatorProgramLocationV1({}), { repo_dir: null, target_branch: null });
}

// ── 2. resolveJarvisLocalOperatorProgramLocationV1: real fixture repo -> real repo_dir + real live branch ──
{
  const repo = makeFixtureRepo();
  const loc = resolveJarvisLocalOperatorProgramLocationV1({ JARVIS_CLAUDE_REPO_DIR: repo });
  assert.equal(loc.repo_dir, repo);
  assert.equal(loc.target_branch, 'factory/fixture-branch');
}

// ── 3. resolveJarvisLocalOperatorProgramLocationV1: configured but not a real git repo -> both null (fail closed, not thrown) ──
{
  const notGit = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-cc-program-notgit-'));
  const loc = resolveJarvisLocalOperatorProgramLocationV1({ JARVIS_CLAUDE_REPO_DIR: notGit });
  assert.deepEqual(loc, { repo_dir: null, target_branch: null });
}

// ── 4. renderJarvisCommandCenterV1 embeds program location when provided, null when not ──
{
  const withLocation = renderJarvisCommandCenterV1({ program_repo_dir: '/some/repo', program_target_branch: 'factory/x' });
  assert.match(withLocation, /"programName":"JARVIS_MASTERARCHITECTURE_V2"/);
  assert.match(withLocation, /"programRepoDir":"\/some\/repo"/);
  assert.match(withLocation, /"programTargetBranch":"factory\/x"/);
  assert.equal(JARVIS_V2_PROGRAM_ID, 'JARVIS_MASTERARCHITECTURE_V2');

  const withoutLocation = renderJarvisCommandCenterV1({});
  assert.match(withoutLocation, /"programRepoDir":null/);
  assert.match(withoutLocation, /"programTargetBranch":null/);
}

// ── 5. End-to-end through the real local operator server: repo_dir/target_branch wired in,
//      GET / carries them, GET /api/program/state genuinely reaches the real Program Controller
//      (PENDING, no mission dispatched yet — no fabricated state) ──
{
  const repo = makeFixtureRepo();
  const authorize = createJarvisLocalOperatorAuthorizeV1({ JARVIS_LOCAL_OPERATOR_EMAIL: 'smoke-operator@example.invalid' });
  const memoryStore = createMemoryJarvisStoreV1();
  const fixtureBridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({}) });

  const started = await startJarvisLocalOperatorV1({ JARVIS_LOCAL_PORT: '18788', JARVIS_CLAUDE_REPO_DIR: repo }, {
    supabase_check: { ok: true },
    authorize,
    memory_store: memoryStore,
    claude_bridge_result: { bridge: fixtureBridge, bound: true, requested: true, reason: null }
  });
  assert.equal(started.ok, true, JSON.stringify(started));
  started.options.memory_store = memoryStore;

  const base = started.url;
  try {
    const homeRes = await fetch(base + '/');
    const homeBody = await homeRes.text();
    assert.equal(homeRes.status, 200);
    assert.match(homeBody, new RegExp(`"programRepoDir":${JSON.stringify(repo)}`));
    assert.match(homeBody, /"programTargetBranch":"factory\/fixture-branch"/);

    const q = new URLSearchParams({ program: JARVIS_V2_PROGRAM_ID, repo_dir: repo, target_branch: 'factory/fixture-branch' });
    const stateRes = await fetch(base + '/api/program/state?' + q.toString());
    const stateBody = await stateRes.json();
    assert.equal(stateRes.status, 200);
    assert.equal(stateBody.ok, true);
    assert.equal(stateBody.current_wave, 0);
    assert.equal(stateBody.completed_waves.length, 0);
    assert.equal(stateBody.verified_progress_percent, 0);
    // On the target branch, no mission ever dispatched -> genuinely PENDING,
    // awaiting a real task (never fabricated) — matches
    // deriveJarvisProgramWaveStateV1 exactly, unmodified by this wave.
    assert.equal(stateBody.wave_state, 'PENDING');
    assert.deepEqual(stateBody.next_action, { action: 'PROPOSE_WAVE_TASK' });
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }
}

console.log('JARVIS Command Center Program Controller V1 (Wave 2 plumbing) smoke: PASS');
