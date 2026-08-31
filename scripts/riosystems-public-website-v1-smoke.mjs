#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../projects/riosystems-public-website-v1/', import.meta.url);
const [html, css, visualCss, js, projectRaw] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('visual-v2.css', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('project.json', root), 'utf8')
]);
const project = JSON.parse(projectRaw);

for (const token of [
  'AURENTARA SYSTEMS',
  'WE BUILD', 'THE SYSTEMS', 'BEHIND YOUR', 'BUSINESS.',
  'Web. CRM. AI. Automation. Growth. Analytics. Operations.',
  'DAS PROBLEM', 'DIE LÖSUNG', 'WAS WIR BAUEN', 'SO ARBEITEN WIR',
  'DEMOPROJEKT · SYNTHETISCH', 'WARUM AURENTARA SYSTEMS',
  'YOU RUN THE BUSINESS.', 'WE BUILD WHAT MAKES IT RUN.',
  'A YSRIO Company'
]) assert.ok(html.includes(token), `missing homepage contract token: ${token}`);

assert.ok(!html.includes('Warum RIOSYSTEMS'), 'legacy operative brand remains visible');
assert.ok(!html.includes('>RIOSYSTEMS<'), 'legacy operative brand remains visible in page text');
assert.ok(!html.includes('SYNTROPIC'), 'superseded operative brand remains visible');
assert.ok(html.includes('<span class="core-r">A</span>'), 'public Core visual must use AURENTARA initial');
assert.ok(html.includes('href="./visual-v2.css"'), 'AURENTARA Visual Upgrade V2 overlay is not loaded');

for (const capability of ['Websites','Sales & CRM','AI & Automation','Growth','Operations','Analytics']) {
  assert.ok(html.includes(capability), `missing capability: ${capability}`);
}

for (const step of ['Verstehen','Planen','Bauen','Verbinden','Prüfen','Starten','Verbessern']) {
  assert.ok(html.includes(step), `missing process step: ${step}`);
}

for (const locale of ['de','en','fr','it','es','nl','pl','pt']) {
  assert.ok(html.includes(`value="${locale}"`), `missing locale option: ${locale}`);
}

assert.ok(html.includes('class="skip-link"'), 'skip link missing');
assert.ok(html.includes('aria-live="polite"'), 'form live region missing');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'), 'base reduced motion missing');
assert.ok(visualCss.includes('@media(prefers-reduced-motion:reduce)'), 'visual overlay reduced motion missing');
for (const width of ['1199px','899px','767px','360px']) {
  assert.ok(css.includes(width), `responsive breakpoint missing in base CSS: ${width}`);
  assert.ok(visualCss.includes(width), `responsive breakpoint missing in visual overlay: ${width}`);
}

for (const visualToken of [
  '.core-stage:before',
  '.core-stage:after',
  '.core-lines path:nth-child(2)',
  '.section-problem:after',
  'FRAGMENTED  →  CONNECTED',
  '.connected-map:after'
]) assert.ok(visualCss.includes(visualToken), `missing visual-upgrade contract token: ${visualToken}`);

assert.equal(project.project.name, 'AURENTARA SYSTEMS Public Website V1');
assert.equal(project.project.slug, 'riosystems-public-website-v1');
assert.equal(project.schema, 'riosystems.web-staging-project.v1');
assert.equal(project.generated_by, 'riosystems-native-web');
assert.equal(project.brand.public_brand, 'AURENTARA SYSTEMS');
assert.equal(project.brand.parent_brand, 'YSRIO');
assert.equal(project.brand.endorsement, 'A YSRIO Company');
assert.equal(project.brand.public_domain_reserved, 'aurentarasystems.com');
assert.equal(project.brand.parent_domain_reserved, 'ysrio.com');
assert.equal(project.environment, 'staging');
assert.equal(project.real_customer_data, false);
assert.equal(project.production_deploy, false);
assert.equal(project.custom_domain, false);
assert.equal(project.dns_change, false);
assert.equal(project.domain_activation_authorized, false);
assert.equal(project.deployment_cost_limit_eur, 0);
assert.equal(project.forms_mode, 'local-validation-only');
assert.ok(js.includes('preventDefault()'), 'staging form must prevent network submission');
assert.ok(!js.includes('fetch('), 'public website V1 app must not perform provider/network writes');
assert.ok(js.includes("'riosystems:analytics'"), 'internal RIOSYSTEMS analytics namespace must remain stable');

const prohibitedClaims = [
  '+320', '+180', '1,860H', '1.860H', '1,243', '99.98%', '99,98%',
  'Kunden vertrauen uns', 'garantiert mehr Umsatz'
];
for (const claim of prohibitedClaims) assert.ok(!html.includes(claim), `prohibited/unverified claim found: ${claim}`);

assert.ok(html.includes('<main id="main">'), 'semantic main missing');
assert.ok(html.includes('<nav'), 'semantic nav missing');
assert.ok(html.includes('<footer'), 'semantic footer missing');
assert.ok(html.includes('meta name="description"'), 'SEO description missing');
assert.ok(html.includes('meta property="og:title"'), 'OpenGraph title missing');
assert.ok(html.includes('meta property="og:site_name"'), 'OpenGraph site name missing');

console.log('AURENTARA SYSTEMS Public Website V1 + Visual Upgrade V2 smoke: PASS');
