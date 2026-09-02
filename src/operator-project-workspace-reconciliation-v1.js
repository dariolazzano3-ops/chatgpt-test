const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

export const AURENTARA_WEBSITE_PROJECT_PATH = 'projects/riosystems-public-website-v1';
export const AURENTARA_WEBSITE_PROJECT_ID = 'riosystems-public-website-v1';
export const AURENTARA_WEBSITE_SCOPE = 'aurentara-systems-internal:riosystems-public-website-v1';

function githubHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'riosystems-project-workspace-reconciliation/1.0'
  };
}

async function githubRead(token, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: 'GET',
    headers: githubHeaders(token)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const error = new Error(clean(body?.message || `GITHUB_HTTP_${response.status}`, 300));
    error.status = response.status;
    throw error;
  }
  return body;
}

function repositoryFromEnv(env = {}) {
  const repository = clean(env.GITHUB_REPOSITORY || 'dariolazzano3-ops/chatgpt-test', 200);
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ? repository : null;
}

function projectMissionMatch(item = {}) {
  const scope = clean(item.scope_key || item.project_scope || item.scope || item.mission?.scope_key, 300);
  const projectId = clean(item.project_id || item.mission?.project_id || item.delivery?.project_id, 200);
  return scope === AURENTARA_WEBSITE_SCOPE || projectId === AURENTARA_WEBSITE_PROJECT_ID;
}

function latestRuntimeMission(body = {}) {
  const candidates = [];
  for (const item of Array.isArray(body.durable) ? body.durable : []) {
    if (projectMissionMatch(item)) candidates.push({ source: 'durable_runtime', ...clone(item) });
  }
  for (const item of Array.isArray(body.universal) ? body.universal : []) {
    if (projectMissionMatch(item)) candidates.push({ source: 'universal_runtime', ...clone(item) });
  }
  for (const item of Array.isArray(body.live_staging) ? body.live_staging : []) {
    if (projectMissionMatch(item)) candidates.push({ source: 'live_staging_runtime', ...clone(item) });
  }
  return candidates.at(-1) || null;
}

async function readRuntimeMission(runtimeService) {
  if (!runtimeService || typeof runtimeService.handle !== 'function') return null;
  try {
    const result = await runtimeService.handle({ method: 'GET', path: '/missions' });
    if (!result?.ok) return null;
    return latestRuntimeMission(result.body || {});
  } catch {
    return null;
  }
}

function githubActionsQuality(checkRuns = []) {
  const relevant = (Array.isArray(checkRuns) ? checkRuns : []).filter((item) => item?.app?.slug === 'github-actions');
  if (!relevant.length) {
    return {
      status: 'NOT_VERIFIED',
      source: 'github_actions_project_iteration',
      check_count: 0,
      checks: []
    };
  }
  const checks = relevant.map((item) => ({
    name: clean(item.name, 160) || 'unnamed-check',
    status: clean(item.status, 40) || null,
    conclusion: clean(item.conclusion, 80) || null
  }));
  const failed = checks.some((item) => ['failure','cancelled','timed_out','action_required','startup_failure'].includes(item.conclusion));
  const complete = checks.every((item) => item.status === 'completed');
  const passed = complete && checks.every((item) => ['success','neutral','skipped'].includes(item.conclusion));
  return {
    status: failed ? 'FAIL' : passed ? 'PASS' : 'IN_PROGRESS',
    source: 'github_actions_project_iteration',
    check_count: checks.length,
    checks
  };
}

function unavailableTruth(reason) {
  return {
    ok: false,
    schema: 'riosystems.operator-project-current-truth.v1',
    status: 'NOT_RECONCILED',
    reason: clean(reason, 200) || 'CURRENT_PROJECT_TRUTH_UNAVAILABLE',
    canonical: null,
    iteration: null,
    mission: null,
    delivery: null,
    quality: { status: 'NOT_RECONCILED', source: 'none', check_count: 0, checks: [] },
    production_deploy: false,
    external_write_performed: false,
    variable_cost_eur: 0
  };
}

export async function resolveAurentaraProjectCurrentTruth(env = {}, runtimeService = null) {
  const repository = repositoryFromEnv(env);
  const branch = clean(env.FACTORY_CONTROL_BRANCH || 'factory-control', 160) || 'factory-control';
  const token = env.GITHUB_TOKEN;
  if (!repository) return unavailableTruth('INVALID_GITHUB_REPOSITORY');
  if (!token) return unavailableTruth('GITHUB_TOKEN_NOT_CONFIGURED');
  const [owner, repo] = repository.split('/');

  try {
    const branchRef = await githubRead(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const repositoryHeadSha = clean(branchRef?.object?.sha, 80) || null;
    if (!repositoryHeadSha) return unavailableTruth('CANONICAL_BRANCH_HEAD_NOT_AVAILABLE');

    const commits = await githubRead(
      token,
      `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(AURENTARA_WEBSITE_PROJECT_PATH)}&per_page=1`
    );
    const projectCommit = Array.isArray(commits) ? commits[0] || null : null;
    const projectSha = clean(projectCommit?.sha, 80) || null;
    if (!projectSha) return unavailableTruth('PROJECT_CANONICAL_COMMIT_NOT_AVAILABLE');

    const pulls = await githubRead(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(projectSha)}/pulls`);
    const mergedPull = (Array.isArray(pulls) ? pulls : []).find((item) => item?.merged_at && item?.base?.ref === branch) || null;
    const qualitySha = clean(mergedPull?.head?.sha, 80) || projectSha;
    const checkPayload = await githubRead(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(qualitySha)}/check-runs?per_page=100`);
    const quality = githubActionsQuality(checkPayload?.check_runs || []);
    const mission = await readRuntimeMission(runtimeService);
    const committedAt = clean(projectCommit?.commit?.committer?.date || projectCommit?.commit?.author?.date, 100) || null;

    const iteration = mergedPull ? {
      iteration_id: `PR_${mergedPull.number}`,
      kind: 'GITHUB_PULL_REQUEST',
      pr_number: mergedPull.number,
      title: clean(mergedPull.title, 300) || null,
      head_branch: clean(mergedPull.head?.ref, 240) || null,
      head_sha: clean(mergedPull.head?.sha, 80) || null,
      merge_sha: clean(mergedPull.merge_commit_sha, 80) || projectSha,
      status: 'MERGED',
      merged_at: clean(mergedPull.merged_at, 100) || committedAt
    } : {
      iteration_id: `COMMIT_${projectSha.slice(0, 12)}`,
      kind: 'CANONICAL_PROJECT_COMMIT',
      pr_number: null,
      title: clean(projectCommit?.commit?.message?.split('\n')[0], 300) || null,
      head_branch: null,
      head_sha: projectSha,
      merge_sha: projectSha,
      status: 'CANONICAL',
      merged_at: committedAt
    };

    const delivery = mergedPull ? {
      delivery_id: `github-pr-${mergedPull.number}`,
      kind: 'GITHUB_MERGED_PR',
      status: 'MERGED',
      pr_number: mergedPull.number,
      merge_sha: clean(mergedPull.merge_commit_sha, 80) || projectSha,
      head_sha: clean(mergedPull.head?.sha, 80) || null,
      head_branch: clean(mergedPull.head?.ref, 240) || null,
      title: clean(mergedPull.title, 300) || null,
      delivered_at: clean(mergedPull.merged_at, 100) || committedAt,
      production_deploy: false
    } : {
      delivery_id: `canonical-${projectSha.slice(0, 12)}`,
      kind: 'CANONICAL_PROJECT_COMMIT',
      status: 'CANONICAL',
      pr_number: null,
      merge_sha: projectSha,
      head_sha: projectSha,
      head_branch: null,
      title: clean(projectCommit?.commit?.message?.split('\n')[0], 300) || null,
      delivered_at: committedAt,
      production_deploy: false
    };

    return {
      ok: true,
      schema: 'riosystems.operator-project-current-truth.v1',
      status: 'RECONCILED',
      canonical: {
        repository,
        branch,
        repository_head_sha: repositoryHeadSha,
        project_path: AURENTARA_WEBSITE_PROJECT_PATH,
        project_sha: projectSha,
        project_sha_source: 'github_canonical_branch_path_history',
        committed_at: committedAt
      },
      iteration,
      mission: mission || { status: 'NOT_AVAILABLE', source: 'runtime_project_scope' },
      delivery,
      quality,
      production_deploy: false,
      external_write_performed: false,
      variable_cost_eur: 0
    };
  } catch (error) {
    return unavailableTruth(error?.message || 'GITHUB_PROJECT_TRUTH_READ_FAILED');
  }
}

function currentNextAction(result = {}, truth = {}) {
  if (!truth.ok) return 'RECONCILE_PROJECT_STATE';
  if (truth.quality?.status === 'FAIL') return 'REVIEW_QUALITY_FAILURE';
  if (truth.quality?.status !== 'PASS') return 'VERIFY_CURRENT_QUALITY';
  if (truth.delivery?.status === 'MERGED') return 'HUMAN_REVIEW';
  return 'READY_FOR_NEXT_ITERATION';
}

export function reconcileOperatorProjectWorkspace(snapshot = {}, truth = {}) {
  const result = clone(snapshot) || {};
  const priorProject = clone(result.project || {});
  const registration = {
    canonical_sha_at_registration: priorProject.canonical_sha || null,
    canonical_sha_state_at_registration: priorProject.canonical_sha_state || null,
    working_branch_at_registration: priorProject.working_branch || null,
    accepted_rc_sha: priorProject.accepted_rc_sha || null,
    accepted_rc_pr: priorProject.accepted_rc_pr || null,
    qa_status_at_registration: priorProject.qa_status || null
  };

  result.registration_state = registration;
  result.project = result.project || {};
  result.project.canonical_sha = truth.ok ? truth.canonical?.project_sha || null : null;
  result.project.canonical_sha_state = truth.ok ? 'RECONCILED_PROJECT_PATH_HEAD' : 'NOT_RECONCILED';
  result.project.canonical_source = truth.ok ? 'github_remote_project_path_history' : 'CURRENT_PROJECT_TRUTH_UNAVAILABLE';
  result.project.working_branch = truth.ok ? truth.iteration?.head_branch || null : null;
  result.project.qa_status = truth.ok ? truth.quality?.status || 'NOT_VERIFIED' : 'NOT_RECONCILED';
  result.project.last_change = truth.ok ? truth.iteration?.merged_at || truth.canonical?.committed_at || null : null;

  result.latest_iteration = truth.ok ? clone(truth.iteration) : { status: 'NOT_RECONCILED' };
  result.latest_mission = truth.ok ? clone(truth.mission || { status: 'NOT_AVAILABLE' }) : { status: 'NOT_RECONCILED' };
  result.latest_delivery = truth.ok ? clone(truth.delivery) : { status: 'NOT_RECONCILED' };
  result.quality = truth.ok ? clone(truth.quality) : { status: 'NOT_RECONCILED', source: 'none', check_count: 0, checks: [] };
  result.next_action = currentNextAction(result, truth);
  result.current_state = {
    status: truth.ok ? 'RECONCILED' : 'NOT_RECONCILED',
    canonical_project_sha: result.project.canonical_sha,
    canonical_repository_head_sha: truth.ok ? truth.canonical?.repository_head_sha || null : null,
    canonical_branch: truth.ok ? truth.canonical?.branch || result.project.canonical_branch || 'factory-control' : result.project.canonical_branch || 'factory-control',
    latest_iteration: result.latest_iteration,
    latest_mission: result.latest_mission,
    latest_delivery: result.latest_delivery,
    quality_status: result.quality.status,
    preview_status: result.preview?.status || result.project.preview_status || 'NOT_AVAILABLE',
    next_action: result.next_action
  };

  if (result.qa && typeof result.qa === 'object') {
    result.qa.source = truth.ok ? 'github_actions_latest_project_iteration' : 'current_project_truth_unavailable';
    result.qa.current_iteration_status = result.quality.status;
  }

  const currentHistory = Array.isArray(result.iteration_history) ? result.iteration_history : [];
  if (truth.ok && truth.iteration) {
    const alreadyPresent = currentHistory.some((item) => item.git_sha === truth.canonical?.project_sha || item.pr_number === truth.iteration?.pr_number);
    if (!alreadyPresent) {
      currentHistory.push({
        iteration: truth.iteration.iteration_id,
        git_sha: truth.canonical?.project_sha || truth.iteration.merge_sha || null,
        branch: truth.iteration.head_branch || truth.canonical?.branch || null,
        preview: result.preview?.status === 'AVAILABLE' ? result.preview.url : 'NOT_AVAILABLE',
        qa_status: result.quality.status,
        at: truth.iteration.merged_at || truth.canonical?.committed_at || null,
        status: truth.iteration.status,
        pr_number: truth.iteration.pr_number || null
      });
    }
  }
  result.iteration_history = currentHistory;
  result.reconciliation = {
    schema: 'riosystems.operator-project-workspace-reconciliation.v1',
    registration_metadata_preserved: true,
    current_truth_source: truth.ok ? 'github_plus_existing_operator_runtime' : 'NOT_RECONCILED',
    stale_registration_values_used_as_current_truth: false,
    production_deploy: false,
    external_write_performed: false,
    variable_cost_eur: 0
  };
  result.production_deploy = false;
  return result;
}
