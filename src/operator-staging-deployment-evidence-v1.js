const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

const CANONICAL_DEPLOY_SOURCE = Object.freeze({
  id: 'workflow_dispatch_zero_cost_staging_deploy',
  name: 'RIOSYSTEMS Zero-Cost Staging Deploy',
  path: '.github/workflows/riosystems-staging-deploy.yml',
  event: 'workflow_dispatch'
});

const GUARDED_ACTIVATION_SOURCE = Object.freeze({
  id: 'guarded_exact_head_staging_activation_push',
  name: 'RIOSYSTEMS V1 Staging Activation Once',
  path: '.github/workflows/riosystems-v1-staging-activation-once.yml',
  event: 'push'
});

const AUTHORIZED_PR_DEPLOY_SOURCE = Object.freeze({
  id: 'authorized_pr_zero_cost_staging_deploy',
  name: 'RIOSYSTEMS Zero-Cost Staging Deploy',
  path: '.github/workflows/riosystems-staging-deploy.yml',
  event: 'pull_request',
  head_branch: 'riosystems-staging-deploy-request',
  base_branch: 'factory-control',
  request_path: '.github/riosystems-staging-deploy-request.json',
  pr_title: '[STAGING DEPLOY] riosystems-staging'
});

const DEPLOY_SOURCES = Object.freeze([
  CANONICAL_DEPLOY_SOURCE,
  GUARDED_ACTIVATION_SOURCE,
  AUTHORIZED_PR_DEPLOY_SOURCE
]);

function result(status, label, extras = {}) {
  return {
    schema: 'riosystems.operator-staging-deployment-evidence.v1',
    status,
    raw: status,
    label,
    ...extras,
    production_deploy: false,
    external_writes: false
  };
}

async function fetchJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'RIOSYSTEMS-Staging-Deployment-Evidence-V1',
        'x-github-api-version': '2022-11-28'
      }
    });
  } catch (error) {
    return { ok: false, error: `GITHUB_DEPLOY_EVIDENCE_UNAVAILABLE:${clean(error?.message || error, 240)}` };
  }
  if (!response?.ok) return { ok: false, error: `GITHUB_DEPLOY_EVIDENCE_HTTP_${response?.status || 0}` };
  try { return { ok: true, data: await response.json() }; }
  catch { return { ok: false, error: 'GITHUB_DEPLOY_EVIDENCE_INVALID_JSON' }; }
}

function runState(run = {}) {
  const conclusion = clean(run.conclusion, 80).toLowerCase();
  const status = clean(run.status, 80).toLowerCase();
  if (status !== 'completed') return 'DEGRADED';
  if (conclusion === 'success') return 'HEALTHY';
  if (['failure','timed_out','action_required','startup_failure'].includes(conclusion)) return 'BLOCKED';
  return 'NOT_VERIFIED';
}

function expectedWorkflowName(source, workflowNameOverride = null) {
  const zeroCostWorkflow = source === CANONICAL_DEPLOY_SOURCE || source === AUTHORIZED_PR_DEPLOY_SOURCE;
  return zeroCostWorkflow && workflowNameOverride ? workflowNameOverride : source.name;
}

function repositoryMatches(run = {}, repositoryFullName = '') {
  return clean(run?.repository?.full_name, 240) === repositoryFullName
    && clean(run?.head_repository?.full_name, 240) === repositoryFullName;
}

function basicAuthorizedPrMetadataMatches(run = {}, source = AUTHORIZED_PR_DEPLOY_SOURCE, branch = 'factory-control', repositoryFullName = '') {
  if (run?.head_branch !== source.head_branch) return false;
  if (!repositoryMatches(run, repositoryFullName)) return false;
  const pullRequests = Array.isArray(run?.pull_requests) ? run.pull_requests : [];
  if (pullRequests.length !== 1) return false;
  const pr = pullRequests[0];
  if (clean(pr?.head?.ref, 200) !== source.head_branch) return false;
  if (clean(pr?.head?.sha, 80) !== clean(run?.head_sha, 80)) return false;
  if (clean(pr?.base?.ref, 200) !== branch) return false;
  const repositoryId = Number(run?.repository?.id || 0);
  if (repositoryId && Number(pr?.head?.repo?.id || 0) !== repositoryId) return false;
  if (repositoryId && Number(pr?.base?.repo?.id || 0) !== repositoryId) return false;
  return true;
}

function sourceForRun(run = {}, {
  branch = 'factory-control',
  workflowNameOverride = null,
  repositoryFullName = ''
} = {}) {
  for (const source of DEPLOY_SOURCES) {
    if (run?.name !== expectedWorkflowName(source, workflowNameOverride)) continue;
    if (run?.path !== source.path || run?.event !== source.event) continue;
    if (source === AUTHORIZED_PR_DEPLOY_SOURCE) {
      if (basicAuthorizedPrMetadataMatches(run, source, branch, repositoryFullName)) return source;
      continue;
    }
    if (run?.head_branch === branch) return source;
  }
  return null;
}

function encodeRepoPath(path = '') {
  return String(path).split('/').map((part) => encodeURIComponent(part)).join('/');
}

function decodeContentsJson(data = {}) {
  if (clean(data?.encoding, 40).toLowerCase() !== 'base64') return null;
  const encoded = String(data?.content || '').replace(/\s+/g, '');
  if (!encoded) return null;
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

async function validateAuthorizedPrDeployRequest({
  fetchImpl,
  api,
  owner,
  repo,
  branch,
  run,
  source
}) {
  const repositoryFullName = `${owner}/${repo}`;
  if (!basicAuthorizedPrMetadataMatches(run, source, branch, repositoryFullName)) {
    return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_METADATA_MISMATCH' };
  }

  const pullRequestRef = run.pull_requests[0];
  const expectedPrUrl = `${api}/pulls/${Number(pullRequestRef?.number || 0)}`;
  if (!Number(pullRequestRef?.number) || clean(pullRequestRef?.url, 500) !== expectedPrUrl) {
    return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_PR_REFERENCE_INVALID' };
  }

  const prResponse = await fetchJson(fetchImpl, expectedPrUrl);
  if (!prResponse.ok) return { ok: false, error: prResponse.error };
  const pr = prResponse.data || {};
  if (clean(pr?.title, 300) !== source.pr_title) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_TITLE_MISMATCH' };
  if (pr?.draft === true) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_DRAFT_REJECTED' };
  if (clean(pr?.user?.login, 160) !== owner) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_ACTOR_MISMATCH' };
  if (clean(pr?.head?.ref, 200) !== source.head_branch) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_HEAD_BRANCH_MISMATCH' };
  if (clean(pr?.head?.sha, 80) !== clean(run?.head_sha, 80)) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_HEAD_SHA_MISMATCH' };
  if (clean(pr?.head?.repo?.full_name, 240) !== repositoryFullName) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_HEAD_REPO_MISMATCH' };
  if (clean(pr?.base?.ref, 200) !== branch) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_BASE_BRANCH_MISMATCH' };
  if (clean(pr?.base?.repo?.full_name, 240) !== repositoryFullName) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_BASE_REPO_MISMATCH' };

  const filesResponse = await fetchJson(fetchImpl, `${expectedPrUrl}/files?per_page=100`);
  if (!filesResponse.ok) return { ok: false, error: filesResponse.error };
  const files = Array.isArray(filesResponse.data) ? filesResponse.data : [];
  if (files.length !== 1 || clean(files[0]?.filename, 500) !== source.request_path) {
    return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_DIFF_NOT_ISOLATED' };
  }

  const requestUrl = `${api}/contents/${encodeRepoPath(source.request_path)}?ref=${encodeURIComponent(clean(run?.head_sha, 80))}`;
  const requestResponse = await fetchJson(fetchImpl, requestUrl);
  if (!requestResponse.ok) return { ok: false, error: requestResponse.error };
  const request = decodeContentsJson(requestResponse.data);
  if (!request) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_REQUEST_INVALID_JSON' };

  const canonicalSha = clean(request.canonical_sha, 80);
  const valid = request.schema === 'riosystems-staging-deploy-request-v1'
    && request.target === 'riosystems-staging'
    && request.canonical_ref === branch
    && /^[0-9a-f]{40}$/i.test(canonicalSha)
    && request.confirmation === 'DEPLOY_RIOSYSTEMS_STAGING_ZERO_COST'
    && request.production_deploy === false
    && request.external_writes === false
    && canonicalSha === clean(pr?.base?.sha, 80)
    && canonicalSha === clean(pullRequestRef?.base?.sha, 80);
  if (!valid) return { ok: false, error: 'AUTHORIZED_PR_DEPLOY_REQUEST_CONTRACT_MISMATCH' };

  return {
    ok: true,
    deployed_sha: canonicalSha,
    pull_request_number: Number(pr.number || pullRequestRef.number),
    request_path: source.request_path,
    authorization_contract: 'authorized_zero_cost_staging_deploy_request_v1',
    production_deploy: false,
    external_writes: false
  };
}

async function resolveCandidate({
  fetchImpl,
  api,
  owner,
  repo,
  branch,
  run,
  source
}) {
  if (source !== AUTHORIZED_PR_DEPLOY_SOURCE) {
    return {
      ok: true,
      deployed_sha: clean(run?.head_sha, 80) || null,
      production_deploy: false,
      external_writes: false
    };
  }
  return validateAuthorizedPrDeployRequest({ fetchImpl, api, owner, repo, branch, run, source });
}

function newestFirst(a, b) {
  const left = new Date(a?.run?.updated_at || a?.run?.created_at || 0).getTime();
  const right = new Date(b?.run?.updated_at || b?.run?.created_at || 0).getTime();
  return right - left;
}

export async function readAuthoritativeStagingDeploymentEvidence({
  fetch_impl = globalThis.fetch,
  owner = 'dariolazzano3-ops',
  repo = 'chatgpt-test',
  branch = 'factory-control',
  canonical_head_sha = null,
  workflow_name = CANONICAL_DEPLOY_SOURCE.name
} = {}) {
  const head = clean(canonical_head_sha, 80) || null;
  if (!head) return result('NOT_VERIFIED', 'Canonical factory-control head is unavailable');

  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const repositoryFullName = `${owner}/${repo}`;
  const canonicalRunsUrl = `${api}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=100`;
  const authorizedPrRunsUrl = `${api}/actions/runs?branch=${encodeURIComponent(AUTHORIZED_PR_DEPLOY_SOURCE.head_branch)}&per_page=100`;
  const [canonicalRunsResponse, authorizedPrRunsResponse] = await Promise.all([
    fetchJson(fetch_impl, canonicalRunsUrl),
    fetchJson(fetch_impl, authorizedPrRunsUrl)
  ]);

  if (!canonicalRunsResponse.ok && !authorizedPrRunsResponse.ok) {
    return result('NOT_VERIFIED', 'Staging deployment workflow history could not be read', {
      canonical_head_sha: head,
      error: canonicalRunsResponse.error || authorizedPrRunsResponse.error
    });
  }

  const combinedRuns = [
    ...(canonicalRunsResponse.ok && Array.isArray(canonicalRunsResponse.data?.workflow_runs) ? canonicalRunsResponse.data.workflow_runs : []),
    ...(authorizedPrRunsResponse.ok && Array.isArray(authorizedPrRunsResponse.data?.workflow_runs) ? authorizedPrRunsResponse.data.workflow_runs : [])
  ];
  const uniqueRuns = [...new Map(combinedRuns.map((run) => [run?.id ?? `${run?.name}:${run?.head_sha}:${run?.event}`, run])).values()];
  const acceptedRuns = uniqueRuns
    .map((run) => ({
      run,
      source: sourceForRun(run, { branch, workflowNameOverride: workflow_name, repositoryFullName })
    }))
    .filter((entry) => entry.source);

  const candidates = [];
  for (const entry of acceptedRuns) {
    const resolved = await resolveCandidate({
      fetchImpl: fetch_impl,
      api,
      owner,
      repo,
      branch,
      run: entry.run,
      source: entry.source
    });
    if (resolved.ok) candidates.push({ ...entry, ...resolved });
  }
  candidates.sort(newestFirst);

  const selected = candidates.find((entry) => clean(entry.deployed_sha, 80) === head) || candidates[0] || null;
  if (!selected) return result('NOT_VERIFIED', 'No accepted zero-cost staging deployment run exists', {
    canonical_head_sha: head,
    accepted_sources: DEPLOY_SOURCES.map((source) => source.id)
  });

  const { run, source } = selected;
  const deployedSha = clean(selected.deployed_sha, 80) || null;
  const base = {
    canonical_head_sha: head,
    deployed_sha: deployedSha,
    workflow_name: run.name ?? source.name,
    workflow_path: run.path ?? null,
    workflow_event: run.event ?? null,
    deploy_source: source.id,
    run_id: run.id ?? null,
    run_number: run.run_number ?? null,
    run_status: run.status ?? null,
    run_conclusion: run.conclusion ?? null,
    completed_at: run.updated_at || run.created_at || null,
    pull_request_number: selected.pull_request_number ?? null,
    request_path: selected.request_path ?? null,
    authorization_contract: selected.authorization_contract ?? null,
    source: 'github_actions_zero_cost_staging_deploy',
    production_deploy: false,
    external_writes: false
  };

  if (!run.jobs_url) return result('NOT_VERIFIED', 'Successful deployment run has no job evidence URL', base);
  const jobsResponse = await fetchJson(fetch_impl, run.jobs_url);
  if (!jobsResponse.ok) return result('NOT_VERIFIED', 'Staging deployment job evidence could not be read', { ...base, error: jobsResponse.error });
  const jobs = Array.isArray(jobsResponse.data?.jobs) ? jobsResponse.data.jobs : [];

  if (source === AUTHORIZED_PR_DEPLOY_SOURCE) {
    const authorizeJob = jobs.find((job) => job?.name === 'authorize-deploy') || null;
    if (!authorizeJob) return result('NOT_VERIFIED', 'Authorized PR deploy is missing authorize-deploy job evidence', base);
    if (authorizeJob.status !== 'completed') return result('DEGRADED', 'Authorized PR deploy authorization is still running', {
      ...base,
      authorize_job_id: authorizeJob.id ?? null,
      authorize_job_status: authorizeJob.status ?? null
    });
    if (authorizeJob.conclusion !== 'success') return result('BLOCKED', 'Authorized PR deploy authorization did not succeed', {
      ...base,
      authorize_job_id: authorizeJob.id ?? null,
      authorize_job_conclusion: authorizeJob.conclusion ?? null
    });
  }

  const deployJob = jobs.find((job) => job?.name === 'deploy-staging') || null;
  if (!deployJob) return result('NOT_VERIFIED', 'Deploy-staging job is missing from successful workflow run', base);
  if (deployJob.status !== 'completed') return result('DEGRADED', 'Deploy-staging job is not completed', {
    ...base,
    deploy_job_id: deployJob.id ?? null,
    deploy_job_status: deployJob.status ?? null
  });
  if (deployJob.conclusion !== 'success') return result('BLOCKED', 'Deploy-staging job did not succeed', {
    ...base,
    deploy_job_id: deployJob.id ?? null,
    deploy_job_conclusion: deployJob.conclusion ?? null
  });

  const baseState = runState(run);
  if (baseState === 'DEGRADED') return result('DEGRADED', 'Latest accepted staging deployment workflow is still running', {
    ...base,
    deploy_job_id: deployJob.id ?? null,
    deploy_job_status: deployJob.status,
    deploy_job_conclusion: deployJob.conclusion
  });
  if (baseState === 'BLOCKED') return result('BLOCKED', 'Latest accepted staging deployment workflow failed', {
    ...base,
    deploy_job_id: deployJob.id ?? null,
    deploy_job_status: deployJob.status,
    deploy_job_conclusion: deployJob.conclusion
  });
  if (baseState !== 'HEALTHY') return result('NOT_VERIFIED', 'Latest accepted staging deployment workflow did not prove a deployment', base);
  if (!deployedSha || deployedSha !== head) return result('STALE', 'Latest successful staging deployment is not the current factory-control head', {
    ...base,
    deploy_job_id: deployJob.id ?? null,
    deploy_job_status: deployJob.status,
    deploy_job_conclusion: deployJob.conclusion
  });

  return result('HEALTHY', 'Current factory-control head is successfully deployed to zero-cost staging', {
    ...base,
    deploy_job_id: deployJob.id ?? null,
    deploy_job_status: deployJob.status,
    deploy_job_conclusion: deployJob.conclusion
  });
}

export function operatorStagingDeploymentEvidenceManifest() {
  return {
    schema: 'riosystems.operator-staging-deployment-evidence.v1',
    accepted_sources: DEPLOY_SOURCES.map((source) => ({ ...source })),
    required_branch: 'factory-control',
    required_job: 'deploy-staging',
    authorized_pr_required_job: 'authorize-deploy',
    authorized_pr_request_branch: AUTHORIZED_PR_DEPLOY_SOURCE.head_branch,
    authorized_pr_request_path: AUTHORIZED_PR_DEPLOY_SOURCE.request_path,
    exact_head_required: true,
    github_read_only: true,
    validate_only_never_counts_as_deploy: true,
    production_deploy: false,
    external_writes: false,
    states: ['HEALTHY','DEGRADED','BLOCKED','STALE','NOT_VERIFIED']
  };
}
