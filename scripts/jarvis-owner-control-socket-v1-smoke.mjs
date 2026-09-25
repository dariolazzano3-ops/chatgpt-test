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
    body,
    paid_fallback_enabled: env.JARVIS_AI_API_FALLBACK_ENABLED || null,
    paid_fallback_approved: env.JARVIS_AI_API_FALLBACK_APPROVED || null,
    max_job_cost_usd: env.JARVIS_AI_MAX_JOB_COST_USD || null
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
  worker_handler: workerHandler,
  audit_reader: async (requestId) => [{
    request_id: requestId,
    result: {
      job_status: 'FAILED',
      job_failure_reason: 'usage_limit_reached',
      secret_token: 'must-not-leak'
    },
    authorization: 'must-not-leak'
  }]
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

assert.equal(calls.at(-1).paid_fallback_enabled, null);
assert.equal(calls.at(-1).paid_fallback_approved, null);
assert.equal(calls.at(-1).max_job_cost_usd, null);

const paidChat = await request('POST', '/v1/chat', {
  message: 'Inspect AURENTARA with approved paid fallback.',
  correlation_id: '22222222-2222-4222-8222-222222222222',
  paid_fallback_approved: true,
  max_job_cost_usd: 0.25
});
assert.equal(paidChat.status, 200);
assert.equal(calls.at(-1).paid_fallback_enabled, 'true');
assert.equal(calls.at(-1).paid_fallback_approved, 'true');
assert.equal(calls.at(-1).max_job_cost_usd, '0.25');

const overCap = await request('POST', '/v1/chat', {
  message: 'Must fail before runtime dispatch.',
  paid_fallback_approved: true,
  max_job_cost_usd: 0.26
});
assert.equal(overCap.status, 400);
assert.equal(overCap.body.error, 'JARVIS_OWNER_CONTROL_PAID_FALLBACK_CAP_INVALID');

const capWithoutApproval = await request('POST', '/v1/chat', {
  message: 'Must also fail before runtime dispatch.',
  max_job_cost_usd: 0.10
});
assert.equal(capWithoutApproval.status, 400);
assert.equal(capWithoutApproval.body.error, 'JARVIS_OWNER_CONTROL_PAID_FALLBACK_APPROVAL_REQUIRED');

const job = await request('GET', '/v1/job?request_id=11111111-1111-4111-8111-111111111111');
assert.equal(job.status, 200);
assert.equal(job.body.rows[0].result.job_failure_reason, 'usage_limit_reached');
assert.equal('secret_token' in job.body.rows[0].result, false);
assert.equal('authorization' in job.body.rows[0], false);

const denied = await request('POST', '/v1/arbitrary', { message: 'x' });
assert.equal(denied.status, 404);
assert.equal(calls.length, 4);

const stat = await fs.lstat(socketPath);
assert.equal(stat.isSocket(), true);
assert.equal(stat.mode & 0o777, 0o660);
assert.equal(stat.gid, (await fs.stat(tmp)).gid);

const manifest = jarvisOwnerControlSocketManifestV1();
assert.equal(manifest.public_tcp_listener, false);
assert.equal(manifest.client_identity_override, false);
assert.equal(manifest.secrets_returned, false);
assert.equal(manifest.paid_fallback_request_scoped, true);
assert.equal(manifest.paid_fallback_max_job_cost_usd, 0.25);
assert.equal(manifest.paid_fallback_public_web_path_enabled, false);
assert.equal(manifest.paid_fallback_mutates_process_env, false);

await new Promise((resolve) => started.server.close(resolve));
await fs.rm(tmp, { recursive: true, force: true });

console.log('JARVIS_OWNER_CONTROL_SOCKET_V1_SMOKE_PASS');
