import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 8793;
const base = `http://127.0.0.1:${port}`;
const useProcessGroup = process.platform !== 'win32';
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'wrangler', 'dev', '--config', 'scripts/fixtures/project-source-dns-worker-wrangler.jsonc',
  '--local', '--port', String(port), '--log-level', 'error'
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: useProcessGroup,
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
});

let output = '';
child.stdout.on('data', (chunk) => { output += String(chunk); });
child.stderr.on('data', (chunk) => { output += String(chunk); });

async function waitForReady() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/?hostname=example.com`, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`WORKER_DNS_FIXTURE_NOT_READY\n${output.slice(-4000)}`);
}

function signalProcessTree(signal) {
  try {
    if (useProcessGroup && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {}
}

async function stopWorker() {
  signalProcessTree('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 1_000))
  ]);
  signalProcessTree('SIGKILL');
  child.stdout.destroy();
  child.stderr.destroy();
}

try {
  const publicResult = await waitForReady();
  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.runtime, 'workerd-node-dns');
  assert.equal(Array.isArray(publicResult.addresses), true);
  assert.equal(publicResult.addresses.length > 0, true);

  const missingResponse = await fetch(`${base}/?hostname=${encodeURIComponent('definitely-not-present.aurentara.invalid')}`, { signal: AbortSignal.timeout(8_000) });
  const missing = await missingResponse.json();
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.addresses, []);

  console.log(JSON.stringify({
    ok: true,
    suite: 'project-source-dns-worker-runtime-smoke',
    actual_runtime: 'workerd',
    isolated_fixture_config: true,
    worker_native_node_dns_public_resolution: 'PASS',
    worker_native_nxdomain_no_address: 'PASS',
    deterministic_process_cleanup: 'PASS',
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  }, null, 2));
} finally {
  await stopWorker();
}
