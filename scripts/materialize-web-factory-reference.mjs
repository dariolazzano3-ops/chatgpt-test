import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWebsiteProject, writeWebsiteArtifact } from '../src/web-factory/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const fixturePath = path.join(repo, 'fixtures', 'web-factory', 'bakery-muller.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const buildTime = process.env.RIOSYSTEMS_REFERENCE_BUILD_TIME || new Date().toISOString();
const build = buildWebsiteProject(fixture, { now: buildTime });

if (!build.ok || build.qa_result.status !== 'PASS') {
  console.error(JSON.stringify({ status: build.status, qa_result: build.qa_result }, null, 2));
  process.exit(1);
}

const projectDirectory = path.join(repo, build.artifact.project_root);
await rm(projectDirectory, { recursive: true, force: true });
await writeWebsiteArtifact(build, repo);

console.log(JSON.stringify({
  ok: true,
  status: build.status,
  build_id: build.artifact.build_id,
  project_root: build.artifact.project_root,
  pages: build.blueprint.pages.length,
  qa_status: build.qa_result.status,
  qa_score: build.qa_result.score,
  deployment_status: build.deployment.status,
  variable_cost_eur: build.variable_cost_eur,
  production_deploy: build.production_deploy
}));
