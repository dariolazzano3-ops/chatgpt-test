/* Wave 7 — real local browser acceptance of the accepted orange Command Center.
   Desktop 1440x900 + mobile 390x844. No deploy: a local http server serves the
   shell and mocks /api/*. Deterministic screenshots go to the scratchpad. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';

const OUT = process.env.SCRATCH_DIR
  || '/tmp/claude-1000/-home-dario-chatgpt-test/wave7';
fs.mkdirSync(OUT, { recursive: true });

const EMPTY_TRUTH = {
  ok: true, private: true, read_only: true,
  systems: { source: { classification: 'UNKNOWN', source_state: 'NOT_CONNECTED' }, data: {} },
  runs: { source: { classification: 'UNKNOWN', source_state: 'NOT_CONNECTED' }, data: { items: [] } },
  activity: { source: { classification: 'UNKNOWN', source_state: 'NOT_CONNECTED' }, data: { items: [] } },
  approvals: { source: { classification: 'UNKNOWN', source_state: 'NOT_CONNECTED' }, data: { items: [], pending_count: 0 } },
  evidence: { source: { classification: 'UNKNOWN', source_state: 'NOT_CONNECTED' }, data: { items: [] } },
  command_chain: {
    schema: 'aurentara.jarvis.command-center.worker-chain.v1',
    primary_worker: 'CLAUDE_CODE', fallback_worker: 'CODEX', fallback_active: false,
    claude_execution_bridge_bound: false, codex_binding_present: false,
    implementation_commands_fail_closed: true, worker_output_self_accepts: false,
    nodes: [
      { node: 'HERMES', role: 'Orchestrierung', bound: 'LOCAL_ONLY' },
      { node: 'ASTRA', role: 'Reasoning', bound: 'LOCAL_ONLY' },
      { node: 'CLAUDE_CODE', role: 'Umsetzung', bound: false },
      { node: 'CODEX', role: 'Fallback', bound: false },
      { node: 'BRIDGE', role: 'Sicherheit', bound: true },
      { node: 'GIT', role: 'Truth', bound: 'ADAPTER_REQUIRED' },
      { node: 'VERIFICATION', role: 'Abnahme', bound: false },
    ],
  },
  validation: { ok: true, violations: [] },
};
const REAL_TRUTH = {
  ...EMPTY_TRUTH,
  systems: { source: { classification: 'DERIVED', source_state: 'CONNECTED' }, data: { JARVIS: 'ONLINE', GIT: 'SYNCED' } },
  runs: { source: { classification: 'DERIVED', source_state: 'CONNECTED' }, data: { items: [
    { id: 'aaaaaaaa-1111-4111-8111-111111111111', title: 'Repo-Diff zusammenfassen', worker: 'JARVIS Runtime', status: 'COMPLETE', started_at: '2026-09-11T12:00:00.000Z', updated_at: '2026-09-11T12:01:00.000Z', progress: null, approval_state: null, evidence_ref: 'audit:x1' },
    { id: 'bbbbbbbb-2222-4222-8222-222222222222', title: 'Staging-Deploy', worker: 'JARVIS Runtime', status: 'WAITING_APPROVAL', started_at: '2026-09-11T12:10:00.000Z', updated_at: '2026-09-11T12:10:00.000Z', progress: null, approval_state: 'PENDING', evidence_ref: null },
  ] } },
  activity: { source: { classification: 'REAL', source_state: 'CONNECTED' }, data: { items: [
    { at: '2026-09-11T12:01:00.000Z', event: 'ANALYZE', summary: 'Repo-Diff zusammengefasst', run_id: 'aaaaaaaa-1111-4111-8111-111111111111', status: 'COMPLETED', evidence_ref: 'audit:x1' },
    { at: '2026-09-11T12:10:00.000Z', event: 'DEPLOY_STAGING', summary: 'Staging-Deploy angefragt', run_id: 'bbbbbbbb-2222-4222-8222-222222222222', status: 'PENDING', evidence_ref: null },
  ] } },
  approvals: { source: { classification: 'DERIVED', source_state: 'CONNECTED' }, data: { pending_count: 1, items: [
    { approval_id: 'bbbbbbbb-2222-4222-8222-222222222222:approval', run_id: 'bbbbbbbb-2222-4222-8222-222222222222', scope_key: 'jarvis:operator:op', approval_type: 'DEPLOY_STAGING', capability: 'cloudflare.deploy', reason: 'Berührt eine Live-Umgebung.', risk: 'mittel', state: 'PENDING', requested_at: '2026-09-11T12:10:00.000Z' },
  ] } },
  evidence: { source: { classification: 'DERIVED', source_state: 'CONNECTED' }, data: { items: [
    { evidence_id: 'audit:x1', kind: 'GIT_COMMIT', status: 'COMPLETED', observed_at: '2026-09-11T12:01:00.000Z', worker_verified: true, independent_acceptance: false, acceptance_ref: null, run_ref: 'aaaaaaaa-1111-4111-8111-111111111111' },
  ] } },
};

let TRUTH = EMPTY_TRUTH;
let chatCalls = [];
let decideCalls = [];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (url.pathname === '/' || url.pathname === '/jarvis') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderJarvisCommandCenterV1({ base_path: '' }));
    return;
  }
  if (url.pathname === '/api/runtime-truth') return send(TRUTH);
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw); } catch {}
      chatCalls.push(body);
      send({
        ok: true, request_id: body.correlation_id, correlation_id: body.correlation_id,
        answer: 'Verstanden. Übergeben an die JARVIS-Runtime.', tone: 'calm',
        intent: 'STATUS_REQUEST', action: 'READ_PERSONAL_CONTEXT',
        gate_status: 'ALLOWED', approval_required: false, blocked: false,
        run_state: 'RUNNING', connector_status: null, audit_persisted: true, external_effect: false,
      });
    });
    return;
  }
  if (url.pathname === '/api/approvals/decide' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw); } catch {}
      decideCalls.push(body);
      send({
        ok: true, approval_id: body.approval_id, run_id: body.run_id, decision: body.decision,
        gate_status: 'APPROVED_BY_OPERATOR', execution_authorized: false, external_effect: false, executed: false,
      });
    });
    return;
  }
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
    if (/Failed to load resource/i.test(t)) return; // benign: fonts stubbed offline
    consoleErrors.push('console.error: ' + t);
  });
  // keep it offline / deterministic — stub external fonts with empty 200s
  await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/fonts\.gstatic\.com/, (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));

  TRUTH = EMPTY_TRUTH;
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.jcc', { timeout: 8000 });
  await page.waitForTimeout(400);

  // 1. accepted structure is present
  for (const sel of ['.jcc', '.bg-glow', '.shell', 'canvas.stars', '.orb-wrap canvas', '.beam', '.side .logo', '.mnav', '.core .stage']) {
    const n = await page.$(sel);
    if (!n) problems.push(`[${name}] missing accepted element: ${sel}`);
  }
  // 2. amber design system in the injected style
  const hasAmber = await page.evaluate(() => Array.from(document.querySelectorAll('style')).some((s) => (s.textContent || '').includes('--amber:#ffab40')));
  if (!hasAmber) problems.push(`[${name}] amber token --amber:#ffab40 not in injected CSS`);
  // 3. no blue legacy leakage
  const html = await page.content();
  if (/A BRIGHTER YOU|--blue:#8bd2ff/.test(html)) problems.push(`[${name}] legacy blue UI leaked into the DOM`);
  // 4. System Status fail-closed
  const sysTexts = await page.$$eval('.svc-list .svc-r .svc-s', (els) => els.map((e) => e.textContent.trim()));
  if (!sysTexts.length || !sysTexts.every((t) => /Nicht verbunden/.test(t))) {
    problems.push(`[${name}] System Status not fail-closed: ${JSON.stringify(sysTexts)}`);
  }
  // 5. honest empty states for runs / activity
  const bodyText = await page.textContent('body');
  if (!/Runs nicht verbunden|Noch keine Runs|Runs werden geladen/.test(bodyText)) problems.push(`[${name}] no honest Runs state`);
  if (!/Aktivität|Nicht verbunden/.test(bodyText)) problems.push(`[${name}] no honest Activity state`);
  // 6. no horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`[${name}] horizontal overflow: ${overflow}px`);
  // 7. command input usable
  const input = await page.$('input[aria-label="Befehl an JARVIS"]');
  if (!input) problems.push(`[${name}] command input missing`);

  await page.screenshot({ path: path.join(OUT, `wave7-${name}-empty.png`), fullPage: false });

  // 8. real data renders without crash
  TRUTH = REAL_TRUTH;
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.jcc', { timeout: 8000 });
  await page.waitForTimeout(500);
  const runRows = await page.$$eval('.mini-run .mr-t, .row .row-t', (els) => els.map((e) => e.textContent.trim()));
  if (!runRows.some((t) => /Repo-Diff zusammenfassen|Staging-Deploy/.test(t))) problems.push(`[${name}] real runs did not render: ${JSON.stringify(runRows)}`);
  const feed = await page.$$eval('.feed-r .m', (els) => els.map((e) => e.textContent.trim())).catch(() => []);
  if (!feed.some((t) => /Repo-Diff|Staging-Deploy/.test(t))) problems.push(`[${name}] real activity did not render`);
  await page.screenshot({ path: path.join(OUT, `wave7-${name}-real.png`), fullPage: false });

  // 9. navigation across every view without a crash
  for (const label of ['Chat', 'Tasks', 'Projekte', 'Memory', 'Freigaben', 'System', 'Logs', 'Home']) {
    const ok = await nav(page, label);
    if (!ok) problems.push(`[${name}] nav target not reachable: ${label}`);
    await page.waitForTimeout(140);
  }
  // Freigaben shows the projected approval
  await nav(page, 'Freigaben');
  await page.waitForTimeout(250);
  const apText = await page.textContent('body');
  if (!/DEPLOY_STAGING|Berührt eine Live-Umgebung/.test(apText)) problems.push(`[${name}] projected approval not shown on Freigaben`);

  // 9b. Live Binding: operator decision on a projected approval -> POST
  // /api/approvals/decide with the correlated run, never claims execution.
  decideCalls = [];
  const freigebenBtn = page.locator('.ap .btn.pri:has-text("Freigeben")').first();
  if (await freigebenBtn.count()) {
    await freigebenBtn.click();
    await page.waitForTimeout(400);
    if (!decideCalls.length) problems.push(`[${name}] approval decision did not call /api/approvals/decide`);
    else {
      const call = decideCalls[0];
      if (call.approval_id !== 'bbbbbbbb-2222-4222-8222-222222222222:approval') problems.push(`[${name}] approval decision sent wrong approval_id`);
      if (call.run_id !== 'bbbbbbbb-2222-4222-8222-222222222222') problems.push(`[${name}] approval decision did not correlate to the run`);
    }
    const decidedText = await page.textContent('body');
    if (/wurde ausgeführt|external.effect.*true/i.test(decidedText)) problems.push(`[${name}] UI must never claim execution from an approval decision`);
  } else {
    problems.push(`[${name}] projected approval has no decision button`);
  }

  // System view shows the real execution-chain binding state (no fake availability)
  await nav(page, 'System');
  await page.waitForTimeout(250);
  const sysText = await page.textContent('body');
  if (!/Ausführungskette/.test(sysText)) problems.push(`[${name}] execution-chain binding panel missing`);
  if (!/nicht gebunden|CLAUDE_CODE/i.test(sysText)) problems.push(`[${name}] Claude Code binding state not shown honestly`);

  // 10. command submit -> mocked /api/chat with correlation_id -> optimistic run
  chatCalls = [];
  await nav(page, 'Chat');
  await page.waitForTimeout(180);
  const chatInput = page.locator('input[aria-label="Befehl an JARVIS"]');
  await chatInput.fill('Systemstatus');
  await chatInput.press('Enter');
  await page.waitForTimeout(600);
  if (!chatCalls.length) problems.push(`[${name}] command submit did not call /api/chat`);
  else if (!/^[0-9a-f-]{36}$/i.test(String(chatCalls[0].correlation_id || ''))) problems.push(`[${name}] command submit sent no valid correlation_id`);
  if (consoleErrors.length) problems.push(`[${name}] console/page errors: ${consoleErrors.slice(0, 4).join(' | ')}`);

  await ctx.close();
}

try {
  await acceptViewport('desktop', 1440, 900);
  await acceptViewport('mobile', 390, 844);
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error('WAVE 7 BROWSER ACCEPTANCE FAILURES:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`JARVIS Command Center Wave 7 browser acceptance (1440x900 + 390x844): PASS — screenshots in ${OUT}`);
