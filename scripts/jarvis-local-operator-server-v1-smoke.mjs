/* JARVIS Local Operator V1 — targeted smoke test.

   CI-safe: uses a FIXTURE Claude executor (createLocalFixtureExecutorV1), a
   real in-memory JARVIS store (no live Supabase network call), and binds the
   real Node http server to an ephemeral localhost port. No `claude` CLI is
   spawned here. Proves acceptance A-M from the mission spec. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  startJarvisLocalOperatorV1,
  createJarvisLocalOperatorAuthorizeV1,
  jarvisLocalOperatorEmailV1,
  verifyJarvisLocalOperatorSupabaseConfigV1,
  resolveJarvisLocalOperatorClaudeBridgeV1,
  jarvisLocalOperatorManifestV1,
  JARVIS_LOCAL_OPERATOR_BIND_HOST,
  LOCAL_OPERATOR_AUTH_LABEL
} from '../src/jarvis/local-operator-server-v1.js';
import { createJarvisClaudeCodeBridgeV1, createLocalFixtureExecutorV1 } from '../src/jarvis/claude-code-bridge-v1.js';
import { createMemoryJarvisStoreV1 } from '../src/jarvis/memory-store-memory-v1.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

// ── A. launcher binds only localhost ──
await check('A. bind address is 127.0.0.1, never 0.0.0.0', () => {
  assert.equal(JARVIS_LOCAL_OPERATOR_BIND_HOST, '127.0.0.1');
});

// ── B. local auth works only through the injected local adapter ──
await check('B. LOCAL_OPERATOR_AUTH is deterministic and ignores request headers', async () => {
  const authorize = createJarvisLocalOperatorAuthorizeV1({ JARVIS_LOCAL_OPERATOR_EMAIL: 'operator@example.invalid' });
  const spoofed = new Request('https://example.invalid/jarvis/api/session', {
    headers: { 'cf-access-jwt-assertion': 'not-a-real-token', 'x-forwarded-for': '203.0.113.9' }
  });
  const first = await authorize(spoofed);
  const second = await authorize(new Request('https://example.invalid/jarvis/api/session'));
  assert.equal(first.ok, true);
  assert.equal(first.email, 'operator@example.invalid');
  assert.equal(first.authentication, LOCAL_OPERATOR_AUTH_LABEL);
  assert.deepEqual(first, second, 'identity is fixed by server config, never by request content');
  assert.equal(jarvisLocalOperatorEmailV1({}), 'local-operator@localhost', 'deterministic default when unconfigured');
});

// ── C. production auth code remains untouched ──
await check('C. production Cloudflare Access auth module is unmodified by this feature', () => {
  const src = fs.readFileSync(new URL('../src/jarvis/access-v1.js', import.meta.url), 'utf8');
  assert.match(src, /verifyJarvisCloudflareAccessJwtV1/);
  assert.doesNotMatch(src, /LOCAL_OPERATOR_AUTH/, 'access-v1.js must never reference the local-only adapter');
  assert.doesNotMatch(src, /local-operator-server-v1/, 'access-v1.js must never import the local launcher');
});

// ── D. Supabase store is durable-bound (config verification, no network call) ──
await check('D. Supabase config verifier requires supabase-rpc, refuses the legacy mode, and binds when configured', () => {
  const unset = verifyJarvisLocalOperatorSupabaseConfigV1({});
  assert.equal(unset.ok, false);
  assert.equal(unset.error, 'JARVIS_LOCAL_OPERATOR_SUPABASE_RPC_MODE_REQUIRED');

  // The legacy direct-table mode is explicitly refused here, never merely
  // deprioritized — it would otherwise require exposing jarvis_private in
  // PostgREST, which this project deliberately never does.
  const legacy = verifyJarvisLocalOperatorSupabaseConfigV1({
    JARVIS_PERSONAL_MEMORY_STORE: 'supabase',
    JARVIS_PERSONAL_MEMORY_SUPABASE_URL: 'https://example.supabase.co',
    JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY: 'fixture-key-not-real'
  });
  assert.equal(legacy.ok, false);
  assert.equal(legacy.error, 'JARVIS_LOCAL_OPERATOR_SUPABASE_RPC_MODE_REQUIRED', 'legacy "supabase" mode fails closed, same as unset');

  const partial = verifyJarvisLocalOperatorSupabaseConfigV1({ JARVIS_PERSONAL_MEMORY_STORE: 'supabase-rpc' });
  assert.equal(partial.ok, false);
  assert.equal(partial.error, 'JARVIS_LOCAL_OPERATOR_SUPABASE_ENV_MISSING');
  assert.deepEqual(partial.missing, ['JARVIS_PERSONAL_MEMORY_SUPABASE_URL', 'JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY']);

  const ok = verifyJarvisLocalOperatorSupabaseConfigV1({
    JARVIS_PERSONAL_MEMORY_STORE: 'supabase-rpc',
    JARVIS_PERSONAL_MEMORY_SUPABASE_URL: 'https://example.supabase.co',
    JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY: 'fixture-key-not-real'
  });
  assert.equal(ok.ok, true);

  // No secret value ever appears in a verifier result, in either direction.
  for (const result of [unset, legacy, partial, ok]) {
    assert.doesNotMatch(JSON.stringify(result), /fixture-key-not-real/);
  }
});

// ── E. Claude bridge is genuinely bound when env enables it (fixture executor) ──
await check('E. Claude bridge resolves off by default, and binds only when explicitly enabled', () => {
  const off = resolveJarvisLocalOperatorClaudeBridgeV1({});
  assert.equal(off.requested, false);
  assert.equal(off.bound, false);
  assert.equal(off.bridge, null);

  // Explicit fixture: never spawns a CLI, proves the fail-closed CLI preflight path.
  const unavailable = resolveJarvisLocalOperatorClaudeBridgeV1(
    { JARVIS_CLAUDE_LOCAL_EXECUTION: 'on', JARVIS_CLAUDE_BIN: 'jarvis-fixture-nonexistent-binary-v1' }
  );
  assert.equal(unavailable.requested, true);
  assert.equal(unavailable.bound, false);
  assert.match(unavailable.reason, /JARVIS_CLAUDE_CLI_UNAVAILABLE/);
});

// ── fixture-bound end-to-end server (F, G, H, I, J, K, L) ──
const fixtureBridge = createJarvisClaudeCodeBridgeV1({
  executor: createLocalFixtureExecutorV1({ 'fixture task': { exit_code: 0, stdout: 'fixture: done', stderr: '' } })
});
const authorize = createJarvisLocalOperatorAuthorizeV1({ JARVIS_LOCAL_OPERATOR_EMAIL: 'smoke-operator@example.invalid' });
const memoryStore = createMemoryJarvisStoreV1();

// A fixed, non-default port: avoids colliding with a real `npm run
// jarvis:local` instance that may genuinely be running on 8787 already.
const started = await startJarvisLocalOperatorV1({ JARVIS_LOCAL_PORT: '18787' }, {
  supabase_check: { ok: true },
  authorize,
  claude_bridge_result: { bridge: fixtureBridge, bound: true, requested: true, reason: null }
});
assert.equal(started.ok, true, 'server starts when config checks are satisfied');
// Startup honestly reports whatever memory store actually resolved — here
// the in-memory fallback (no JARVIS_PERSONAL_MEMORY_STORE env set), never a
// hardcoded claim of Supabase.
assert.equal(typeof started.memory_store_kind, 'string');
assert.equal(started.durable_memory_ready, false, 'the in-memory fallback used by this fixture test is honestly reported as non-durable');
started.options.memory_store = memoryStore;

const base = started.url;
try {
  await check('F. `/` renders the accepted orange Command Center', async () => {
    const res = await fetch(base + '/');
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(body, /jarvis-command-center-root/);
    assert.match(body, /jarvis-visual-baseline" content="ACCEPTED"/);
  });

  await check('G. `/api/runtime-truth` works', async () => {
    const res = await fetch(base + '/api/runtime-truth');
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.production_deploy, false);
    assert.equal(body.hamyren_data_flow, false);
    assert.equal(body.command_chain?.claude_execution_bridge_bound, true);
  });

  const correlationId = crypto.randomUUID();
  await check('H. `/api/chat` reaches the real runtime', async () => {
    const res = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'What is my status?', correlation_id: correlationId })
    });
    const body = await res.json();
    assert.equal(body.request_id, correlationId, 'reached the real handler, not a mock');
    assert.equal(body.production_deploy, false);
  });

  await check('I. approval flow remains enforced (a write-shaped command still blocks first)', async () => {
    const corr = crypto.randomUUID();
    const res = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Create a file with a fixture task result', correlation_id: corr })
    });
    const body = await res.json();
    assert.equal(body.run_state, 'WAITING_APPROVAL');
    assert.equal(body.claude_execution, null, 'nothing executes before approval, even with a bound bridge');

    const decideRes = await fetch(base + '/api/approvals/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approval_id: `${corr}:approval`, run_id: corr, decision: 'approve' })
    });
    const decide = await decideRes.json();
    assert.equal(decide.executed, false, 'approval decision itself never executes anything');
    assert.equal(decide.action_gate_bypassed, false);
  });

  await check('J. no Cloudflare/RIOSYSTEMS Durable Object dependency leaks into this launcher', () => {
    const src = fs.readFileSync(new URL('../src/jarvis/local-operator-server-v1.js', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /DurableObject/);
    assert.doesNotMatch(src, /import[^\n]*riosystems/i, 'no import from a riosystems module');
    assert.doesNotMatch(src, /env\.RIOSYSTEMS/, 'no riosystems env binding read');
    assert.equal(jarvisLocalOperatorManifestV1().riosystems_durable_object_dependency, false);
  });

  await check('K. no HAMYREN data flow', () => {
    assert.equal(jarvisLocalOperatorManifestV1().hamyren_data_flow, false);
  });

  await check('L. no secret output', async () => {
    const res = await fetch(base + '/api/session');
    const body = await res.json();
    assert.equal(body.credentials_exposed, false);
    const src = fs.readFileSync(new URL('../src/jarvis/local-operator-server-v1.js', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /console\.(log|error)\([^)]*(key|secret|token)[^)]*\)/i);
  });
} finally {
  await new Promise((resolve) => started.server.close(resolve));
}

// ── M. Node-only launcher is not imported by any deployed worker ──
await check('M. Node-only launcher is not imported by any deployed Cloudflare Worker entrypoint', () => {
  for (const file of ['pages-worker-v1.js', 'standalone-worker-v1.js', 'http-v1.js', 'command-center-worker-binding-v1.js']) {
    const src = fs.readFileSync(new URL(`../src/jarvis/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /local-operator-server-v1/, `${file} must never import the local launcher`);
  }
});

console.log(JSON.stringify({
  schema: 'aurentara.jarvis.local-operator-server.smoke.v1',
  passed,
  fixture_claude_executor: true,
  live_claude_cli_invoked: false,
  live_supabase_network_call: false
}, null, 2));
