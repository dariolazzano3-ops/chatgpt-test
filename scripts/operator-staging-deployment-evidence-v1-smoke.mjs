#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readAuthoritativeStagingDeploymentEvidence, operatorStagingDeploymentEvidenceManifest } from '../src/operator-staging-deployment-evidence-v1.js';

const HEAD = '8eb172c1070194496182127db3c36e44a99ad1e7';
const RUNS_URL_PART = '/actions/runs?branch=factory-control&per_page=100';
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
    path: '.github/workflows/riosystems-staging-deploy.yml',
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

function oneShotRun(overrides = {}) {
  return {
    id: 200,
    run_number: 1,
    name: 'RIOSYSTEMS V1 Staging Activation Once',
    path: '.github/workflows/riosystems-v1-staging-activation-once.yml',
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

const deployJob = [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'success' }];

const none = await readAuthoritativeStagingDeploymentEvidence({ canonical_head_sha: HEAD, fetch_impl: makeFetch([]) });
assert.equal(none.status, 'NOT_VERIFIED');

const healthyDispatch = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun()], deployJob)
});
assert.equal(healthyDispatch.status, 'HEALTHY');
assert.equal(healthyDispatch.deployed_sha, HEAD);
assert.equal(healthyDispatch.deploy_source, 'workflow_dispatch_zero_cost_staging_deploy');
assert.equal(healthyDispatch.deploy_job_conclusion, 'success');

const healthyOneShot = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([oneShotRun()], deployJob)
});
assert.equal(healthyOneShot.status, 'HEALTHY');
assert.equal(healthyOneShot.deployed_sha, HEAD);
assert.equal(healthyOneShot.deploy_source, 'guarded_exact_head_staging_activation_push');
assert.equal(healthyOneShot.workflow_event, 'push');

const oneShotWrongEvent = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([oneShotRun({ event: 'workflow_dispatch' })], deployJob)
});
assert.equal(oneShotWrongEvent.status, 'NOT_VERIFIED');

const oneShotWrongPath = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([oneShotRun({ path: '.github/workflows/not-approved.yml' })], deployJob)
});
assert.equal(oneShotWrongPath.status, 'NOT_VERIFIED');

const stale = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([deployRun({ head_sha: 'older-factory-control-head' })], deployJob)
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
  fetch_impl: makeFetch([oneShotRun()], [{ id: 502, name: 'validate', status: 'completed', conclusion: 'success' }])
});
assert.equal(validateOnly.status, 'NOT_VERIFIED');

const deployJobFailed = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([oneShotRun()], [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'failure' }])
});
assert.equal(deployJobFailed.status, 'BLOCKED');

const prefersExactHead = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch([
    deployRun({ id: 300, head_sha: 'newer-but-wrong-head', updated_at: '2026-08-30T15:00:00Z' }),
    oneShotRun({ id: 301 })
  ], deployJob)
});
assert.equal(prefersExactHead.status, 'HEALTHY');
assert.equal(prefersExactHead.run_id, 301);

const manifest = operatorStagingDeploymentEvidenceManifest();
assert.equal(manifest.exact_head_required, true);
assert.equal(manifest.required_job, 'deploy-staging');
assert.equal(manifest.github_read_only, true);
assert.equal(manifest.validate_only_never_counts_as_deploy, true);
assert.equal(manifest.accepted_sources.length, 2);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-staging-deployment-evidence-v1',
  healthy_dispatch: healthyDispatch.status,
  healthy_one_shot: healthyOneShot.status,
  one_shot_wrong_event: oneShotWrongEvent.status,
  one_shot_wrong_path: oneShotWrongPath.status,
  stale: stale.status,
  failed: failed.status,
  running: running.status,
  validate_only: validateOnly.status,
  deploy_job_failed: deployJobFailed.status,
  exact_head_preferred: prefersExactHead.status,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));