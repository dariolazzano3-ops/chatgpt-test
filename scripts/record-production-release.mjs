import fs from 'node:fs';

const [stateDir = 'factory-state'] = process.argv.slice(2);
const required = ['PROJECT_SLUG','EDIT_REVISION','PROJECT_SHA','BRANCH','PREVIEW_URL','PRODUCTION_URL','TARGET_PROJECT','ACTOR'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`MISSING_ENV:${key}`);
}

const projectSlug = process.env.PROJECT_SLUG;
const editRevision = Number(process.env.EDIT_REVISION);
const projectSha = process.env.PROJECT_SHA;
const branch = process.env.BRANCH;
const previewUrl = process.env.PREVIEW_URL;
const productionUrl = process.env.PRODUCTION_URL;
const targetProject = process.env.TARGET_PROJECT;
const actor = process.env.ACTOR;

if (!Number.isInteger(editRevision) || editRevision < 0) throw new Error('EDIT_REVISION_INVALID');
if (!/^[0-9a-f]{40}$/i.test(projectSha)) throw new Error('PROJECT_SHA_INVALID');
if (!branch.startsWith('factory/')) throw new Error('BRANCH_INVALID');
if (!previewUrl.startsWith('https://')) throw new Error('PREVIEW_URL_INVALID');
if (!productionUrl.startsWith('https://')) throw new Error('PRODUCTION_URL_INVALID');

const activePath = `${stateDir}/active-project.json`;
const registryPath = `${stateDir}/projects.json`;
const releasesPath = `${stateDir}/releases.json`;

const active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
let releases = { version: 1, releases: [] };
if (fs.existsSync(releasesPath)) releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
if (!Array.isArray(releases.releases)) releases.releases = [];

if (active?.project_slug !== projectSlug) throw new Error('ACTIVE_PROJECT_SLUG_MISMATCH');
if (active?.edit_revision !== editRevision) throw new Error('ACTIVE_PROJECT_REVISION_MISMATCH');
if (active?.branch !== branch) throw new Error('ACTIVE_PROJECT_BRANCH_MISMATCH');
if (active?.release_readiness?.evidence?.project_sha !== projectSha) throw new Error('ACTIVE_PROJECT_SHA_MISMATCH');
if (registry?.projects?.[projectSlug]?.edit_revision !== editRevision) throw new Error('REGISTRY_PROJECT_REVISION_MISMATCH');

const deployedAt = new Date().toISOString();
const productionRelease = {
  version: 1,
  deployed: true,
  project_slug: projectSlug,
  edit_revision: editRevision,
  project_sha: projectSha,
  branch,
  production_url: productionUrl,
  cloudflare_pages_project: targetProject,
  approved_by: actor,
  deployed_at: deployedAt
};

releases.version = 1;
releases.releases.push({
  project_slug: projectSlug,
  edit_revision: editRevision,
  project_sha: projectSha,
  branch,
  preview_url: previewUrl,
  production_url: productionUrl,
  cloudflare_pages_project: targetProject,
  approved_by: actor,
  production_deploy: true,
  deployed_at: deployedAt
});
releases.updated_at = deployedAt;

active.production_release = productionRelease;
active.updated_at = deployedAt;
registry.projects[projectSlug].production_release = productionRelease;
registry.projects[projectSlug].updated_at = deployedAt;
registry.updated_at = deployedAt;

fs.writeFileSync(releasesPath, `${JSON.stringify(releases, null, 2)}\n`);
fs.writeFileSync(activePath, `${JSON.stringify(active, null, 2)}\n`);
fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

console.log(JSON.stringify({ ok: true, production_release: productionRelease }, null, 2));
