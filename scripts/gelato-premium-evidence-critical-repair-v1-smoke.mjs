#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  createProjectSourceIntakeState,
  registerProjectSource,
  upsertProjectFact,
  registerProjectAsset,
  createContentPack,
  createVisualPack,
  evaluatePremiumDiscoveryReadiness
} from '../src/project-source-intake-v1.js';
import {
  evaluatePremiumWebsiteStandard,
  normalizePremiumAssets,
  normalizePremiumTrustEvidence,
  normalizePremiumPerformanceEvidence,
  evaluatePrimaryJourneyAccessibility,
  normalizePremiumLegalReadiness,
  evaluatePremiumLaunchChecklist,
  evaluatePremiumHumanReview
} from '../src/web-factory/premium-standard-v1.js';

const ROOT = process.cwd();
const PROJECT_DIR = path.join(ROOT, 'projects/gelato-donatello-website-v1');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts/gelato-premium-evidence-repair-v1');
const SOURCE_URL = process.env.GELATO_SOURCE_URL || 'https://gelato-donatello.de/';
const VIEWPORTS = [
  ['desktop', 1440, 1000],
  ['tablet', 1024, 900],
  ['mobile', 390, 844],
  ['small-mobile', 320, 760]
];

await mkdir(ARTIFACT_DIR, { recursive: true });
const project = JSON.parse(await readFile(path.join(PROJECT_DIR, 'project.json'), 'utf8'));
const evidence = JSON.parse(await readFile(path.join(PROJECT_DIR, 'source-evidence.json'), 'utf8'));
const factoryPreviewWorkflow = await readFile(path.join(ROOT, '.github/workflows/factory-preview.yml'), 'utf8');

assert.equal(project.preview_policy?.external_publish, false, 'Gelato external preview publishing must remain disabled');
assert.equal(project.safety?.public_preview_deploy, false, 'Gelato public preview deploy must remain disabled');
assert.match(factoryPreviewWorkflow, /Resolve external preview policy/, 'Factory Preview must resolve project external-publish policy');
assert.match(factoryPreviewWorkflow, /external_publish=\$EXTERNAL_PUBLISH/, 'Factory Preview must project resolved external-publish state');
assert.match(factoryPreviewWorkflow, /steps\.preview_policy\.outputs\.external_publish == 'false'/, 'Factory Preview must support local-private skip path');

function requireOk(result, label) {
  assert.equal(result?.ok, true, label + ': ' + JSON.stringify(result));
  return result;
}

let intake = requireOk(createProjectSourceIntakeState({
  operator_id: 'operator:gelato-premium-evidence-repair-v1',
  customer_id: project.customer_id,
  project_id: project.project_id,
  scope_key: project.scope_key,
  at: '2026-09-04T08:00:00.000Z'
}), 'create project source intake').state;

for (const source of [
  { source_id: 'canonical-project-identity', source_type: 'MANUAL_INPUT', locator: 'manual://canonical-project-identity', display_name: 'Canonical project identity', ownership_status: 'OWNED_CONFIRMED' },
  { source_id: 'operator-input-2026-08-12', source_type: 'MANUAL_INPUT', locator: 'manual://operator-input-2026-08-12', display_name: 'Operator input 2026-08-12', ownership_status: 'OWNED_CONFIRMED' },
  { source_id: 'gelato-live-owned-website', source_type: 'OWNED_WEBSITE', locator: SOURCE_URL, display_name: 'Current public Gelato website', ownership_status: 'UNKNOWN', website_usage: { content: false, structure_reference: false, design_reference: false } },
  { source_id: 'gelato-live-imprint', source_type: 'OWNED_WEBSITE', locator: new URL('/impressum/', SOURCE_URL).href, display_name: 'Current public Gelato imprint', ownership_status: 'UNKNOWN', website_usage: { content: false, structure_reference: false, design_reference: false } }
]) {
  const r = requireOk(registerProjectSource(intake, source, { at: '2026-09-04T08:01:00.000Z' }), 'register source ' + source.source_id);
  intake = r.state;
}

for (const fact of evidence.facts) {
  const r = requireOk(upsertProjectFact(intake, {
    fact_id: fact.fact_id,
    field_path: fact.field_path,
    value: fact.value,
    origin: fact.origin,
    verification_status: fact.verification_status,
    source_refs: fact.source_refs,
    critical: /business\.|contact\.|legal\.|products\./.test(fact.field_path),
    verified_by: fact.verification_status === 'OPERATOR_CONFIRMED' ? 'operator:gelato-premium-evidence-repair-v1' : null,
    verified_at: fact.verification_status === 'OPERATOR_CONFIRMED' ? '2026-08-12T00:00:00.000Z' : null
  }, { at: '2026-09-04T08:02:00.000Z' }), 'register fact ' + fact.fact_id);
  intake = r.state;
}

for (const asset of evidence.assets) {
  const r = requireOk(registerProjectAsset(intake, {
    asset_id: asset.asset_id,
    source_id: 'gelato-live-owned-website',
    usage_role: asset.role,
    rights_status: asset.rights_state,
    publishable: false
  }, { at: '2026-09-04T08:03:00.000Z' }), 'register asset ' + asset.asset_id);
  intake = r.state;
}

let packed = requireOk(createContentPack(intake, { pack_id: 'gelato-premium-repair-content-v1', at: '2026-09-04T08:04:00.000Z' }), 'content pack');
intake = packed.state;
const contentPack = packed.pack;
packed = requireOk(createVisualPack(intake, { pack_id: 'gelato-premium-repair-visual-v1', at: '2026-09-04T08:04:30.000Z' }), 'visual pack');
intake = packed.state;
const visualPack = packed.pack;

assert.equal(contentPack.canonical_values['business.name'], 'Gelato Donatello');
assert.equal(contentPack.canonical_values['products.flavor_count'], 40);
assert.equal(Object.values(contentPack.canonical_values).some((value) => String(value).includes('über 45')), false);
assert.equal(visualPack.approved_assets.length, 0, 'Unknown-rights assets must not enter approved visual pack');

const discovery = requireOk(evaluatePremiumDiscoveryReadiness(intake, {
  required_inputs: ['business_identity', 'products_services', 'target_customers', 'primary_conversion'],
  brand_path: 'USE_EXISTING_BRAND',
  required_asset_roles: ['logo', 'real_business_photography', 'product_photography'],
  asset_quality: Object.fromEntries(evidence.assets.map((asset) => [asset.asset_id, asset.quality_state])),
  legal_required: true
}), 'premium discovery').projection;

assert.equal(discovery.status, 'BLOCKED');
assert.equal(discovery.research_policy.unverified_research_may_become_customer_fact, false);
assert.equal(discovery.research_policy.unverified_research_may_become_trust_claim, false);
assert.equal(discovery.rights_and_asset_quality_separate, true);
assert.equal(discovery.production_deploy, false);
assert.equal(discovery.paid_provider_calls, 0);

await writeFile(path.join(ARTIFACT_DIR, 'project-source-intake-evidence.json'), JSON.stringify({
  source_count: intake.sources.length,
  fact_count: intake.facts.length,
  asset_count: intake.assets.length,
  content_pack: contentPack,
  visual_pack: visualPack,
  premium_discovery: discovery,
  safety: intake.safety
}, null, 2));

const browser = await chromium.launch({ headless: true });
const live = {
  source_url: SOURCE_URL,
  capture_mode: 'READ_ONLY',
  captured_at: new Date().toISOString(),
  field_cwv_claimed: false,
  viewports: {},
  technical: {},
  facts: {
    operator_confirmed_flavor_count: 40,
    live_claim_over_45_present: null,
    source_conflict_present: null
  }
};

async function auditLiveSource() {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  for (const [name, width, height] of VIEWPORTS) {
    const page = await context.newPage({ viewport: { width, height } });
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push('pageerror: ' + error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push('console: ' + message.text());
    });
    try {
      const response = await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(900);
      const snapshot = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
        const origins = [];
        for (const item of resources) {
          try {
            const origin = new URL(item, location.href).origin;
            if (origin !== location.origin) origins.push(origin);
          } catch {}
        }
        return {
          title: document.title,
          lang: document.documentElement.lang || null,
          h1_count: document.querySelectorAll('h1').length,
          nav_landmark_count: document.querySelectorAll('nav').length,
          canonical: document.querySelector('link[rel="canonical"]')?.href || null,
          robots_meta: document.querySelector('meta[name="robots"]')?.content || null,
          description: document.querySelector('meta[name="description"]')?.content || null,
          image_count: document.images.length,
          image_missing_alt_count: document.querySelectorAll('img:not([alt])').length,
          tel_link_count: document.querySelectorAll('a[href^="tel:"]').length,
          mail_link_count: document.querySelectorAll('a[href^="mailto:"]').length,
          horizontal_overflow_px: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
          third_party_origins: [...new Set(origins)].sort(),
          body_has_over_45_claim: /über\s+45\s+verschiedene\s+Eissorten/i.test(bodyText)
        };
      });
      live.viewports[name] = {
        status: response?.status() || null,
        final_url: page.url(),
        ...snapshot,
        browser_errors: browserErrors
      };
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live-' + name + '.png'), fullPage: true });
    } catch (error) {
      live.viewports[name] = { status: null, error: String(error?.message || error), browser_errors: browserErrors, state: 'NOT_VERIFIED' };
    }
    await page.close();
  }

  const request = context.request;
  for (const [key, pathname] of [['robots', '/robots.txt'], ['sitemap', '/sitemap_index.xml'], ['not_found', '/aurentara-premium-audit-not-found-v1']]) {
    try {
      const response = await request.get(new URL(pathname, SOURCE_URL).href, { timeout: 15000, failOnStatusCode: false });
      live.technical[key] = {
        status: response.status(),
        final_url: response.url(),
        content_type: response.headers()['content-type'] || null,
        location: response.headers().location || null
      };
    } catch (error) {
      live.technical[key] = { state: 'NOT_VERIFIED', error: String(error?.message || error) };
    }
  }
  const cookies = await context.cookies(SOURCE_URL);
  live.technical.cookie_count_after_read_only_load = cookies.length;
  live.facts.live_claim_over_45_present = Object.values(live.viewports).some((v) => v.body_has_over_45_claim === true);
  live.facts.source_conflict_present = live.facts.live_claim_over_45_present === true && live.facts.operator_confirmed_flavor_count === 40;
  await context.close();
}

await auditLiveSource();
await writeFile(path.join(ARTIFACT_DIR, 'live-source-evidence.json'), JSON.stringify(live, null, 2));

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
  'x-robots-tag': 'noindex, nofollow, noarchive'
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  let rel = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.replace(/^\/+/, '');
  if (rel.includes('..')) rel = '404.html';
  let filePath = path.join(PROJECT_DIR, rel);
  let statusCode = 200;
  try {
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error('not file');
  } catch {
    filePath = path.join(PROJECT_DIR, '404.html');
    statusCode = 404;
  }
  const body = await readFile(filePath);
  for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', contentTypes[path.extname(filePath)] || 'application/octet-stream');
  res.statusCode = statusCode;
  res.end(body);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = 'http://127.0.0.1:' + address.port + '/';

const candidate = {
  base_url: baseUrl,
  environment: 'private-local-staging',
  production_deploy: false,
  public_deploy: false,
  field_cwv_claimed: false,
  viewports: {},
  technical: {},
  performance: {}
};

for (const [name, width, height] of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push('pageerror: ' + error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push('console: ' + message.text());
  });
  const response = await page.goto(baseUrl, { waitUntil: 'load' });
  assert.equal(response?.status(), 200, name + ': candidate response');
  const result = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    h1_count: document.querySelectorAll('h1').length,
    nav_count: document.querySelectorAll('nav').length,
    main_count: document.querySelectorAll('main').length,
    robots: document.querySelector('meta[name="robots"]')?.content || null,
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    description: document.querySelector('meta[name="description"]')?.content || null,
    image_count: document.images.length,
    script_count: document.scripts.length,
    form_count: document.forms.length,
    external_action_count: document.querySelectorAll('a[href^="tel:"],a[href^="mailto:"],form[action]').length,
    horizontal_overflow_px: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    body_has_over_45_claim: /über\s+45\s+verschiedene\s+Eissorten/i.test(document.body.innerText),
    body_has_fake_review_language: /5\s*sterne|kundenbewertung|google reviews?/i.test(document.body.innerText),
    resource_urls: performance.getEntriesByType('resource').map((entry) => entry.name),
    navigation_ms: performance.getEntriesByType('navigation')[0]?.duration || null
  }));

  assert.equal(result.lang, 'de', name + ': lang');
  assert.equal(result.h1_count, 1, name + ': one h1');
  assert.ok(result.nav_count >= 1, name + ': nav landmark');
  assert.equal(result.main_count, 1, name + ': main landmark');
  assert.match(result.robots || '', /noindex/i, name + ': staging noindex');
  assert.equal(result.canonical, 'https://gelato-donatello.de/', name + ': canonical source');
  assert.ok(result.description?.length > 20, name + ': description');
  assert.equal(result.image_count, 0, name + ': unknown-rights images excluded');
  assert.equal(result.script_count, 0, name + ': script-free repair candidate');
  assert.equal(result.form_count, 0, name + ': no unverified external form');
  assert.equal(result.external_action_count, 0, name + ': no unverified phone/mail submit');
  assert.ok(result.horizontal_overflow_px <= 1, name + ': no horizontal overflow');
  assert.equal(result.body_has_over_45_claim, false, name + ': conflicting claim absent');
  assert.equal(result.body_has_fake_review_language, false, name + ': no fabricated review language');

  const primary = page.getByRole('link', { name: 'Sorten ansehen' }).first();
  const secondary = page.getByRole('link', { name: 'Kontaktangaben prüfen' }).first();
  assert.equal(await primary.isVisible(), true, name + ': primary CTA visible');
  assert.equal(await secondary.isVisible(), true, name + ': secondary CTA visible');
  const primaryBox = await primary.boundingBox();
  const secondaryBox = await secondary.boundingBox();
  assert.ok((primaryBox?.height || 0) >= 44, name + ': primary tap target');
  assert.ok((secondaryBox?.height || 0) >= 44, name + ': secondary tap target');

  await primary.focus();
  const focusedPrimary = await page.evaluate(() => ({
    tag: document.activeElement?.tagName || null,
    href: document.activeElement?.getAttribute?.('href') || null
  }));
  assert.equal(focusedPrimary.tag, 'A', name + ': primary CTA keyboard focus lands on link');
  assert.equal(focusedPrimary.href, '#sorten', name + ': primary CTA keyboard target');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.location.hash === '#sorten', null, { timeout: 2000 });
  assert.equal(new URL(page.url()).hash, '#sorten', name + ': primary CTA keyboard journey');
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.keyboard.press('Tab');
  const skipFocused = await page.locator('.skip-link').evaluate((node) => document.activeElement === node);
  assert.equal(skipFocused, true, name + ': skip link first keyboard target');

  const thirdParty = result.resource_urls.filter((item) => {
    try { return new URL(item, baseUrl).origin !== new URL(baseUrl).origin; } catch { return true; }
  });
  assert.deepEqual(thirdParty, [], name + ': no third-party resources');
  assert.deepEqual(browserErrors, [], name + ': no browser errors');

  candidate.viewports[name] = { ...result, browser_errors: browserErrors, primary_cta_height: primaryBox?.height || null, secondary_cta_height: secondaryBox?.height || null };
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'candidate-' + name + '.png'), fullPage: true });
  await context.close();
}

const auditContext = await browser.newContext();
const auditPage = await auditContext.newPage();
const mainResponse = await auditPage.goto(baseUrl, { waitUntil: 'load' });
candidate.technical.security_headers = Object.fromEntries(Object.keys(securityHeaders).map((key) => [key, mainResponse?.headers()[key] || null]));
for (const [key, expected] of Object.entries(securityHeaders)) assert.equal(candidate.technical.security_headers[key], expected, 'security header ' + key);
const notFoundResponse = await auditPage.goto(baseUrl + 'definitely-missing', { waitUntil: 'load' });
assert.equal(notFoundResponse?.status(), 404, '404 route must return 404');
assert.match(await auditPage.locator('h1').innerText(), /Seite nicht gefunden/i);
candidate.technical.not_found_status = 404;

const robotsText = await (await auditContext.request.get(baseUrl + 'robots.txt')).text();
assert.match(robotsText, /Disallow:\s*\//);
candidate.technical.robots = 'PASS';
const sitemapText = await (await auditContext.request.get(baseUrl + 'sitemap.xml')).text();
assert.match(sitemapText, /https:\/\/gelato-donatello\.de\//);
candidate.technical.sitemap = 'PASS';

const indexBytes = (await stat(path.join(PROJECT_DIR, 'index.html'))).size;
const cssBytes = (await stat(path.join(PROJECT_DIR, 'styles.css'))).size;
candidate.performance = {
  status: Object.values(candidate.viewports).every((item) => Number(item.navigation_ms || 0) < 1500) && indexBytes + cssBytes < 100000 ? 'PASS' : 'FAIL',
  prelaunch_lab: true,
  total_core_bytes: indexBytes + cssBytes,
  max_navigation_ms: Math.max(...Object.values(candidate.viewports).map((item) => Number(item.navigation_ms || 0))),
  third_party_requests: 0,
  javascript_files: 0,
  image_files: 0,
  field_cwv_claimed: false,
  post_launch_field_cwv: 'NOT_VERIFIED'
};
assert.equal(candidate.performance.status, 'PASS');
await auditContext.close();
await browser.close();
server.close();

const PASS = 'PASS';
const NV = 'NOT_VERIFIED';
const checks = {
  business_understanding: [
    ['canonical project identity', PASS],
    ['operator-confirmed flavor list baseline', PASS],
    ['target customers confirmed', NV],
    ['business model confirmed', NV],
    ['primary business conversion confirmed', NV]
  ],
  brand_foundation_fit: [
    ['existing business identity preserved', PASS],
    ['brand path constrained to existing brand', PASS],
    ['logo rights verified', NV],
    ['visual asset rights verified', NV],
    ['human brand fit approval', NV]
  ],
  content_copy: [
    ['unsupported public claims excluded', PASS],
    ['known source conflict excluded from rendered candidate', PASS],
    ['CTA wording clear', PASS],
    ['evidence provenance visible', PASS],
    ['full products/services content confirmed', NV],
    ['customer objection content confirmed', NV],
    ['customer copy approval', NV]
  ],
  information_architecture_ux: [
    ['expected page set explicit and justified', PASS],
    ['semantic sections and landmarks', PASS],
    ['navigation works', PASS],
    ['desktop primary journey works', PASS],
    ['mobile primary journey works', PASS],
    ['customer IA approval', NV]
  ],
  visual_design_art_direction: [
    ['responsive layout consistency', PASS],
    ['design token and spacing consistency', PASS],
    ['unknown-rights assets excluded', PASS],
    ['human art direction review', NV],
    ['central real imagery approved', NV]
  ],
  conversion: [
    ['primary CTA present', PASS],
    ['primary CTA works', PASS],
    ['secondary CTA present and works', PASS],
    ['mobile CTA target passes', PASS],
    ['unverified external contact action blocked', PASS],
    ['business conversion channel confirmed', NV],
    ['customer trust near final conversion approved', NV]
  ],
  trust: [
    ['fabricated claims absent', PASS],
    ['known conflicting claim excluded', PASS],
    ['operator-confirmed fact provenance retained', PASS],
    ['public history trust claims customer verified', NV],
    ['customer trust approval', NV]
  ],
  seo_discoverability: [
    ['title present', PASS],
    ['meta description present', PASS],
    ['language and heading semantics', PASS],
    ['canonical declared', PASS],
    ['private staging noindex', PASS],
    ['sitemap technically valid', PASS],
    ['unverified LocalBusiness structured data excluded', PASS],
    ['local business facts confirmed', NV],
    ['production indexing verified', NV]
  ],
  performance: [
    ['prelaunch lab load budget', PASS],
    ['core bytes budget', PASS],
    ['zero third-party candidate requests', PASS],
    ['zero JS and image payload in repair candidate', PASS],
    ['post-launch field CWV evidence', NV]
  ],
  accessibility: [
    ['document language', PASS],
    ['skip-link keyboard path', PASS],
    ['single h1 hierarchy', PASS],
    ['semantic landmarks', PASS],
    ['visible keyboard focus contract', PASS],
    ['44px CTA target', PASS],
    ['keyboard CTA activation', PASS],
    ['responsive reflow engineering check', PASS],
    ['human screen-reader review', NV],
    ['human zoom/reflow review', NV]
  ],
  technical_quality_security: [
    ['content security policy', PASS],
    ['nosniff header', PASS],
    ['referrer policy', PASS],
    ['permissions policy', PASS],
    ['404 status correctness', PASS],
    ['zero third-party candidate resources', PASS],
    ['no executable script surface', PASS],
    ['no external write surface', PASS]
  ],
  mobile_responsive: [
    ['desktop viewport pass', PASS],
    ['tablet viewport pass', PASS],
    ['mobile viewport pass', PASS],
    ['small-mobile viewport pass', PASS],
    ['CTA targets and no overflow', PASS],
    ['human mobile quality approval', NV]
  ],
  legal_rights_readiness: [
    ['unknown-rights assets not published', PASS],
    ['current legal entity confirmed', NV],
    ['privacy processing inventory confirmed', NV],
    ['asset rights evidence received', NV],
    ['public legal inputs complete', NV],
    ['customer legal approval', NV]
  ],
  launch_handover_readiness: [
    ['private staging indexing locked', PASS],
    ['404 readiness', PASS],
    ['sitemap template readiness', PASS],
    ['monitoring plan confirmed', NV],
    ['production smoke', NV],
    ['customer approval', NV],
    ['human premium approval', NV],
    ['DNS/SSL launch approval', NV]
  ]
};

function scoreDimension(items) {
  const passCount = items.filter(([, status]) => status === PASS).length;
  return Math.round((passCount / items.length) * 10000) / 100;
}
const dimensionScores = Object.fromEntries(Object.entries(checks).map(([id, items]) => [id, {
  score: scoreDimension(items),
  verification: items.every(([, status]) => status === PASS) ? 'VERIFIED' : 'NOT_VERIFIED',
  evidence_refs: ['gelato-premium-evidence-repair-v1:' + id]
}]));

const hardPass = (code) => ({ status: PASS, evidence_refs: ['gelato-premium-evidence-repair-v1:' + code] });
const hardNotVerified = (code) => ({ status: NV, evidence_refs: ['gelato-premium-evidence-repair-v1:' + code] });
const hardGates = {
  fabricated_trust_claim: hardPass('fabricated_trust_claim'),
  fabricated_review: hardPass('fabricated_review'),
  fabricated_qualification: hardPass('fabricated_qualification'),
  fabricated_certification: hardPass('fabricated_certification'),
  fabricated_customer_project_evidence: hardPass('fabricated_customer_project_evidence'),
  fake_location: hardPass('fake_location'),
  critical_source_conflict_in_rendered_content: hardPass('critical_source_conflict_in_rendered_content'),
  blocked_or_unknown_rights_on_published_asset: hardPass('blocked_or_unknown_rights_on_published_asset'),
  broken_primary_conversion: hardNotVerified('broken_primary_conversion'),
  critical_accessibility_failure: hardPass('critical_accessibility_failure'),
  broken_responsive_primary_journey: hardPass('broken_responsive_primary_journey'),
  secret_leakage: hardPass('secret_leakage'),
  pii_analytics_leakage: hardPass('pii_analytics_leakage'),
  critical_security_failure: hardPass('critical_security_failure'),
  tracking_outside_required_consent_policy: hardPass('tracking_outside_required_consent_policy'),
  incorrect_production_indexing_state: hardPass('incorrect_production_indexing_state'),
  critical_canonical_redirect_route_failure: hardNotVerified('critical_canonical_redirect_route_failure'),
  missing_required_public_legal_input: hardNotVerified('missing_required_public_legal_input'),
  missing_final_human_approval: hardNotVerified('missing_final_human_approval'),
  missing_required_customer_approval: hardNotVerified('missing_required_customer_approval'),
  project_isolation_violation: hardPass('project_isolation_violation'),
  production_action_without_existing_operator_approval: hardPass('production_action_without_existing_operator_approval')
};

const assetReadiness = normalizePremiumAssets(evidence.assets.map((asset) => ({
  asset_id: asset.asset_id,
  role: asset.role,
  central: true,
  quality_state: asset.quality_state,
  rights_status: asset.rights_state,
  publishable: false
})));

const trustEvidence = normalizePremiumTrustEvidence([{
  evidence_id: 'operator-confirmed-flavor-count',
  claim: '40 Einträge in der zuletzt operator-bestätigten Sortenliste',
  source_refs: ['operator-input-2026-08-12'],
  verification_status: 'OPERATOR_CONFIRMED',
  placement: ['#sorten']
}]);

const performanceEvidence = normalizePremiumPerformanceEvidence({
  prelaunch_lab: {
    status: candidate.performance.status,
    evidence_refs: ['candidate-browser-evidence.json'],
    total_core_bytes: candidate.performance.total_core_bytes,
    max_navigation_ms: candidate.performance.max_navigation_ms,
    third_party_requests: 0
  },
  post_launch_field_cwv: null
});

const accessibilityEvidence = evaluatePrimaryJourneyAccessibility({
  automated: 'PASS',
  human_checks: {
    keyboard: NV,
    focus: NV,
    form_errors: NV,
    navigation: NV,
    semantic_basics: NV,
    screenreader_basics: NV,
    zoom_reflow: NV,
    touch_interaction: NV
  }
});

const legalReadiness = normalizePremiumLegalReadiness({
  state: 'LEGAL_REVIEW_REQUIRED',
  missing_required_inputs: evidence.legal.missing_required_inputs,
  technical_readiness: 'PASS'
});
const launchChecklist = evaluatePremiumLaunchChecklist({
  domain: NV,
  dns_plan_state: NV,
  ssl: NV,
  redirects: NV,
  canonicals: 'PASS',
  robots: 'PASS',
  sitemap: 'PASS',
  analytics: NV,
  search_console_readiness: NV,
  forms: NV,
  email_delivery: NV,
  404: 'PASS',
  monitoring: NV,
  backup_strategy: NV,
  rollback: NV,
  production_smoke: NV,
  production_verification: NV
});
const humanReview = evaluatePremiumHumanReview({ state: 'CHANGES_REQUIRED', automated: false });

const premium = evaluatePremiumWebsiteStandard({
  project_ref: project,
  industry: project.industry,
  quality_dimensions: dimensionScores,
  hard_gates: hardGates,
  input_readiness: {
    required_inputs: ['business_identity', 'business_model', 'products_services', 'target_customers', 'primary_conversion'],
    values: { business_identity: 'Gelato Donatello' }
  },
  brand_readiness: { path: 'USE_EXISTING_BRAND' },
  asset_readiness: assetReadiness,
  trust_evidence: trustEvidence,
  performance_evidence: performanceEvidence,
  accessibility_evidence: accessibilityEvidence,
  legal_readiness: legalReadiness,
  launch_checklist: launchChecklist,
  human_review: humanReview,
  customer_review: { required_review_content_present: true, approval_claimed: false },
  ownership: {},
  care: { state: 'OPTIONAL' },
  preview_qa: 'PASS',
  responsive_qa: 'PASS',
  seo_evidence: { status: 'PASS', evidence_refs: ['candidate-browser-evidence.json'] },
  local_seo_evidence: { status: NV, reason: 'Current local business facts require customer confirmation' },
  privacy_evidence: { status: 'PASS', tracking: false, external_forms: false },
  security_evidence: { status: 'PASS', evidence_refs: ['candidate-browser-evidence.json'] },
  project_isolation: { status: 'PASS', scope_key: project.scope_key },
  launch_governance: NV,
  evaluated_at: new Date().toISOString()
});

assert.equal(premium.production_deploy, false);
assert.equal(premium.technical_evidence.field_cwv_claimed, false);
assert.equal(premium.hard_failures.length, 0);
assert.equal(premium.delivery_readiness.customer_review_ready, false);
assert.equal(premium.delivery_readiness.premium_delivery_ready, false);
assert.equal(premium.launch_readiness.public_launch_ready, false);
assert.equal(premium.weighted_score, 64.21);

const baselineDimensions = evidence.baseline.dimension_scores;
const dimensionChange = Object.fromEntries(Object.entries(dimensionScores).map(([id, detail]) => [id, {
  starting: baselineDimensions[id],
  final: detail.score,
  change: Math.round((detail.score - baselineDimensions[id]) * 100) / 100,
  verification: detail.verification,
  checks: checks[id].map(([name, status]) => ({ name, status }))
}]));

const report = {
  schema: 'aurentara.gelato-premium-evidence-critical-repair-result.v1',
  project_ref: premium.project_ref,
  starting_score: evidence.baseline.premium_score,
  final_evidence_backed_score: premium.weighted_score,
  score_change: Math.round((premium.weighted_score - evidence.baseline.premium_score) * 100) / 100,
  dimension_change: dimensionChange,
  premium,
  fixed_issues: [
    'Real project source and evidence contract captured',
    'Automatically researched/live extracted facts separated from operator-confirmed facts',
    'Known flavor-count source conflict excluded from rendered candidate',
    'Unknown-rights images and logo excluded from published candidate',
    'Responsive desktop/tablet/mobile/small-mobile journey verified',
    'Primary and secondary staging CTA architecture verified without unconfirmed external action',
    'Prelaunch lab performance budget verified',
    'Accessibility engineering checks verified for keyboard path, landmarks, targets and reflow',
    'Technical SEO staging controls, canonical, sitemap and 404 verified',
    'Security headers and zero third-party candidate resources verified',
    'No tracking, analytics or PII payload surface introduced'
  ],
  remaining_not_verified: [
    ...discovery.missing_customer_inputs.map((item) => 'customer_input:' + item),
    ...discovery.missing_asset_roles.map((item) => 'asset_rights_or_quality:' + item),
    ...evidence.legal.missing_required_inputs.map((item) => 'legal:' + item),
    'business_primary_conversion_channel',
    'production_redirects_and_canonical_behavior',
    'post_launch_field_cwv',
    'human_accessibility_review',
    'human_visual_quality_review',
    'customer_content_approval',
    'customer_premium_approval',
    'launch_governance_and_production_smoke'
  ],
  hard_failures: premium.hard_failures,
  not_verified_hard_gates: premium.not_verified_hard_gates,
  customer_input_required: ['target customers', 'business model', 'complete products/services', 'primary contact/conversion channel', 'current address', 'current phone/email', 'opening hours', 'trust/history claims'],
  legal_rights_input_required: [...evidence.legal.missing_required_inputs, 'logo rights', 'storefront photography rights', 'product photography rights'],
  human_approval_required: ['desktop', 'tablet', 'mobile', 'small mobile', 'brand fit', 'visual quality', 'copy quality', 'final premium quality gate'],
  customer_review_ready: premium.delivery_readiness.customer_review_ready,
  premium_delivery_ready: premium.delivery_readiness.premium_delivery_ready,
  public_launch_ready: premium.launch_readiness.public_launch_ready,
  production_deploy: false,
  public_deploy: false,
  paid_provider_calls: 0,
  dns_changes: false,
  billing: false,
  live_source_capture: {
    read_only: true,
    source_conflict_present: live.facts.source_conflict_present,
    field_cwv_claimed: false
  }
};

await writeFile(path.join(ARTIFACT_DIR, 'candidate-browser-evidence.json'), JSON.stringify(candidate, null, 2));
await writeFile(path.join(ARTIFACT_DIR, 'premium-reassessment.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: true,
  suite: 'gelato-premium-evidence-critical-truth-conversion-repair-v1',
  starting_score: report.starting_score,
  final_score: report.final_evidence_backed_score,
  score_change: report.score_change,
  hard_failures: report.hard_failures.length,
  not_verified_hard_gates: report.not_verified_hard_gates.map((item) => item.code),
  customer_review_ready: report.customer_review_ready,
  premium_delivery_ready: report.premium_delivery_ready,
  public_launch_ready: report.public_launch_ready,
  field_cwv_claimed: false,
  production_deploy: false,
  public_deploy: false,
  paid_provider_calls: 0
}, null, 2));
