import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 8791;
const origin = `http://127.0.0.1:${port}`;
const args = [
  'wrangler', 'dev',
  '--env', 'staging',
  '--port', String(port),
  '--var', 'RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var', 'RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local'
];

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  cwd: process.cwd(),
  env: { ...process.env, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitFor(url, timeoutMs = 25000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`local Worker did not become ready: ${lastError?.message || 'timeout'}\n${output}`);
}

try {
  const shellResponse = await waitFor(`${origin}/operator`);
  const shell = await shellResponse.text();
  assert.equal(shellResponse.status, 200, output);
  assert.match(shell, /RIOSYSTEMS/);
  assert.match(shell, /Private Operator Control Plane/);
  assert.match(shell, /Mission Studio/);
  assert.match(shell, /CONFIRM_SYNTHETIC_STAGING/);
  assert.match(shell, /approval_required/);
  assert.match(shell, /delivery_ready/);
  assert.match(shellResponse.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);

  const projectsResponse = await fetch(`${origin}/operator/api/projects`);
  assert.equal(projectsResponse.status, 200, output);
  const projects = await projectsResponse.json();
  assert.equal(projects.schema, 'riosystems.operator-projects-view.v2');
  assert.equal(projects.items.length, 3);
  assert.ok(projects.items.every((item) => item.production_deploy === false));

  const dashboardResponse = await fetch(`${origin}/operator/api/dashboard`);
  assert.equal(dashboardResponse.status, 200, output);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.safety_panel.production, 'LOCKED');

  console.log(JSON.stringify({
    ok: true,
    suite: 'operator-dashboard-local-worker',
    route: '/operator',
    access_dev_identity: 'verified',
    projects: projects.items.length,
    production_deploy: false
  }, null, 2));
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
