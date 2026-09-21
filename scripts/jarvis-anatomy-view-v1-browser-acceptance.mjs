/* JARVIS Anatomy View V1 — real local browser acceptance.
   Desktop 1440x900 + iPhone-ish 390x844. No deploy: a local http server serves
   the shell and mocks /api/runtime-truth. Proves the Anatomy view renders,
   is reachable from Home/System, honours fail-closed statuses, opens the
   detail sheet with honest fields, and never fabricates a proven count. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';

const OUT = process.env.SCRATCH_DIR
  || path.join(process.cwd(), '.tmp-anatomy-acceptance');
fs.mkdirSync(OUT, { recursive: true });

const NOT_CONNECTED = { classification: 'UNKNOWN', source_state: 'NOT_CONNECTED' };
const EMPTY_TRUTH = {
  ok: true, private: true, read_only: true,
  systems: { source: NOT_CONNECTED, data: {} },
  runs: { source: NOT_CONNECTED, data: { items: [] } },
  activity: { source: NOT_CONNECTED, data: { items: [] } },
  approvals: { source: NOT_CONNECTED, data: { items: [], pending_count: 0 } },
  evidence: { source: NOT_CONNECTED, data: { items: [] } },
  command_chain: { schema: 'aurentara.jarvis.command-center.worker-chain.v1', nodes: [] },
  anatomy: {
    schema: 'aurentara.jarvis.anatomy.v1', generated_at: '2026-09-21T12:00:00.000Z',
    core: { status: 'NOT_CONNECTED', label: 'JARVIS Core', capability: 'Central JARVIS runtime core', source: null, observed_at: null, last_success: null, reason: 'SYSTEMS_SOURCE_NOT_CONNECTED', evidence_ref: null, detail: {} },
    brain: { status: 'NOT_CONNECTED', label: 'Brain — Reasoning / Operator Logic', capability: 'Astra reasoning & policy control', source: null, observed_at: null, last_success: null, reason: 'SYSTEMS_SOURCE_NOT_CONNECTED', evidence_ref: null, detail: {} },
    eyes: { status: 'NOT_CONNECTED', label: 'Eyes — Perception / Monitoring', capability: 'Perception & monitoring signal', source: null, observed_at: null, last_success: null, reason: 'NO_GENUINE_SOURCE_BOUND', evidence_ref: null, detail: {} },
    ears: { status: 'NOT_CONNECTED', label: 'Ears — Voice / Input', capability: 'Voice & input channel', source: null, observed_at: null, last_success: null, reason: 'NO_GENUINE_SOURCE_BOUND', evidence_ref: null, detail: {} },
    mouth: { status: 'NOT_CONNECTED', label: 'Mouth — Communication / Output', capability: 'Communication & output channel', source: null, observed_at: null, last_success: null, reason: 'NO_GENUINE_SOURCE_BOUND', evidence_ref: null, detail: {} },
    right_hand: { status: 'NOT_CONNECTED', label: 'Right Hand — Claude Code / Engineering Execution', capability: 'Claude Code engineering execution', source: null, observed_at: null, last_success: null, reason: null, evidence_ref: null, detail: {} },
    left_hand: { status: 'NOT_CONNECTED', label: 'Left Hand — Browser / Desktop Execution', capability: 'Browser / desktop execution', source: null, observed_at: null, last_success: null, reason: 'NO_GENUINE_SOURCE_BOUND', evidence_ref: null, detail: {} },
    nervous_system: { status: 'NOT_CONNECTED', label: 'Nervous System — Bridge', capability: 'Bridge integrations & connectors', source: null, observed_at: null, last_success: null, reason: 'SYSTEMS_SOURCE_NOT_CONNECTED', evidence_ref: null, detail: {} },
    infrastructure: { status: 'NOT_CONNECTED', label: 'Infrastructure — Runtime Foundation', capability: 'VPS / service / runtime / git / storage / network foundation', source: null, observed_at: null, last_success: null, reason: null, evidence_ref: null, detail: {} }
  },
  autonomy: {
    schema: 'aurentara.jarvis.autonomy-view.v1', generated_at: '2026-09-21T12:00:00.000Z',
    stage: 'UNKNOWN', source: null, observed_at: null, current_run: null, last_activity: null,
    last_success: null, evidence_ref: null, reason: 'RUN_SOURCE_NOT_CONNECTED', operator_acceptance_fabricated: false,
    stages: ['IDLE','WORK_DETECTED','JOB_CREATED','EXECUTING','VERIFYING','REPAIRING','COMPLETE','BLOCKED','FAILED']
  },
  validation: { ok: true, violations: [] },
};

const HEALTHY_TRUTH = {
  ...EMPTY_TRUTH,
  anatomy: {
    ...EMPTY_TRUTH.anatomy,
    core: { status: 'HEALTHY', label: 'JARVIS Core', capability: 'Central JARVIS runtime core', source: 'jarvis-command-center-live-probes-v1', observed_at: '2026-09-21T11:59:30.000Z', last_success: '2026-09-21T11:59:30.000Z', reason: null, evidence_ref: 'jarvis-command-center-live-probes-v1', detail: { jarvis: 'ONLINE' } },
    brain: { status: 'UNKNOWN', label: 'Brain — Reasoning / Operator Logic', capability: 'Astra reasoning & policy control', source: 'jarvis-command-center-live-probes-v1', observed_at: '2026-09-21T11:59:30.000Z', last_success: null, reason: null, evidence_ref: null, detail: { astra: 'UNKNOWN' } },
    nervous_system: { status: 'FAILED', label: 'Nervous System — Bridge', capability: 'Bridge integrations & connectors', source: 'jarvis-command-center-live-probes-v1', observed_at: '2026-09-21T11:59:30.000Z', last_success: null, reason: 'BRIDGE_OFFLINE', evidence_ref: 'jarvis-command-center-live-probes-v1', detail: { bridge: 'OFFLINE' } },
    right_hand: { status: 'DEGRADED', label: 'Right Hand — Claude Code / Engineering Execution', capability: 'Claude Code engineering execution', source: 'jarvis-command-center-live-probes-v1', observed_at: '2026-09-21T11:59:30.000Z', last_success: '2026-09-21T11:00:00.000Z', reason: 'CLAUDE_BUSY', evidence_ref: 'evidence:req-1', detail: { last_run: { id: 'b5acafe1-d006-42c6-aa05-98ac62c0ae57', status: 'COMPLETE' } } },
  },
  autonomy: {
    schema: 'aurentara.jarvis.autonomy-view.v1', generated_at: '2026-09-21T12:00:00.000Z',
    stage: 'COMPLETE', source: 'jarvis-run-projection-v1', observed_at: '2026-09-21T11:59:30.000Z',
    current_run: { id: 'b5acafe1-d006-42c6-aa05-98ac62c0ae57', title: 'Owner E2E', worker: 'Claude Code', status: 'COMPLETE', program: 'JARVIS_OWNER_CHAT' },
    last_activity: { event: 'IMPLEMENTATION_MISSION', status: 'COMPLETED', at: '2026-09-21T11:59:30.000Z', summary: 'ENGINEERING · IMPLEMENTATION_MISSION' },
    last_success: '2026-09-21T11:59:30.000Z', evidence_ref: 'claude-code:b5acafe1-d006-42c6-aa05-98ac62c0ae57',
    reason: null, operator_acceptance_fabricated: false,
    stages: ['IDLE','WORK_DETECTED','JOB_CREATED','EXECUTING','VERIFYING','REPAIRING','COMPLETE','BLOCKED','FAILED']
  },
};

let TRUTH = EMPTY_TRUTH;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (url.pathname === '/' || url.pathname === '/jarvis') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderJarvisCommandCenterV1({ base_path: '' }));
    return;
  }
  if (url.pathname === '/api/runtime-truth') return send(TRUTH);
  send({ ok: false, error: 'NOT_FOUND' }, 404);
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://localhost:${port}/`;

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const problems = [];

async function nav(page, label) {
  for (const sel of ['.mnav button', '.nav .nav-i']) {
    const loc = page.locator(sel).filter({ hasText: label }).first();
    if ((await loc.count()) && (await loc.isVisible())) { await loc.click(); return true; }
  }
  return false;
}

async function acceptViewport(name, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/i.test(t)) return;
    consoleErrors.push('console.error: ' + t);
  });
  await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/fonts\.gstatic\.com/, (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));

  TRUTH = EMPTY_TRUTH;
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.jcc', { timeout: 8000 });
  await page.waitForTimeout(300);

  // reach Anatomy from Home (Schnellzugriff) on mobile, from the sidebar on desktop
  let reached = false;
  if (width >= 980) {
    reached = await nav(page, 'Anatomie');
  } else {
    const shortcut = page.locator('.q-i').filter({ hasText: 'Anatomie' }).first();
    if (await shortcut.count()) { await shortcut.click(); reached = true; }
  }
  if (!reached) problems.push(`[${name}] could not reach Anatomie view`);
  await page.waitForSelector('.an-stage', { timeout: 8000 }).catch(() => problems.push(`[${name}] .an-stage did not render`));
  await page.waitForTimeout(300);

  // local strip present
  const stripText = await page.textContent('.an-strip').catch(() => '');
  for (const marker of ['ANATOMIE', 'SYSTEM', 'MODUL', 'LIVE', 'DETAILS']) {
    if (!stripText.includes(marker)) problems.push(`[${name}] anatomy strip missing "${marker}"`);
  }

  // autonomy panel is visible and fail-closed when no run source is connected
  const autonomyText = await page.textContent('.au-panel').catch(() => '');
  if (!autonomyText.includes('Was macht JARVIS gerade?')) problems.push(`[${name}] autonomy panel missing`);
  if (!autonomyText.includes('Unbekannt')) problems.push(`[${name}] empty autonomy state must be Unbekannt: ${autonomyText}`);
  for (const step of ['Erkannt', 'Job', 'Ausführen', 'Prüfen', 'Reparieren', 'Fertig']) {
    if (!autonomyText.includes(step)) problems.push(`[${name}] autonomy flow missing ${step}`);
  }

  // figure + all 9 zone nodes present
  const nodeCount = await page.locator('.an-node').count();
  if (nodeCount !== 9) problems.push(`[${name}] expected 9 anatomy nodes, found ${nodeCount}`);

  // fail-closed: every card reads "Nicht verbunden" when anatomy is all NOT_CONNECTED
  const cardStates = await page.$$eval('.an-card .an-card-s', (els) => els.map((e) => e.textContent.trim()));
  if (!cardStates.length || !cardStates.every((t) => t === 'Nicht verbunden')) {
    problems.push(`[${name}] anatomy cards not fail-closed: ${JSON.stringify(cardStates)}`);
  }

  // bottom summary must reflect real 0/9, never a fabricated 100%/8-of-8
  const summary = await page.textContent('.an-summary');
  if (!/0\/9 Zonen mit echtem Signal · 0 gesund/.test(summary)) problems.push(`[${name}] anatomy summary not honest for empty truth: ${summary}`);

  await page.screenshot({ path: path.join(OUT, `anatomy-${name}-empty.png`), fullPage: false });

  // open a detail sheet and verify honest fields
  await page.locator('.an-card').first().click();
  await page.waitForSelector('.an-sheet', { timeout: 4000 }).catch(() => problems.push(`[${name}] detail sheet did not open`));
  await page.waitForTimeout(200);
  const sheetText = await page.textContent('.an-sheet').catch(() => '');
  if (!sheetText.includes('Nicht verbunden')) problems.push(`[${name}] detail sheet did not show fail-closed status`);
  await page.screenshot({ path: path.join(OUT, `anatomy-${name}-sheet.png`), fullPage: false });
  await page.locator('.an-sheet-x').click();
  await page.waitForTimeout(150);
  if (await page.locator('.an-sheet').count()) problems.push(`[${name}] detail sheet did not close`);

  // now real mixed HEALTHY/DEGRADED/FAILED composition
  TRUTH = HEALTHY_TRUTH;
  await page.reload({ waitUntil: 'load' });
  if (width >= 980) { await nav(page, 'Anatomie'); }
  else { await page.locator('.q-i').filter({ hasText: 'Anatomie' }).first().click(); }
  await page.waitForSelector('.an-stage', { timeout: 8000 });
  await page.waitForTimeout(300);
  const mixedStates = await page.$$eval('.an-card .an-card-s', (els) => els.map((e) => e.textContent.trim()));
  if (!mixedStates.includes('Gesund')) problems.push(`[${name}] HEALTHY state did not render: ${JSON.stringify(mixedStates)}`);
  if (!mixedStates.includes('Fehler')) problems.push(`[${name}] FAILED state did not render: ${JSON.stringify(mixedStates)}`);
  if (!mixedStates.includes('Eingeschränkt')) problems.push(`[${name}] DEGRADED state did not render: ${JSON.stringify(mixedStates)}`);
  if (!mixedStates.includes('Unbekannt')) problems.push(`[${name}] UNKNOWN state did not render: ${JSON.stringify(mixedStates)}`);
  const mixedSummary = await page.textContent('.an-summary');
  if (!/3\/9 Zonen mit echtem Signal · 1 gesund/.test(mixedSummary)) problems.push(`[${name}] mixed anatomy summary not honest: ${mixedSummary}`);

  const liveAutonomyText = await page.textContent('.au-panel').catch(() => '');
  if (!liveAutonomyText.includes('Abgeschlossen')) problems.push(`[${name}] COMPLETE autonomy state did not render: ${liveAutonomyText}`);
  if (!liveAutonomyText.includes('b5acafe1-d006-42c6-aa05-98ac62c0ae57')) problems.push(`[${name}] real Owner E2E run id missing from autonomy panel`);
  if (!liveAutonomyText.includes('claude-code:b5acafe1-d006-42c6-aa05-98ac62c0ae57')) problems.push(`[${name}] real Claude evidence missing from autonomy panel`);
  const activeFlowText = await page.locator('.au-step.on').allTextContents();
  if (activeFlowText.length !== 1 || !activeFlowText[0].includes('Fertig')) problems.push(`[${name}] autonomy flow active stage is not exactly COMPLETE/Fertig: ${JSON.stringify(activeFlowText)}`);

  // Right Hand detail must expose activity/evidence without inventing acceptance.
  await page.locator('.an-card').filter({ hasText: 'Rechte Hand' }).first().click();
  await page.waitForSelector('.an-sheet', { timeout: 4000 }).catch(() => problems.push(`[${name}] right-hand detail sheet did not open`));
  const rightHandSheet = await page.textContent('.an-sheet').catch(() => '');
  if (!rightHandSheet.includes('Aktivität')) problems.push(`[${name}] right-hand detail missing activity field`);
  if (!rightHandSheet.includes('b5acafe1-d006-42c6-aa05-98ac62c0ae57')) problems.push(`[${name}] right-hand detail missing real run id`);
  await page.locator('.an-sheet-x').click();

  await page.screenshot({ path: path.join(OUT, `anatomy-${name}-mixed.png`), fullPage: false });

  // no horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`[${name}] horizontal overflow: ${overflow}px`);

  if (consoleErrors.length) problems.push(`[${name}] console/page errors: ${consoleErrors.slice(0, 4).join(' | ')}`);
  await ctx.close();
}

try {
  await acceptViewport('desktop', 1440, 900);
  await acceptViewport('iphone', 390, 844);
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error('ANATOMY VIEW BROWSER ACCEPTANCE FAILURES:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`JARVIS Anatomy View V1 browser acceptance (1440x900 + 390x844): PASS — screenshots in ${OUT}`);
