#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
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

for (const flavor of FLAVORS) {
  const rel = flavorsModule.flavorImagePath(flavor.slug).replace(/^\//, '');
  assert.match(rel, /^assets\/images\/flavors\/[a-z0-9-]+\.webp$/, `unexpected flavor image path: ${rel}`);
  await access(path.join(PROJECT_DIR, rel));
}

// --- pricing -----------------------------------------------------------------

const pricingModule = await import(pathToFileURL(path.join(PROJECT_DIR, 'assets/js/data/pricing.js')).href);
const { KERNPREISE, EISBECHER_KATEGORIEN, EISBECHER_ENTRY_COUNT, EXTRAS_KATEGORIEN, EXTRAS_ENTRY_COUNT, EISTORTEN, EISBOMBEN, EISVITRINE } = pricingModule;

const expectedKernpreise = { kugel: 1.60, sahne: 1.20, sosse: 1, creme: 1.50, likoer: 1.50, streusel: 1 };
for (const [key, priceEur] of Object.entries(expectedKernpreise)) {
  const entry = KERNPREISE.find((p) => p.key === key);
  assert.ok(entry, `missing Kernpreis "${key}"`);
  assert.equal(entry.priceEur, priceEur, `Kernpreis "${key}" expected ${priceEur}, found ${entry.priceEur}`);
}


const expectedCupMenu = [
  ['kleine-gaeste', [
    ['Smarties',4.90],['Pinocchio',4.90],['Mickey Mouse',4.90],['Spaghetti',4.90],['Gummibären',4.90],['Biene Maja',4.90]
  ]],
  ['frisch-fruchtig', [
    ['Kiwi',7.50],['Erdbeer',7.50],['Früchte',8.50],['Coppa Italia',8.50],['Mango',7.50],['Ananas',7.50],['Himbeer',8.50],['Waldbeer',8.50]
  ]],
  ['nussig-schokoladig', [
    ['Schoko',7.00],['Stracciatella',7.00],['Karamell',7.00],['Cookies',7.00],['Krokant',7.50],['Walnuss',7.50],['Haselnuss',7.50],['Nutella',7.50],['Crumble Becher',7.50],['Giotto',8.00],['Toffifee',8.00],['Pistazien',9.00],['Mozart Becher',9.00]
  ]],
  ['mit-alkohol', [
    ['Eierlikör',7.50],['Malaga',7.50],['Tartufo',8.50],['Amaretto',7.50],['Banana Cup',7.50],['Schwarzwald',7.50]
  ]],
  ['suesse-versuchungen', [
    ['Rocher',8.50],['After Eight',8.00],['Raffaello',8.00],['Tartufo',8.50],['Banana Split',8.00],['Köllerbacher',8.50],['Erdbeer',7.50],['Ananas',7.50],['Früchte',8.50],['Nusstraum',8.50]
  ]],
  ['spaghetti-becher', [
    ['Spaghettieis',7.00],['Spaghettieis XL',10.50],['Tricolore',7.00],['Neri',7.00],['Joghurt',7.00],['Erdbeer',7.50],['Kiwi',7.50],['Italia',8.50],['Bonito',7.50],['Amarena',7.50],['Carbonara',7.50],['Melone',7.50],['Waldbeer',8.50]
  ]],
  ['joghurtbecher', [
    ['Melone',7.50],['Erdbeer',7.50],['Früchte',8.50],['Amarena',7.50],['Ananas',7.50],['Himbeer',8.50],['Waldbeer',8.50],['Mango',7.50],['Kiwi',7.50],['Italia',8.50],['Banane',7.50],['Waldbeer',8.50]
  ]]
];

assert.equal(EISBECHER_KATEGORIEN.length, 7, 'expected 7 cup-menu categories');
assert.equal(EISBECHER_ENTRY_COUNT, 68, 'expected 68 owner-source cup entries');
assert.deepEqual(
  EISBECHER_KATEGORIEN.map((group) => [group.key, group.items.map((item) => [item.label, item.priceEur])]),
  expectedCupMenu,
  'complete cup menu must match the owner source'
);
const joghurt = EISBECHER_KATEGORIEN.find((group) => group.key === 'joghurtbecher');
assert.ok(joghurt?.sourceNote?.includes('zweimal'), 'joghurt source duplicate must be documented');
assert.equal(joghurt.items.filter((item) => item.label === 'Waldbeer').length, 2, 'both Waldbeer source rows must be preserved');
assert.equal(joghurt.items.at(-1).sourceDuplicate, true, 'second Waldbeer must be explicitly flagged as duplicate source data');

const expectedExtras = {
  sossen: ['Schoko','Nutella','Karamell','Mocca','Walnuss','Amaretto','Amarena','Erdbeer','Himbeer','Waldbeer','Melone','Mango','Kiwi'],
  cremes: ['Pistaziencreme','Haselnusscreme'],
  likoere: ['Amaretto','Eierlikör','Nougatlikör','Baileys','Schokolikör','Batida de Coco','Kirschwasser','Kirschlikör','Pfefferminzlikör'],
  toppings: ['dunkle Schokolade','weiße Schokolade','Nuss Streusel','Krokant Streusel','Karamell Crumble','Butter Crumble','Gummibärchen','Smarties','Marshmallows']
};
assert.equal(EXTRAS_KATEGORIEN.length, 4, 'expected 4 extras categories');
assert.equal(EXTRAS_ENTRY_COUNT, 33, 'expected 33 extras');
for (const group of EXTRAS_KATEGORIEN) {
  assert.deepEqual(group.items.map((item) => item.label), expectedExtras[group.key], `extras group ${group.key} labels drifted`);
}
assert.ok(EXTRAS_KATEGORIEN.find((g) => g.key === 'sossen').items.every((x) => x.priceEur === 1));
assert.ok(EXTRAS_KATEGORIEN.find((g) => g.key === 'cremes').items.every((x) => x.priceEur === 1.5));
assert.ok(EXTRAS_KATEGORIEN.find((g) => g.key === 'likoere').items.every((x) => x.priceEur === 1.5));
assert.ok(EXTRAS_KATEGORIEN.find((g) => g.key === 'toppings').items.every((x) => x.priceEur === 1));

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
for (const display of ['1,60 €', '1,20 €', '1,50 €', '1,00 €']) {
  assert.ok(eisbecherHtml.includes(display), `eisbecher/index.html: missing price "${display}"`);
}
assert.match(eisbecherHtml, /data-component="cup-menu"/, 'eisbecher page must mount the full cup menu');
assert.match(eisbecherHtml, /data-component="extras-menu"/, 'eisbecher page must the extras menu');
assert.match(eisbecherHtml, /68 Einträge/, 'eisbecher page must disclose current source entry count');

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

const confirmedInputs = JSON.parse(await readProjectFile('confirmed-project-inputs.json'));
const cupFact = confirmedInputs.facts.find((fact) => fact.field_path === 'products.eisbecher_karte');
const extrasFact = confirmedInputs.facts.find((fact) => fact.field_path === 'products.extras');
assert.equal(cupFact?.verification_status, 'OPERATOR_CONFIRMED');
assert.equal(cupFact?.value?.category_count, 7);
assert.equal(cupFact?.value?.source_entry_count, 68);
assert.match(cupFact?.value?.data_quality_note || '', /zweimal/);
assert.equal(extrasFact?.verification_status, 'OPERATOR_CONFIRMED');
assert.equal(Object.values(extrasFact?.value || {}).reduce((sum, list) => sum + list.length, 0), 33);

const manifest = JSON.parse(await readProjectFile('assets/manifest.json'));
assert.equal(manifest.schema, 'aurentara.asset-manifest.v2');
assert.equal(manifest.production_rights_status, 'PENDING_OWNER_CONFIRMATION');
assert.equal(manifest.flavor_assets.slots.length, 41, 'manifest must have 41 flavor slots');
assert.equal(manifest.flavor_assets.path_template, '/assets/images/flavors/{slug}.webp');
assert.equal(manifest.flavor_assets.rights, 'owner_provided_private_preview');
assert.ok(manifest.flavor_assets.slots.every((s) => typeof s.slug === 'string' && s.slug.length > 0));
assert.equal(manifest.assets.filter((a) => a.rights === 'pending').length, 2, 'only two mobile-rental-vitrine placeholders may remain pending');
assert.ok(manifest.assets.filter((a) => a.rights === 'pending').every((a) => a.category === 'vitrine'));

const provenance = JSON.parse(await readProjectFile('assets/ingest-provenance.json'));
assert.equal(provenance.schema, 'gelato-donatello.asset-ingest.v1');
assert.equal(provenance.counts.total, 78);
assert.equal(provenance.counts.flavors, 41);
assert.equal(provenance.counts.cups, 6);
assert.equal(provenance.counts.shop, 5);
assert.equal(provenance.counts.cakes + provenance.counts.bombs + provenance.counts.spaghetti_cakes, 24);
assert.equal(provenance.records.length, 78);
for (const record of provenance.records) {
  assert.match(record.target_sha256, /^[a-f0-9]{64}$/);
  assert.match(record.source_sha256, /^[a-f0-9]{64}$/);
  await access(path.join(PROJECT_DIR, record.target.replace(/^assets\//, 'assets/')));
}

// --- owner image integration --------------------------------------------------

const homeHtml = await readProjectFile('index.html');
assert.match(homeHtml, /\/assets\/images\/flavors\/pistazie\.webp/);
assert.match(homeHtml, /\/assets\/images\/shop\/vitrine-wide\.webp/);
assert.match(homeHtml, /(?:data-asset-loading="eager"|loading="eager"[^>]*fetchpriority="high")/);

const kontaktHtml = await readProjectFile(path.join('kontakt', 'index.html'));
assert.match(kontaktHtml, /\/assets\/images\/shop\/vitrine-wide\.webp/);
assert.match(kontaktHtml, /\/assets\/images\/shop\/interior-counter\.webp/);

assert.match(eisbecherHtml, /\/assets\/images\/cups\/fruechte-becher\.webp/);
for (const slug of ['after-eight-becher','biene-maja','amarena-becher','erdbeer-becher','banana-split']) {
  assert.match(eisbecherHtml, new RegExp(`/assets/images/cups/${slug}\.webp`));
}

for (const asset of ['eistorte-01','eistorte-02','eisbombe-01','eisbombe-02','spaghetti-eistorte-01','spaghetti-eistorte-02']) {
  assert.match(eistortenHtml, new RegExp(`/assets/images/cakes/${asset}\.webp`));
}

const navJs = await readProjectFile('assets/js/components/nav.js');
assert.match(navJs, /\/assets\/images\/brand\/logo-donatello\.webp/);

assert.match(eisvitrineHtml, /\/assets\/img\/vitrine\/mobil-1\.jpg/);
assert.match(eisvitrineHtml, /\/assets\/img\/vitrine\/mobil-2\.jpg/);

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
assert.match(appJs, /renderCupMenu/, 'app.js must initialize cup menu component');
assert.match(appJs, /renderExtrasMenu/, 'app.js must initialize extras menu component');
const cupMenuJs = await readProjectFile('assets/js/components/cup-menu.js');
assert.match(cupMenuJs, /EISBECHER_KATEGORIEN/, 'cup-menu component must use structured cup data');
assert.match(cupMenuJs, /EXTRAS_KATEGORIEN/, 'cup-menu component must use structured extras data');
assert.doesNotMatch(cupMenuJs, /innerHTML/, 'cup-menu renderer must avoid innerHTML');

// --- release isolation ---------------------------------------------------------

// Local quarantine candidates are intentionally outside this clean release checkout.
// The release must therefore be self-contained and must not depend on their presence.

console.log('OK: gelato-donatello-v5-final smoke test passed (6 routes, 41 flavors + images, 68 cup entries, 33 extras, 78 owner assets, confirmed pricing, safety, manifest, CSS breakpoints).');
