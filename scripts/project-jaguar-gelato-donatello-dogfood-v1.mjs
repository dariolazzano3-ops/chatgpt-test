import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {
  PREMIUM_STATIC_WEB_V1_ID,
  getIndustryPattern,
  getPremiumIndustryQualityProfile,
  getWebsiteRecipe,
  materializePremiumStaticWebV1SourcePackage,
  runWebOperatingSystemV2
} from '../src/web-factory/index.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const project = JSON.parse(await readFile(new URL('../projects/gelato-donatello-website-v1/project-jaguar-dogfood-v1.json', import.meta.url), 'utf8'));
const confirmed = JSON.parse(await readFile(new URL('../projects/gelato-donatello-website-v1/confirmed-project-inputs-v1.json', import.meta.url), 'utf8'));

function confirmedValue(fieldPath) {
  return confirmed.facts.find((fact) => fact.field_path === fieldPath)?.value;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startStaticServer(root) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const destination = path.resolve(root, rel);
      if (!destination.startsWith(path.resolve(root) + path.sep)) {
        response.writeHead(403);
        response.end('forbidden');
        return;
      }
      const body = await readFile(destination);
      const type = destination.endsWith('.html') ? 'text/html; charset=utf-8'
        : destination.endsWith('.css') ? 'text/css; charset=utf-8'
        : destination.endsWith('.js') ? 'text/javascript; charset=utf-8'
        : 'application/octet-stream';
      response.writeHead(200, { 'content-type':type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url:`http://127.0.0.1:${server.address().port}` };
}

async function waitForChrome(port) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('LIGHTHOUSE_CHROME_DEBUG_PORT_NOT_READY');
}

assert.equal(project.mission.business_name, confirmedValue('business.name'));
assert.deepEqual(project.mission.services.map((x) => x.replace(' und ', ' & ')).length > 0, true);
assert.equal(project.confirmed_facts.flavor_count, confirmedValue('products.flavor_count'));
assert.equal(project.confirmed_facts.mocca_included, confirmedValue('products.mocca_included'));
assert.equal(project.confirmed_facts.scoop_eur, confirmedValue('business.pricing').kugel_eis_eur);
assert.equal(project.confirmed_facts.display_rental.rent_eur, confirmedValue('business.pricing').eisvitrine.miete_eur);
assert.equal(project.source_contract.live_site_is_automatic_design_reference, false);
assert.equal(project.source_contract.live_site_is_automatic_content_truth, false);

const recipe = getWebsiteRecipe(project.mission.industry);
const industry = getIndustryPattern(project.mission.industry);
const premiumProfile = getPremiumIndustryQualityProfile(project.mission.industry);
assert.equal(recipe.recipe_id, 'restaurant');
assert.equal(industry.industry_key, 'restaurant');
assert.equal(premiumProfile.profile_id, 'GASTRONOMY');

const build = runWebOperatingSystemV2({
  mission:project.mission,
  quality_level:'PREMIUM',
  content:project.mission.existing_content,
  assets:[],
  trust_evidence:{ available:[] },
  local_business_data:{},
  premium_evidence:{
    human_review:{ state:'CHANGES_REQUIRED', approved:false },
    assets:[]
  }
}, { now:'2026-09-07T00:00:00.000Z', build_duration_ms:1 });

assert.equal(build.ok, true);
assert.equal(build.status, 'VERIFIED_WEB_OS_V2_DELIVERABLE');
assert.equal(build.build_profile.profile_id, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(build.provider_route.selected.route_id, 'native-premium-cloudflare');
assert.equal(build.provider_route.selected.build_profile, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(build.production_deploy, false);
assert.equal(build.integrations.external_side_effects, false);
assert.equal(build.deployment.contract.production, false);
assert.equal(build.deployment.contract.direct_deploy_executed, false);
assert.equal(build.premium_standard.launch_readiness.public_launch_ready, false);
assert.equal(build.premium_standard.delivery_readiness.premium_delivery_ready, false);

const pageIds = build.artifact.pages.map((page) => page.id);
for (const expected of ['home','menu','about','contact','faq','legal-notice','privacy']) assert.ok(pageIds.includes(expected), `missing page ${expected}`);
assert.equal(pageIds.includes('services'), false);

const html = Object.entries(build.artifact.files)
  .filter(([file]) => file.endsWith('.html'))
  .map(([, value]) => String(value))
  .join('\n');

for (const forbidden of project.forbidden_unverified_render_values) {
  assert.equal(html.includes(forbidden), false, `unverified value leaked into generated HTML: ${forbidden}`);
}

for (const required of ['40', '1,60 €', '18 cm 65 €', '26 cm 109 €', '250 €', '100 €', '5 Liter Eis', '4 Sorten']) {
  assert.ok(html.includes(required), `confirmed Gelato value missing from generated HTML: ${required}`);
}

assert.ok(html.includes('href="/menu/"'));
assert.equal(/href=["']tel:/i.test(html), false);
assert.equal(/href=["']mailto:/i.test(html), false);
assert.equal(/action=["']https?:/i.test(html), false);
assert.ok(/disabled[^>]*aria-disabled=["']true/i.test(html));

const temp = await mkdtemp(path.join(os.tmpdir(), 'project-jaguar-gelato-'));
let server;
let browser;
let chromeProcess;

try {
  const sourceRoot = path.join(temp, 'source');
  await materializePremiumStaticWebV1SourcePackage(build.build_profile, sourceRoot);
  await symlink(path.join(repoRoot, 'node_modules'), path.join(sourceRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

  const astroBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');
  await stat(astroBin);
  const astro = spawnSync(astroBin, ['build'], {
    cwd:sourceRoot,
    encoding:'utf8',
    env:{ ...process.env, CI:'1' }
  });
  if (astro.status !== 0) throw new Error(`GELATO_ASTRO_BUILD_FAILED\n${astro.stdout}\n${astro.stderr}`);

  const dist = path.join(sourceRoot, 'dist');
  await stat(path.join(dist, 'index.html'));
  await stat(path.join(dist, 'menu', 'index.html'));
  server = await startStaticServer(dist);

  browser = await chromium.launch({ headless:true });
  const viewports = [
    { name:'desktop', width:1440, height:1000 },
    { name:'tablet', width:1024, height:900 },
    { name:'mobile', width:390, height:844 },
    { name:'small_mobile', width:320, height:760 }
  ];
  const browserEvidence = {};

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height } });
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil:'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const h1 = await page.locator('h1').count();
    const menuHref = await page.locator('a[href="/menu/"]').count();
    assert.equal(overflow, false, `${viewport.name} horizontal overflow`);
    assert.equal(h1, 1, `${viewport.name} h1 count`);
    assert.ok(menuHref >= 1, `${viewport.name} menu CTA missing`);
    if (viewport.name === 'desktop') {
      const axe = await new AxeBuilder({ page }).analyze();
      const severe = axe.violations.filter((violation) => ['critical','serious'].includes(violation.impact));
      assert.deepEqual(severe.map((v) => ({ id:v.id, impact:v.impact, nodes:v.nodes.length })), []);
      browserEvidence.axe_serious_critical = 0;
    }
    const screenshot = await page.screenshot({ fullPage:true });
    assert.ok(screenshot.length > 1000);
    browserEvidence[viewport.name] = { overflow_px:0, h1_count:h1, screenshot_bytes:screenshot.length };
    await context.close();
  }

  const debugPort = await reservePort();
  const chromeProfile = path.join(temp, 'lighthouse-profile');
  chromeProcess = spawn(chromium.executablePath(), [
    '--headless=new','--no-sandbox','--disable-gpu','--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${chromeProfile}`, 'about:blank'
  ], { stdio:'ignore' });
  await waitForChrome(debugPort);

  const { default:lighthouse } = await import('lighthouse');
  const result = await lighthouse(server.url, {
    port:debugPort,
    output:'json',
    logLevel:'error',
    onlyCategories:['performance','accessibility','best-practices']
  });
  const lighthouseScores = {
    performance:result.lhr.categories.performance.score,
    accessibility:result.lhr.categories.accessibility.score,
    best_practices:result.lhr.categories['best-practices'].score
  };
  assert.ok(lighthouseScores.performance >= 0.90);
  assert.ok(lighthouseScores.accessibility >= 0.95);
  assert.ok(lighthouseScores.best_practices >= 0.95);

  console.log(JSON.stringify({
    ok:true,
    suite:'project-jaguar-gelato-donatello-real-dogfood-v1',
    project_id:project.project_ref.project_id,
    build_profile:build.build_profile.profile_id,
    recipe:recipe.recipe_id,
    premium_profile:premiumProfile.profile_id,
    generated_pages:pageIds,
    confirmed_fact_guard:'PASS',
    unverified_fact_leakage:0,
    external_contact_actions:0,
    astro_build:'PASS',
    browser:browserEvidence,
    lighthouse:lighthouseScores,
    visual_foundry:build.build_profile.acceptance.gates.visual_foundry.status,
    public_launch_ready:false,
    premium_delivery_ready:false,
    production_deploy:false,
    public_launch:false,
    dns_changes:false,
    billing:false,
    external_writes:false
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server?.server) await new Promise((resolve) => server.server.close(resolve));
  if (chromeProcess && chromeProcess.exitCode === null) {
    chromeProcess.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => chromeProcess.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
    if (chromeProcess.exitCode === null) {
      chromeProcess.kill('SIGKILL');
      await new Promise((resolve) => chromeProcess.once('exit', resolve));
    }
  }
  await rm(temp, { recursive:true, force:true, maxRetries:8, retryDelay:200 });
}
