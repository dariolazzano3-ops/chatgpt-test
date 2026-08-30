#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../projects/riosystems-public-website-v1/', import.meta.url);
const [html, css, js, projectRaw] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('project.json', root), 'utf8')
]);
const project = JSON.parse(projectRaw);

for (const token of [
  'WE BUILD', 'THE SYSTEMS', 'BEHIND YOUR', 'BUSINESS.',
  'DAS PROBLEM', 'DIE LÖSUNG', 'WAS WIR BAUEN', 'SO ARBEITEN WIR',
  'DEMOPROJEKT · SYNTHETISCH', 'WARUM RIOSYSTEMS',
  'YOU RUN THE BUSINESS.', 'WE BUILD WHAT MAKES IT RUN.'
]) assert.ok(html.includes(token), `missing homepage contract token: ${token}`);

for (const capability of ['Branding','Websites','Sales & CRM','AI & Automation','Operations','Analytics']) {
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
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'), 'reduced motion missing');
for (const width of ['1199px','899px','767px','360px']) assert.ok(css.includes(width), `responsive breakpoint missing: ${width}`);

assert.equal(project.environment, 'staging');
assert.equal(project.real_customer_data, false);
assert.equal(project.production_deploy, false);
assert.equal(project.deployment_cost_limit_eur, 0);
assert.equal(project.forms_mode, 'local-validation-only');
assert.ok(js.includes('preventDefault()'), 'staging form must prevent network submission');
assert.ok(!js.includes('fetch('), 'public website V1 app must not perform provider/network writes');

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

console.log('RIOSYSTEMS Public Website V1 smoke: PASS');
