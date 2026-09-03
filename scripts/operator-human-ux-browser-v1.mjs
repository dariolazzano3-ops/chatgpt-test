import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { AURENTARA_WEBSITE_SCOPE } from '../src/operator-project-workspace-v1.js';

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
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
child.once('exit', (code, signal) => { childExit = { code, signal }; });

async function waitForWorker(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (childExit) throw new Error(`local Worker exited: ${JSON.stringify(childExit)}\n${output}`);
    try {
      const response = await fetch(`${origin}/operator`, { signal: AbortSignal.timeout(1500) });
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`local Worker did not become ready\n${output}`);
}

let browser;
const pageErrors = [];
const workspaceErrors = [];
const checkedViews = [];
const visibleLabel = (label) => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

async function go(page, id, title) {
  const nav = page.locator(`.nav button[data-goto="${id}"]`);
  if (await nav.count()) await nav.first().click();
  else await page.locator(`[data-goto="${id}"]`).first().click();
  await page.waitForFunction((expected) => document.getElementById('title')?.textContent?.trim() === expected, title);
  assert.equal(await page.locator(`#${id}`).isVisible(), true, `${id} must be visible`);
  checkedViews.push(id);
}

try {
  await waitForWorker();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(`${origin}/operator`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.humanUxSeal === 'reality-fix-v1' && !document.body.classList.contains('loading'));
  await page.waitForTimeout(400);

  assert.match(await page.locator('.brand').innerText(), /AURENTARA SYSTEMS/);
  assert.equal(await page.locator('#title').innerText(), 'HQ');
  assert.match(await page.locator('.top .subtitle').innerText(), /Betriebszustand/);
  for (const [id, label] of [['projects', 'Projekte'], ['approvals', 'Freigaben'], ['providers', 'Provider'], ['health', 'Systemstatus'], ['settings', 'Richtlinien']]) {
    assert.equal(await page.locator(`.nav button[data-goto="${id}"] span:last-child`).innerText(), label);
  }
  checkedViews.push('hq');

  await go(page, 'projects', 'Projekte');
  assert.match(await page.locator('#projects').innerText(), /Projektportfolio/);
  const create = page.locator('#projects details.human-create');
  await create.waitFor();
  assert.equal(await create.getAttribute('open'), null);
  assert.equal(await page.locator('#refresh').isVisible(), false);

  const opens = page.locator('#projects .project-open');
  assert.ok(await opens.count() > 0);
  const workspaceOpen = page.locator('#projects .project-open').filter({ hasText: 'Workspace' });
  await workspaceOpen.first().waitFor();
  assert.equal(await workspaceOpen.count(), 1, 'exactly one projected website workspace action expected');
  assert.equal(await workspaceOpen.first().getAttribute('data-scope'), AURENTARA_WEBSITE_SCOPE);

  const workspacePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  workspacePage.on('pageerror', (error) => workspaceErrors.push(String(error)));
  await workspacePage.goto(`${origin}/operator/workspace/${encodeURIComponent(AURENTARA_WEBSITE_SCOPE)}`, { waitUntil: 'domcontentloaded' });
  await workspacePage.waitForFunction(() => !document.body.classList.contains('loading') && document.querySelector('#header')?.textContent?.includes('Project Header'));
  const workspaceText = await workspacePage.locator('body').innerText();
  for (const label of ['Project Header', 'Live Preview', 'Change Request', 'QA Panel', 'Version / Iteration History', 'Human Review', 'Production OFF', 'Billing OFF', 'Real Customer Data NONE']) {
    assert.match(workspaceText, visibleLabel(label));
  }
  assert.match(await workspacePage.locator('#preview').innerText(), /Preview noch nicht verfügbar/i);
  assert.equal(await workspacePage.locator('#preview iframe').count(), 0, 'missing preview must not render a fake iframe');
  assert.equal(await workspacePage.locator('#classify').isVisible(), true);
  assert.equal(await workspacePage.locator('#preflight').isVisible(), true);
  assert.equal(await workspacePage.locator('[data-decision="accept"]').isVisible(), true);
  assert.equal(await workspacePage.locator('[data-decision="request_changes"]').isVisible(), true);
  assert.equal(await workspacePage.locator('[data-decision="return_to_accepted"]').isVisible(), true);
  assert.equal(await workspacePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'workspace desktop horizontal overflow');
  checkedViews.push('project-workspace-desktop');

  await workspacePage.setViewportSize({ width: 390, height: 844 });
  await workspacePage.waitForTimeout(150);
  assert.equal(await workspacePage.locator('#header').isVisible(), true);
  assert.equal(await workspacePage.locator('#preview').isVisible(), true);
  assert.equal(await workspacePage.locator('#change').isVisible(), true);
  assert.equal(await workspacePage.locator('#qa').isVisible(), true);
  assert.equal(await workspacePage.locator('#history').isVisible(), true);
  assert.equal(await workspacePage.locator('#decision').isVisible(), true);
  assert.equal(await workspacePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'workspace mobile horizontal overflow');
  checkedViews.push('project-workspace-mobile');
  assert.deepEqual(workspaceErrors, []);
  await workspacePage.close();

  let legacyOpenIndex = -1;
  for (let index = 0; index < await opens.count(); index += 1) {
    if (!/workspace/i.test(await opens.nth(index).innerText())) {
      legacyOpenIndex = index;
      break;
    }
  }
  assert.ok(legacyOpenIndex >= 0, 'legacy project detail action must remain available');
  await opens.nth(legacyOpenIndex).click();
  await page.waitForFunction(() => {
    const root = document.getElementById('project-detail');
    return Boolean(root?.querySelector('[data-human-project-priority]') && root.textContent?.includes('Projektstatus') && root.textContent?.includes('Nächste Aktion'));
  });
  const projectText = await page.locator('#project-detail').innerText();
  for (const label of ['Projektstatus', 'Aktueller Zustand', 'Capabilities', 'Ergebnisse', 'Nächste Aktion']) assert.match(projectText, visibleLabel(label));
  const projectRaw = page.locator('#project-detail details.human-raw');
  if (await projectRaw.count()) {
    assert.equal(await projectRaw.first().getAttribute('open'), null);
    assert.ok(await page.locator('#project-detail [data-human-project-delivery]').count() > 0);
  }
  checkedViews.push('project-detail');

  await go(page, 'mission', 'Mission Studio');
  const missionText = page.locator('#mission textarea[name="mission_text"]');
  await missionText.fill('Erstelle einen rein synthetischen internen Testplan für Website und CRM ohne Production und ohne externe Writes.');
  const industry = page.locator('#mission input[name="industry"]');
  if (await industry.count()) await industry.fill('synthetic');
  const outcomes = page.locator('#mission input[name="requested_outcomes"]');
  if (await outcomes.count()) {
    await page.locator('#mission').getByRole('checkbox', { name: 'Website' }).check();
    await page.locator('#mission').getByRole('checkbox', { name: 'CRM' }).check();
  }
  await page.locator('#mission-form button[type="submit"]').click();
  await page.waitForFunction(() => document.getElementById('plan-review')?.textContent?.includes('Plan Review'));
  assert.match(await page.locator('#plan-review').innerText(), /Freigabe erforderlich/i);
  assert.match(await page.locator('#plan-review').innerText(), /0,00\s?€|0\s?€/);
  checkedViews.push('mission-plan');

  await go(page, 'approvals', 'Freigaben');
  assert.ok(/Keine Freigaben erforderlich|Freigeben|Ablehnen|Approve|Reject/i.test(await page.locator('#approvals').innerText()));

  await go(page, 'factories', 'Factories');
  await page.waitForFunction(() => document.querySelectorAll('#factories .human-card').length > 0);
  const factoryText = await page.locator('#factories').innerText();
  assert.ok(/EXISTS|STAGING VERIFIED|READY|PLANNED|NOT VERIFIED|BLOCKED/i.test(factoryText));
  assert.ok(/Noch kein verifizierter Run|Runs/i.test(factoryText));

  await go(page, 'providers', 'Provider');
  await page.waitForFunction(() => document.querySelectorAll('#providers .provider-ecosystem-card').length >= 5);
  const providerText = await page.locator('#providers').innerText();
  for (const provider of ['Cloudflare', 'Supabase', 'PostHog', 'OpenAI', 'Workers AI', 'Framer', 'Base44', 'Make', 'Activepieces', 'n8n', 'Lovable', 'Webflow']) {
    assert.match(providerText, visibleLabel(provider));
  }
  assert.match(providerText, /Provider Ecosystem/i);
  assert.match(providerText, /Active Runtime Routes/i);
  assert.ok(/AVAILABLE|CONNECTED STAGING|READ ONLY VERIFIED|NOT VERIFIED|NOT_CONNECTED|VERIFIED/i.test(providerText));
  assert.equal(await page.locator('#refresh').isVisible(), true);

  await go(page, 'costs', 'Kosten');
  const costLabels = (await page.locator('#costs .metric .k').allInnerTexts()).map((value) => value.toLocaleLowerCase('de-DE'));
  for (const label of ['Ausgegeben', 'Reserviert', 'Geschätzt', 'Verbleibend']) assert.ok(costLabels.includes(label.toLocaleLowerCase('de-DE')));
  assert.equal(costLabels.some((label) => ['spent', 'reserved', 'estimated', 'remaining'].includes(label)), false);

  await go(page, 'deliveries', 'Ergebnisse');
  const deliveriesText = await page.locator('#deliveries').innerText();
  const humanDeliveries = page.locator('#deliveries [data-human-unified-delivery]');
  if (await humanDeliveries.count() > 0) {
    const firstDelivery = humanDeliveries.first();
    for (const label of ['Projekt', 'Mission', 'Status', 'Finaler Delivery-Status', 'Qualität', 'Factory', 'Capability', 'Provider', 'Kosten', 'Umgebung', 'Production', 'External Writes', 'Execution Evidence', 'Wichtige Annahmen', 'Abgelehnte / ungenutzte Capabilities', 'Delivery / Result Reference']) {
      assert.match(await firstDelivery.innerText(), visibleLabel(label));
    }
    const raw = firstDelivery.locator('details.human-raw');
    assert.equal(await raw.getAttribute('open'), null);
    assert.match(await raw.locator('summary').innerText(), /Technische Details \/ Raw Evidence/i);
  } else {
    assert.match(deliveriesText, /Noch keine Unified-Delivery-Evidence vorhanden/i);
    assert.equal(await page.locator('#deliveries pre').count(), 0, 'empty Unified Delivery state must not fall back to raw JSON');
  }

  await go(page, 'health', 'Systemstatus');
  const healthText = await page.locator('#health').innerText();
  for (const label of ['Overall System State', 'Runtime Health', 'Staging Verification', 'Activation Readiness', 'Production State']) assert.match(healthText, visibleLabel(label));
  assert.match(healthText, /DISABLED/i);
  assert.equal(await page.locator('#refresh').isVisible(), true);

  await go(page, 'audit', 'Aktivität');
  await page.waitForTimeout(100);
  const codes = page.locator('#audit .human-meta code');
  if (await codes.count()) {
    const key = await codes.first().innerText();
    assert.notEqual((await codes.first().locator('xpath=../..').innerText()).split('\n')[0].trim(), key);
  }

  await go(page, 'settings', 'Richtlinien');
  const policyText = await page.locator('#settings').innerText();
  assert.doesNotMatch(policyText, /NOT CONFIGURED/);
  assert.ok(/Nicht konfiguriert|Monatsbudget/i.test(policyText));

  await go(page, 'hq', 'HQ');
  assert.match(await page.locator('#hq').innerText(), /Aktive Vorgänge|System|Ergebnisse|Letzte Aktivität/i);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    ok: true,
    suite: 'operator-human-ux-browser-v1',
    mode: 'local_worker_browser',
    browser: 'system_chrome',
    flow: checkedViews,
    workspace_desktop: true,
    workspace_mobile: true,
    workspace_preview_state: 'truthful_not_available',
    synthetic_plan_review: 'verified_without_execution',
    unified_delivery_state: await humanDeliveries.count() > 0 ? 'human_summary_with_secondary_raw_evidence' : 'truthful_human_empty_state',
    provider_ecosystem_cards: await page.locator('#providers .provider-ecosystem-card').count(),
    provider_calls: 0,
    production_deploy: false,
    external_writes: false,
    real_customer_data: false,
    additional_variable_cost_eur: 0
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (!childExit) child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (childExit) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}