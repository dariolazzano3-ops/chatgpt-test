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
assert.equal(validateJarvisClaudeCodeRequestV1(base).ok, true);

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

assert.deepEqual(Object.values(JARVIS_CLAUDE_BRIDGE_STATE).sort(), ['BLOCKED', 'CANCELLED', 'COMPLETE', 'FAILED', 'QUEUED', 'RUNNING', 'TIMEOUT', 'UNAVAILABLE']);

console.log('JARVIS Claude Code Execution Bridge V1 smoke: PASS');
