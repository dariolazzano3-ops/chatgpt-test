import assert from 'node:assert/strict';
import { handleDiagnostics } from '../src/diagnostics.js';

const originalFetch = globalThis.fetch;

try {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return new Response(JSON.stringify({ full_name: 'dariolazzano3-ops/chatgpt-test' }), { status: 200 });
    return new Response(JSON.stringify({ object: { sha: '17d78ba6c14ed9bfb074aa925f072ff450b297ef' } }), { status: 200 });
  };

  const response = await handleDiagnostics(new Request('https://example.test/factory/diagnostics/github'), {
    GITHUB_TOKEN: 'github-secret',
    GITHUB_REPOSITORY: 'dariolazzano3-ops/chatgpt-test'
  });
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.configuration.base_branch, 'factory-control');
  assert.equal(body.configuration.canonical_control_branch, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].endsWith('/git/ref/heads/factory-control'), true);
  assert.equal(JSON.stringify(body).includes('github-secret'), false);

  const invalid = await handleDiagnostics(new Request('https://example.test/factory/diagnostics/github'), {
    GITHUB_TOKEN: 'github-secret',
    FACTORY_CONTROL_BRANCH: '../main'
  });
  assert.equal((await invalid.json()).error, 'INVALID_FACTORY_CONTROL_BRANCH');
  assert.equal(calls.length, 2);

  console.log(JSON.stringify({
    ok: true,
    suite: 'branch-truth',
    canonical_control_branch: 'factory-control',
    main_treated_as_runtime_source: false,
    secret_values_exposed: false,
    production_deploy: false
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
