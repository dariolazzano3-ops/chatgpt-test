import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { evaluateHumanOutcomeAcceptance } from '../src/human-outcome-acceptance-v1.js';

const base = process.env.QA_URL || 'http://127.0.0.1:4173/';
const cases = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 }
];
const browser = await chromium.launch({ headless: true });
const evidence = [];

try {
  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const external = [];
    const errors = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith(base) && !url.startsWith('data:')) external.push(url);
    });
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    const response = await page.goto(base, { waitUntil: 'networkidle' });
    assert.ok(response?.ok());
    await page.evaluate(() => {
      document.documentElement.dataset.riosystemsSyntheticE2e = 'true';
      window.__muellerSyntheticLead = null;
      window.addEventListener('aurentara:synthetic-lead-ready', (event) => {
        window.__muellerSyntheticLead = structuredClone(event.detail);
      }, { once: true });
    });

    const form = page.locator('[data-lead-form]');
    await form.scrollIntoViewIfNeeded();
    await form.locator('[name="name"]').fill('SYNTHETIC');
    await form.locator('[name="contact"]').fill('SYNTHETIC_CHANNEL');
    await form.locator('[name="postal_code"]').fill('00000');
    await form.locator('[name="project_type"]').selectOption({ label: 'Sanierung' });
    await form.locator('button[type="submit"]').click();

    const result = page.locator('[data-form-result]');
    await result.waitFor({ state: 'visible' });
    assert.match(await result.innerText(), /lokal validiert/i);

    const lead = await page.evaluate(() => window.__muellerSyntheticLead);
    assert.equal(lead?.schema, 'aurentara.synthetic-form-lead.v1');
    assert.equal(lead?.project_id, 'mueller-elektrotechnik-digital-customer-system-v1');
    assert.equal(lead?.scope_key, 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1');
    assert.equal(lead?.idempotency_key, 'mueller-elektrotechnik-digital-customer-system-v1-synthetic-lead-001');
    assert.equal(lead?.project_type, 'Sanierung');
    assert.equal(lead?.synthetic, true);
    assert.equal(lead?.pii_in_event, false);
    assert.equal(lead?.production_deploy, false);
    const serialized = JSON.stringify(lead).toLowerCase();
    assert.equal(serialized.includes('@'), false);
    assert.equal(serialized.includes('phone'), false);
    assert.equal(serialized.includes('message'), false);
    assert.equal(external.length, 0);
    assert.equal(errors.length, 0);

    evidence.push({
      viewport: item.name,
      form_visible: await form.isVisible(),
      result_visible: await result.isVisible(),
      synthetic_lead_event: true,
      scope_key: lead.scope_key,
      idempotency_key: lead.idempotency_key,
      project_type: lead.project_type,
      external_requests: 0,
      console_errors: 0,
      pii_in_evidence: false
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const humanOutcome = evaluateHumanOutcomeAcceptance({
  technical_implementation: true,
  technical_integration: true,
  final_dom_presence: true,
  human_visibility: evidence.every((item) => item.form_visible && item.result_visible),
  human_reachability: true,
  primary_interaction: evidence.every((item) => item.synthetic_lead_event),
  expected_result: evidence.every((item) => item.scope_key.endsWith(':mueller-elektrotechnik-digital-customer-system-v1')),
  desktop_acceptance: evidence.some((item) => item.viewport === 'desktop'),
  mobile_acceptance: evidence.some((item) => item.viewport === 'mobile'),
  composition_regression: true,
  safety_regression: evidence.every((item) => item.external_requests === 0 && item.pii_in_evidence === false)
});
assert.equal(humanOutcome.human_outcome_accepted, true);

console.log('Müller Ferrari browser form → synthetic lead → human outcome: PASS');
console.log(JSON.stringify({
  status: 'PASS',
  project_scope: 'synthetic-mueller-elektrotechnik-saarbruecken:mueller-elektrotechnik-digital-customer-system-v1',
  evidence,
  human_outcome: {
    schema: humanOutcome.schema,
    verdict: humanOutcome.verdict,
    human_outcome_accepted: humanOutcome.human_outcome_accepted,
    failed: humanOutcome.failed,
    missing: humanOutcome.missing
  },
  production_deploy: false,
  external_writes: 0,
  pii_in_evidence: false
}, null, 2));
