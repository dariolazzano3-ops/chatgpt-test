import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const args = new Set(process.argv.slice(2));
const deploy = args.has('--deploy');
const production = args.has('--production');
const projectSlug = process.env.RIOSYSTEMS_PAGES_PROJECT_SLUG || 'bakery-muller-staging';

assert.equal(production, false, 'Production deployment is never permitted by the Pages preview guard');
assert.match(projectSlug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid project slug');
assert.equal(projectSlug, 'bakery-muller-staging', 'Only the approved synthetic reference project is permitted');

const manifestUrl = new URL(`../projects/${projectSlug}/project.json`, import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

assert.equal(manifest.schema, 'riosystems.web-staging-project.v1');
assert.equal(manifest.project?.slug, projectSlug);
assert.equal(manifest.environment, 'staging');
assert.equal(manifest.synthetic_test_data_only, true);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.external_integrations, false);
assert.equal(manifest.forms_enabled, false);
assert.equal(manifest.payments_enabled, false);
assert.equal(manifest.robots, 'noindex,nofollow');
assert.equal(manifest.hosting_target, 'cloudflare-pages-preview');
assert.equal(manifest.expected_pages_project, 'chatgpt-factory-preview');
assert.equal(manifest.deployment_authorized, false, 'Repository artifact must not self-authorize deployment');
assert.equal(manifest.custom_domain, false);
assert.equal(manifest.dns_change, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

if (deploy) {
  assert.equal(process.env.RIOSYSTEMS_STAGING_DEPLOY_APPROVED, 'true', 'Staging approval is required');
  assert.equal(process.env.RIOSYSTEMS_ZERO_COST_CONFIRMED, 'true', 'Account-specific zero-cost status is required');
  assert.equal(
    process.env.RIOSYSTEMS_PAGES_STAGING_CONFIRMATION,
    'DEPLOY_BAKERY_MULLER_PAGES_PREVIEW_ZERO_COST',
    'Exact staging confirmation is required'
  );
}

console.log(JSON.stringify({
  ok: true,
  mode: deploy ? 'deploy' : 'validate',
  project_slug: projectSlug,
  pages_project: manifest.expected_pages_project,
  deployment_branch: 'riosystems-staging-bakery-muller',
  synthetic_test_data_only: true,
  production_deploy: false
}));
