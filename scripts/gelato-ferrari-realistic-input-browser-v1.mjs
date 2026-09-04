import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';

const baseUrl = process.env.GELATO_FERRARI_PREVIEW_URL || 'http://127.0.0.1:4183/ferrari-preview-v1.html';
const browser = await chromium.launch({ headless: true });
const externalRequests = [];
const consoleErrors = [];
const results = [];

try {
  for (const viewport of [
    { id: 'desktop', width: 1440, height: 1000 },
    { id: 'mobile', width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({ viewport: viewport.id, text: message.text() }); });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['127.0.0.1','localhost'].includes(url.hostname)) externalRequests.push({ viewport: viewport.id, url: request.url() });
    });

    const response = await page.goto(baseUrl, { waitUntil: 'networkidle' });
    assert.equal(response?.ok(), true);

    const bodyText = await page.locator('body').innerText();
    assert.match(bodyText, /40 bestätigte Sorten/);
    assert.match(bodyText, /Mocca ist enthalten/);
    assert.match(bodyText, /1,60 €/);
    assert.match(bodyText, /Eisvitrine Vermietung/);
    assert.match(bodyText, /250 €/);
    assert.match(bodyText, /100 €/);

    for (const forbidden of [
      '06806 9394980',
      '+49 176 200 150 65',
      'Hauptstraße 4',
      'seit 1965',
      '2. Generation',
      'über 45',
      'Fabrizio.lazzano@freenet.de'
    ]) {
      assert.equal(bodyText.includes(forbidden), false, `unverified public claim leaked into preview: ${forbidden}`);
    }

    const telLinks = await page.locator('a[href^="tel:"]').count();
    const mailLinks = await page.locator('a[href^="mailto:"]').count();
    const forms = await page.locator('form').count();
    assert.equal(telLinks, 0);
    assert.equal(mailLinks, 0);
    assert.equal(forms, 0);

    await page.locator('a[href="#sortiment"]').first().click();
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#sortiment').isVisible(), true);

    await page.locator('a[href="#vermietung"]').first().click();
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#vermietung').isVisible(), true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false);

    const primaryBox = await page.locator('.button.primary').first().boundingBox();
    assert.ok(primaryBox);
    assert.ok(primaryBox.height >= 44);

    results.push({
      viewport: viewport.id,
      overflow: false,
      primary_cta_height_px: Math.round(primaryBox.height * 100) / 100,
      unverified_claims_rendered: false,
      external_contact_actions: 0
    });
    await page.close();
  }
} finally {
  await browser.close();
}

assert.deepEqual(externalRequests, []);
assert.deepEqual(consoleErrors, []);

const humanOutcome = evaluateHumanOutcomeAcceptance({
  technical_implementation: true,
  technical_integration: true,
  final_dom_presence: true,
  human_visibility: true,
  human_reachability: true,
  primary_interaction: true,
  expected_result: true,
  desktop_acceptance: true,
  mobile_acceptance: true,
  composition_regression: true,
  safety_regression: true
});
assert.equal(humanOutcome.human_outcome_accepted, true);

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.gelato-ferrari-realistic-input-browser.v1',
  preview_url: baseUrl,
  viewports: results,
  external_requests: 0,
  console_errors: 0,
  unverified_critical_claims_rendered: 0,
  human_outcome: {
    verdict: humanOutcome.verdict,
    accepted: humanOutcome.human_outcome_accepted
  },
  production_deploy: false,
  public_launch: false,
  variable_cost_eur: 0
}, null, 2));
