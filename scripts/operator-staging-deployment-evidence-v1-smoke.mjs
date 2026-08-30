#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readAuthoritativeStagingDeploymentEvidence, operatorStagingDeploymentEvidenceManifest } from '../src/operator-staging-deployment-evidence-v1.js';

const HEAD = '8eb172c1070194496182127db3c36e44a99ad1e7';
const RUNS_URL_PART = '/actions/runs?branch=factory-control&event=workflow_dispatch&per_page=50';
const JOBS_URL = 'https://api.github.test/jobs/123';

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function makeFetch(runs, jobs = []) {
  return async (url) => {
    const value = String(url);
    if (value.includes(RUNS_URL_PART)) return response({ workflow_runs: runs });
    if (value === JOBS_URL) return response({ jobs });
    return response({}, 404);
  };
}

function deployRun(overrides = {}) {
  return {
    id: 100,
    run_number: 5,
    name: 'RIOSYSTEMS Zero-Cost Staging Deploy',
    event: 'workflow_dispatch',
    head_branch: 'factory-control',
    head_sha: HEAD,
    status: 'completed',
    conclusion: 'success',
    updated_at: '2026-08-30T13:00:00Z',
    jobs_url: JOBS_URL,
    ...overrides
  };
}

const none = await readAuthoritativeStagingDeploymentEvidence({ canonical_head_sha: HEAD, fetch_impl: makeFetch([]) });
assert.equal(none.status, 'NOT_VERIFIED');

const healthy = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun()], [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'success' }])
});
assert.equal(healthy.status, 'HEALTHY');
assert.equal(healthy.deployed_sha, HEAD);
assert.equal(healthy.deploy_job_conclusion, 'success');

const stale = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun({ head_sha: 'older-factory-control-head' })], [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'success' }])
});
assert.equal(stale.status, 'STALE');

const failed = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun({ conclusion: 'failure' })])
});
assert.equal(failed.status, 'BLOCKED');

const running = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun({ status: 'in_progress', conclusion: null })])
});
assert.equal(running.status, 'DEGRADED');

const validateOnly = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun()], [{ id: 502, name: 'validate', status: 'completed', conclusion: 'success' }])
});
assert.equal(validateOnly.status, 'NOT_VERIFIED');

const deployJobFailed = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun()], [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'failure' }])
});
assert.equal(deployJobFailed.status, 'BLOCKED');

const manifest = operatorStagingDeploymentEvidenceManifest();
assert.equal(manifest.exact_head_required, true);
assert.equal(manifest.required_job, 'deploy-staging');
assert.equal(manifest.github_read_only, true);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-staging-deployment-evidence-v1',
  healthy: healthy.status,
  stale: stale.status,
  failed: failed.status,
  running: running.status,
  validate_only: validateOnly.status,
  deploy_job_failed: deployJobFailed.status,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
