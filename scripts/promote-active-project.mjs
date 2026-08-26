import fs from 'node:fs/promises';

const [projectPath, branch, prUrl, previewUrl] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const statePath = 'factory-state/active-project.json';
const controlRef = 'factory-control';

if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
if (!projectPath || !projectPath.startsWith('projects/')) throw new Error('PROJECT_PATH_INVALID');
if (!branch || !branch.startsWith('factory/')) throw new Error('PROJECT_BRANCH_INVALID');
if (!previewUrl || !previewUrl.startsWith('https://')) throw new Error('PREVIEW_URL_INVALID');

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

const readResponse = await fetch(`https://api.github.com/repos/${repository}/contents/${statePath}?ref=${encodeURIComponent(controlRef)}`, { headers });
if (!readResponse.ok) throw new Error(`ACTIVE_STATE_READ_FAILED_${readResponse.status}:${(await readResponse.text()).slice(0, 300)}`);
const current = await readResponse.json();
if (!current?.sha) throw new Error('ACTIVE_STATE_SHA_MISSING');

const state = {
  version: 1,
  active: true,
  project_name: projectName,
  project_slug: projectSlug,
  source_path: projectPath,
  branch,
  pull_request: pullRequest,
  preview_url: previewUrl,
  production_deploy: false,
  mode: 'editing',
  updated_at: new Date().toISOString()
};

const writeResponse = await fetch(`https://api.github.com/repos/${repository}/contents/${statePath}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    message: `Activate Factory project ${projectSlug}`,
    content: Buffer.from(`${JSON.stringify(state, null, 2)}\n`).toString('base64'),
    sha: current.sha,
    branch: controlRef
  })
});
if (!writeResponse.ok) throw new Error(`ACTIVE_STATE_WRITE_FAILED_${writeResponse.status}:${(await writeResponse.text()).slice(0, 500)}`);

console.log(JSON.stringify({ ok: true, active_state_path: statePath, ...state }, null, 2));
