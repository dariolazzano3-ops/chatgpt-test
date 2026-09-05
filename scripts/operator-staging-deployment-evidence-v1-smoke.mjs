#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readAuthoritativeStagingDeploymentEvidence, operatorStagingDeploymentEvidenceManifest } from '../src/operator-staging-deployment-evidence-v1.js';

const HEAD = '8eb172c1070194496182127db3c36e44a99ad1e7';
const OLD_HEAD = '7ab48f26e597272f414674ff9458190eabcf3da8';
const REQUEST_SHA = '882ddc70342053a8c8bef88aab22910506cc7054';
const REPO = 'dariolazzano3-ops/chatgpt-test';
const RUNS_URL_PART = '/actions/runs?branch=factory-control&per_page=100';
const PR_RUNS_URL_PART = '/actions/runs?branch=riosystems-staging-deploy-request&per_page=100';
const JOBS_URL = 'https://api.github.test/jobs/123';
const PR_URL = 'https://api.github.com/repos/dariolazzano3-ops/chatgpt-test/pulls/420';
const REQUEST_PATH = '.github/riosystems-staging-deploy-request.json';

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function encodedJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function makeFetch({
  canonicalRuns = [],
  prRuns = [],
  jobs = [],
  pr = null,
  prFiles = [{ filename: REQUEST_PATH }],
  request = null
} = {}) {
  return async (url) => {
    const value = String(url);
    if (value.includes(RUNS_URL_PART)) return response({ workflow_runs: canonicalRuns });
    if (value.includes(PR_RUNS_URL_PART)) return response({ workflow_runs: prRuns });
    if (value === JOBS_URL) return response({ jobs });
    if (value === PR_URL) return pr ? response(pr) : response({}, 404);
    if (value === `${PR_URL}/files?per_page=100`) return response(prFiles);
    if (value.includes(`/contents/${REQUEST_PATH}?ref=`)) {
      return request
        ? response({ encoding: 'base64', content: encodedJson(request) })
        : response({}, 404);
    }
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

function authorizedPrScenario({
  deployedSha = HEAD,
  runOverrides = {},
  prOverrides = {},
  requestOverrides = {},
  jobs = null,
  prFiles = [{ filename: REQUEST_PATH }]
} = {}) {
  const repoRef = { id: 1346557876 };
  const run = {
    id: 300,
    run_number: 170,
    name: 'RIOSYSTEMS Zero-Cost Staging Deploy',
    path: '.github/workflows/riosystems-staging-deploy.yml',
    event: 'pull_request',
    head_branch: 'riosystems-staging-deploy-request',
    head_sha: REQUEST_SHA,
    repository: { id: 1346557876, full_name: REPO },
    head_repository: { id: 1346557876, full_name: REPO },
    pull_requests: [{
      number: 420,
      url: PR_URL,
      head: { ref: 'riosystems-staging-deploy-request', sha: REQUEST_SHA, repo: repoRef },
      base: { ref: 'factory-control', sha: deployedSha, repo: repoRef }
    }],
    status: 'completed',
    conclusion: 'success',
    updated_at: '2026-09-05T13:26:47Z',
    jobs_url: JOBS_URL,
    ...runOverrides
  };
  const pr = {
    number: 420,
    title: '[STAGING DEPLOY] riosystems-staging',
    draft: false,
    state: 'open',
    user: { login: 'dariolazzano3-ops' },
    head: {
      ref: 'riosystems-staging-deploy-request',
      sha: REQUEST_SHA,
      repo: { full_name: REPO }
    },
    base: {
      ref: 'factory-control',
      sha: deployedSha,
      repo: { full_name: REPO }
    },
    ...prOverrides
  };
  const request = {
    schema: 'riosystems-staging-deploy-request-v1',
    target: 'riosystems-staging',
    canonical_ref: 'factory-control',
    canonical_sha: deployedSha,
    confirmation: 'DEPLOY_RIOSYSTEMS_STAGING_ZERO_COST',
    production_deploy: false,
    external_writes: false,
    ...requestOverrides
  };
  const effectiveJobs = jobs ?? [
    { id: 500, name: 'authorize-deploy', status: 'completed', conclusion: 'success' },
    { id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'success' }
  ];
  return {
    run,
    fetch: makeFetch({ prRuns: [run], jobs: effectiveJobs, pr, prFiles, request })
  };
}

const deployJob = [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'success' }];

const none = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch()
});
assert.equal(none.status, 'NOT_VERIFIED');

const healthyDispatch = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({ canonicalRuns: [deployRun()], jobs: deployJob })
});
assert.equal(healthyDispatch.status, 'HEALTHY');
assert.equal(healthyDispatch.deployed_sha, HEAD);
assert.equal(healthyDispatch.deploy_source, 'workflow_dispatch_zero_cost_staging_deploy');
assert.equal(healthyDispatch.deploy_job_conclusion, 'success');

const healthyOneShot = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({ canonicalRuns: [oneShotRun()], jobs: deployJob })
});
assert.equal(healthyOneShot.status, 'HEALTHY');
assert.equal(healthyOneShot.deployed_sha, HEAD);
assert.equal(healthyOneShot.deploy_source, 'guarded_exact_head_staging_activation_push');
assert.equal(healthyOneShot.workflow_event, 'push');

const authorizedPr = authorizedPrScenario();
const healthyPr = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: authorizedPr.fetch
});
assert.equal(healthyPr.status, 'HEALTHY');
assert.equal(healthyPr.deployed_sha, HEAD);
assert.equal(healthyPr.deploy_source, 'authorized_pr_zero_cost_staging_deploy');
assert.equal(healthyPr.pull_request_number, 420);
assert.equal(healthyPr.authorization_contract, 'authorized_zero_cost_staging_deploy_request_v1');
assert.equal(healthyPr.production_deploy, false);
assert.equal(healthyPr.external_writes, false);

const validateOnlyPr = authorizedPrScenario({
  jobs: [
    { id: 500, name: 'authorize-deploy', status: 'completed', conclusion: 'success' },
    { id: 502, name: 'validate', status: 'completed', conclusion: 'success' }
  ]
});
const validateOnly = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: validateOnlyPr.fetch
});
assert.equal(validateOnly.status, 'NOT_VERIFIED');

const wrongPrBranch = authorizedPrScenario({
  runOverrides: { head_branch: 'not-authorized-deploy-request' }
});
const wrongBranch = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: wrongPrBranch.fetch
});
assert.equal(wrongBranch.status, 'NOT_VERIFIED');

const wrongPrWorkflow = authorizedPrScenario({
  runOverrides: { name: 'Untrusted Staging Deploy' }
});
const wrongWorkflow = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: wrongPrWorkflow.fetch
});
assert.equal(wrongWorkflow.status, 'NOT_VERIFIED');

const failedPr = authorizedPrScenario({
  runOverrides: { conclusion: 'failure' },
  jobs: [
    { id: 500, name: 'authorize-deploy', status: 'completed', conclusion: 'success' },
    { id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'failure' }
  ]
});
const failed = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: failedPr.fetch
});
assert.equal(failed.status, 'BLOCKED');

const runningPr = authorizedPrScenario({
  runOverrides: { status: 'in_progress', conclusion: null },
  jobs: [
    { id: 500, name: 'authorize-deploy', status: 'completed', conclusion: 'success' },
    { id: 501, name: 'deploy-staging', status: 'in_progress', conclusion: null }
  ]
});
const running = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: runningPr.fetch
});
assert.equal(running.status, 'DEGRADED');

const stalePr = authorizedPrScenario({ deployedSha: OLD_HEAD });
const stale = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: stalePr.fetch
});
assert.equal(stale.status, 'STALE');
assert.equal(stale.deployed_sha, OLD_HEAD);

const exactHeadPr = authorizedPrScenario();
const exactHead = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: exactHeadPr.fetch
});
assert.equal(exactHead.status, 'HEALTHY');
assert.equal(exactHead.deployed_sha, HEAD);

const oneShotWrongEvent = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({ canonicalRuns: [oneShotRun({ event: 'workflow_dispatch' })], jobs: deployJob })
});
assert.equal(oneShotWrongEvent.status, 'NOT_VERIFIED');

const oneShotWrongPath = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({ canonicalRuns: [oneShotRun({ path: '.github/workflows/not-approved.yml' })], jobs: deployJob })
});
assert.equal(oneShotWrongPath.status, 'NOT_VERIFIED');

const dispatchFailed = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({
    canonicalRuns: [deployRun({ conclusion: 'failure' })],
    jobs: [{ id: 501, name: 'deploy-staging', status: 'completed', conclusion: 'failure' }]
  })
});
assert.equal(dispatchFailed.status, 'BLOCKED');

const dispatchRunning = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({
    canonicalRuns: [deployRun({ status: 'in_progress', conclusion: null })],
    jobs: [{ id: 501, name: 'deploy-staging', status: 'in_progress', conclusion: null }]
  })
});
assert.equal(dispatchRunning.status, 'DEGRADED');

const prefersExactHead = await readAuthoritativeStagingDeploymentEvidence({
  canonical_head_sha: HEAD,
  fetch_impl: makeFetch({
    canonicalRuns: [
      deployRun({ id: 400, head_sha: OLD_HEAD, updated_at: '2026-09-05T14:00:00Z' }),
      oneShotRun({ id: 401, updated_at: '2026-09-05T13:00:00Z' })
    ],
    jobs: deployJob
  })
});
assert.equal(prefersExactHead.status, 'HEALTHY');
assert.equal(prefersExactHead.run_id, 401);

const manifest = operatorStagingDeploymentEvidenceManifest();
assert.equal(manifest.exact_head_required, true);
assert.equal(manifest.required_job, 'deploy-staging');
assert.equal(manifest.authorized_pr_required_job, 'authorize-deploy');
assert.equal(manifest.authorized_pr_request_branch, 'riosystems-staging-deploy-request');
assert.equal(manifest.authorized_pr_request_path, REQUEST_PATH);
assert.equal(manifest.github_read_only, true);
assert.equal(manifest.validate_only_never_counts_as_deploy, true);
assert.equal(manifest.accepted_sources.length, 3);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-staging-deployment-evidence-v1',
  workflow_dispatch_exact_head: healthyDispatch.status,
  guarded_push_exact_head: healthyOneShot.status,
  authorized_pr_exact_head: healthyPr.status,
  pr_validate_only: validateOnly.status,
  wrong_pr_branch: wrongBranch.status,
  wrong_pr_workflow: wrongWorkflow.status,
  failed_deploy_staging: failed.status,
  running_deploy_staging: running.status,
  stale_successful_deploy: stale.status,
  current_exact_head_successful_deploy: exactHead.status,
  exact_head_preferred: prefersExactHead.status,
  production_deploy: false,
  external_writes: false,
  variable_cost_eur: 0
}, null, 2));
