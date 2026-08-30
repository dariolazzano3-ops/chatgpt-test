import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWebsiteProject,
  componentRegistryManifest,
  executeWebFactoryTask,
  runAutomaticRepairLoop,
  runWebsiteQa,
  validateWebsiteMission,
  webFactoryProviderManifest,
  writeWebsiteArtifact
} from '../src/web-factory/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const fixture = async (name) => JSON.parse(await readFile(path.join(repo, 'fixtures', 'web-factory', name), 'utf8'));
const bakery = await fixture('bakery-muller.json');
const cyber = await fixture('northstar-cyber.json');

const invalid = validateWebsiteMission({ business_name: 'Incomplete' });
assert.equal(invalid.ok, false);
assert.ok(invalid.requirements.some((item) => item.field === 'industry'));
assert.ok(invalid.requirements.some((item) => item.field === 'services'));

const bakeryBuild = buildWebsiteProject(bakery, { now: '2026-08-30T00:00:00.000Z' });
const cyberBuild = buildWebsiteProject(cyber, { now: '2026-08-30T00:00:00.000Z' });
for (const build of [bakeryBuild, cyberBuild]) {
  assert.equal(build.ok, true, JSON.stringify(build.qa_result.blocking_issues));
  assert.equal(build.status, 'VERIFIED_WEBSITE_DELIVERABLE');
  assert.equal(build.qa_result.status, 'PASS');
  assert.ok(build.qa_result.score >= 90);
  assert.ok(build.blueprint.pages.length >= 7);
  assert.ok(Object.keys(build.artifact.files).filter((file) => file.endsWith('.html')).length >= 5);
  assert.equal(build.artifact.environment, 'staging');
  assert.equal(build.artifact.real_customer_data, false);
  assert.equal(build.artifact.production_deploy, false);
  assert.equal(build.artifact.variable_cost_eur, 0);
  assert.equal(build.deployment.target, 'cloudflare-pages-preview');
  assert.equal(build.deployment.deployment_authorized, false);
  assert.equal(build.delivery_manifest.production_status, 'DISABLED');
  assert.ok(build.artifact.files[`${build.artifact.project_root}/robots.txt`].includes('Disallow: /'));
  assert.ok(build.artifact.files[`${build.artifact.project_root}/_headers`].includes('X-Robots-Tag: noindex, nofollow'));
  assert.ok(build.artifact.files[`${build.artifact.project_root}/sitemap.xml`]);
  assert.ok(build.artifact.files[`${build.artifact.project_root}/design-tokens.json`]);
  assert.ok(build.artifact.files[`${build.artifact.project_root}/content.json`]);
  assert.ok(build.artifact.files[`${build.artifact.project_root}/website-blueprint.json`]);
  assert.ok(build.artifact.files[`${build.artifact.project_root}/deployment-artifact.json`]);
  assert.ok(build.artifact.files[`${build.artifact.project_root}/delivery-manifest.json`]);
  assert.ok(build.artifact.files[`${build.artifact.project_root}/build-observability.json`]);
  assert.ok(build.artifact.observability.some((event) => event.event === 'mission_received'));
  assert.ok(build.artifact.observability.some((event) => event.event === 'deployment_readiness'));
  for (const file of Object.keys(build.artifact.files)) assert.ok(file.startsWith(`${build.artifact.project_root}/`));
}

assert.notEqual(bakeryBuild.artifact.project.slug, cyberBuild.artifact.project.slug);
assert.notDeepEqual(bakeryBuild.design_system.tokens.colors, cyberBuild.design_system.tokens.colors);
assert.notEqual(bakeryBuild.blueprint.strategy.target_audience, cyberBuild.blueprint.strategy.target_audience);

const bakeryProject = JSON.parse(bakeryBuild.artifact.files['projects/bakery-muller-staging/project.json']);
assert.equal(bakeryProject.schema, 'riosystems.web-staging-project.v1');
assert.equal(bakeryProject.project.slug, 'bakery-muller-staging');
assert.equal(bakeryProject.environment, 'staging');
assert.equal(bakeryProject.synthetic_test_data_only, true);
assert.equal(bakeryProject.real_customer_data, false);
assert.equal(bakeryProject.external_integrations, false);
assert.equal(bakeryProject.forms_enabled, false);
assert.equal(bakeryProject.payments_enabled, false);
assert.equal(bakeryProject.robots, 'noindex,nofollow');
assert.equal(bakeryProject.hosting_target, 'cloudflare-pages-preview');
assert.equal(bakeryProject.expected_pages_project, 'chatgpt-factory-preview');
assert.equal(bakeryProject.deployment_authorized, false);
assert.equal(bakeryProject.custom_domain, false);
assert.equal(bakeryProject.dns_change, false);
assert.equal(bakeryProject.automatic_paid_overflow, false);
assert.equal(bakeryProject.production_deploy, false);

const intentionallyBroken = structuredClone(bakeryBuild.artifact);
const home = 'projects/bakery-muller-staging/index.html';
intentionallyBroken.files[home] = intentionallyBroken.files[home]
  .replace(/\n\s*<meta name="viewport"[^>]*>/, '')
  .replace(/\n\s*<meta name="robots"[^>]*>/, '');
const brokenQa = runWebsiteQa(intentionallyBroken);
assert.equal(brokenQa.status, 'FAIL');
assert.ok(brokenQa.blocking_issues.some((item) => item.code === 'VIEWPORT_MISSING'));
assert.ok(brokenQa.blocking_issues.some((item) => item.code === 'STAGING_NOINDEX_MISSING'));
const repaired = runAutomaticRepairLoop(intentionallyBroken, { max_attempts: 3 });
assert.equal(repaired.qa_result.status, 'PASS');
assert.ok(repaired.repair_history.length >= 1);
assert.equal(repaired.fail_closed, false);

const secretArtifact = structuredClone(cyberBuild.artifact);
secretArtifact.files[`${secretArtifact.project_root}/index.html`] += '\n<!-- api_key="sk-123456789012345678901234567890" -->';
const secretQa = runWebsiteQa(secretArtifact);
assert.equal(secretQa.status, 'FAIL');
assert.ok(secretQa.blocking_issues.some((item) => item.code.includes('SECRET_PATTERN')));

const provider = webFactoryProviderManifest();
assert.equal(provider.deterministic_zero_cost_mode, true);
assert.equal(provider.ai_provider_required, false);
assert.equal(provider.production_deploy, false);
const adapterBuild = executeWebFactoryTask({ capability: 'web.build', website_mission: bakery }, { now: '2026-08-30T00:00:00.000Z' });
assert.equal(adapterBuild.ok, true);

const registry = componentRegistryManifest();
for (const component of ['Header', 'Navigation', 'Hero', 'FeatureGrid', 'Services', 'About', 'Stats', 'Testimonials', 'Gallery', 'FAQ', 'CTA', 'Contact', 'Footer']) {
  assert.ok(registry.components.includes(component));
}

const coreFiles = ['contracts.js', 'planner.js', 'design-system.js', 'content.js', 'components.js', 'qa.js', 'repair.js', 'factory.js', 'adapter.js'];
for (const file of coreFiles) {
  const source = await readFile(path.join(repo, 'src', 'web-factory', file), 'utf8');
  assert.doesNotMatch(source, /Bäckerei Müller|bakery-muller|Northstar Cyber/i, `${file} contains fixture-specific logic`);
}

const temp = await mkdtemp(path.join(os.tmpdir(), 'riosystems-web-factory-'));
try {
  const writeResult = await writeWebsiteArtifact(bakeryBuild, temp);
  assert.equal(writeResult.ok, true);
  const diskManifest = JSON.parse(await readFile(path.join(temp, 'projects', 'bakery-muller-staging', 'delivery-manifest.json'), 'utf8'));
  assert.equal(diskManifest.build_id, bakeryBuild.artifact.build_id);
  assert.equal(diskManifest.production_status, 'DISABLED');
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  suite: 'web-factory-v1',
  missions_tested: [bakery.business_name, cyber.business_name],
  bakery_pages: bakeryBuild.blueprint.pages.length,
  cyber_pages: cyberBuild.blueprint.pages.length,
  repair_attempts_verified: repaired.repair_history.length,
  qa_categories: Object.keys(bakeryBuild.qa_result.categories),
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
