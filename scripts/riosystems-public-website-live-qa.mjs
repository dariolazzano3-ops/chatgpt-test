#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.RIOSYSTEMS_PREVIEW_URL;
assert.ok(url?.startsWith('https://'), 'RIOSYSTEMS_PREVIEW_URL required');
await mkdir('artifacts/riosystems-public-website-v1', { recursive: true });
const browser = await chromium.launch({ headless: true });
const sizes = [['desktop-large',1440,1000],['desktop',1200,900],['tablet-wide',1024,900],['tablet',768,900],['mobile-large',430,900],['mobile',390,844],['mobile-375',375,812],['mobile-small',320,760]];
for (const [name,width,height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.ok(response?.ok(), `${name}: live page response is not OK`);
  assert.match(await page.title(), /RIOSYSTEMS/, `${name}: title missing`);
  await page.locator('h1').waitFor({ state: 'visible' });
  assert.ok((await page.locator('h1').innerText()).includes('BUSINESS.'), `${name}: hero copy missing`);
  assert.ok(await page.getByRole('link', { name: /Projekt starten/i }).first().isVisible(), `${name}: primary CTA not visible`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `artifacts/riosystems-public-website-v1/${name}.png`, fullPage: true });
  await page.close();
}
const motionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await motionPage.emulateMedia({ reducedMotion: 'reduce' });
await motionPage.goto(url, { waitUntil: 'networkidle' });
assert.equal(await motionPage.locator('.reveal').first().evaluate((el) => getComputedStyle(el).opacity), '1');
await motionPage.getByRole('button', { name: /Projekt starten/i }).click();
await motionPage.locator('dialog[open]').waitFor();
assert.ok(await motionPage.getByText(/keine Daten an einen externen Provider/i).isVisible(), 'staging form safety note missing');
await motionPage.close();
await browser.close();
console.log('RIOSYSTEMS Public Website live responsive QA: PASS');
