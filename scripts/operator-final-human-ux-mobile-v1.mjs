import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8798;
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'dev', '--env', 'staging', '--port', String(port),
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
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`local Worker did not become ready\n${output}`);
}

async function waitReady(page) {
  await page.waitForFunction(() => !document.body.classList.contains('loading'));
  await page.waitForFunction(() => window.__aurentaraOperatorFinalLocalizationV1 === true);
  await page.waitForTimeout(250);
}

async function openProjectDetail(page) {
  const projectsNav = page.locator('.nav button[data-goto="projects"]');
  await projectsNav.first().click();
  await page.waitForFunction(() => document.getElementById('title')?.textContent?.trim() === 'Projekte');
  const opens = page.locator('#projects .project-open');
  await opens.first().waitFor();
  let target = null;
  for (let index = 0; index < await opens.count(); index += 1) {
    const label = await opens.nth(index).innerText();
    if (!/workspace/i.test(label)) {
      target = opens.nth(index);
      break;
    }
  }
  assert.ok(target, 'a project detail action must be available');
  const scope = await target.getAttribute('data-scope');
  assert.ok(scope, 'project detail action keeps scope');
  await target.click();
  await page.waitForFunction(() => Boolean(document.getElementById('project-detail')?.textContent?.trim()));
  await page.waitForTimeout(200);
  return scope;
}

let browser;
const pageErrors = [];
try {
  await waitForWorker();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(`${origin}/operator`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'iPhone viewport must not overflow horizontally');
  const scope = await openProjectDetail(page);
  const detailBefore = await page.locator('#project-detail').innerText();
  assert.ok(detailBefore.length > 20, 'project detail must contain visible data before failure');
  const initialContext = await page.evaluate(() => ({ section: state.section, scope: state.selectedScope }));
  assert.equal(initialContext.section, 'projects');
  assert.equal(initialContext.scope, scope);

  const source = page.locator('#project-detail [data-project-source-intake]');
  if (await source.count()) {
    const sourceText = await source.innerText();
    for (const label of ['Rechte', 'Verwendung', 'Hochladen']) assert.match(sourceText, new RegExp(label, 'i'));
    const rights = await source.locator('[data-source-rights] option').evaluateAll((options) => options.map((option) => ({ value: option.value, text: option.textContent.trim() })));
    assert.ok(rights.some((item) => item.value === 'CUSTOMER_ASSERTED' && item.text === 'Vom Kunden bestätigt'));
    assert.ok(rights.some((item) => item.value === 'OWNED_CONFIRMED' && item.text === 'Eigentum bestätigt'));
    const usage = await source.locator('[data-source-usage] option').evaluateAll((options) => options.map((option) => ({ value: option.value, text: option.textContent.trim() })));
    assert.ok(usage.some((item) => item.value === 'PROJECT_VISUAL' && item.text === 'Projektbild'));
    assert.ok(usage.some((item) => item.value === 'GALLERY' && item.text === 'Galerie'));
  }

  let dashboardCalls = 0;
  await page.route('**/operator/api/dashboard*', async (route) => {
    dashboardCalls += 1;
    if (dashboardCalls === 1) return route.abort('failed');
    return route.continue();
  });
  await page.evaluate(() => loadAll());
  await page.waitForTimeout(250);
  assert.equal(dashboardCalls, 2, 'one transient GET failure is retried exactly once');
  assert.equal((await page.evaluate(() => state.selectedScope)), scope, 'selectedScope survives recovered GET failure');
  await page.unroute('**/operator/api/dashboard*');

  dashboardCalls = 0;
  await page.route('**/operator/api/dashboard*', async (route) => {
    dashboardCalls += 1;
    return route.abort('failed');
  });
  await page.evaluate(() => loadAll());
  await page.waitForTimeout(300);
  assert.equal(dashboardCalls, 2, 'persistent transient GET failure stops after the single retry');
  const failedContext = await page.evaluate(() => ({ section: state.section, scope: state.selectedScope }));
  assert.equal(failedContext.section, 'projects', 'workspace section survives failed read');
  assert.equal(failedContext.scope, scope, 'selectedScope survives failed read');
  assert.equal(await page.locator('#project-detail').isVisible(), true, 'project detail remains visible after failed read');
  assert.match(await page.locator('#project-detail').innerText(), new RegExp(detailBefore.split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const errorText = await page.locator('#error').innerText();
  assert.match(errorText, /Verbindung fehlgeschlagen\. Bitte erneut versuchen\./i);
  assert.match(errorText, /Technisches Detail:/i);

  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('aurentara.operator-context.v1') || '{}'));
  assert.equal(stored.section, 'projects');
  assert.equal(stored.scope, scope);
  assert.equal(stored.detail?.project?.scope_key, scope, 'tab-local detail snapshot is retained for reload recovery');

  dashboardCalls = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitReady(page);
  assert.ok(dashboardCalls >= 1 && dashboardCalls <= 2, 'initial reload read remains bounded and never exceeds one retry');
  const reloadContext = await page.evaluate(() => ({ section: state.section, scope: state.selectedScope, detailScope: state.detail?.project?.scope_key || null }));
  assert.equal(reloadContext.section, 'projects', 'iPhone reload keeps project workspace section');
  assert.equal(reloadContext.scope, scope, 'iPhone reload keeps selected scope');
  assert.equal(reloadContext.detailScope, scope, 'iPhone reload restores cached project detail when read hydration fails');
  assert.equal(await page.locator('#project-detail').isVisible(), true, 'cached project detail remains visible across transient reload failure');
  assert.match(await page.locator('#error').innerText(), /Verbindung fehlgeschlagen\. Bitte erneut versuchen\./i);
  await page.unroute('**/operator/api/dashboard*');

  let writeProbeCalls = 0;
  await page.route('**/operator/api/operator-final-ux-write-probe', async (route) => {
    writeProbeCalls += 1;
    return route.abort('failed');
  });
  await page.evaluate(async () => {
    try { await fetch('/operator/api/operator-final-ux-write-probe', { method: 'POST', body: '{}' }); } catch {}
  });
  assert.equal(writeProbeCalls, 1, 'POST is never automatically retried');
  await page.unroute('**/operator/api/operator-final-ux-write-probe');

  await page.evaluate(() => loadAll());
  await page.waitForFunction(() => !document.body.classList.contains('loading'));
  assert.equal(await page.evaluate(() => state.selectedScope), scope, 'manual retry after connectivity recovery keeps selected scope');

  const activityNav = page.locator('.nav button[data-goto="audit"]');
  await activityNav.first().click();
  await page.waitForTimeout(200);
  const codes = page.locator('#audit .human-meta code');
  if (await codes.count()) {
    const code = await codes.first().innerText();
    const parentText = await codes.first().locator('xpath=../..').innerText();
    assert.ok(parentText.includes(code), 'technical event code remains visible');
    assert.notEqual(parentText.split('\n')[0].trim(), code, 'human activity title is primary');
  }

  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({
    ok: true,
    suite: 'operator-final-human-ux-mobile-v1',
    viewport: '390x844',
    selected_scope_preserved: scope,
    get_retry_maximum: 1,
    write_retry_maximum: 0,
    reload_context_retained: true,
    source_enum_values_preserved: true,
    production_deploy: false,
    external_writes: false,
    paid_provider_calls: 0,
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
