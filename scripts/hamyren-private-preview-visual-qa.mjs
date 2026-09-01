import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDeterministicTestProvider } from '../src/ai-provider-adapters-v1.js';
import { createCustomerProductSurface } from '../src/customer-product/surface-v1.js';

const baseUrl = process.env.HAMYREN_PREVIEW_BASE_URL || 'http://localhost:4173';
const outDir = path.resolve(process.env.HAMYREN_VISUAL_QA_DIR || 'artifacts/hamyren-private-preview-v1');
await fs.mkdir(outDir, { recursive: true });

let inferenceCalls = 0;
const provider = createDeterministicTestProvider({
  id: 'hamyren-private-browser-qa',
  scripted_response() {
    inferenceCalls += 1;
    return {
      answer: 'Use one measurable next step based on the confirmed synthetic business context.',
      recommendations: ['Test one bounded change and measure the result.'],
      follow_up_questions: [],
      memory_candidates: [],
      goal_proposals: [],
      decision_proposals: [],
      evidence_refs: [],
      needs_external_research: false,
      confidence: 0.91
    };
  }
});
const surface = createCustomerProductSurface({ force_synthetic: true, providers: [provider] });

const browser = await chromium.launch({ headless: true });
const report = {
  schema: 'hamyren.private-preview-visual-qa.v2',
  base_url: baseUrl,
  canonical_runtime: '/customer',
  runtime_handler: 'createCustomerProductSurface',
  captures: [],
  external_requests: [],
  console_errors: [],
  desktop: {},
  mobile: {},
  functional: {},
  ok: false
};

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

async function installCanonicalCustomerRuntime(page) {
  await page.route('**/customer**', async (route) => {
    const request = route.request();
    const headers = await request.allHeaders();
    const postData = request.postDataBuffer();
    const init = { method: request.method(), headers };
    if (postData && !['GET', 'HEAD'].includes(request.method())) init.body = postData;
    const response = await surface.handle(new Request(request.url(), init), {});
    assert.ok(response, `Canonical customer runtime did not handle ${request.method()} ${request.url()}`);
    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    await route.fulfill({
      status: response.status,
      headers: responseHeaders,
      body: Buffer.from(await response.arrayBuffer())
    });
  });
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
  await installCanonicalCustomerRuntime(page);
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  return page;
}

async function ask(page, question) {
  await page.locator('#message').fill(question);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/customer/api/chat') && response.request().method() === 'POST');
  await page.locator('#send').click();
  const response = await responsePromise;
  await page.waitForFunction(() => document.querySelector('#chatstatus')?.textContent !== 'Business Context wird geprüft …');
  return response;
}

try {
  {
    const page = await openPage('/index.html', { width: 1440, height: 1000 }, 'dual-site-desktop');
    assert.match(await page.title(), /AURENTARA SYSTEMS/);
    await page.locator('.desktop-nav [data-hamyren-entry]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.desktop-nav [data-hamyren-entry]').getAttribute('href'), './hamyren/index.html');
    await screenshot(page, '01-aurentara-desktop');
    await page.locator('.desktop-nav [data-hamyren-entry]').click();
    await page.waitForURL('**/hamyren/index.html');
    assert.equal(await page.title(), 'HAMYREN · Your Personal Business AI · Private Preview');
    assert.equal(await page.locator('[data-canonical-pricing-bridge]').count(), 1, 'HAMYREN overview must replace duplicate pricing with canonical bridge');
    assert.doesNotMatch(await page.locator('#plans').innerText(), /€19,90|€24,90|400 Compute|500 Compute/);
    await assertNoHorizontalOverflow(page, 'hamyren-overview-desktop');
    await screenshot(page, '02-hamyren-overview-desktop');

    const experienceLink = page.locator('a[href="./experience.html"]').first();
    await experienceLink.click();
    await page.waitForURL('**/hamyren/experience.html');
    assert.equal(await page.title(), 'HAMYREN · Test Experience · Private Preview');
    assert.equal(await page.locator('[data-canonical-customer-surface]').first().getAttribute('href'), '/customer');
    assert.match(await page.locator('body').innerText(), /No duplicate trial engine/i);
    await screenshot(page, '03-hamyren-test-bridge-desktop');

    await page.locator('[data-canonical-customer-surface]').first().click();
    await page.waitForURL('**/customer');
    assert.equal(await page.title(), 'HAMYREN · Your Personal Business AI');
    await page.locator('#trialremaining').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#trialremaining').textContent(), '5');
    report.functional.initial_remaining = 5;
    await assertNoHorizontalOverflow(page, 'canonical-customer-desktop');
    await screenshot(page, '04-canonical-hamyren-desktop');

    const callsBeforeBlocked = inferenceCalls;
    await ask(page, 'What is the current Mindestlohn and what must I pay an employee?');
    assert.equal(await page.locator('#trialremaining').textContent(), '5');
    assert.equal(inferenceCalls, callsBeforeBlocked);
    assert.match(await page.locator('#chatstatus').textContent(), /research|evidence|required/i);
    report.functional.failed_turn_consumed_free_question = false;

    const remaining = [4, 3, 2, 1, 0];
    for (let index = 0; index < remaining.length; index += 1) {
      const response = await ask(page, `Synthetic low-risk business question ${index + 1}: what is one measurable next step?`);
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('#trialremaining').textContent(), String(remaining[index]));
    }
    assert.equal(inferenceCalls, callsBeforeBlocked + 5);
    assert.equal(await page.locator('#accounthandoff').isVisible(), true);
    assert.equal(await page.locator('#composer').isVisible(), false);
    assert.match(await page.locator('#chatlog').innerText(), /Use one measurable next step/);
    report.functional.fifth_answer_delivered = true;
    report.functional.remaining_after_fifth = 0;
    await screenshot(page, '05-account-handoff-desktop');

    const sixth = await page.evaluate(async () => {
      const response = await fetch('/customer/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'sixth turn must not execute' }) });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(sixth.status, 409);
    assert.equal(sixth.body.error, 'HAMYREN_FREE_QUESTION_TRIAL_COMPLETE');
    assert.equal(sixth.body.remaining_free_questions, 0);
    assert.equal(sixth.body.next_step, 'ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF');
    assert.equal(inferenceCalls, callsBeforeBlocked + 5);
    report.functional.sixth_turn_blocked = true;

    await page.locator('#accountgate').click();
    await page.waitForFunction(() => document.querySelector('#accountstatus')?.textContent?.trim().length > 0);
    assert.match(await page.locator('#accountstatus').textContent(), /Account-Core erkannt|Auth bleibt/i);
    report.functional.account_handoff_existing_core = true;

    for (const view of ['memory', 'goals', 'decisions']) {
      await page.locator(`#nav [data-view="${view}"]`).click();
      await page.locator(`#view-${view}`).waitFor({ state: 'visible' });
      assert.equal(await page.locator(`#view-${view}`).isVisible(), true);
    }
    report.functional.memory_goals_decisions = true;

    await page.locator('#nav [data-view="usage"]').click();
    await page.locator('#plans .plan').first().waitFor({ state: 'visible' });
    const usageText = await page.locator('#view-usage').innerText();
    assert.match(usageText, /Free · Starter/);
    assert.match(usageText, /20 Compute Units/);
    assert.match(usageText, /Personal Business AI · Founder/);
    assert.match(usageText, /€19,90/);
    assert.match(usageText, /400 Compute Units/);
    assert.match(usageText, /Guest Trial und monatliches Entitlement sind getrennte Limits/);
    assert.match(usageText, /5 \/ 5/);
    assert.match(usageText, /5 \/ 20/);
    report.functional.pricing_from_runtime_catalog = true;
    report.functional.trial_vs_compute_separation = true;
    await screenshot(page, '06-usage-pricing-desktop');

    const founderUpgrade = page.locator('#plans [data-upgrade="personal-business-ai-founder-v1"]');
    await founderUpgrade.click();
    await page.waitForFunction(() => document.querySelector('#accountstatus')?.textContent?.includes('Payment Provider'));
    assert.match(await page.locator('#accountstatus').textContent(), /Payment Provider \/ Checkout ist nicht aktiviert/);
    report.functional.upgrade_handoff_closed = true;

    await page.locator('[data-return-aurentara]').click();
    await page.waitForURL(`${baseUrl}/`);
    assert.match(await page.title(), /AURENTARA SYSTEMS/);
    report.desktop.dual_site_round_trip = true;
    await page.close();
  }

  {
    const page = await openPage('/index.html', { width: 390, height: 844 }, 'dual-site-mobile');
    await assertNoHorizontalOverflow(page, 'aurentara-mobile');
    await page.locator('[data-menu-button]').click();
    await page.locator('[data-mobile-menu] [data-hamyren-entry]').waitFor({ state: 'visible' });
    await screenshot(page, '07-aurentara-mobile-menu');
    await page.locator('[data-mobile-menu] [data-hamyren-entry]').click();
    await page.waitForURL('**/hamyren/index.html');
    await assertNoHorizontalOverflow(page, 'hamyren-overview-mobile');
    await screenshot(page, '08-hamyren-overview-mobile');

    await page.locator('a[href="./experience.html"]').first().click();
    await page.waitForURL('**/hamyren/experience.html');
    await assertNoHorizontalOverflow(page, 'hamyren-bridge-mobile');
    await page.locator('[data-canonical-customer-surface]').first().click();
    await page.waitForURL('**/customer');
    await page.locator('#trialremaining').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#trialremaining').textContent(), '5');
    await assertNoHorizontalOverflow(page, 'canonical-customer-mobile');
    await page.locator('#nav [data-view="usage"]').click();
    await page.locator('#plans .plan').first().waitFor({ state: 'visible' });
    await assertNoHorizontalOverflow(page, 'canonical-customer-mobile-usage');
    report.mobile.navigation = true;
    report.mobile.canonical_product_surface = true;
    await screenshot(page, '09-canonical-hamyren-mobile');
    await page.close();
  }

  assert.deepEqual(report.external_requests, [], 'Private QA made external browser requests');
  assert.deepEqual(report.console_errors, [], 'Browser console/page errors detected');
  assert.equal(inferenceCalls, 5, 'Only the five successful desktop trial questions may invoke deterministic inference');
  report.functional.paid_provider_calls = 0;
  report.functional.real_customer_data = false;
  report.functional.public_deploy = false;
  report.functional.additional_variable_cost_eur = 0;
  report.ok = true;
} finally {
  await browser.close();
  await fs.writeFile(path.join(outDir, 'visual-qa-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`HAMYREN private dual-site visual QA: ${report.ok ? 'PASS' : 'FAIL'}`);
console.log(JSON.stringify(report, null, 2));
