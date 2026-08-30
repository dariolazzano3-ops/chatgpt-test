const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

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

export async function readAuthoritativeStagingDeploymentEvidence({
  fetch_impl = globalThis.fetch,
  owner = 'dariolazzano3-ops',
  repo = 'chatgpt-test',
  branch = 'factory-control',
  canonical_head_sha = null,
  workflow_name = 'RIOSYSTEMS Zero-Cost Staging Deploy'
} = {}) {
  const head = clean(canonical_head_sha, 80) || null;
  if (!head) return result('NOT_VERIFIED', 'Canonical factory-control head is unavailable');

  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const runsResponse = await fetchJson(fetch_impl, `${api}/actions/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=50`);
  if (!runsResponse.ok) return result('NOT_VERIFIED', 'Staging deployment workflow history could not be read', { error: runsResponse.error, canonical_head_sha: head });

  const runs = Array.isArray(runsResponse.data?.workflow_runs) ? runsResponse.data.workflow_runs : [];
  const run = runs.find((item) => item?.name === workflow_name && item?.event === 'workflow_dispatch' && item?.head_branch === branch) || null;
  if (!run) return result('NOT_VERIFIED', 'No zero-cost staging deployment run exists', { canonical_head_sha: head, workflow_name });

  const deployedSha = clean(run.head_sha, 80) || null;
  const baseState = runState(run);
  const base = {
    canonical_head_sha: head,
    deployed_sha: deployedSha,
    workflow_name,
    run_id: run.id ?? null,
    run_number: run.run_number ?? null,
    run_status: run.status ?? null,
    run_conclusion: run.conclusion ?? null,
    completed_at: run.updated_at || run.created_at || null,
    source: 'github_actions_zero_cost_staging_deploy'
  };

  if (baseState === 'DEGRADED') return result('DEGRADED', 'Latest staging deployment is still running', base);
  if (baseState === 'BLOCKED') return result('BLOCKED', 'Latest staging deployment workflow failed', base);
  if (baseState !== 'HEALTHY') return result('NOT_VERIFIED', 'Latest staging deployment workflow did not prove a deployment', base);
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
    workflow_name: 'RIOSYSTEMS Zero-Cost Staging Deploy',
    required_event: 'workflow_dispatch',
    required_branch: 'factory-control',
    required_job: 'deploy-staging',
    exact_head_required: true,
    github_read_only: true,
    states: ['HEALTHY','DEGRADED','BLOCKED','STALE','NOT_VERIFIED'],
    production_deploy: false
  };
}
