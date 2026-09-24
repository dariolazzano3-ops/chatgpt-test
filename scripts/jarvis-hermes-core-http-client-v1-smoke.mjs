import assert from 'node:assert/strict';
import {
  createJarvisHermesCoreClientV1,
  isJarvisHermesPrivateUrlV1
} from '../src/jarvis/hermes-core-http-client-v1.js';

const KEY = '0123456789abcdef0123456789abcdef';
const URL = 'http://172.17.0.3:8642';
const calls = [];

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const fetchImpl = async (url, init = {}) => {
  calls.push({ url, init });
  if (url.endsWith('/health')) return response(200, { status: 'ok', platform: 'hermes-agent', version: 'test' });
  if (url.endsWith('/v1/capabilities')) {
    return response(200, {
      object: 'hermes.api_server.capabilities',
      platform: 'hermes-agent',
      features: { run_submission: true, session_key_header: 'X-Hermes-Session-Key' }
    });
  }
  if (url.endsWith('/v1/toolsets')) {
    return response(200, {
      object: 'list',
      platform: 'api_server',
      data: [
        { name: 'memory', enabled: true, tools: ['memory'] },
        { name: 'session_search', enabled: true, tools: ['session_search'] }
      ]
    });
  }
  if (url.endsWith('/v1/chat/completions') && init.method === 'POST') {
    return response(200, {
      model: 'jarvis-orchestrator',
      choices: [{ message: { content: '{"complexity":"LIGHT","rationale":"memory scoped","execution_brief":"do the bounded thing"}' } }],
      usage: {}
    });
  }
  if (url.endsWith('/v1/runs') && init.method === 'POST') {
    return response(202, { status: 'started', run_id: 'run_abcdef123456' });
  }
  if (url.endsWith('/v1/runs/run_abcdef123456')) {
    return response(200, {
      object: 'hermes.run',
      run_id: 'run_abcdef123456',
      status: 'completed',
      final_response: 'done'
    });
  }
  return response(404, { error: 'not_found' });
};

assert.equal(isJarvisHermesPrivateUrlV1(URL), true);
assert.equal(isJarvisHermesPrivateUrlV1('http://127.0.0.1:8642'), true);
assert.equal(isJarvisHermesPrivateUrlV1('http://8.8.8.8:8642'), false);
assert.equal(isJarvisHermesPrivateUrlV1('http://example.com:8642'), false);

const client = createJarvisHermesCoreClientV1({
  base_url: URL,
  api_key: KEY,
  fetch_impl: fetchImpl,
  clock: () => Date.parse('2026-09-23T03:40:00Z')
});
assert.equal(client.configured, true);
assert.equal((await client.health()).platform, 'hermes-agent');
assert.equal((await client.capabilities()).features.run_submission, true);
assert.equal((await client.toolsets()).data.some((row) => row.tools.includes('memory')), true);

const chat = await client.chatCompletion({
  session_key: 'jarvis:owner:00000000-0000-4000-8000-000000000001',
  idempotency_key: 'jarvis-memory-scope-1',
  messages: [{ role: 'user', content: 'remember this safely' }]
});
assert.equal(chat.ok, true);

const started = await client.startRun({
  input: 'harmless test',
  session_id: 'jarvis-smoke',
  idempotency_key: 'jarvis-smoke-1',
  session_key: 'jarvis:owner:00000000-0000-4000-8000-000000000001'
});
assert.equal(started.run_id, 'run_abcdef123456');

const status = await client.getRun(started.run_id);
assert.equal(status.status, 'completed');

const probe = await client.liveProbe();
assert.deepEqual(probe, {
  live: true,
  state: 'ONLINE',
  source_id: 'jarvis-hermes-core:authenticated-api',
  observed_at: '2026-09-23T03:40:00.000Z',
  stale_after_ms: 60000,
  version: 'test'
});

const healthCall = calls.find((x) => x.url.endsWith('/health'));
assert.equal(healthCall.init.headers.authorization, undefined);
for (const call of calls.filter((x) => !x.url.endsWith('/health'))) {
  assert.equal(call.init.headers.authorization, 'Bearer ' + KEY);
}
for (const call of calls.filter((x) => x.url.endsWith('/v1/chat/completions') || x.url.endsWith('/v1/runs'))) {
  assert.equal(call.init.headers['x-hermes-session-key'], 'jarvis:owner:00000000-0000-4000-8000-000000000001');
}
assert.equal(JSON.stringify(calls).includes(KEY), true);

const invalid = createJarvisHermesCoreClientV1({
  base_url: 'http://example.com:8642',
  api_key: KEY,
  fetch_impl: fetchImpl
});
assert.equal(invalid.configured, false);
await assert.rejects(() => invalid.health(), /HERMES_CORE_NOT_CONFIGURED/);

console.log('JARVIS_HERMES_CORE_HTTP_CLIENT_V1_SMOKE_PASS');
