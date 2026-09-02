#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.RIOSYSTEMS_PREVIEW_URL;
const privateLocal = url?.startsWith('http://127.0.0.1:') || url?.startsWith('http://localhost:');
assert.ok(url?.startsWith('https://') || privateLocal, 'RIOSYSTEMS_PREVIEW_URL must be HTTPS or private localhost');
await mkdir('artifacts/riosystems-public-website-v1', { recursive: true });
const browser = await chromium.launch({ headless: true });
const sizes = [['desktop-large',1440,1000],['desktop',1200,900],['tablet-wide',1024,900],['tablet',768,900],['mobile-large',430,900],['mobile',390,844],['mobile-375',375,812],['mobile-small',320,760]];

async function revealWholePage(page) {
  const reveals = page.locator('.reveal');
  const count = await reveals.count();
  for (let index = 0; index < count; index += 1) {
    await reveals.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(55);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(160);
}

for (const [name,width,height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.ok(response?.ok(), `${name}: page response is not OK`);
  assert.match(await page.title(), /AURENTARA SYSTEMS/, `${name}: operative brand missing from title`);
  await page.locator('h1').waitFor({ state: 'visible' });
  assert.ok((await page.locator('h1').innerText()).includes('BUSINESS.'), `${name}: hero copy missing`);
  assert.ok(await page.locator('.hero').getByRole('link', { name: /Projekt starten/i }).isVisible(), `${name}: primary CTA not visible`);
  assert.equal(await page.locator('select[data-locale]').count(), 0, `${name}: unfinished locale UI is exposed`);
  assert.ok(await page.locator('#hamyren').count(), `${name}: HAMYREN homepage section missing`);
  assert.ok(await page.locator('#about').count(), `${name}: AURENTARA about section missing`);

  await revealWholePage(page);
  const hiddenRevealCount = await page.locator('.reveal:not(.is-visible)').count();
  assert.equal(hiddenRevealCount, 0, `${name}: ${hiddenRevealCount} reveal blocks remained hidden after traversal`);
  assert.ok(await page.locator('#project').isVisible(), `${name}: contact/start section missing`);
  assert.ok(await page.locator('footer').isVisible(), `${name}: footer missing`);
  await page.screenshot({ path: `artifacts/riosystems-public-website-v1/${name}.png`, fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${name}: horizontal overflow ${overflow}px`);

  if (width <= 767) {
    const menuButton = page.locator('[data-menu-button]');
    assert.ok(await menuButton.isVisible(), `${name}: mobile menu button missing`);
    await menuButton.click();
    await page.locator('#mobile-menu').waitFor({ state: 'visible' });
    assert.equal(await menuButton.getAttribute('aria-expanded'), 'true', `${name}: mobile menu did not open`);
    assert.ok(await page.locator('#mobile-menu a[href="#hamyren"]').isVisible(), `${name}: mobile HAMYREN entry missing`);
    await menuButton.click();
    await page.locator('#mobile-menu').waitFor({ state: 'hidden' });
    assert.equal(await menuButton.getAttribute('aria-expanded'), 'false', `${name}: mobile menu did not close`);
  }

  await page.close();
}

const journeyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await journeyPage.goto(url, { waitUntil: 'networkidle' });
const hamyrenHref = await journeyPage.getByRole('link', { name: /HAMYREN kennenlernen/i }).getAttribute('href');
assert.equal(hamyrenHref, './hamyren/index.html', 'HAMYREN overview bridge changed');
const testHref = await journeyPage.getByRole('link', { name: /5 Fragen testen/i }).getAttribute('href');
assert.equal(testHref, './hamyren/experience.html', 'HAMYREN test bridge changed');
const hamyrenResponse = await journeyPage.goto(new URL('hamyren/index.html', url).href, { waitUntil: 'networkidle' });
assert.ok(hamyrenResponse?.ok(), 'HAMYREN overview did not load');
assert.match(await journeyPage.title(), /HAMYREN/i, 'HAMYREN product identity missing');
assert.ok(await journeyPage.getByRole('link', { name: /AURENTARA/i }).first().isVisible(), 'HAMYREN return path missing');
await journeyPage.close();

const motionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await motionPage.emulateMedia({ reducedMotion: 'reduce' });
await motionPage.goto(url, { waitUntil: 'networkidle' });
assert.equal(await motionPage.locator('.reveal').first().evaluate((el) => getComputedStyle(el).opacity), '1');
await motionPage.getByRole('button', { name: /Projekt starten/i }).click();
await motionPage.locator('dialog[open]').waitFor();
assert.ok(await motionPage.getByText(/keine Daten an einen externen Provider/i).isVisible(), 'staging form safety note missing');
await motionPage.close();
await browser.close();
console.log('AURENTARA SYSTEMS Public Website private responsive QA: PASS');
