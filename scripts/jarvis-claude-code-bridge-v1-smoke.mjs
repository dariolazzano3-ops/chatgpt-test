import assert from 'node:assert/strict';
import {
  createJarvisClaudeCodeBridgeV1,
  createLocalFixtureExecutorV1,
  createChildProcessExecutorV1,
  validateJarvisClaudeCodeRequestV1,
  jarvisClaudeCodeBridgeContractV1,
  JARVIS_CLAUDE_BRIDGE_STATE
} from '../src/jarvis/claude-code-bridge-v1.js';

const CORR = '11111111-2222-4333-8444-555555555555';
const base = { correlation_id: CORR, request_id: CORR, owner_ref: 'jarvis:operator:op@example.invalid', workspace: '/workspace/projects/demo', task: 'implement x' };

// ── request validation: fail-closed on unsafe input ──
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, workspace: '/etc' }).error, 'CLAUDE_BRIDGE_WORKSPACE_OUT_OF_BOUNDS');
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, protected_branch: true }).error, 'CLAUDE_BRIDGE_PROTECTED_BRANCH_BLOCKED');
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, production: true }).error, 'CLAUDE_BRIDGE_PRODUCTION_BLOCKED');
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, allow_external_writes: true }).error, 'CLAUDE_BRIDGE_EXTERNAL_WRITE_NOT_PERMITTED');
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, correlation_id: 'nope' }).error, 'CLAUDE_BRIDGE_CORRELATION_ID_REQUIRED');
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, execution_mode: 'destroy' }).error, 'CLAUDE_BRIDGE_EXECUTION_MODE_INVALID');
assert.equal(validateJarvisClaudeCodeRequestV1(base).request.execution_mode, 'implement');
assert.equal(validateJarvisClaudeCodeRequestV1({ ...base, execution_mode: 'review' }).request.execution_mode, 'review');

// ── no executor -> bridge unbound, every submit fails closed to UNAVAILABLE ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({});
  assert.equal(bridge.bound, false);
  const r = await bridge.submit(base).result;
  assert.equal(r.state, 'UNAVAILABLE');
  assert.equal(r.bridge_bound, false);
  assert.equal(r.reason, 'NO_EXECUTOR_BOUND');
  assert.equal(r.external_effect, false);
  assert.equal(r.evidence.independent_acceptance, false);
  const contract = jarvisClaudeCodeBridgeContractV1(bridge);
  assert.equal(contract.bridge_bound, false);
  assert.equal(contract.worker_output_self_accepts, false);
  assert.equal(contract.independent_acceptance_from_bridge, false);
  assert.equal(contract.external_writes, false);
  assert.deepEqual(contract.execution_modes, ['implement', 'review']);
  assert.equal(contract.review_mode_read_only, true);
}

// ── success fixture ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'implement x': { exit_code: 0, stdout: 'done', stderr: '' } }) });
  assert.equal(bridge.bound, true);
  const r = await bridge.submit(base).result;
  assert.equal(r.state, 'COMPLETE');
  assert.equal(r.ok, true);
  assert.equal(r.exit_code, 0);
  assert.equal(r.stdout, 'done');
  assert.equal(r.external_effect, false);
  assert.equal(r.correlation_id, CORR);
  assert.equal(r.request_id, CORR);
  assert.equal(r.evidence.kind, 'CLAUDE_CODE_EXECUTION');
  assert.match(r.evidence.stdout_sha256, /^[0-9a-f]{64}$/);
  assert.equal(r.evidence.worker_verified, false);
  assert.equal(r.evidence.independent_acceptance, false);
  // worker success is NOT independent acceptance
  assert.equal(bridge.isIndependentlyAccepted(r), false);
}

// ── review mode is carried to the executor without creating a second worker path ──
{
  let observedMode = null;
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: async (input) => {
      observedMode = input.execution_mode;
      return { exit_code: 0, stdout: 'review complete', stderr: '', external_effect: false };
    }
  });
  const r = await bridge.submit({
    ...base,
    correlation_id: '12121212-2222-4333-8444-555555555555',
    request_id: '12121212-2222-4333-8444-555555555555',
    execution_mode: 'review',
    task: 'inspect only'
  }).result;
  assert.equal(r.state, 'COMPLETE');
  assert.equal(r.execution_mode, 'review');
  assert.equal(observedMode, 'review');
}

// ── worker failure (non-zero exit) ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'fail': { exit_code: 2, stdout: '', stderr: 'boom' } }) });
  const r = await bridge.submit({ ...base, task: 'fail now' }).result;
  assert.equal(r.state, 'FAILED');
  assert.equal(r.ok, false);
  assert.equal(r.exit_code, 2);
  assert.equal(r.stderr, 'boom');
}

// ── executor throws ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'throwit': { throw: 'exec exploded' } }) });
  const r = await bridge.submit({ ...base, task: 'throwit' }).result;
  assert.equal(r.state, 'FAILED');
  assert.match(r.error_detail, /exec exploded/);
}

// ── timeout ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'slow': { delay_ms: 5000, exit_code: 0 } }) });
  const started = Date.now();
  const r = await bridge.submit({ ...base, task: 'slow task', timeout_ms: 1000 }).result;
  assert.equal(r.state, 'TIMEOUT');
  assert.ok(Date.now() - started < 3000, 'timeout fired promptly');
  assert.equal(r.external_effect, false);
}

// ── cancellation ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'cancelme': { delay_ms: 5000, exit_code: 0 } }) });
  const handle = bridge.submit({ ...base, task: 'cancelme', timeout_ms: 10000 });
  setTimeout(() => handle.cancel('OPERATOR_CANCELLED'), 100);
  const r = await handle.result;
  assert.equal(r.state, 'CANCELLED');
}

// ── duplicate correlation_id is idempotent (no double execution) ──
{
  let calls = 0;
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: async () => { calls += 1; return { exit_code: 0, stdout: `run ${calls}` }; } });
  const a = await bridge.submit(base).result;
  const b = await bridge.submit(base).result;
  assert.equal(calls, 1, 'executor ran once for a repeated correlation_id');
  assert.equal(b.duplicate, true);
  assert.equal(a.stdout, b.stdout);
}

// ── an executor claiming external_effect is surfaced honestly, still no acceptance ──
{
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: createLocalFixtureExecutorV1({ 'ext': { exit_code: 0, stdout: 'ok', external_effect: true, acceptance_ref: 'bridge:accept:9' } }) });
  const r = await bridge.submit({ ...base, task: 'ext op' }).result;
  assert.equal(r.external_effect, true);
  assert.equal(r.evidence.acceptance_ref, 'bridge:accept:9');
  assert.equal(r.independent_acceptance, false, 'bridge never grants independent acceptance');
}

// ── child-process executor: real bounded local run (node), and refuses a claude-shaped command ──
{
  const exec = createChildProcessExecutorV1({ command: 'node', args: ['-e', 'process.stdout.write("child-ok");process.exit(0)'], pass_task: false });
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: exec });
  const r = await bridge.submit({ ...base, task: 'noop' }).result;
  assert.equal(r.state, 'COMPLETE');
  assert.match(r.stdout, /child-ok/);

  const refuses = createChildProcessExecutorV1({ command: '/usr/local/bin/claude' });
  const bridge2 = createJarvisClaudeCodeBridgeV1({ executor: refuses });
  const r2 = await bridge2.submit({ ...base, correlation_id: '22222222-3333-4444-8555-666666666666', request_id: '22222222-3333-4444-8555-666666666666', task: 'noop' }).result;
  assert.equal(r2.state, 'FAILED');
  assert.match(r2.error_detail, /MODEL_SESSION_REFUSED/);
}

// ── child-process executor: timeout kills the process ──
{
  const exec = createChildProcessExecutorV1({ command: 'node', args: ['-e', 'setTimeout(()=>{}, 999999)'], pass_task: false });
  const bridge = createJarvisClaudeCodeBridgeV1({ executor: exec });
  const r = await bridge.submit({ ...base, correlation_id: '33333333-4444-4555-8666-777777777777', request_id: '33333333-4444-4555-8666-777777777777', task: 'hang', timeout_ms: 1200 }).result;
  assert.equal(r.state, 'TIMEOUT');
}

// ── timeout precedence: bridge-configured default vs. per-request override vs. hardcoded fallback ──
// A raw request with no explicit timeout_ms must leave it `null` after
// validation — never silently backfilled to DEFAULT_TIMEOUT_MS here, or
// submit()'s own `request.timeout_ms || defaultTimeout` could never fall
// through to the bridge's configured default.
{
  const noTimeout = validateJarvisClaudeCodeRequestV1(base);
  assert.equal(noTimeout.request.timeout_ms, null, 'no explicit timeout -> null, not a hardcoded default');

  const explicit = validateJarvisClaudeCodeRequestV1({ ...base, timeout_ms: 5000 });
  assert.equal(explicit.request.timeout_ms, 5000, 'an explicit timeout is preserved exactly');

  // ── 3. MAX_TIMEOUT_MS=960000 clamp still enforced on an explicit request timeout ──
  const overMax = validateJarvisClaudeCodeRequestV1({ ...base, timeout_ms: 999999999 });
  assert.equal(overMax.request.timeout_ms, 960000, 'an explicit timeout above the max is clamped to MAX_TIMEOUT_MS');
}

// ── 1. bridge config default is honored when the raw request omits timeout_ms ──
{
  // submit() floors any resolved timeout at 1000ms, so the smallest
  // observable config default is 1000ms itself. A fixture delay well past
  // that (2500ms) must now genuinely time out at ~1000ms, proving the
  // bridge's own config.timeout_ms (not a pre-empted 120000 default) is
  // what actually governs when the request itself specifies nothing.
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({ 'config-default task': { delay_ms: 2500, exit_code: 0 } }),
    timeout_ms: 1000
  });
  const started = Date.now();
  const r = await bridge.submit({ ...base, correlation_id: '44444444-5555-4666-8777-888888888888', request_id: '44444444-5555-4666-8777-888888888888', task: 'config-default task' }).result;
  assert.equal(r.state, 'TIMEOUT', 'the bridge-configured 1000ms default fired, not a stale 120000ms default');
  assert.ok(Date.now() - started < 5000, 'timed out at the configured ~1000ms, not anywhere near 120000ms');
}

// ── 2. an explicit per-request timeout still overrides the bridge's configured default ──
{
  // Same short 1000ms bridge default as above, but this request explicitly
  // asks for far longer (8000ms) — the same fixture delay (2500ms) must now
  // complete normally, proving the explicit override wins over the config.
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({ 'explicit-override task': { delay_ms: 2500, exit_code: 0 } }),
    timeout_ms: 1000
  });
  const r = await bridge.submit({ ...base, correlation_id: '55555555-6666-4777-8888-999999999999', request_id: '55555555-6666-4777-8888-999999999999', task: 'explicit-override task', timeout_ms: 8000 }).result;
  assert.equal(r.state, 'COMPLETE', 'an explicit request timeout overrides the shorter bridge-configured default');
}

// ── 4. the original 120000ms fallback still applies when NEITHER a bridge config nor the request provides a timeout ──
{
  // No `timeout_ms` in the bridge config at all here (unlike the two blocks
  // above) — a short fixture delay must still complete normally, i.e. the
  // fallback is still some large, sane value (still DEFAULT_TIMEOUT_MS
  // internally — unchanged by this fix), never accidentally 0 or `null`
  // reaching the real timer.
  const bridge = createJarvisClaudeCodeBridgeV1({
    executor: createLocalFixtureExecutorV1({ 'unconfigured-default task': { delay_ms: 50, exit_code: 0 } })
  });
  const r = await bridge.submit({ ...base, correlation_id: '66666666-7777-4888-8999-aaaaaaaaaaaa', request_id: '66666666-7777-4888-8999-aaaaaaaaaaaa', task: 'unconfigured-default task' }).result;
  assert.equal(r.state, 'COMPLETE', 'the original hardcoded fallback (still 120000ms) remains in force when nothing else configures a timeout');
}

assert.deepEqual(Object.values(JARVIS_CLAUDE_BRIDGE_STATE).sort(), ['BLOCKED', 'CANCELLED', 'COMPLETE', 'FAILED', 'QUEUED', 'RUNNING', 'TIMEOUT', 'UNAVAILABLE']);

console.log('JARVIS Claude Code Execution Bridge V1 smoke: PASS');
