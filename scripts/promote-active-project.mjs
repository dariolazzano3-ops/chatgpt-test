import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [projectPath, branch, prUrl, previewUrl, expectedSourceBranch = ''] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const statePath = 'factory-state/active-project.json';
const registryPath = 'factory-state/projects.json';
const controlRef = 'factory-control';

if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
if (!projectPath || !projectPath.startsWith('projects/')) throw new Error('PROJECT_PATH_INVALID');
if (!branch || !branch.startsWith('factory/')) throw new Error('PROJECT_BRANCH_INVALID');
if (!previewUrl || !previewUrl.startsWith('https://')) throw new Error('PREVIEW_URL_INVALID');
if (expectedSourceBranch && !expectedSourceBranch.startsWith('factory/')) throw new Error('EXPECTED_SOURCE_BRANCH_INVALID');

const projectSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/i.test(projectSha)) throw new Error('PROJECT_SHA_INVALID');

const projectRaw = await fs.readFile(`${projectPath}/project.json`, 'utf8');
const projectMeta = JSON.parse(projectRaw);
const projectName = String(projectMeta?.project?.name || '').trim();
const projectSlug = String(projectMeta?.project?.slug || '').trim();
if (!projectName || !projectSlug) throw new Error('PROJECT_METADATA_INVALID');
if (projectPath !== `projects/${projectSlug}`) throw new Error('PROJECT_PATH_SLUG_MISMATCH');

const prMatch = String(prUrl || '').match(/\/pull\/(\d+)(?:$|[/?#])/);
const pullRequest = prMatch ? Number(prMatch[1]) : null;
if (!pullRequest || !/^https:\/\/github\.com\//i.test(String(prUrl || ''))) throw new Error('PULL_REQUEST_REQUIRED_FOR_PROMOTION');

let visualQaReport;
try {
  visualQaReport = JSON.parse(await fs.readFile('visual-qa/report.json', 'utf8'));
} catch (error) {
  throw new Error(`RELEASE_READINESS_QA_EVIDENCE_MISSING:${String(error?.message || error).slice(0, 180)}`);
}
const qaResults = Array.isArray(visualQaReport?.results) ? visualQaReport.results : [];
const qaViewports = qaResults.map((item) => item?.viewport?.name).filter(Boolean);
const qaFailures = qaResults.flatMap((item) => Array.isArray(item?.failures) ? item.failures : []);
const qaReady = visualQaReport?.ok === true && qaFailures.length === 0 && qaViewports.includes('desktop') && qaViewports.includes('mobile');
if (!qaReady) throw new Error(`RELEASE_READINESS_VISUAL_QA_FAILED:${JSON.stringify({ ok: visualQaReport?.ok, viewports: qaViewports, failures: qaFailures }).slice(0, 500)}`);

const releaseReadiness = {
  version: 1,
  gate: 'factory-v3-release-readiness',
  preview_ready: true,
  production_ready: false,
  production_deploy: false,
  production_approved: false,
  status: 'PREVIEW_READY_AWAITING_PRODUCTION_APPROVAL',
  blockers: ['manual_production_approval_required'],
  evidence: {
    project_sha: projectSha,
    project_path_valid: true,
    branch_isolated: true,
    pull_request_present: true,
    preview_https: true,
    visual_qa: {
      ok: true,
      report_version: visualQaReport.version ?? null,
      generated_at: visualQaReport.generated_at ?? null,
      viewports: qaViewports
    }
  },
  feedback: {
    current_stage: 'preview_review',
    next_action: 'review_preview_and_request_manual_approval',
    safe_to_continue_editing: true
  }
};

const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'content-type': 'application/json'
};

async function readJson(path, required = true) {
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=${encodeURIComponent(controlRef)}`, { headers });
  if (response.status === 404 && !required) return { sha: null, value: null };
  if (!response.ok) throw new Error(`STATE_READ_FAILED_${response.status}:${path}:${(await response.text()).slice(0, 300)}`);
  const body = await response.json();
  if (!body?.sha || !body?.content) throw new Error(`STATE_CONTENT_INVALID:${path}`);
  return { sha: body.sha, value: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) };
}

async function writeJson(path, value, sha, message) {
  const payload = {
    message,
    content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64'),
    branch: controlRef
  };
  if (sha) payload.sha = sha;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/${path}`, {
    method: 'PUT', headers, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`STATE_WRITE_FAILED_${response.status}:${path}:${(await response.text()).slice(0, 500)}`);
}

async function assertBranchContains(baseBranch, headBranch) {
  const compareUrl = `https://api.github.com/repos/${repository}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(headBranch)}`;
  const response = await fetch(compareUrl, { headers });
  if (!response.ok) throw new Error(`PROJECT_LINEAGE_COMPARE_FAILED_${response.status}:${(await response.text()).slice(0, 300)}`);
  const comparison = await response.json();
  if (Number(comparison.behind_by || 0) !== 0 || !['ahead', 'identical'].includes(comparison.status)) {
    throw new Error(`PROJECT_LINEAGE_STALE:${projectSlug}:base=${baseBranch}:candidate=${headBranch}:status=${comparison.status}:behind=${comparison.behind_by}`);
  }
  return comparison;
}

const now = new Date().toISOString();
releaseReadiness.generated_at = now;
const currentRegistry = await readJson(registryPath, false);
const registry = currentRegistry.value && typeof currentRegistry.value === 'object' ? currentRegistry.value : { version: 1, projects: {} };
if (!registry.projects || typeof registry.projects !== 'object' || Array.isArray(registry.projects)) registry.projects = {};
registry.version = 1;

const priorProject = registry.projects[projectSlug] || null;
const isEditBranch = branch.startsWith(`factory/${projectSlug}-edit-`);
const lineageSourceBranch = expectedSourceBranch || (isEditBranch ? String(priorProject?.branch || '') : '');
if (isEditBranch && !lineageSourceBranch) throw new Error(`PROJECT_LINEAGE_MISSING:${projectSlug}`);
if (lineageSourceBranch) await assertBranchContains(lineageSourceBranch, branch);

const priorRevision = Number.isInteger(priorProject?.edit_revision) ? priorProject.edit_revision : 0;
const editRevision = lineageSourceBranch ? priorRevision + 1 : priorRevision;
const state = {
  version: 1, active: true, project_name: projectName, project_slug: projectSlug,
  source_path: projectPath, branch, previous_branch: lineageSourceBranch || priorProject?.branch || null,
  edit_revision: editRevision, pull_request: pullRequest, preview_url: previewUrl,
  production_deploy: false, release_readiness: releaseReadiness, mode: 'editing', updated_at: now
};

registry.projects[projectSlug] = {
  project_name: projectName, project_slug: projectSlug, source_path: projectPath, branch,
  previous_branch: state.previous_branch, edit_revision: editRevision, pull_request: pullRequest,
  preview_url: previewUrl, production_deploy: false, release_readiness: releaseReadiness,
  mode: 'editing', updated_at: now
};
registry.updated_at = now;

await writeJson(registryPath, registry, currentRegistry.sha, `Register Factory project ${projectSlug}`);
const currentState = await readJson(statePath, true);
await writeJson(statePath, state, currentState.sha, `Activate Factory project ${projectSlug}`);

console.log(JSON.stringify({ ok: true, active_state_path: statePath, project_registry_path: registryPath, ...state }, null, 2));
