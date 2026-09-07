import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {
  J9_BROWSER_CHECKS,
  J9_DEVICE_MATRIX,
  J9_LIGHTHOUSE_MINIMUMS,
  J9_PERFORMANCE_BUDGETS,
  J9_FIELD_CWV_GOOD,
  evaluateJ9BrowserMatrix,
  evaluateJ9Accessibility,
  evaluateJ9Performance,
  compileJ9Acceptance,
  j9BrowserAccessibilityPerformanceManifest
} from '../src/web-factory/browser-accessibility-performance-v2.js';

const devices = {
  DESKTOP: { width: 1440, height: 900 },
  LAPTOP: { width: 1280, height: 800 },
  TABLET: { width: 1024, height: 768 },
  IPHONE: { width: 390, height: 844 },
  SMALL_MOBILE: { width: 320, height: 700 }
};

const css = '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Arial,sans-serif;color:#111;background:#fff}header{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #ddd;padding:8px}nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}a,button,input{min-height:44px}a,button{display:inline-flex;align-items:center;padding:8px 12px}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #005fcc;outline-offset:2px}#mobile-menu[hidden]{display:none}main{padding:24px;max-width:960px;margin:auto}section{min-height:260px;padding-top:24px}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gallery img{width:100%;height:120px;object-fit:cover}.carousel{border:1px solid #bbb;padding:12px}video{width:100%;max-width:360px;min-height:120px;background:#222}.motion-box{animation:pulse 1s infinite}@keyframes pulse{from{opacity:.8}to{opacity:1}}@media(prefers-reduced-motion:reduce){*{animation-duration:0s!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}@media(max-width:600px){main{padding:16px}.gallery{grid-template-columns:1fr}}';

const js = "const q=(s)=>document.querySelector(s);q('#mobile-toggle').addEventListener('click',()=>{const m=q('#mobile-menu');m.hidden=!m.hidden;});q('#dialog-open').addEventListener('click',()=>q('#demo-dialog').showModal());q('#dialog-close').addEventListener('click',()=>q('#demo-dialog').close());q('#carousel-next').addEventListener('click',()=>{const c=q('#carousel');c.dataset.index=String((Number(c.dataset.index||0)+1)%3);});q('#demo-form').addEventListener('submit',(e)=>{e.preventDefault();q('#form-status').textContent='Gesendet';});q('#action-button').addEventListener('click',()=>{q('#button-status').textContent='Aktiviert';});";

const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="PROJECT JAGUAR J9 deterministic browser accessibility and performance acceptance fixture."><title>PROJECT JAGUAR J9</title><style>' + css + '</style></head><body><header data-sticky="true"><nav aria-label="Hauptnavigation"><a id="nav-home" href="#top">Start</a><a id="nav-features" href="#features">Funktionen</a><a id="external-link" href="https://example.com/" target="_blank" rel="noopener noreferrer">Extern</a><button id="mobile-toggle" type="button" aria-controls="mobile-menu">Menü</button><div id="mobile-menu" hidden><a href="#contact">Kontakt</a></div></nav></header><main id="top"><h1>J9 Browser, Accessibility & Performance V2</h1><p><a id="primary-cta" href="#contact">Kontakt aufnehmen</a></p><section id="features" aria-labelledby="features-title"><h2 id="features-title">Interaktionen</h2><button id="action-button" type="button">Aktion</button><span id="button-status" aria-live="polite"></span><button id="dialog-open" type="button">Dialog öffnen</button><dialog id="demo-dialog"><p>Dialoginhalt</p><button id="dialog-close" type="button">Schließen</button></dialog><details id="accordion"><summary>Mehr erfahren</summary><p>Accordion-Inhalt</p></details><div class="gallery" aria-label="Galerie"><img alt="Abstraktes Testmotiv eins" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'320\' height=\'160\'%3E%3Crect width=\'320\' height=\'160\' fill=\'%23ddd\'/%3E%3C/svg%3E"><img alt="Abstraktes Testmotiv zwei" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'320\' height=\'160\'%3E%3Crect width=\'320\' height=\'160\' fill=\'%23bbb\'/%3E%3C/svg%3E"></div><div id="carousel" class="carousel" data-index="0" aria-label="Karussell"><p>Slide</p><button id="carousel-next" type="button">Weiter</button></div><video id="demo-video" controls muted aria-label="Demovideo"></video><div class="motion-box" id="motion-box">Motion</div></section><section id="contact" aria-labelledby="contact-title"><h2 id="contact-title">Kontakt</h2><form id="demo-form"><label for="email">E-Mail</label><input id="email" name="email" type="email" required><button type="submit">Senden</button><span id="form-status" aria-live="polite"></span></form></section></main><script>' + js + '</script></body></html>';

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(html);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html lang="de"><head><title>404</title></head><body><main><h1>404</h1></main></body></html>');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, url: 'http://127.0.0.1:' + server.address().port }));
  });
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

async function waitForChrome(port) {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('J9_LIGHTHOUSE_CHROME_NOT_READY');
}

async function browserChecks(page, baseUrl, device) {
  const pass = {};
  const home = async () => page.goto(baseUrl, { waitUntil: 'networkidle' });
  await home();
  pass.navigation = (await page.locator('nav a').count()) >= 3;
  await page.locator('#mobile-toggle').click();
  pass.mobile_navigation = await page.locator('#mobile-menu').isVisible();
  await page.locator('#primary-cta').click();
  pass.cta = (await page.evaluate(() => location.hash)) === '#contact';
  await page.locator('#email').fill('test@example.com');
  await page.locator('#demo-form button[type="submit"]').click();
  pass.forms = (await page.locator('#form-status').textContent()) === 'Gesendet';
  await page.locator('#nav-features').click();
  pass.anchors = (await page.evaluate(() => location.hash)) === '#features';
  await page.locator('#action-button').click();
  pass.buttons = (await page.locator('#button-status').textContent()) === 'Aktiviert';
  await page.locator('#dialog-open').click();
  pass.dialogs = await page.locator('#demo-dialog').evaluate((el) => el.open === true);
  await page.locator('#dialog-close').click();
  await page.locator('#accordion summary').click();
  pass.accordions = await page.locator('#accordion').evaluate((el) => el.open === true);
  pass.gallery = (await page.locator('.gallery img[alt]').count()) === 2;
  const before = await page.locator('#carousel').getAttribute('data-index');
  await page.locator('#carousel-next').click();
  const after = await page.locator('#carousel').getAttribute('data-index');
  pass.carousel = before !== after;
  pass.video = await page.locator('#demo-video').evaluate((el) => el.controls === true);
  await page.locator('body').press('Tab');
  pass.keyboard_navigation = await page.evaluate(() => {
    const el = document.activeElement;
    return Boolean(el && ['A','BUTTON','INPUT','SUMMARY'].includes(el.tagName));
  });
  pass.focus_states = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  });
  const missing = await page.goto(baseUrl + '/missing-j9-route', { waitUntil: 'domcontentloaded' });
  pass['404'] = missing?.status() === 404;
  await home();
  pass.external_links = await page.locator('#external-link').evaluate((el) => el.target === '_blank' && el.rel.includes('noopener'));
  await page.locator('#contact').scrollIntoViewIfNeeded();
  pass.scroll_behavior = (await page.evaluate(() => scrollY)) > 0;
  pass.sticky_navigation = await page.locator('header').evaluate((el) => getComputedStyle(el).position === 'sticky');
  await page.setViewportSize({ width: device.height, height: device.width });
  const landscapeNoOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  await page.setViewportSize(device);
  pass.orientation_changes = landscapeNoOverflow;
  return pass;
}

const manifest = j9BrowserAccessibilityPerformanceManifest();
assert.equal(manifest.chromium_required, true);
assert.equal(manifest.webkit_recommended, true);
assert.equal(manifest.firefox_profile_dependent, true);
assert.deepEqual(manifest.browser_checks, J9_BROWSER_CHECKS);
assert.deepEqual(manifest.device_matrix, J9_DEVICE_MATRIX);
assert.equal(manifest.accessibility.target, 'WCAG 2.2 AA');
assert.equal(manifest.accessibility.axe_critical_maximum, 0);
assert.equal(manifest.accessibility.axe_serious_maximum, 0);
assert.equal(manifest.accessibility.automated_pass_replaces_human_review, false);
assert.equal(manifest.performance.total_assets_block_above_bytes, 5 * 1024 * 1024);
assert.equal(manifest.performance.javascript_warning_above_bytes, 300 * 1024);

const temp = await mkdtemp(path.join(os.tmpdir(), 'jaguar-j9-'));
let staticServer;
let browser;
let chromeProcess;

try {
  staticServer = await startServer();
  browser = await chromium.launch({ headless: true });
  const browserDevices = {};
  let desktopAxe = null;
  let accessibilityChecks = null;

  for (const deviceName of J9_DEVICE_MATRIX) {
    const viewport = devices[deviceName];
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const checks = await browserChecks(page, staticServer.url, viewport);
    for (const check of J9_BROWSER_CHECKS) assert.equal(checks[check], true, deviceName + ':' + check);

    await page.goto(staticServer.url, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    const critical = axe.violations.filter((v) => v.impact === 'critical');
    const serious = axe.violations.filter((v) => v.impact === 'serious');
    assert.equal(critical.length, 0, deviceName + ':axe critical');
    assert.equal(serious.length, 0, deviceName + ':axe serious');

    if (deviceName === 'DESKTOP') {
      desktopAxe = { critical: critical.length, serious: serious.length };
      await page.keyboard.press('Tab');
      const keyboard = await page.evaluate(() => ['A','BUTTON','INPUT','SUMMARY'].includes(document.activeElement?.tagName));
      const visibleFocus = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      });
      const headingHierarchy = await page.evaluate(() => {
        const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el) => Number(el.tagName.slice(1)));
        return levels[0] === 1 && levels.slice(1).every((level, index) => level - levels[index] <= 1);
      });
      const landmarks = await page.evaluate(() => document.querySelectorAll('header,nav,main').length >= 3);
      const labels = await page.evaluate(() => [...document.querySelectorAll('input,textarea,select')].every((el) => el.id && document.querySelector('label[for="' + el.id + '"]')));
      const altText = await page.evaluate(() => [...document.images].every((img) => img.hasAttribute('alt')));
      const contrast = !axe.violations.some((v) => v.id === 'color-contrast');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reducedMotion = await page.locator('#motion-box').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration) === 0);
      const targetBox = await page.locator('#action-button').boundingBox();
      const touchTarget = Boolean(targetBox && targetBox.height >= 44);
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const zoomBehavior = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
      accessibilityChecks = {
        keyboard_navigation: keyboard,
        visible_focus: visibleFocus,
        heading_hierarchy: headingHierarchy,
        landmarks,
        labels,
        contrast,
        alt_text: altText,
        reduced_motion: reducedMotion,
        touch_target_size: touchTarget,
        zoom_behavior: zoomBehavior
      };
    }

    browserDevices[deviceName] = {
      viewport,
      checks: Object.fromEntries(J9_BROWSER_CHECKS.map((check) => [check, { status: checks[check] ? 'PASS' : 'FAIL', evidence: 'real-chromium' }]))
    };
    await context.close();
  }

  const browserReport = evaluateJ9BrowserMatrix({ profiles: { CHROMIUM: { devices: browserDevices } } });
  assert.equal(browserReport.status, 'PASS');
  assert.equal(browserReport.profiles.CHROMIUM.status, 'PASS');
  assert.ok(browserReport.warnings.some((w) => w.browser === 'WEBKIT'));
  assert.ok(browserReport.warnings.some((w) => w.browser === 'FIREFOX'));

  const missingChromium = evaluateJ9BrowserMatrix({ profiles: {} });
  assert.equal(missingChromium.status, 'FAIL');
  assert.ok(missingChromium.blocking_issues.some((x) => x.code === 'J9_REQUIRED_BROWSER_MISSING'));

  const accessibility = evaluateJ9Accessibility({
    axe: desktopAxe,
    checks: Object.fromEntries(Object.entries(accessibilityChecks).map(([key, value]) => [key, { status: value ? 'PASS' : 'FAIL', evidence: 'real-browser' }]))
  });
  assert.equal(accessibility.status, 'PASS');
  assert.equal(accessibility.state, 'HUMAN_REVIEW_PENDING');
  assert.equal(accessibility.certification_claimed, false);
  assert.equal(accessibility.automated_pass_does_not_replace_human_review, true);

  const debugPort = await reservePort();
  chromeProcess = spawn(chromium.executablePath(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-allow-origins=*',
    '--remote-debugging-port=' + debugPort,
    '--user-data-dir=' + path.join(temp, 'chrome-profile'),
    'about:blank'
  ], { stdio: 'ignore' });
  await waitForChrome(debugPort);

  const { default: lighthouse } = await import('lighthouse');
  const lighthouseResult = await lighthouse(staticServer.url, {
    port: debugPort,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices']
  });
  const lighthouseScores = {
    performance: lighthouseResult.lhr.categories.performance.score,
    accessibility: lighthouseResult.lhr.categories.accessibility.score,
    best_practices: lighthouseResult.lhr.categories['best-practices'].score
  };
  for (const [key, minimum] of Object.entries(J9_LIGHTHOUSE_MINIMUMS)) {
    assert.ok(lighthouseScores[key] >= minimum, key + '=' + lighthouseScores[key]);
  }

  const assets = [
    { id: 'index.html', category: 'other', bytes: Buffer.byteLength(html) },
    { id: 'inline.css', category: 'css', bytes: Buffer.byteLength(css) },
    { id: 'inline.js', category: 'javascript', bytes: Buffer.byteLength(js) }
  ];
  const performance = evaluateJ9Performance({
    assets,
    lighthouse: lighthouseScores,
    category_budgets: {
      css: { maximum_bytes: 150 * 1024 },
      images: { maximum_bytes: 2 * 1024 * 1024 },
      video: { maximum_bytes: 3 * 1024 * 1024 }
    }
  });
  assert.equal(performance.status, 'PASS');
  assert.equal(performance.lighthouse.status, 'PASS');
  assert.equal(performance.field_cwv.status, 'NOT_VERIFIED');
  assert.equal(performance.field_cwv.field_cwv_claimed, false);
  assert.equal(performance.field_cwv.prelaunch_lab_is_not_field_cwv, true);

  const totalBudgetFail = evaluateJ9Performance({
    assets: [{ id: 'huge-video', category: 'video', bytes: J9_PERFORMANCE_BUDGETS.total_assets_bytes + 1 }],
    lighthouse: lighthouseScores
  });
  assert.equal(totalBudgetFail.status, 'FAIL');
  assert.ok(totalBudgetFail.blocking_issues.some((x) => x.code === 'J9_TOTAL_ASSET_BUDGET_EXCEEDED'));

  const jsWarning = evaluateJ9Performance({
    assets: [{ id: 'app.js', category: 'javascript', bytes: J9_PERFORMANCE_BUDGETS.javascript_warning_bytes + 1 }],
    lighthouse: lighthouseScores
  });
  assert.equal(jsWarning.status, 'PASS');
  assert.ok(jsWarning.warnings.some((x) => x.code === 'J9_JAVASCRIPT_BUDGET_WARNING'));

  const fieldPass = evaluateJ9Performance({
    assets,
    lighthouse: lighthouseScores,
    field_cwv: {
      real_field_evidence: true,
      evidence_ref: 'rum:j9-field-fixture',
      percentile: 75,
      lcp_ms: J9_FIELD_CWV_GOOD.lcp_ms,
      inp_ms: J9_FIELD_CWV_GOOD.inp_ms,
      cls: J9_FIELD_CWV_GOOD.cls
    }
  });
  assert.equal(fieldPass.field_cwv.status, 'PASS');
  assert.equal(fieldPass.field_cwv.field_cwv_claimed, true);

  const acceptance = compileJ9Acceptance({
    browser: { profiles: { CHROMIUM: { devices: browserDevices } } },
    accessibility: {
      axe: desktopAxe,
      checks: Object.fromEntries(Object.entries(accessibilityChecks).map(([key, value]) => [key, value]))
    },
    performance: { assets, lighthouse: lighthouseScores }
  });
  assert.equal(acceptance.status, 'PASS');
  assert.equal(acceptance.human_accessibility_review_pending, true);
  assert.equal(acceptance.full_accessibility_accepted, false);
  assert.equal(acceptance.production_deploy, false);
  assert.equal(acceptance.public_launch, false);
  assert.equal(acceptance.dns_change, false);
  assert.equal(acceptance.billing_activation, false);
  assert.equal(acceptance.automatic_paid_activation, false);
  assert.equal(acceptance.external_writes, false);

  console.log(JSON.stringify({
    ok: true,
    suite: 'webfactory-100-j9-browser-accessibility-performance-v2',
    chromium_devices: J9_DEVICE_MATRIX,
    browser_checks: J9_BROWSER_CHECKS.length,
    chromium_required: 'PASS',
    webkit: 'RECOMMENDED_NOT_REQUIRED',
    firefox: 'PROFILE_DEPENDENT',
    axe_critical: desktopAxe.critical,
    axe_serious: desktopAxe.serious,
    accessibility_state: accessibility.state,
    wcag_target: accessibility.target,
    lighthouse: lighthouseScores,
    total_asset_bytes: performance.assets.total_bytes,
    field_cwv_claimed: false,
    production_deploy: false,
    public_launch: false,
    external_writes: false
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (staticServer?.server) await new Promise((resolve) => staticServer.server.close(resolve));
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
  await rm(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
}
