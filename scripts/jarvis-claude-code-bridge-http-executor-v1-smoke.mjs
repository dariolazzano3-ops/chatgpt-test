/* JARVIS Bridge HTTP executor V1 — targeted smoke test.

   CI-safe: binds a real, local, ephemeral fixture HTTP server standing in
   for the private jarvis-claude Bridge — no real VPS/network dependency.
   Proves the executor (1) succeeds and normalizes a real response, (2)
   fails closed on every failure mode Task D asked for, (3) never leaks the
   Authorization/token value anywhere, and (4) never falls back to a local
   CLI. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import {
  createJarvisBridgeHttpExecutorV1,
  jarvisBridgeHttpExecutorManifestV1
} from '../src/jarvis/claude-code-bridge-http-executor-v1.js';
import {
  createJarvisBridgeHttpRuntimeBindingV1,
  preflightJarvisBridgeHttpV1,
  resolveBridgeHttpTimeoutMsV1,
  BRIDGE_HTTP_MIN_TIMEOUT_MS,
  BRIDGE_HTTP_DEFAULT_TIMEOUT_MS,
  BRIDGE_HTTP_MAX_TIMEOUT_MS,
  jarvisBridgeHttpRuntimeBindingManifestV1
} from '../src/jarvis/claude-code-bridge-http-runtime-binding-v1.js';
import { evaluateJarvisRepoBoundVerificationV1 } from '../src/jarvis/engineering-mission-acceptance-v1.js';

const FIXTURE_TOKEN = 'fixture-bridge-token-not-real-8f2c9a';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

/** A tiny fixture Bridge: `handler(req, body)` decides the response. Returns
 *  { url, close }. */
function startFixtureBridgeV1(handler) {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
      handler(req, res, body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

function jsonRes(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(text);
}

const baseCall = { task: 'implement the thing', workspace: '/workspace/projects/chatgpt-test', correlation_id: crypto.randomUUID(), owner_ref: 'jarvis:operator:op@example.invalid' };

// ── 1. successful Bridge execution ──
await check('1. successful Bridge execution normalizes into the executor contract', async () => {
  const fixture = await startFixtureBridgeV1((req, res, body) => {
    assert.equal(req.headers.authorization, `Bearer ${FIXTURE_TOKEN}`);
    assert.equal(body.project, 'chatgpt-test');
    assert.equal(body.mode, 'implement');
    assert.equal(body.prompt, baseCall.task);
    jsonRes(res, 200, {
      ok: true, service: 'jarvis-claude-bridge', version: 4, mode: 'implement', project: 'chatgpt-test',
      exit_code: 0, git_evidence: { files_changed: ['a.js'] }, filesystem_evidence: { changed: 1 },
      tool_audit: [{ tool: 'Write', path: 'a.js' }], stderr: ''
    });
  });
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.equal(result.exit_code, 0);
    assert.equal(result.external_effect, true);
    assert.equal(result.verification.schema, 'aurentara.jarvis.bridge-http-verification.v1');
    assert.deepEqual(result.verification.git_evidence, { files_changed: ['a.js'] });
    assert.deepEqual(result.verification.filesystem_evidence, { changed: 1 });
    assert.deepEqual(result.verification.tool_audit, [{ tool: 'Write', path: 'a.js' }]);
  } finally {
    await fixture.close();
  }
});

// ── 2. Bridge unreachable ──
await check('2. Bridge unreachable fails closed, never throws past the executor as a crash', async () => {
  const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: 'http://127.0.0.1:1', bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
  await assert.rejects(() => executor(baseCall), /BRIDGE_HTTP_UNREACHABLE/);
});

// ── 3. HTTP 401 ──
await check('3. HTTP 401 fails closed with a non-zero exit_code, no throw', async () => {
  const fixture = await startFixtureBridgeV1((req, res) => jsonRes(res, 401, { error: 'unauthorized' }));
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: 'wrong-token', project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.equal(result.exit_code, 1);
    assert.match(result.stderr, /BRIDGE_HTTP_401/);
  } finally {
    await fixture.close();
  }
});

// ── 4 & 5. timeout / AbortSignal ──
await check('4. a caller-provided AbortSignal genuinely cancels the in-flight request (covers timeout via the outer bridge and direct cancellation)', async () => {
  const fixture = await startFixtureBridgeV1((req, res) => {
    // Never respond — simulates a hung Bridge; the executor must not hang forever.
    req.socket.on('close', () => {});
  });
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const controller = new AbortController();
    const runPromise = executor({ ...baseCall, signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(() => runPromise, /BRIDGE_HTTP_UNREACHABLE/);
  } finally {
    await fixture.close();
  }
});

// ── 6. malformed JSON ──
await check('6. malformed JSON response fails closed', async () => {
  const fixture = await startFixtureBridgeV1((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{not valid json');
  });
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.equal(result.exit_code, 1);
    assert.match(result.stderr, /BRIDGE_RESPONSE_NOT_JSON/);
  } finally {
    await fixture.close();
  }
});

// ── 7. oversized response ──
await check('7. an oversized response is refused rather than buffered without limit', async () => {
  const fixture = await startFixtureBridgeV1((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    // Well over the 2_000_000-byte cap.
    res.end(JSON.stringify({ ok: true, stderr: 'x'.repeat(3_000_000) }));
  });
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.equal(result.exit_code, 1);
    assert.match(result.stderr, /BRIDGE_RESPONSE_TOO_LARGE/);
  } finally {
    await fixture.close();
  }
});

// ── 8. bridge ok=false ──
await check('8. bridge ok=false is a failed execution, evidence still preserved', async () => {
  const fixture = await startFixtureBridgeV1((req, res) => jsonRes(res, 200, {
    ok: false, mode: 'implement', project: 'chatgpt-test', exit_code: 2, stderr: 'claude exited non-zero',
    git_evidence: { files_changed: [] }, filesystem_evidence: null, tool_audit: []
  }));
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.equal(result.exit_code, 2);
    assert.match(result.stderr, /claude exited non-zero/);
    assert.equal(result.verification.mode, 'implement');
  } finally {
    await fixture.close();
  }
});

// ── 9, 10, 11. git_evidence / filesystem_evidence / tool_audit preserved even through a bounded round trip ──
await check('9-11. git_evidence, filesystem_evidence, and tool_audit all survive the adapter unmodified', async () => {
  const evidence = {
    git_evidence: { schema: 'fixture', diff: 'a.js changed', commits: 0 },
    filesystem_evidence: { created: ['a.js'], deleted: [] },
    tool_audit: [{ tool: 'Read', path: 'b.js' }, { tool: 'Edit', path: 'a.js' }]
  };
  const fixture = await startFixtureBridgeV1((req, res) => jsonRes(res, 200, { ok: true, exit_code: 0, mode: 'implement', project: 'chatgpt-test', stderr: '', ...evidence }));
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.deepEqual(result.verification.git_evidence, evidence.git_evidence);
    assert.deepEqual(result.verification.filesystem_evidence, evidence.filesystem_evidence);
    assert.deepEqual(result.verification.tool_audit, evidence.tool_audit);
  } finally {
    await fixture.close();
  }
});

// ── 12. Authorization secret never appears in any error/log ──
await check('12. the bridge token never appears in a thrown error or a returned stderr string', async () => {
  const unreachableExecutor = createJarvisBridgeHttpExecutorV1({ bridge_url: 'http://127.0.0.1:1', bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
  try {
    await unreachableExecutor(baseCall);
    assert.fail('expected a rejection');
  } catch (error) {
    assert.doesNotMatch(String(error?.message), new RegExp(FIXTURE_TOKEN));
  }

  const fixture = await startFixtureBridgeV1((req, res) => jsonRes(res, 500, { error: 'internal' }));
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor(baseCall);
    assert.doesNotMatch(result.stderr, new RegExp(FIXTURE_TOKEN));
  } finally {
    await fixture.close();
  }

  // Source-level: the executor never builds a string containing the raw
  // header name alongside anything that could be a token interpolation
  // outside the one deliberate `authorization: \`Bearer ${token}\`` header
  // object property — never inside a template literal used for logging.
  const src = fs.readFileSync(new URL('../src/jarvis/claude-code-bridge-http-executor-v1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /console\.(log|error|warn)/, 'this file must never log anything itself (no seam for a token to leak through)');
});

// ── workspace/project scope is pinned server-side, never caller-overridable ──
// Bridge's own /v1/run contract has no branch/workspace field at all — it
// only ever receives {prompt, project, mode}. Protected-branch refusal
// (main/master) is enforced upstream, before dispatch, by the existing
// Program Controller / branch-manager-v1.js path (unchanged by this
// adapter — see the regression smokes) and is never duplicated or
// reachable here. This proves the adapter itself cannot be tricked into
// sending a different project no matter what a caller's `workspace` says.
await check('wrong/foreign workspace on the call object never changes the server-configured project sent to Bridge', async () => {
  const fixture = await startFixtureBridgeV1((req, res, body) => {
    assert.equal(body.project, 'chatgpt-test', 'project is pinned by executor config, never by the call');
    jsonRes(res, 200, { ok: true, exit_code: 0, mode: 'implement', project: 'chatgpt-test', stderr: '' });
  });
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor({ ...baseCall, workspace: '/workspace/projects/some-other-repo' });
    assert.equal(result.exit_code, 0);
  } finally {
    await fixture.close();
  }
});

// ── 13. no local-Claude fallback ──
await check('13. neither Bridge HTTP file imports a local/repo-bound Claude CLI path', () => {
  for (const file of ['claude-code-bridge-http-executor-v1.js', 'claude-code-bridge-http-runtime-binding-v1.js']) {
    const src = fs.readFileSync(new URL(`../src/jarvis/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /node:child_process/, `${file} must never spawn a local process`);
    assert.doesNotMatch(src, /from\s+['"][^'"]*claude-code-repo-bound/, `${file} must never import the local-CLI repo-bound path`);
    assert.doesNotMatch(src, /from\s+['"][^'"]*claude-code-local-runtime-binding/, `${file} must never import the disposable-tmp local path`);
  }
});

// ── health preflight: real, bounded, never optimistic ──
await check('health preflight fails closed on non-2xx, malformed JSON, ok:false, and unreachable — succeeds only on a genuine ok:true body', async () => {
  const okFixture = await startFixtureBridgeV1((req, res) => {
    if (req.url === '/health') return jsonRes(res, 200, { ok: true, service: 'jarvis-claude-bridge', version: 4 });
    jsonRes(res, 404, {});
  });
  try {
    const ok = await preflightJarvisBridgeHttpV1(okFixture.url);
    assert.equal(ok.ok, true);
    assert.equal(ok.service, 'jarvis-claude-bridge');
  } finally {
    await okFixture.close();
  }

  const badFixture = await startFixtureBridgeV1((req, res) => jsonRes(res, 200, { ok: false }));
  try {
    const bad = await preflightJarvisBridgeHttpV1(badFixture.url);
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, 'BRIDGE_HEALTH_NOT_OK');
  } finally {
    await badFixture.close();
  }

  const unreachable = await preflightJarvisBridgeHttpV1('http://127.0.0.1:1', { timeout_ms: 500 });
  assert.equal(unreachable.ok, false);
  assert.match(unreachable.reason, /BRIDGE_HEALTH_UNREACHABLE/);
});

// ── runtime timeout contract: a configured client deadline may never pre-empt Bridge V5's 900s worker deadline ──
assert.equal(resolveBridgeHttpTimeoutMsV1(), BRIDGE_HTTP_DEFAULT_TIMEOUT_MS);
assert.equal(resolveBridgeHttpTimeoutMsV1('not-a-number'), BRIDGE_HTTP_DEFAULT_TIMEOUT_MS);
assert.equal(resolveBridgeHttpTimeoutMsV1(300_000), BRIDGE_HTTP_MIN_TIMEOUT_MS, 'legacy 5-minute config is raised to the safe floor');
assert.equal(resolveBridgeHttpTimeoutMsV1(930_000), BRIDGE_HTTP_MIN_TIMEOUT_MS);
assert.equal(resolveBridgeHttpTimeoutMsV1(99_999_999), BRIDGE_HTTP_MAX_TIMEOUT_MS);
assert.ok(BRIDGE_HTTP_MIN_TIMEOUT_MS > 900_000);

// ── runtime binding: fail-closed wiring, opt-in, no fabricated binding ──
await check('runtime binding is off by default, requires URL+token, fails closed when health check fails, never fabricates bound:true', async () => {
  const off = await createJarvisBridgeHttpRuntimeBindingV1({});
  assert.equal(off.requested, false);
  assert.equal(off.bound, false);

  const noUrl = await createJarvisBridgeHttpRuntimeBindingV1({ JARVIS_BRIDGE_HTTP_EXECUTION: 'on' });
  assert.equal(noUrl.bound, false);
  assert.equal(noUrl.reason, 'JARVIS_BRIDGE_URL_REQUIRED');

  const noToken = await createJarvisBridgeHttpRuntimeBindingV1({ JARVIS_BRIDGE_HTTP_EXECUTION: 'on', JARVIS_BRIDGE_URL: 'http://127.0.0.1:1' });
  assert.equal(noToken.bound, false);
  assert.equal(noToken.reason, 'JARVIS_BRIDGE_TOKEN_REQUIRED');

  const unhealthy = await createJarvisBridgeHttpRuntimeBindingV1(
    { JARVIS_BRIDGE_HTTP_EXECUTION: 'on', JARVIS_BRIDGE_URL: 'http://127.0.0.1:1', JARVIS_BRIDGE_TOKEN: FIXTURE_TOKEN },
    { health_timeout_ms: 500 }
  );
  assert.equal(unhealthy.bound, false);
  assert.match(unhealthy.reason, /BRIDGE_UNAVAILABLE/);

  const healthyFixture = await startFixtureBridgeV1((req, res) => {
    if (req.url === '/health') return jsonRes(res, 200, { ok: true, service: 'jarvis-claude-bridge', version: 4 });
    jsonRes(res, 404, {});
  });
  try {
    const bound = await createJarvisBridgeHttpRuntimeBindingV1(
      { JARVIS_BRIDGE_HTTP_EXECUTION: 'on', JARVIS_BRIDGE_URL: healthyFixture.url, JARVIS_BRIDGE_TOKEN: FIXTURE_TOKEN }
    );
    assert.equal(bound.bound, true);
    assert.equal(bound.bridge.bound, true);
    const manifest = jarvisBridgeHttpRuntimeBindingManifestV1();
    assert.equal(manifest.bridge_server_worker_timeout_ms, 900000);
    assert.equal(manifest.minimum_timeout_ms, 930000);
    assert.equal(manifest.default_timeout_ms, 930000);
    assert.equal(manifest.maximum_timeout_ms, 960000);
    assert.equal(manifest.configured_timeout_cannot_preempt_server_worker, true);
    assert.equal(manifest.client_timeout_exceeds_server_worker_timeout, true, 'client deadline must be later than Bridge server worker kill deadline');
  } finally {
    await healthyFixture.close();
  }
});

// ── canonical repo-bound verification: closes the acceptance-evidence contract gap ──
function git(dir, args) { return execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim(); }
function makeFixtureRepoV1(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-bridge-verification-fixture-'));
  git(dir, ['init', '-q']);
  git(dir, ['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
  git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  git(dir, ['config', 'user.name', 'Fixture']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

await check('with repo_dir configured, a real file change is independently verified and satisfies Independent Acceptance (evaluateJarvisRepoBoundVerificationV1)', async () => {
  const repo = makeFixtureRepoV1('factory/bridge-verification-smoke');
  try {
    const fixture = await startFixtureBridgeV1((req, res) => {
      // Simulate Claude having genuinely edited a real, valid file inside
      // the shared repo before Bridge responds.
      fs.writeFileSync(path.join(repo, 'healthz.js'), 'module.exports = () => ({ ok: true });\n');
      jsonRes(res, 200, {
        ok: true, service: 'jarvis-claude-bridge', version: 4, mode: 'implement', project: 'chatgpt-test',
        exit_code: 0, stderr: '',
        git_evidence: { diff: 'healthz.js added' }, filesystem_evidence: { created: ['healthz.js'] },
        tool_audit: [{ tool: 'Write', path: 'healthz.js' }]
      });
    });
    try {
      const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test', repo_dir: repo });
      const result = await executor({ task: 'add healthz' });

      assert.equal(result.verification.schema, 'aurentara.jarvis.repo-bound-verification.v1');
      assert.equal(result.verification.branch, 'factory/bridge-verification-smoke');
      assert.equal(result.verification.branch_drift, false);
      assert.deepEqual(result.verification.files_changed, ['healthz.js']);
      assert.equal(result.verification.syntax_check.passed, true);
      assert.equal(result.verification.syntax_check.checked, 1);
      // Bridge's raw evidence is still merged in, unmodified.
      assert.deepEqual(result.verification.git_evidence, { diff: 'healthz.js added' });
      assert.deepEqual(result.verification.tool_audit, [{ tool: 'Write', path: 'healthz.js' }]);
      assert.equal(result.external_effect, true);

      // The actual acceptance gate: this is the direct proof the evidence
      // contract gap is closed — the SAME function
      // engineering-mission-acceptance-v1.js uses now accepts Bridge HTTP
      // evidence, with no change to that file at all.
      const acceptance = evaluateJarvisRepoBoundVerificationV1(result.verification);
      assert.equal(acceptance.sufficient, true, JSON.stringify(acceptance));
    } finally {
      await fixture.close();
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('syntax validation remains mandatory: a genuinely broken file still fails Independent Acceptance, never bypassed', async () => {
  const repo = makeFixtureRepoV1('factory/bridge-verification-syntax-fail');
  try {
    const fixture = await startFixtureBridgeV1((req, res) => {
      // Simulate a broken edit — invalid JS syntax.
      fs.writeFileSync(path.join(repo, 'broken.js'), 'module.exports = ( => {\n');
      jsonRes(res, 200, { ok: true, exit_code: 0, mode: 'implement', project: 'chatgpt-test', stderr: '', git_evidence: {}, filesystem_evidence: {}, tool_audit: [] });
    });
    try {
      const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test', repo_dir: repo });
      const result = await executor({ task: 'break it' });

      assert.equal(result.verification.syntax_check.passed, false, 'a genuinely invalid file must fail the syntax check');
      const acceptance = evaluateJarvisRepoBoundVerificationV1(result.verification);
      assert.equal(acceptance.sufficient, false);
      assert.equal(acceptance.reason, 'SYNTAX_CHECK_FAILED_OR_MISSING');
    } finally {
      await fixture.close();
    }
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

await check('without repo_dir configured, verification falls back to Bridge-only evidence, unchanged from before', async () => {
  const fixture = await startFixtureBridgeV1((req, res) => jsonRes(res, 200, {
    ok: true, exit_code: 0, mode: 'implement', project: 'chatgpt-test', stderr: '',
    git_evidence: { x: 1 }, filesystem_evidence: { y: 2 }, tool_audit: []
  }));
  try {
    const executor = createJarvisBridgeHttpExecutorV1({ bridge_url: fixture.url, bridge_token: FIXTURE_TOKEN, project: 'chatgpt-test' });
    const result = await executor({ task: 'no repo dir' });
    assert.equal(result.verification.schema, 'aurentara.jarvis.bridge-http-verification.v1');
    assert.equal(result.verification.branch, undefined, 'no canonical fields fabricated without repo_dir');
  } finally {
    await fixture.close();
  }
});

// ── manifests are honest ──
await check('manifests declare no local-CLI fallback and server-side-only token source', () => {
  const executorManifest = jarvisBridgeHttpExecutorManifestV1();
  assert.equal(executorManifest.local_cli_fallback, false);
  assert.equal(executorManifest.token_source, 'SERVER_SIDE_CONFIG_ONLY');
  assert.equal(executorManifest.token_ever_logged, false);
  assert.equal(executorManifest.canonical_verification_schema, 'aurentara.jarvis.repo-bound-verification.v1');
  assert.equal(executorManifest.syntax_check_mandatory_when_repo_dir_configured, true);
  assert.equal(executorManifest.shares_verification_computation_with_local_cli_executor, true);

  const bindingManifest = jarvisBridgeHttpRuntimeBindingManifestV1();
  assert.equal(bindingManifest.local_cli_fallback, false);
  assert.equal(bindingManifest.health_preflight_required, true);
  assert.equal(bindingManifest.default, 'off');
  assert.equal(bindingManifest.canonical_verification_wired, true);
});

console.log(JSON.stringify({
  schema: 'aurentara.jarvis.claude-code-bridge-http-executor.smoke.v1',
  passed,
  live_bridge_network_call: false,
  live_claude_cli_invoked: false,
  secret_ever_printed: false
}, null, 2));
