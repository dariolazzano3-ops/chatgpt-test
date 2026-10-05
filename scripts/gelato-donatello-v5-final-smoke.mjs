#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const PROJECT_DIR = path.join(ROOT, 'projects/gelato-donatello-v5-final');

const ROUTES = [
  { dir: '', file: 'index.html', page: 'home' },
  { dir: 'sortiment', file: 'index.html', page: 'sortiment' },
  { dir: 'eisbecher', file: 'index.html', page: 'eisbecher' },
  { dir: 'eistorten-eisbomben', file: 'index.html', page: 'eistorten-eisbomben' },
  { dir: 'eisvitrine', file: 'index.html', page: 'eisvitrine' },
  { dir: 'kontakt', file: 'index.html', page: 'kontakt' }
];

async function readProjectFile(relPath) {
  return readFile(path.join(PROJECT_DIR, relPath), 'utf8');
}

// --- project.json / safety -------------------------------------------------

const project = JSON.parse(await readProjectFile('project.json'));
assert.equal(project.project_id, 'gelato-donatello-v5-final');
assert.equal(project.expected_page_set.length, 6, 'expected exactly 6 routes in project.json');
assert.equal(project.safety.production_deploy, false);
assert.equal(project.safety.public_deploy, false);
assert.equal(project.safety.dns_changes, false);
assert.equal(project.safety.billing, false);
assert.equal(project.safety.public_preview_deploy, false);
assert.equal(project.safety.indexing, 'NOINDEX');
assert.equal(project.preview_policy.external_publish, false);

// --- routes ------------------------------------------------------------------

for (const route of ROUTES) {
  const relPath = route.dir ? path.join(route.dir, route.file) : route.file;
  const html = await readProjectFile(relPath);
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive"\s*\/?>/, `${relPath}: missing noindex meta`);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/css\/style\.css"\s*\/?>/, `${relPath}: missing stylesheet link`);
  assert.match(html, /<script type="module" src="\/assets\/js\/app\.js"><\/script>/, `${relPath}: missing app.js entrypoint`);
  const h1Matches = html.match(/<h1[\s>]/g) || [];
  assert.equal(h1Matches.length, 1, `${relPath}: expected exactly one <h1>, found ${h1Matches.length}`);
  assert.match(html, new RegExp(`data-page="${route.page}"`), `${relPath}: missing data-page="${route.page}"`);
  assert.doesNotMatch(html, /style="/, `${relPath}: inline style attribute found (CSP violation)`);
}

const notFound = await readProjectFile('404.html');
assert.match(notFound, /<meta name="robots" content="noindex,nofollow,noarchive"\s*\/?>/, '404.html: missing noindex meta');

// --- flavors -----------------------------------------------------------------

const flavorsModule = await import(pathToFileURL(path.join(PROJECT_DIR, 'assets/js/data/flavors.js')).href);
const { FLAVORS, FLAVOR_COUNT_CONFIRMED } = flavorsModule;
assert.equal(FLAVOR_COUNT_CONFIRMED, 41);
assert.equal(FLAVORS.length, 41, `expected 41 flavors, found ${FLAVORS.length}`);
const regularFlavors = FLAVORS.filter((f) => f.category === 'regular');
const specialFlavors = FLAVORS.filter((f) => f.category === 'special');
assert.equal(regularFlavors.length, 30, `expected 30 regular flavors, found ${regularFlavors.length}`);
assert.equal(specialFlavors.length, 11, `expected 11 special flavors, found ${specialFlavors.length}`);
assert.ok(FLAVORS.every((f) => f.status === 'confirmed'), 'all flavors must be status: confirmed');
const slugs = FLAVORS.map((f) => f.slug);
assert.equal(new Set(slugs).size, slugs.length, 'flavor slugs must be unique (no duplicates)');
for (const label of ['Pistazie', 'Stracciatella', 'Dubai Eis', 'Dragon Summer', 'Strawberry Matcha']) {
  assert.ok(FLAVORS.some((f) => f.label === label), `expected flavor "${label}" to be present`);
}

// --- pricing -----------------------------------------------------------------

const pricingModule = await import(pathToFileURL(path.join(PROJECT_DIR, 'assets/js/data/pricing.js')).href);
const { KERNPREISE, EISTORTEN, EISBOMBEN, EISVITRINE } = pricingModule;

const expectedKernpreise = { kugel: 1.60, sahne: 1.20, sosse: 1, creme: 1.50, likoer: 1.50, streusel: 1 };
for (const [key, priceEur] of Object.entries(expectedKernpreise)) {
  const entry = KERNPREISE.find((p) => p.key === key);
  assert.ok(entry, `missing Kernpreis "${key}"`);
  assert.equal(entry.priceEur, priceEur, `Kernpreis "${key}" expected ${priceEur}, found ${entry.priceEur}`);
}

assert.deepEqual(EISTORTEN.sizes.map((s) => [s.sizeCm, s.priceEur]), [[18, 65], [20, 75], [24, 95], [26, 109]]);
assert.equal(EISTORTEN.includedFlavors, 2);
assert.equal(EISTORTEN.premiumSurchargeEur, 5);

assert.deepEqual(EISBOMBEN.sizes.map((s) => [s.kugeln, s.priceEur]), [[40, 75], [60, 109]]);
assert.equal(EISBOMBEN.maxFlavors, 6);
assert.equal(EISBOMBEN.premiumSurchargeEur, 5);

assert.equal(EISVITRINE.mieteEur, 250);
assert.equal(EISVITRINE.kautionEur, 100);
assert.equal(EISVITRINE.eisLiter, 5);
assert.equal(EISVITRINE.sorten, 4);
assert.equal(EISVITRINE.zubehoerInklusive, true);

// --- prices actually rendered in HTML ----------------------------------------

const eisbecherHtml = await readProjectFile('eisbecher/index.html');
for (const display of ['1,60 €', '1,20 €', '1,50 €']) {
  assert.ok(eisbecherHtml.includes(display), `eisbecher/index.html: missing price "${display}"`);
}

const eistortenHtml = await readProjectFile(path.join('eistorten-eisbomben', 'index.html'));
for (const display of ['65 €', '75 €', '95 €', '109 €', '+5 €']) {
  assert.ok(eistortenHtml.includes(display), `eistorten-eisbomben/index.html: missing price "${display}"`);
}

const eisvitrineHtml = await readProjectFile(path.join('eisvitrine', 'index.html'));
for (const display of ['250 €', '100 €']) {
  assert.ok(eisvitrineHtml.includes(display), `eisvitrine/index.html: missing price "${display}"`);
}

// --- business facts ------------------------------------------------------------

const businessModule = await import(pathToFileURL(path.join(PROJECT_DIR, 'assets/js/data/business.js')).href);
const { BUSINESS } = businessModule;
assert.equal(BUSINESS.foundingYear, 1965);
assert.equal(BUSINESS.locationSince, 2016);
assert.equal(BUSINESS.address.street, 'Hauptstrasse 4');
assert.equal(BUSINESS.address.postalCode, '66346');
assert.equal(BUSINESS.phone, '06806 9394980');
assert.equal(BUSINESS.openingHours, null, 'opening hours must stay null (not confirmed by owner)');

// --- asset manifest ------------------------------------------------------------

const manifest = JSON.parse(await readProjectFile('assets/manifest.json'));
assert.equal(manifest.flavor_assets.slots.length, 41, 'manifest must have 41 flavor slots');
assert.ok(manifest.assets.every((a) => a.rights === 'pending'), 'no manifest asset may claim non-pending rights until owner photos are ingested');
assert.ok(manifest.flavor_assets.slots.every((s) => typeof s.slug === 'string' && s.slug.length > 0));

// --- headers / robots ----------------------------------------------------------

const headers = await readProjectFile('_headers');
assert.match(headers, /X-Robots-Tag:\s*noindex/i);
assert.match(headers, /Content-Security-Policy:/);
assert.doesNotMatch(headers, /unsafe-inline/);

const robots = await readProjectFile('robots.txt');
assert.match(robots, /Disallow:\s*\//);

// --- CSS breakpoints / motion ---------------------------------------------------

const styleCss = await readProjectFile('assets/css/style.css');
assert.match(styleCss, /@media \(min-width: 1440px\)/, 'style.css missing 1440px breakpoint');
assert.match(styleCss, /@media \(prefers-reduced-motion: reduce\)/, 'style.css missing prefers-reduced-motion block');
assert.doesNotMatch(styleCss, /\.style\./, 'style.css should not reference inline element.style assignments');

const appJs = await readProjectFile('assets/js/app.js');
assert.doesNotMatch(appJs, /\.style\.\w+\s*=/, 'app.js must not set element.style.* (CSP: no inline styles)');

// --- release isolation ---------------------------------------------------------

// Local quarantine candidates are intentionally outside this clean release checkout.
// The release must therefore be self-contained and must not depend on their presence.

console.log('OK: gelato-donatello-v5-final smoke test passed (6 routes, 41 flavors, confirmed pricing, safety, manifest, CSS breakpoints).');
