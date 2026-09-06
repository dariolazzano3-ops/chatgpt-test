import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import {
  PREMIUM_STATIC_WEB_V1_ID,
  PREMIUM_STATIC_WEB_V1_TOOLCHAIN,
  buildAutonomousPremiumWebsite,
  materializePremiumStaticWebV1SourcePackage,
  premiumStaticWebV1Manifest,
  runWebOperatingSystemV2,
  selectWebBuildRoute
} from '../src/web-factory/index.js';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = JSON.parse(await readFile(new URL('../fixtures/web-factory/autonomous-premium-architecture.json', import.meta.url), 'utf8'));
const approvedReferenceHash = 'a'.repeat(64);

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

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
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
      response.writeHead(200, { 'content-type': contentType(destination) });
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
  const port = server.address().port;
  return { server, url: `http://127.0.0.1:${port}` };
}

async function waitForChrome(port) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('LIGHTHOUSE_CHROME_DEBUG_PORT_NOT_READY');
}

const manifest = premiumStaticWebV1Manifest();
assert.equal(manifest.profile_id, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(manifest.source_owned, true);
assert.equal(manifest.production_deploy, false);
assert.equal(PREMIUM_STATIC_WEB_V1_TOOLCHAIN.renderer.id, 'astro');
assert.equal(PREMIUM_STATIC_WEB_V1_TOOLCHAIN.visual_qa.id, 'riosystems-visual-foundry');

const nativeRoute = selectWebBuildRoute({ native_premium:true, quality_level:'PREMIUM', synthetic_test_data_only:true, environment:'staging' });
assert.equal(nativeRoute.selected.route_id, 'native-premium-cloudflare');
assert.equal(nativeRoute.selected.build_profile, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(nativeRoute.selected.constraints.default_static_build_profile, PREMIUM_STATIC_WEB_V1_ID);

const specialistRoute = selectWebBuildRoute({ premium_visual:true, native_premium:false, quality_level:'PREMIUM', synthetic_test_data_only:true, environment:'staging' });
assert.equal(specialistRoute.selected.route_id, 'framer-design-native-cloudflare');
assert.equal(specialistRoute.selected.build_profile, PREMIUM_STATIC_WEB_V1_ID);

const premium = buildAutonomousPremiumWebsite({
  ...fixture,
  approved_reference_id:'project-jaguar-synthetic-approved-reference',
  approved_reference_hash:approvedReferenceHash
}, { now:'2026-09-06T22:00:00.000Z' });

assert.equal(premium.ok, true);
assert.equal(premium.build_profile.profile_id, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(premium.build_profile.status, 'READY_FOR_ACCEPTANCE');
assert.equal(premium.build_profile.acceptance.gates.visual_foundry.required, true);
assert.equal(premium.build_profile.visual_foundry_bridge.duplicate_visual_engine_created, false);
assert.equal(premium.build_profile.safety.production_deploy, false);
assert.equal(premium.build_profile.safety.external_writes, false);
assert.ok(premium.build_profile.source_package.files['astro.config.mjs']);
assert.ok(premium.build_profile.source_package.files['src/layouts/BaseLayout.astro']);
assert.ok(premium.build_profile.source_package.files['src/pages/index.astro']);
assert.ok(premium.build_profile.source_package.files['src/styles/global.css']);
assert.ok(premium.build_profile.source_package.files['public/site.js']);
assert.ok(premium.artifact.files[`${premium.artifact.project_root}/premium-static-web-v1.json`]);

const webOs = runWebOperatingSystemV2({
  ...fixture,
  approved_reference_id:'project-jaguar-synthetic-approved-reference',
  approved_reference_hash:approvedReferenceHash
}, { now:'2026-09-06T22:00:00.000Z', build_duration_ms: 1 });
assert.equal(webOs.ok, true);
assert.equal(webOs.build_profile.profile_id, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(webOs.delivery_manifest.build_profile.profile_id, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(webOs.provider_route.selected.build_profile, PREMIUM_STATIC_WEB_V1_ID);
assert.equal(webOs.production_deploy, false);
assert.equal(webOs.integrations.external_side_effects, false);

const gsapModule = await import('gsap');
const gsapApi = gsapModule.gsap || gsapModule.default?.gsap || gsapModule.default;
assert.equal(typeof gsapApi?.timeline, 'function');

const optimized = await sharp({
  create: {
    width: 64,
    height: 64,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 }
  }
}).webp({ quality: 80 }).toBuffer();
assert.ok(optimized.length > 20);

const temp = await mkdtemp(path.join(os.tmpdir(), 'project-jaguar-'));
let staticServer;
let browser;
let chromeProcess;

try {
  const sourceRoot = path.join(temp, 'source');
  await materializePremiumStaticWebV1SourcePackage(premium.build_profile, sourceRoot);

  const astroBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');
  await stat(astroBin);
  const astro = spawnSync(astroBin, ['build'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' }
  });
  if (astro.status !== 0) {
    throw new Error(`ASTRO_BUILD_FAILED\nSTDOUT:\n${astro.stdout}\nSTDERR:\n${astro.stderr}`);
  }

  const dist = path.join(sourceRoot, 'dist');
  await stat(path.join(dist, 'index.html'));
  staticServer = await startStaticServer(dist);

  browser = await chromium.launch({ headless:true });
  const desktop = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  await desktop.goto(staticServer.url, { waitUntil:'networkidle' });
  assert.equal(await desktop.locator('html').getAttribute('lang'), fixture.mission.language);
  assert.equal(await desktop.locator('h1').count(), 1);
  const desktopOverflow = await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(desktopOverflow, false);
  const desktopShot = await desktop.screenshot({ fullPage:true });
  assert.ok(desktopShot.length > 1000);

  const axeResults = await new AxeBuilder({ page:desktop }).analyze();
  const severe = axeResults.violations.filter((violation) => ['critical','serious'].includes(violation.impact));
  assert.deepEqual(severe.map((violation) => ({ id:violation.id, impact:violation.impact, nodes:violation.nodes.length })), []);

  const mobile = await browser.newPage({ viewport:{ width:390, height:844 } });
  await mobile.goto(staticServer.url, { waitUntil:'networkidle' });
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(mobileOverflow, false);
  assert.ok((await mobile.screenshot({ fullPage:true })).length > 1000);

  const debugPort = await reservePort();
  const chromeProfile = path.join(temp, 'lighthouse-chrome-profile');
  chromeProcess = spawn(chromium.executablePath(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfile}`,
    'about:blank'
  ], { stdio:'ignore' });
  await waitForChrome(debugPort);

  const { default:lighthouse } = await import('lighthouse');
  const lighthouseResult = await lighthouse(staticServer.url, {
    port:debugPort,
    output:'json',
    logLevel:'error',
    onlyCategories:['performance','accessibility','best-practices']
  });
  const scores = {
    performance:lighthouseResult.lhr.categories.performance.score,
    accessibility:lighthouseResult.lhr.categories.accessibility.score,
    best_practices:lighthouseResult.lhr.categories['best-practices'].score
  };
  assert.ok(scores.performance >= 0.90, `Lighthouse performance below threshold: ${scores.performance}`);
  assert.ok(scores.accessibility >= 0.95, `Lighthouse accessibility below threshold: ${scores.accessibility}`);
  assert.ok(scores.best_practices >= 0.95, `Lighthouse best practices below threshold: ${scores.best_practices}`);

  console.log(JSON.stringify({
    ok:true,
    suite:'project-jaguar-premium-static-web-v1',
    profile_id:PREMIUM_STATIC_WEB_V1_ID,
    route:nativeRoute.selected.route_id,
    astro_build:'PASS',
    sharp_webp:'PASS',
    gsap_provider:'PASS',
    desktop_browser:'PASS',
    mobile_browser:'PASS',
    axe_serious_critical:0,
    lighthouse:scores,
    visual_foundry_bridge:'PASS',
    source_files:premium.build_profile.source_package.manifest.file_count,
    production_deploy:false,
    public_launch:false,
    dns_changes:false,
    paid_activation:false,
    external_writes:false
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (staticServer?.server) await new Promise((resolve) => staticServer.server.close(resolve));
  if (chromeProcess && !chromeProcess.killed) chromeProcess.kill('SIGTERM');
  await rm(temp, { recursive:true, force:true });
}
