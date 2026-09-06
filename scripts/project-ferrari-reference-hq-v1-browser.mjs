import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8812;
const origin = `http://127.0.0.1:${port}`;
const outDir = path.join(process.cwd(), 'artifacts', 'project-ferrari-reference-hq-v1');
fs.mkdirSync(outDir, { recursive: true });

const child = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'dev', '--env', 'staging', '--port', String(port),
  '--var', 'RIOSYSTEMS_ENVIRONMENT:local',
  '--var', 'RIOSYSTEMS_OPERATOR_RUNTIME_STORE:memory',
  '--var', 'RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local',
  '--var', 'RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local',
  '--var', 'RIOSYSTEMS_PRODUCTION_DEPLOY:false',
  '--var', 'RIOSYSTEMS_EXTERNAL_WRITES:false'
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

let browserInstance;
const pageErrors = [];
const consoleErrors = [];
try {
  await waitForWorker();
  browserInstance = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browserInstance.newPage({ viewport: { width: 1586, height: 992 } });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const response = await page.goto(`${origin}/operator`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  assert.equal(response?.headers()['x-aurentara-ferrari-reference-hq'], 'v1');

  await page.waitForFunction(() => window.__aurentaraFerrariReferenceHqV1 === true && !document.body.classList.contains('loading'));
  await page.waitForSelector('.rf-hq');
  await page.waitForTimeout(500);

  assert.equal(await page.locator('#aurentara-ferrari-reference-hq-v1-style').count(), 1);
  assert.equal(await page.locator('#aurentara-ferrari-reference-hq-v1-script').count(), 1);
  assert.equal(await page.locator('.rf-utility-bar').isVisible(), true);
  assert.equal(await page.locator('.rf-hero').isVisible(), true);
  assert.equal(await page.locator('.rf-kpi').count(), 4);
  assert.equal(await page.locator('.rf-middle .rf-panel').count(), 2);
  assert.equal(await page.locator('.rf-bottom .rf-panel').count(), 2);
  assert.match(await page.locator('.rf-hero').innerText(), /Masterdashboard/i);
  assert.match(await page.locator('.rf-middle').innerText(), /Attention Center/i);
  assert.match(await page.locator('.rf-middle').innerText(), /Operator AI/i);
  assert.match(await page.locator('.rf-bottom').innerText(), /Projekt Portfolio/i);

  const projects = await page.evaluate(async () => {
    const response = await fetch('/operator/api/projects');
    return response.json();
  });
  const projectItems = Array.isArray(projects.items) ? projects.items : [];
  assert.equal(await page.locator('.rf-project-row').count(), projectItems.length, 'HQ portfolio must project the same project collection');

  for (const project of projectItems) {
    const row = page.locator('.rf-project-row[data-rf-row="' + project.scope_key.replace(/"/g, '\\"') + '"]');
    assert.equal(await row.count(), 1, 'project scope must be represented exactly once');
    if (project.project_detail_openable === true) {
      assert.equal(await row.locator('[data-rf-open]').count(), 1, 'runtime-resolvable project gets Project Detail action');
    } else if (project.workspace_enabled === true) {
      assert.equal(await row.locator('[data-rf-workspace]').count(), 1, 'workspace-only project gets dedicated Workspace action');
      assert.equal(await row.locator('[data-rf-open]').count(), 0, 'workspace-only project must not get Project Detail action');
    } else {
      assert.equal(await row.locator('[data-rf-open],[data-rf-workspace]').count(), 0, 'non-resolvable project must not get a false open action');
    }
  }

  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const kpis = [...document.querySelectorAll('.rf-kpi')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    });
    return {
      viewport: [innerWidth, innerHeight],
      sidebar: rect('.side'),
      hero: rect('.rf-hero'),
      attention: rect('.rf-middle .rf-panel:first-child'),
      operator_ai: rect('.rf-middle .rf-panel:last-child'),
      portfolio: rect('.rf-bottom .rf-panel:first-child'),
      selected_project: rect('.rf-bottom .rf-panel:last-child'),
      kpis
    };
  });

  assert.deepEqual(geometry.viewport, [1586, 992]);
  assert.ok(geometry.sidebar.width >= 190 && geometry.sidebar.width <= 230, 'reference sidebar width');
  assert.ok(geometry.kpis.every((item) => Math.abs(item.y - geometry.kpis[0].y) <= 2), 'four KPI cards remain on one desktop row');
  assert.ok(geometry.attention.x < geometry.operator_ai.x, 'Attention Center must sit left of Operator AI');
  assert.ok(geometry.portfolio.x < geometry.selected_project.x, 'Portfolio must sit left of Selected Project');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'desktop horizontal overflow');

  fs.writeFileSync(path.join(outDir, 'reference-01-layout-evidence.json'), JSON.stringify({
    schema: 'aurentara.project-ferrari.reference-hq.browser-evidence.v1',
    reference: 'AURENTARA Masterdashboard im Dark-Mode.png',
    reference_dimensions: [1586, 992],
    geometry,
    project_count: projectItems.length,
    production_deploy: false,
    external_writes: false
  }, null, 2));

  await page.screenshot({ path: path.join(outDir, 'reference-01-hq-desktop.png'), fullPage: true });

  await page.locator('#rf-ai-top').click();
  await page.waitForSelector('#global-operator-ai-backdrop.open');
  assert.equal(await page.locator('#global-operator-ai-section').innerText(), 'HQ');
  await page.locator('#global-operator-ai-close').click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'existing iPhone regression: no horizontal overflow');
  assert.equal(await page.locator('.rf-kpi').count(), 4);
  await page.screenshot({ path: path.join(outDir, 'reference-01-hq-iphone-regression.png'), fullPage: true });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);

  console.log(JSON.stringify({
    ok: true,
    suite: 'project-ferrari-reference-hq-v1-browser',
    reference_dimensions: [1586, 992],
    desktop_structure: 'PASS',
    runtime_project_truth: 'PASS',
    portfolio_routing_truth: 'PASS',
    operator_ai_existing_backbone: 'PASS',
    iphone_regression: 'PASS',
    production_deploy: false,
    external_writes: false
  }, null, 2));
} finally {
  if (browserInstance) await browserInstance.close().catch(() => {});
  if (!childExit) child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (childExit) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
