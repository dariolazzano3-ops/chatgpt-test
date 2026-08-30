import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../projects/bakery-muller-staging/', import.meta.url);
const paths = {
  home: 'index.html',
  services: 'services/index.html',
  about: 'about/index.html',
  contact: 'contact/index.html',
  faq: 'faq/index.html',
  legal: 'legal-notice/index.html',
  privacy: 'privacy/index.html',
  css: 'assets/styles.css',
  js: 'assets/site.js',
  project: 'project.json',
  blueprint: 'website-blueprint.json',
  delivery: 'delivery-manifest.json',
  deployment: 'deployment-artifact.json',
  robots: 'robots.txt',
  headers: '_headers',
  sitemap: 'sitemap.xml'
};

const entries = await Promise.all(Object.entries(paths).map(async ([key, relative]) => [key, await readFile(new URL(relative, root), 'utf8')]));
const data = Object.fromEntries(entries);
const manifest = JSON.parse(data.project);
const blueprint = JSON.parse(data.blueprint);
const delivery = JSON.parse(data.delivery);
const deployment = JSON.parse(data.deployment);

assert.equal(manifest.schema, 'riosystems.web-staging-project.v1');
assert.equal(manifest.project.slug, 'bakery-muller-staging');
assert.equal(manifest.generated_by, 'riosystems-native-web');
assert.equal(manifest.environment, 'staging');
assert.equal(manifest.synthetic_test_data_only, true);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.external_integrations, false);
assert.equal(manifest.forms_enabled, false);
assert.equal(manifest.payments_enabled, false);
assert.equal(manifest.robots, 'noindex,nofollow');
assert.equal(manifest.hosting_target, 'cloudflare-pages-preview');
assert.equal(manifest.expected_pages_project, 'chatgpt-factory-preview');
assert.equal(manifest.deployment_authorized, false);
assert.equal(manifest.custom_domain, false);
assert.equal(manifest.dns_change, false);
assert.equal(manifest.automatic_paid_overflow, false);
assert.equal(manifest.production_deploy, false);

assert.equal(blueprint.schema, 'riosystems.website-blueprint.v1');
for (const page of ['home', 'services', 'about', 'contact', 'faq']) {
  assert.ok(blueprint.pages.some((item) => item.id === page), `Missing blueprint page: ${page}`);
}
assert.ok(blueprint.pages.length >= 7);

for (const page of ['home', 'services', 'about', 'contact', 'faq', 'legal', 'privacy']) {
  assert.match(data[page], /<meta name="robots" content="noindex,nofollow">/);
  assert.match(data[page], /<meta name="viewport"/);
  assert.match(data[page], /<main\b/);
  assert.match(data[page], /<footer\b/);
  assert.doesNotMatch(data[page], /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/);
}
assert.match(data.home, />Leistungen<\/a>/);
assert.match(data.home, />Über uns<\/a>/);
assert.match(data.about, /href="\.\/" aria-current="page"/);
assert.match(data.contact, /data-static-form="true"/);
assert.match(data.contact, /disabled aria-disabled="true"/);
assert.ok(data.css.length > 1000);
assert.match(data.css, /@media\(max-width:/);
assert.match(data.js, /nav-toggle/);
assert.match(data.robots, /Disallow: \/\s*$/m);
assert.match(data.headers, /X-Robots-Tag: noindex, nofollow/);
assert.match(data.headers, /Content-Security-Policy:/);
assert.match(data.sitemap, /<urlset/);

assert.equal(delivery.schema, 'riosystems.web-delivery-manifest.v1');
assert.equal(delivery.qa_result.status, 'PASS');
assert.equal(delivery.production_status, 'DISABLED');
assert.equal(delivery.preview_url, null);
assert.equal(deployment.schema, 'riosystems.web-deployment-artifact.v1');
assert.equal(deployment.status, 'READY_FOR_STAGING');
assert.equal(deployment.environment, 'staging');
assert.equal(deployment.variable_cost_eur, 0);
assert.equal(deployment.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  project_slug: manifest.project.slug,
  pages: blueprint.pages.length,
  qa_status: delivery.qa_result.status,
  qa_score: delivery.qa_result.score,
  deployment_status: deployment.status,
  variable_cost_eur: deployment.variable_cost_eur,
  production_deploy: false
}));
