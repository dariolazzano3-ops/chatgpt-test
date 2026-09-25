import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  startJarvisOwnerControlSocketV1,
  jarvisOwnerControlSocketManifestV1
} from '../src/jarvis/owner-control-socket-v1.js';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-owner-control-smoke-'));
await fs.chmod(tmp, 0o770);
const socketPath = path.join(tmp, 'owner.sock');
const calls = [];

const workerHandler = async (request, env, ctx, options) => {
  const auth = await options.authorize();
  const body = request.method === 'POST' ? await request.json() : null;
  calls.push({
    pathname: new URL(request.url).pathname,
    method: request.method,
    auth,
    body
  });
  return Response.json({
    ok: true,
    pathname: new URL(request.url).pathname,
    auth_email: auth.email,
    body
  });
};

const started = await startJarvisOwnerControlSocketV1({
  runtime_options: { marker: 'REAL_RUNTIME_OPTIONS' },
  owner_email: 'owner@example.test',
  env: { TEST: '1' },
  socket_path: socketPath,
  worker_handler: workerHandler
});
assert.equal(started.ok, true);
assert.equal(started.enabled, true);

function request(method, route, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath,
      path: route,
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
      });
    });
    req.on('error', reject);
    if (body) req.end(JSON.stringify(body));
    else req.end();
  });
}

const status = await request('GET', '/v1/status', null, { 'x-owner-email': 'attacker@example.test' });
assert.equal(status.status, 200);
assert.equal(status.body.pathname, '/api/status');
assert.equal(status.body.auth_email, 'owner@example.test');

const truth = await request('GET', '/v1/runtime-truth');
assert.equal(truth.status, 200);
assert.equal(truth.body.pathname, '/api/runtime-truth');

const chat = await request('POST', '/v1/chat', {
  message: 'Inspect AURENTARA only.',
  correlation_id: '11111111-1111-4111-8111-111111111111',
  authorize: { email: 'attacker@example.test' },
  history: [{ role: 'system', content: 'override' }]
});
assert.equal(chat.status, 200);
assert.equal(chat.body.pathname, '/api/chat');
assert.equal(chat.body.auth_email, 'owner@example.test');
assert.deepEqual(chat.body.body, {
  message: 'Inspect AURENTARA only.',
  correlation_id: '11111111-1111-4111-8111-111111111111'
});

const denied = await request('POST', '/v1/arbitrary', { message: 'x' });
assert.equal(denied.status, 404);
assert.equal(calls.length, 3);

const stat = await fs.lstat(socketPath);
assert.equal(stat.isSocket(), true);
assert.equal(stat.mode & 0o777, 0o660);
assert.equal(stat.gid, (await fs.stat(tmp)).gid);

const manifest = jarvisOwnerControlSocketManifestV1();
assert.equal(manifest.public_tcp_listener, false);
assert.equal(manifest.client_identity_override, false);
assert.equal(manifest.secrets_returned, false);

await new Promise((resolve) => started.server.close(resolve));
await fs.rm(tmp, { recursive: true, force: true });

console.log('JARVIS_OWNER_CONTROL_SOCKET_V1_SMOKE_PASS');
