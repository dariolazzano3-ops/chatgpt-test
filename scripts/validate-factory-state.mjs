import fs from 'node:fs';

const activePath = 'factory-state/active-project.json';
const registryPath = 'factory-state/projects.json';

function fail(message) {
  console.error(`Factory state invalid: ${message}`);
  process.exit(1);
}

function readJson(path) {
  if (!fs.existsSync(path)) fail(`missing ${path}`);
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
}

function validateProjectState(state, label) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) fail(`${label} must be an object`);
  for (const key of ['project_name', 'project_slug', 'source_path', 'branch', 'preview_url', 'mode', 'updated_at']) {
    if (typeof state[key] !== 'string' || !state[key].trim()) fail(`${label}.${key} must be a non-empty string`);
  }
  if (!/^[-a-z0-9]+$/.test(state.project_slug)) fail(`${label}.project_slug invalid`);
  if (state.source_path !== `projects/${state.project_slug}`) fail(`${label}.source_path mismatch`);
  if (!state.branch.startsWith('factory/')) fail(`${label}.branch must use factory/*`);
  if (!Number.isInteger(state.pull_request) || state.pull_request < 1) fail(`${label}.pull_request invalid`);
  let preview;
  try { preview = new URL(state.preview_url); } catch { fail(`${label}.preview_url invalid`); }
  if (preview.protocol !== 'https:') fail(`${label}.preview_url must use HTTPS`);
  if (state.mode !== 'editing') fail(`${label}.mode must be editing`);
  if (state.production_deploy !== false) fail(`${label}.production_deploy must remain false`);
  if (Number.isNaN(Date.parse(state.updated_at))) fail(`${label}.updated_at invalid`);
  if (state.previous_branch != null && (typeof state.previous_branch !== 'string' || !state.previous_branch.startsWith('factory/'))) fail(`${label}.previous_branch invalid`);
  if (state.edit_revision != null && (!Number.isInteger(state.edit_revision) || state.edit_revision < 0)) fail(`${label}.edit_revision invalid`);
}

const active = readJson(activePath);
const registry = readJson(registryPath);

if (active.version !== 1 || active.active !== true) fail('active project must be enabled at version 1');
if (registry.version !== 1) fail('registry version must be 1');
if (!registry.projects || typeof registry.projects !== 'object' || Array.isArray(registry.projects)) fail('registry.projects must be an object');
if (Number.isNaN(Date.parse(registry.updated_at))) fail('registry.updated_at invalid');

validateProjectState(active, 'active');

const slugs = Object.keys(registry.projects);
if (slugs.length === 0) fail('registry must contain at least one project');
for (const slug of slugs) {
  const project = registry.projects[slug];
  validateProjectState(project, `registry.${slug}`);
  if (project.project_slug !== slug) fail(`registry key ${slug} does not match project_slug ${project.project_slug}`);
}

const registeredActive = registry.projects[active.project_slug];
if (!registeredActive) fail(`active project ${active.project_slug} missing from registry`);

const canonicalFields = [
  'project_name', 'project_slug', 'source_path', 'branch', 'pull_request',
  'preview_url', 'production_deploy', 'mode', 'updated_at', 'previous_branch', 'edit_revision'
];
for (const field of canonicalFields) {
  const activeValue = active[field] ?? null;
  const registryValue = registeredActive[field] ?? null;
  if (activeValue !== registryValue) fail(`active/registry drift at ${field}: active=${JSON.stringify(activeValue)} registry=${JSON.stringify(registryValue)}`);
}

const latestProjectUpdate = Math.max(...slugs.map((slug) => Date.parse(registry.projects[slug].updated_at)));
if (Date.parse(registry.updated_at) < latestProjectUpdate) fail('registry.updated_at is older than a project entry');

console.log(`Factory state consistent: ${active.project_slug}`);
console.log(`Registry projects: ${slugs.length}`);
console.log(`Active branch: ${active.branch}`);
