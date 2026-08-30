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

const DEPLOY_SOURCES = Object.freeze([CANONICAL_DEPLOY_SOURCE, GUARDED_ACTIVATION_SOURCE]);

function result(status, label, extras = {}) {
  return {
    schema: 'riosystems.operator-staging-deployment-evidence.v1',
    status,
    raw: status,
    label,
    ...extras,
    production_deploy: false
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

function sourceForRun(run = {}, branch = 'factory-control', workflowNameOverride = null) {
  if (run?.head_branch !== branch) return null;
  return DEPLOY_SOURCES.find((source) => {
    const expectedName = source === CANONICAL_DEPLOY_SOURCE && workflowNameOverride
      ? workflowNameOverride
      : source.name;
    return run?.name === expectedName
      && run?.path === source.path
      && run?.event === source.event;
  }) || null;
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
  const runsResponse = await fetchJson(fetch_impl, `${api}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=100`);
  if (!runsResponse.ok) return result('NOT_VERIFIED', 'Staging deployment workflow history could not be read', { error: runsResponse.error, canonical_head_sha: head });

  const runs = Array.isArray(runsResponse.data?.workflow_runs) ? runsResponse.data.workflow_runs : [];
  const acceptedRuns = runs
    .map((run) => ({ run, source: sourceForRun(run, branch, workflow_name) }))
    .filter((entry) => entry.source);
  const selected = acceptedRuns.find((entry) => clean(entry.run?.head_sha, 80) === head) || acceptedRuns[0] || null;
  if (!selected) return result('NOT_VERIFIED', 'No accepted zero-cost staging deployment run exists', {
    canonical_head_sha: head,
    accepted_sources: DEPLOY_SOURCES.map((source) => source.id)
  });

  const { run, source } = selected;
  const deployedSha = clean(run.head_sha, 80) || null;
  const baseState = runState(run);
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
    source: 'github_actions_zero_cost_staging_deploy'
  };

  if (baseState === 'DEGRADED') return result('DEGRADED', 'Latest accepted staging deployment is still running', base);
  if (baseState === 'BLOCKED') return result('BLOCKED', 'Latest accepted staging deployment workflow failed', base);
  if (baseState !== 'HEALTHY') return result('NOT_VERIFIED', 'Latest accepted staging deployment workflow did not prove a deployment', base);
  if (!deployedSha || deployedSha !== head) return result('STALE', 'Latest successful staging deployment is not the current factory-control head', base);
  if (!run.jobs_url) return result('NOT_VERIFIED', 'Successful deployment run has no job evidence URL', base);

  const jobsResponse = await fetchJson(fetch_impl, run.jobs_url);
  if (!jobsResponse.ok) return result('NOT_VERIFIED', 'Staging deployment job evidence could not be read', { ...base, error: jobsResponse.error });
  const jobs = Array.isArray(jobsResponse.data?.jobs) ? jobsResponse.data.jobs : [];
  const deployJob = jobs.find((job) => job?.name === 'deploy-staging') || null;
  if (!deployJob) return result('NOT_VERIFIED', 'Deploy-staging job is missing from successful workflow run', base);
  if (deployJob.status !== 'completed') return result('DEGRADED', 'Deploy-staging job is not completed', { ...base, deploy_job_id: deployJob.id ?? null, deploy_job_status: deployJob.status ?? null });
  if (deployJob.conclusion !== 'success') return result('BLOCKED', 'Deploy-staging job did not succeed', { ...base, deploy_job_id: deployJob.id ?? null, deploy_job_conclusion: deployJob.conclusion ?? null });

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
    exact_head_required: true,
    github_read_only: true,
    validate_only_never_counts_as_deploy: true,
    states: ['HEALTHY','DEGRADED','BLOCKED','STALE','NOT_VERIFIED'],
    production_deploy: false
  };
}