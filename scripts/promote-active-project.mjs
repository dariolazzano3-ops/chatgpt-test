import fs from 'node:fs/promises';

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

const projectRaw = await fs.readFile(`${projectPath}/project.json`, 'utf8');
const projectMeta = JSON.parse(projectRaw);
const projectName = String(projectMeta?.project?.name || '').trim();
const projectSlug = String(projectMeta?.project?.slug || '').trim();
if (!projectName || !projectSlug) throw new Error('PROJECT_METADATA_INVALID');
if (projectPath !== `projects/${projectSlug}`) throw new Error('PROJECT_PATH_SLUG_MISMATCH');

const prMatch = String(prUrl || '').match(/\/pull\/(\d+)(?:$|[/?#])/);
const pullRequest = prMatch ? Number(prMatch[1]) : null;

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
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`STATE_WRITE_FAILED_${response.status}:${path}:${(await response.text()).slice(0, 500)}`);
}

const now = new Date().toISOString();
const currentRegistry = await readJson(registryPath, false);
const registry = currentRegistry.value && typeof currentRegistry.value === 'object'
  ? currentRegistry.value
  : { version: 1, projects: {} };
if (!registry.projects || typeof registry.projects !== 'object' || Array.isArray(registry.projects)) registry.projects = {};
registry.version = 1;

const priorProject = registry.projects[projectSlug] || null;
if (expectedSourceBranch) {
  const durableBranch = String(priorProject?.branch || '');
  if (!durableBranch) throw new Error(`PROJECT_LINEAGE_MISSING:${projectSlug}`);
  if (durableBranch !== expectedSourceBranch) {
    throw new Error(`PROJECT_LINEAGE_STALE:${projectSlug}:expected=${expectedSourceBranch}:current=${durableBranch}`);
  }
}

const priorRevision = Number.isInteger(priorProject?.edit_revision) ? priorProject.edit_revision : 0;
const editRevision = expectedSourceBranch ? priorRevision + 1 : priorRevision;
const state = {
  version: 1,
  active: true,
  project_name: projectName,
  project_slug: projectSlug,
  source_path: projectPath,
  branch,
  previous_branch: expectedSourceBranch || priorProject?.branch || null,
  edit_revision: editRevision,
  pull_request: pullRequest,
  preview_url: previewUrl,
  production_deploy: false,
  mode: 'editing',
  updated_at: now
};

registry.projects[projectSlug] = {
  project_name: projectName,
  project_slug: projectSlug,
  source_path: projectPath,
  branch,
  previous_branch: state.previous_branch,
  edit_revision: editRevision,
  pull_request: pullRequest,
  preview_url: previewUrl,
  production_deploy: false,
  mode: 'editing',
  updated_at: now
};
registry.updated_at = now;

// Registry first is safe: a registry entry is non-active metadata. Active state only moves after that succeeds.
await writeJson(registryPath, registry, currentRegistry.sha, `Register Factory project ${projectSlug}`);

const currentState = await readJson(statePath, true);
await writeJson(statePath, state, currentState.sha, `Activate Factory project ${projectSlug}`);

console.log(JSON.stringify({ ok: true, active_state_path: statePath, project_registry_path: registryPath, ...state }, null, 2));
