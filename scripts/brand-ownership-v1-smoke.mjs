#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { operatorBrandingManifest } from '../src/operator-branding-v1.js';

const [canonical, rootReadme, publicHtml, publicReadme, publicProjectRaw] = await Promise.all([
  readFile(new URL('../docs/BRAND_OWNERSHIP_ARCHITECTURE.md', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../projects/riosystems-public-website-v1/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../projects/riosystems-public-website-v1/README.md', import.meta.url), 'utf8'),
  readFile(new URL('../projects/riosystems-public-website-v1/project.json', import.meta.url), 'utf8')
]);
const publicProject = JSON.parse(publicProjectRaw);
const operatorBrand = operatorBrandingManifest();

for (const token of ['YSRIO GROUP', 'AURENTARA SYSTEMS', 'RIOSYSTEMS', 'SYNTROPIC is not the canonical operative main brand']) {
  assert.ok(canonical.includes(token), `canonical brand contract missing: ${token}`);
}
assert.ok(canonical.includes('must not claim that a legally incorporated multi-company group'), 'legal group boundary missing');
assert.ok(canonical.includes('AURENTARA SYSTEMS → uses → RIOSYSTEMS internal technology'), 'brand-to-technology boundary missing');
assert.ok(canonical.includes('Production changes'), 'production safety boundary missing');
assert.ok(canonical.includes('DNS or domain changes'), 'DNS safety boundary missing');
assert.ok(canonical.includes('variable cost above 0 EUR'), 'zero-cost safety boundary missing');

assert.ok(rootReadme.includes('docs/BRAND_OWNERSHIP_ARCHITECTURE.md'), 'root README must point to canonical brand contract');
assert.ok(rootReadme.includes('AURENTARA SYSTEMS'), 'root README operative brand missing');
assert.ok(rootReadme.includes('YSRIO GROUP'), 'root README parent brand missing');
assert.ok(rootReadme.includes('RIOSYSTEMS'), 'root README internal technology boundary missing');

assert.ok(publicHtml.includes('AURENTARA SYSTEMS'), 'public website operative brand missing');
assert.ok(!publicHtml.includes('SYNTROPIC'), 'SYNTROPIC must not appear on public website');
assert.ok(!publicHtml.includes('RIOSYSTEMS'), 'RIOSYSTEMS must not be presented as the public website brand');
assert.equal(publicProject.project.name, 'AURENTARA SYSTEMS Public Website V1');
assert.equal(publicProject.project.slug, 'riosystems-public-website-v1');
assert.equal(publicProject.schema, 'riosystems.web-staging-project.v1');
assert.equal(publicProject.generated_by, 'riosystems-native-web');
assert.equal(publicProject.custom_domain, false);
assert.equal(publicProject.dns_change, false);
assert.equal(publicProject.production_deploy, false);
assert.equal(publicProject.deployment_cost_limit_eur, 0);

assert.ok(publicReadme.includes('Customer-facing presentation uses **AURENTARA SYSTEMS**'), 'public README naming boundary missing');
assert.ok(publicReadme.includes('`riosystems:analytics`'), 'internal analytics namespace retention missing');
assert.ok(publicReadme.includes('YSRIO GROUP is the strategic parent / ownership brand'), 'public README ownership boundary missing');

assert.equal(operatorBrand.parent_brand, 'YSRIO GROUP');
assert.equal(operatorBrand.operative_brand, 'AURENTARA SYSTEMS');
assert.equal(operatorBrand.internal_technology, 'RIOSYSTEMS');
assert.equal(operatorBrand.scope, 'operator_html_presentation_only');
assert.equal(operatorBrand.api_contracts_renamed, false);
assert.equal(operatorBrand.runtime_namespaces_renamed, false);
assert.equal(operatorBrand.provider_logic_changed, false);
assert.equal(operatorBrand.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'brand-ownership-v1',
  parent: 'YSRIO GROUP',
  operative_brand: 'AURENTARA SYSTEMS',
  internal_technology: 'RIOSYSTEMS',
  legacy_operative_brand: 'SYNTROPIC_SUPERSEDED',
  production_deploy: false,
  dns_change: false,
  variable_cost_eur: 0
}, null, 2));
