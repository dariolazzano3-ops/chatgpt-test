import assert from 'node:assert/strict';
import { handleDiagnostics } from '../src/diagnostics.js';

const originalFetch = globalThis.fetch;

try {
  let calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, authorization: options.headers?.authorization });
    if (calls.length === 1) return new Response(JSON.stringify({ slug: 'riosystems-core' }), { status: 200 });
    return new Response(JSON.stringify([{
      id: 'issue-1',
      shortId: 'RIO-1',
      title: ' Synthetic staging issue ',
      culprit: 'worker.test',
      level: 'error',
      status: 'unresolved',
      count: '2',
      userCount: 0,
      firstSeen: '2026-08-28T00:00:00Z',
      lastSeen: '2026-08-28T01:00:00Z',
      permalink: 'https://de.sentry.io/issues/1',
      secret_internal_field: 'must-not-leak'
    }]), { status: 200 });
  };

  const unauthorized = await handleDiagnostics(new Request('https://example.test/factory/diagnostics/sentry'), {
    API_TOKEN: 'api-secret',
    SENTRY_AUTH_TOKEN: 'sentry-secret'
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(calls.length, 0);

  const invalidBase = await handleDiagnostics(new Request('https://example.test/factory/diagnostics/sentry', {
    headers: { authorization: 'Bearer api-secret' }
  }), {
    API_TOKEN: 'api-secret',
    SENTRY_AUTH_TOKEN: 'sentry-secret',
    SENTRY_BASE_URL: 'https://attacker.invalid'
  });
  assert.equal((await invalidBase.json()).error, 'SENTRY_BASE_URL_NOT_ALLOWED');
  assert.equal(calls.length, 0);

  const response = await handleDiagnostics(new Request('https://example.test/factory/diagnostics/sentry', {
    headers: { authorization: 'Bearer api-secret' }
  }), {
    API_TOKEN: 'api-secret',
    SENTRY_AUTH_TOKEN: 'sentry-secret',
    SENTRY_ORG: 'riosystems',
    SENTRY_PROJECT: 'riosystems-core',
    SENTRY_BASE_URL: 'https://de.sentry.io'
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.issues.length, 1);
  assert.equal(body.issues[0].title, 'Synthetic staging issue');
  assert.equal('secret_internal_field' in body.issues[0], false);
  assert.equal(JSON.stringify(body).includes('sentry-secret'), false);
  assert.equal(calls.length, 2);
  assert.equal(calls.every((call) => call.method === 'GET'), true);
  assert.equal(calls.every((call) => call.authorization === 'Bearer sentry-secret'), true);

  const methodBlocked = await handleDiagnostics(new Request('https://example.test/factory/diagnostics/sentry', {
    method: 'POST'
  }), {});
  assert.equal(methodBlocked.status, 405);
  assert.equal((await methodBlocked.json()).error, 'METHOD_NOT_ALLOWED');

  console.log(JSON.stringify({
    ok: true,
    suite: 'sentry-readonly-bridge',
    outbound_methods: ['GET'],
    unauthorized_blocked: true,
    untrusted_base_url_blocked: true,
    secret_values_exposed: false,
    production_deploy: false
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
