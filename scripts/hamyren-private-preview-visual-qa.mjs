import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.HAMYREN_PREVIEW_BASE_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve(process.env.HAMYREN_VISUAL_QA_DIR || 'artifacts/hamyren-private-preview-v1');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { schema: 'hamyren.private-preview-visual-qa.v1', base_url: baseUrl, captures: [], external_requests: [], console_errors: [], ok: false };

function attachGuards(page, label) {
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) report.external_requests.push({ label, url: request.url() });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') report.console_errors.push({ label, text: message.text() });
  });
  page.on('pageerror', (error) => report.console_errors.push({ label, text: error.message }));
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `${label}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.width}`);
}

async function screenshot(page, name, fullPage = true) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  report.captures.push({ name, file: path.relative(process.cwd(), file) });
}

async function openPage(pathname, viewport, label) {
  const page = await browser.newPage({ viewport });
  attachGuards(page, label);
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  return page;
}

try {
  {
    const page = await openPage('/hamyren/index.html', { width: 1440, height: 1100 }, 'product-desktop');
    assert.equal(await page.title(), 'HAMYREN · Your Personal Business AI · Private Preview');
    await assertNoHorizontalOverflow(page, 'product-desktop');
    await screenshot(page, '01-product-desktop');
    await page.close();
  }

  {
    const page = await openPage('/hamyren/index.html', { width: 390, height: 844 }, 'product-mobile');
    await assertNoHorizontalOverflow(page, 'product-mobile');
    await screenshot(page, '02-product-mobile');
    await page.close();
  }

  {
    const page = await openPage('/hamyren/experience.html', { width: 1440, height: 1000 }, 'experience-home-desktop');
    assert.equal(await page.title(), 'HAMYREN · Product Experience · Private Preview');
    await assertNoHorizontalOverflow(page, 'experience-home-desktop');
    await screenshot(page, '03-experience-home-desktop');

    await page.locator('[data-product-nav] [data-view-target="ask"]').click();
    await page.locator('[data-fill-synthetic]').click();
    await page.locator('[data-intake-form] button[type="submit"]').click();
    await page.locator('[data-question-panel]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-context-business]').first().textContent(), 'Studio Nord');
    await screenshot(page, '04-experience-question-0-desktop');

    const questions = [
      'Was wäre für mein aktuelles Ziel der sinnvollste erste Schritt?',
      'Welche Schwachstelle sollte ich zuerst prüfen?',
      'Wie würde ich daraus einen klaren Prozess machen?',
      'Was sollte ich als Nächstes messen?',
      'Welche Entscheidung sollte ich danach bewusst festhalten?'
    ];
    for (const question of questions) {
      await page.locator('[data-question-form] textarea').fill(question);
      await page.locator('[data-question-form] button[type="submit"]').click();
    }
    assert.equal(await page.locator('[data-question-used]').textContent(), '5');
    await page.locator('[data-handoff]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-account-gate]').isDisabled(), true);
    await screenshot(page, '05-experience-handoff-desktop');

    const checks = page.locator('[data-eligibility]');
    for (let index = 0; index < await checks.count(); index += 1) await checks.nth(index).check();
    assert.equal(await page.locator('[data-account-gate]').isEnabled(), true);

    await page.locator('[data-product-nav] [data-view-target="usage"]').click();
    assert.equal(await page.locator('[data-usage-questions]').textContent(), '5');
    await screenshot(page, '06-experience-usage-desktop');

    await page.locator('[data-product-nav] [data-view-target="privacy"]').click();
    await screenshot(page, '07-experience-privacy-desktop');
    await assertNoHorizontalOverflow(page, 'experience-privacy-desktop');
    await page.close();
  }

  {
    const page = await openPage('/hamyren/experience.html', { width: 390, height: 844 }, 'experience-mobile');
    await assertNoHorizontalOverflow(page, 'experience-mobile-home');
    await page.locator('[data-load-synthetic]').click();
    await page.locator('[data-question-panel]').waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(page, 'experience-mobile-question');
    await screenshot(page, '08-experience-question-mobile');
    await page.close();
  }

  assert.deepEqual(report.external_requests, [], 'Private preview made external browser requests');
  assert.deepEqual(report.console_errors, [], 'Browser console/page errors detected');
  report.ok = true;
} finally {
  await browser.close();
  await fs.writeFile(path.join(outDir, 'visual-qa-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`HAMYREN private preview visual QA: ${report.ok ? 'PASS' : 'FAIL'}`);
console.log(JSON.stringify(report, null, 2));
