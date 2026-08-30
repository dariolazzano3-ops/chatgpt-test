#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readAuthoritativeCloudflareAccessEvidence, operatorCloudflareAccessEvidenceManifest } from '../src/operator-cloudflare-access-evidence-v1.js';

const HEAD = '8209e599659b73fc4d63bfe2f54eaf483f974b33';
const JOBS_URL = 'https://api.github.test/access-jobs/1';
const RUNS_PART = `/actions/runs?head_sha=${HEAD}&event=push&per_page=50`;

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function run(overrides = {}) {
  return {
    id: 90,
    run_number: 2,
    name: 'RIOSYSTEMS Cloudflare Access Read-only Verification',
    event: 'push',
    head_branch: 'factory-control',
    head_sha: HEAD,
    status: 'completed',
    conclusion: 'success',
    updated_at: '2026-08-30T14:00:00Z',
    jobs_url: JOBS_URL,
    ...overrides
  };
}

function jobs(overrides = {}) {
  return [
    { id: 1, name: 'validate', status: 'completed', conclusion: 'success' },
    { id: 2, name: 'verify-access', status: 'completed', conclusion: 'success' },
    ...(overrides.extra || [])
  ].map((job) => job.name === 'validate' ? { ...job, ...(overrides.validate || {}) } : job.name === 'verify-access' ? { ...job, ...(overrides.verify || {}) } : job);
}

function fetchFor(runs = [], jobList = []) {
  return async (url) => {
    const value = String(url);
    if (value.includes(RUNS_PART)) return response({ workflow_runs: runs });
    if (value === JOBS_URL) return response({ jobs: jobList });
    return response({}, 404);
  };
}

const none = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([]) });
assert.equal(none.status, 'NOT_VERIFIED');

const healthy = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([run()], jobs()) });
assert.equal(healthy.status, 'HEALTHY');
assert.equal(healthy.access_application_configured, true);
assert.equal(healthy.restrictive_policy_verified, true);

const running = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([run({ status: 'in_progress', conclusion: null })]) });
assert.equal(running.status, 'DEGRADED');

const failed = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([run({ conclusion: 'failure' })]) });
assert.equal(failed.status, 'BLOCKED');

const missingVerify = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([run()], jobs().filter((job) => job.name !== 'verify-access')) });
assert.equal(missingVerify.status, 'NOT_VERIFIED');

const verifyFailed = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([run()], jobs({ verify: { conclusion: 'failure' } })) });
assert.equal(verifyFailed.status, 'BLOCKED');

const validateFailed = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([run()], jobs({ validate: { conclusion: 'failure' } })) });
assert.equal(validateFailed.status, 'NOT_VERIFIED');

const wrongHeadRun = run({ head_sha: 'wrong-head' });
const wrongHead = await readAuthoritativeCloudflareAccessEvidence({ canonical_head_sha: HEAD, fetch_impl: fetchFor([wrongHeadRun], jobs()) });
assert.equal(wrongHead.status, 'NOT_VERIFIED');

const manifest = operatorCloudflareAccessEvidenceManifest();
assert.equal(manifest.exact_head_required, true);
assert.deepEqual(manifest.required_jobs, ['validate','verify-access']);
assert.equal(manifest.cloudflare_probe_method, 'GET_ONLY');
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-cloudflare-access-evidence-v1',
  healthy: healthy.status,
  running: running.status,
  failed: failed.status,
  missing_verify: missingVerify.status,
  verify_failed: verifyFailed.status,
  wrong_head: wrongHead.status,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
