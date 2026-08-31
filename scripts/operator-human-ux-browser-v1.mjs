import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8794;
const origin = `http://127.0.0.1:${port}`;
const wranglerCli = 'node_modules/wrangler/bin/wrangler.js';
const child = spawn(process.execPath, [
  wranglerCli, 'dev', '--env', 'staging', '--port', String(port),
  '--var', 'RIOSYSTEMS_ENVIRONMENT:local',
  '--var', 'RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var', 'RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var', 'RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local'
], { cwd: process.cwd(), env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';
let childExit = null;
child.stdout.on('data', chunk => { output += chunk.toString(); });
child.stderr.on('data', chunk => { output += chunk.toString(); });
child.once('exit', (code, signal) => { childExit = { code, signal }; });

async function waitForWorker(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (childExit) throw new Error(`local Worker exited: ${JSON.stringify(childExit)}\n${output}`);
    try {
      const response = await fetch(`${origin}/operator`, { signal: AbortSignal.timeout(1500) });
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw new Error(`local Worker did not become ready\n${output}`);
}

let browser;
const pageErrors = [];
const checkedViews = [];
const visibleLabel = label => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');

async function go(page, id, title) {
  await page.locator(`.nav button[data-goto="${id}"]`).click();
  await page.waitForFunction(expected => document.getElementById('title')?.textContent?.trim() === expected, title);
  assert.equal(await page.locator(`#${id}`).isVisible(), true, `${id} must be visible`);
  checkedViews.push(id);
}

try {
  await waitForWorker();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`${origin}/operator`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.humanUxSeal === 'reality-fix-v1' && !document.body.classList.contains('loading'));
  await page.waitForTimeout(500);

  assert.match(await page.locator('.brand').innerText(), /AURENTARA SYSTEMS/);
  assert.equal(await page.locator('#title').innerText(), 'HQ');
  assert.match(await page.locator('.top .subtitle').innerText(), /Betriebszustand/);
  assert.equal(await page.locator('.nav button[data-goto="projects"] span:last-child').innerText(), 'Projekte');
  assert.equal(await page.locator('.nav button[data-goto="approvals"] span:last-child').innerText(), 'Freigaben');
  assert.equal(await page.locator('.nav button[data-goto="providers"] span:last-child').innerText(), 'Provider');
  assert.equal(await page.locator('.nav button[data-goto="health"] span:last-child').innerText(), 'Systemstatus');
  assert.equal(await page.locator('.nav button[data-goto="settings"] span:last-child').innerText(), 'Richtlinien');
  checkedViews.push('hq');

  await go(page, 'projects', 'Projekte');
  assert.match(await page.locator('#projects').innerText(), /Projektportfolio/);
  const createDetails = page.locator('#projects details.human-create');
  await createDetails.waitFor();
  assert.equal(await createDetails.getAttribute('open'), null, 'project create must be collapsed by default');
  assert.equal(await page.locator('#refresh').isVisible(), false, 'refresh must not dominate Projects');
  const projectButtons = page.locator('#projects .project-open');
  assert.ok(await projectButtons.count() > 0, 'at least one project detail must exist');
  await projectButtons.first().click();
  await page.waitForFunction(() => {
    const root = document.getElementById('project-detail');
    return Boolean(root?.querySelector('[data-human-project-priority]') && root.textContent?.includes('Projektstatus') && root.textContent?.includes('Nächste Aktion'));
  });
  const projectText = await page.locator('#project-detail').innerText();
  for (const label of ['Projektstatus','Aktueller Zustand','Capabilities','Ergebnisse','Nächste Aktion']) assert.match(projectText, visibleLabel(label));
  const projectRaw = page.locator('#project-detail details.human-raw');
  if (await projectRaw.count()) {
    assert.equal(await projectRaw.first().getAttribute('open'), null, 'project raw evidence must be secondary');
    const humanDelivery = page.locator('#project-detail [data-human-project-delivery]');
    assert.ok(await humanDelivery.count() > 0, 'project delivery must have a human summary before raw evidence');
  }
  checkedViews.push('project-detail');

  await go(page, 'mission', 'Mission Studio');
  assert.match(await page.locator('#mission').innerText(), /Neue Mission|Mission/i);
  const missionText = page.locator('#mission textarea[name="mission_text"]');
  await missionText.fill('Erstelle einen rein synthetischen internen Testplan für Website und CRM ohne Production und ohne externe Writes.');
  const industry = page.locator('#mission input[name="industry"]');
  if (await industry.count()) await industry.fill('synthetic');
  const outcomes = page.locator('#mission input[name="requested_outcomes"]');
  if (await outcomes.count()) await outcomes.fill('Website, CRM');
  await page.locator('#mission-form button[type="submit"]').click();
  await page.waitForFunction(() => document.getElementById('plan-review')?.textContent?.includes('Plan Review'));
  assert.match(await page.locator('#plan-review').innerText(), /Freigabe erforderlich/i);
  assert.match(await page.locator('#plan-review').innerText(), /0,00\s?€|0\s?€/);
  checkedViews.push('mission-plan');

  await go(page, 'approvals', 'Freigaben');
  const approvalsText = await page.locator('#approvals').innerText();
  assert.ok(/Keine Freigaben erforderlich|Freigeben|Ablehnen|Approve|Reject/i.test(approvalsText), 'approvals must be actionable or compact all-clear');

  await go(page, 'factories', 'Factories');
  await page.waitForFunction(() => document.querySelectorAll('#factories .human-card').length > 0);
  const factoryText = await page.locator('#factories').innerText();
  assert.ok(/EXISTS|STAGING VERIFIED|READY|PLANNED|NOT VERIFIED|BLOCKED/i.test(factoryText));
  assert.ok(/Noch kein verifizierter Run|Runs/i.test(factoryText));

  await go(page, 'providers', 'Provider');
  await page.waitForFunction(() => document.querySelectorAll('#providers .human-card').length >= 5);
  const providerText = await page.locator('#providers').innerText();
  for (const provider of ['Cloudflare','Supabase','PostHog','OpenAI','Workers AI']) assert.match(providerText, visibleLabel(provider));
  assert.ok(/AVAILABLE|STAGING ONLY|CREDENTIAL REQUIRED|BUDGET GATE|PERMISSION GATE|UNAVAILABLE|UNKNOWN/i.test(providerText));
  assert.equal(await page.locator('#refresh').isVisible(), true, 'refresh may remain visible for provider verification');

  await go(page, 'costs', 'Kosten');
  const costLabels = (await page.locator('#costs .metric .k').allInnerTexts()).map(x => x.toLocaleLowerCase('de-DE'));
  for (const label of ['Ausgegeben','Reserviert','Geschätzt','Verbleibend']) assert.ok(costLabels.includes(label.toLocaleLowerCase('de-DE')), `${label} missing`);
  assert.equal(costLabels.some(label => ['spent','reserved','estimated','remaining'].includes(label)), false, 'cost UI must not mix primary English labels');

  await go(page, 'deliveries', 'Ergebnisse');
  const deliveriesText = await page.locator('#deliveries').innerText();
  const humanDeliveries = page.locator('#deliveries [data-human-unified-delivery]');
  assert.ok(await humanDeliveries.count() > 0, `human Unified Delivery missing\n${deliveriesText}`);
  const firstDelivery = humanDeliveries.first();
  for (const label of ['Projekt','Mission','Status','Finaler Delivery-Status','Qualität','Factory','Capability','Provider','Kosten','Umgebung','Production','External Writes','Execution Evidence','Wichtige Annahmen','Abgelehnte / ungenutzte Capabilities','Delivery / Result Reference']) assert.match(await firstDelivery.innerText(), visibleLabel(label));
  const rawEvidence = firstDelivery.locator('details.human-raw');
  assert.equal(await rawEvidence.getAttribute('open'), null, 'raw evidence must be collapsed by default');
  assert.match(await rawEvidence.locator('summary').innerText(), /Technische Details \/ Raw Evidence/i);

  await go(page, 'health', 'Systemstatus');
  const healthText = await page.locator('#health').innerText();
  for (const label of ['Overall System State','Runtime Health','Staging Verification','Activation Readiness','Production State']) assert.match(healthText, visibleLabel(label));
  assert.match(healthText, /DISABLED/i);
  assert.equal(await page.locator('#refresh').isVisible(), true);

  await go(page, 'audit', 'Aktivität');
  await page.waitForTimeout(150);
  const auditCodes = page.locator('#audit .human-meta code');
  if (await auditCodes.count()) {
    const key = await auditCodes.first().innerText();
    const parent = auditCodes.first().locator('xpath=../..');
    assert.notEqual((await parent.innerText()).split('\n')[0].trim(), key, 'technical audit key must not be primary title');
  }

  await go(page, 'settings', 'Richtlinien');
  const policyText = await page.locator('#settings').innerText();
  assert.doesNotMatch(policyText, /NOT CONFIGURED/);
  assert.ok(/Nicht konfiguriert|Monatsbudget/i.test(policyText));

  await go(page, 'hq', 'HQ');
  assert.match(await page.locator('#hq').innerText(), /Aktive Vorgänge|System|Ergebnisse|Letzte Aktivität/i);

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('\n')}`);
  console.log(JSON.stringify({
    ok: true,
    suite: 'operator-human-ux-browser-v1',
    mode: 'local_worker_browser',
    browser: 'system_chrome',
    flow: checkedViews,
    synthetic_plan_review: 'verified_without_execution',
    provider_calls: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (!childExit) child.kill('SIGTERM');
  await new Promise(resolve => {
    if (childExit) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
