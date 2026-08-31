import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 8791;
const origin = `http://127.0.0.1:${port}`;
const wranglerCli = 'node_modules/wrangler/bin/wrangler.js';
const args = [
  wranglerCli,
  'dev',
  '--env', 'staging',
  '--port', String(port),
  '--var', 'RIOSYSTEMS_ENVIRONMENT:local',
  '--var', 'RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var', 'RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var', 'RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local'
];

const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  env: { ...process.env, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
let childExit = null;
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
child.once('exit', (code, signal) => { childExit = { code, signal }; });

async function waitFor(url, timeoutMs = 25000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    if (childExit) {
      throw new Error(`local Worker exited before readiness: code=${childExit.code} signal=${childExit.signal || 'none'}\n${output}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`local Worker did not become ready: ${lastError?.message || 'timeout'}\n${output}`);
}

async function fetchChecked(url) {
  return fetch(url, { signal: AbortSignal.timeout(3000) });
}

try {
  const shellResponse = await waitFor(`${origin}/operator`);
  const shell = await shellResponse.text();
  assert.equal(shellResponse.status, 200, output);
  assert.match(shell, /AURENTARA SYSTEMS/);
  assert.doesNotMatch(shell, /<title>RIOSYSTEMS Operator Control Plane<\/title>/);
  assert.match(shell, /Private Operator Control Plane/);
  assert.match(shell, /Mission Studio/);
  assert.match(shell, /CONFIRM_SYNTHETIC_STAGING/);
  assert.match(shell, /approval_required/);
  assert.match(shell, /delivery_ready/);
  assert.match(shellResponse.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);

  const projectsResponse = await fetchChecked(`${origin}/operator/api/projects`);
  assert.equal(projectsResponse.status, 200, output);
  const projects = await projectsResponse.json();
  assert.equal(projects.schema, 'riosystems.operator-projects-view.v2');
  assert.equal(projects.items.length, 3);
  assert.ok(projects.items.every((item) => item.production_deploy === false));

  const dashboardResponse = await fetchChecked(`${origin}/operator/api/dashboard`);
  assert.equal(dashboardResponse.status, 200, output);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.schema, 'riosystems.operator-dashboard-view.v1');
  assert.equal(dashboard.safety_panel.production, 'LOCKED');

  console.log(JSON.stringify({
    ok: true,
    suite: 'operator-dashboard-local-worker',
    route: '/operator',
    operative_brand: 'AURENTARA SYSTEMS',
    internal_api_namespace: 'riosystems.*',
    access_dev_identity: 'verified',
    runtime_mode: 'local_memory_only',
    staging_runtime_mode: 'durable_required',
    projects: projects.items.length,
    production_deploy: false
  }, null, 2));
} finally {
  if (!childExit) child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (childExit) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
