const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function evidence(status, label, extras = {}) {
  return {
    schema: 'riosystems.operator-cloudflare-access-evidence.v1',
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
        'user-agent': 'RIOSYSTEMS-Cloudflare-Access-Evidence-V1',
        'x-github-api-version': '2022-11-28'
      }
    });
  } catch (error) {
    return { ok: false, error: `GITHUB_ACCESS_EVIDENCE_UNAVAILABLE:${clean(error?.message || error, 240)}` };
  }
  if (!response?.ok) return { ok: false, error: `GITHUB_ACCESS_EVIDENCE_HTTP_${response?.status || 0}` };
  try { return { ok: true, data: await response.json() }; }
  catch { return { ok: false, error: 'GITHUB_ACCESS_EVIDENCE_INVALID_JSON' }; }
}

function workflowState(run = {}) {
  const status = clean(run.status, 80).toLowerCase();
  const conclusion = clean(run.conclusion, 80).toLowerCase();
  if (status !== 'completed') return 'DEGRADED';
  if (conclusion === 'success') return 'HEALTHY';
  if (['failure','timed_out','action_required','startup_failure'].includes(conclusion)) return 'BLOCKED';
  return 'NOT_VERIFIED';
}

export async function readAuthoritativeCloudflareAccessEvidence({
  fetch_impl = globalThis.fetch,
  owner = 'dariolazzano3-ops',
  repo = 'chatgpt-test',
  branch = 'factory-control',
  canonical_head_sha = null,
  workflow_name = 'RIOSYSTEMS Cloudflare Access Read-only Verification'
} = {}) {
  const head = clean(canonical_head_sha, 80) || null;
  if (!head) return evidence('NOT_VERIFIED', 'Canonical factory-control head is unavailable');
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const runsResponse = await fetchJson(fetch_impl, `${api}/actions/runs?head_sha=${encodeURIComponent(head)}&event=push&per_page=50`);
  if (!runsResponse.ok) return evidence('NOT_VERIFIED', 'Cloudflare Access verification history could not be read', { error: runsResponse.error, canonical_head_sha: head });

  const runs = Array.isArray(runsResponse.data?.workflow_runs) ? runsResponse.data.workflow_runs : [];
  const run = runs.find((item) => item?.name === workflow_name && item?.event === 'push' && item?.head_branch === branch && item?.head_sha === head) || null;
  if (!run) return evidence('NOT_VERIFIED', 'No exact-head Cloudflare Access verification run exists yet', { canonical_head_sha: head, workflow_name });

  const base = {
    canonical_head_sha: head,
    verified_head_sha: clean(run.head_sha, 80) || null,
    workflow_name,
    run_id: run.id ?? null,
    run_number: run.run_number ?? null,
    run_status: run.status ?? null,
    run_conclusion: run.conclusion ?? null,
    checked_at: run.updated_at || run.created_at || null,
    source: 'github_actions_cloudflare_access_readonly'
  };
  const state = workflowState(run);
  if (state === 'DEGRADED') return evidence('DEGRADED', 'Cloudflare Access verification is still running', base);
  if (state === 'BLOCKED') return evidence('BLOCKED', 'Cloudflare Access verification failed on the current factory-control head', base);
  if (state !== 'HEALTHY') return evidence('NOT_VERIFIED', 'Cloudflare Access verification did not prove private access', base);
  if (!run.jobs_url) return evidence('NOT_VERIFIED', 'Successful Access workflow has no job evidence URL', base);

  const jobsResponse = await fetchJson(fetch_impl, run.jobs_url);
  if (!jobsResponse.ok) return evidence('NOT_VERIFIED', 'Cloudflare Access job evidence could not be read', { ...base, error: jobsResponse.error });
  const jobs = Array.isArray(jobsResponse.data?.jobs) ? jobsResponse.data.jobs : [];
  const validateJob = jobs.find((job) => job?.name === 'validate') || null;
  const verifyJob = jobs.find((job) => job?.name === 'verify-access') || null;
  if (!validateJob || validateJob.status !== 'completed' || validateJob.conclusion !== 'success') {
    return evidence('NOT_VERIFIED', 'Access verifier safety validation is not proven', { ...base, validate_job_id: validateJob?.id ?? null, validate_job_conclusion: validateJob?.conclusion ?? null });
  }
  if (!verifyJob) return evidence('NOT_VERIFIED', 'Live verify-access job is missing', base);
  if (verifyJob.status !== 'completed') return evidence('DEGRADED', 'Live verify-access job is not completed', { ...base, verify_job_id: verifyJob.id ?? null, verify_job_status: verifyJob.status ?? null });
  if (verifyJob.conclusion !== 'success') return evidence('BLOCKED', 'Live verify-access job did not succeed', { ...base, verify_job_id: verifyJob.id ?? null, verify_job_conclusion: verifyJob.conclusion ?? null });

  return evidence('HEALTHY', 'Private Cloudflare Access application and restrictive policy verified via GET-only API checks', {
    ...base,
    validate_job_id: validateJob.id ?? null,
    verify_job_id: verifyJob.id ?? null,
    verify_job_conclusion: verifyJob.conclusion,
    access_application_configured: true,
    restrictive_policy_verified: true,
    external_write: false
  });
}

export function operatorCloudflareAccessEvidenceManifest() {
  return {
    schema: 'riosystems.operator-cloudflare-access-evidence.v1',
    workflow_name: 'RIOSYSTEMS Cloudflare Access Read-only Verification',
    required_event: 'push',
    required_branch: 'factory-control',
    required_jobs: ['validate','verify-access'],
    exact_head_required: true,
    github_read_only: true,
    cloudflare_probe_method: 'GET_ONLY',
    states: ['HEALTHY','DEGRADED','BLOCKED','NOT_VERIFIED'],
    production_deploy: false
  };
}
