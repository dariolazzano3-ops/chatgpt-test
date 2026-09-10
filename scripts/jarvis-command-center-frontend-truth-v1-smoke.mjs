import assert from 'node:assert/strict';
import { renderJarvisPrivateChatV1 } from '../src/jarvis/ui-v1.js';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';

const mounted = renderJarvisPrivateChatV1({ base_path: '/jarvis' });
const standalone = renderJarvisPrivateChatV1({ base_path: '' });

// --- Accepted visual baseline is preserved -----------------------------------
for (const html of [mounted, standalone]) {
  assert.match(html, /JARVIS · Private Command Center/);
  assert.match(html, /A BRIGHTER YOU/);
  assert.match(html, /class="shell"/);
  assert.match(html, /grid-template-columns:210px minmax\(0,1fr\) 280px/);
  assert.match(html, /@media\(max-width:760px\)/, 'accepted mobile baseline must stay');
  assert.match(html, /<h3>SYSTEMS<\/h3>/);
  assert.match(html, /<h3>SAFETY<\/h3>/);
  assert.match(html, /<h3>PRINCIPLE<\/h3>/);
  assert.match(html, /--warn:#ffd28b/, 'accepted amber token unchanged');
}

// --- System Status is wired to canonical Runtime Truth ----------------------
for (const id of ['sys-jarvis', 'sys-hermes', 'sys-astra', 'sys-claude', 'sys-codex', 'sys-bridge', 'sys-git']) {
  assert.match(mounted, new RegExp(`id="${id}"`), `${id} row must exist`);
}
assert.match(mounted, /getJson\(API_BASE\+'\/runtime-truth'\)/, 'UI must consume GET <base>/api/runtime-truth');
assert.match(mounted, /loadRuntimeTruth\(\)/);
assert.match(mounted, /classification==='REAL'\|\|src\.classification==='DERIVED'/, 'only canonical truth may render a live state');

// --- UNKNOWN renders as an explicit unavailable state ----------------------
assert.match(mounted, /'Nicht verbunden'/);
assert.match(mounted, /RUNTIME TRUTH · NICHT VERBUNDEN/);
assert.match(mounted, /JARVIS · NICHT VERBUNDEN/);

// --- Old hardcoded operational status path is gone -------------------------
assert.doesNotMatch(mounted, /pill\('core','ONLINE',true\)/);
assert.doesNotMatch(mounted, /id="core"/);
assert.doesNotMatch(mounted, />JARVIS Core</);
assert.doesNotMatch(mounted, /CORE ONLINE/, 'no static heartbeat claim');
assert.doesNotMatch(mounted, /CALENDAR PENDING/);

// --- No fake heartbeat: default indicator is the amber unknown dot --------
assert.match(mounted, /id="live-dot" class="dot unknown"/);
assert.match(mounted, /\.dot\.unknown\{background:var\(--warn\)/);
assert.match(mounted, /<span id="live-label">RUNTIME TRUTH<\/span>/);

// No fake latency / uptime / usage / timestamps are printed by the shell.
for (const forbidden of [/uptime/i, /heartbeat/i, /last seen/i, /zuletzt gesehen/i, /\d+\s?ms\b/, /\blatenz\b/i, /erfolgreich/i, /Slots?\b/, /Worker-Limit/i]) {
  assert.doesNotMatch(mounted, forbidden, `frontend must not fabricate metrics: ${forbidden}`);
}
// The only percent signs in the render belong to CSS, never to a status pill/row value.
for (const m of mounted.match(/<span[^>]*class="pill"[^>]*>[^<]*<\/span>/g) || []) {
  assert.doesNotMatch(m, /\d%/, `pill must not show a fabricated percentage: ${m}`);
}

// --- Standalone worker render keeps the neutral base path ----------------
assert.doesNotMatch(standalone, /\/jarvis\/api\//);
assert.match(standalone, /href="\/connect\/google"/);

// --- End to end: the endpoint the UI now calls fails closed --------------
const authorize = async () => ({ ok: true, operator_id: 'operator:fe@example.invalid', email: 'fe@example.invalid' });
const res = await handleJarvisHttpV1(
  new Request('https://example.invalid/jarvis/api/runtime-truth'),
  {},
  {},
  { authorize, now: '2026-09-11T12:00:00.000Z' }
);
assert.equal(res.status, 200);
const body = await res.json();
const canonical = body.systems.source.classification === 'REAL' || body.systems.source.classification === 'DERIVED';
assert.equal(canonical, false, 'with no probe wired the UI must fall back to Nicht verbunden');
for (const system of ['JARVIS', 'HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE', 'GIT']) {
  assert.equal(body.systems.data[system], 'UNKNOWN');
}

console.log('JARVIS Command Center Frontend Truth V1 smoke: PASS');
