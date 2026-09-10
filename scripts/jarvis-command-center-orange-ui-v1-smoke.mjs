import assert from 'node:assert/strict';
import { renderJarvisCommandCenterV1, jarvisCommandCenterManifestV1 } from '../src/jarvis/command-center-v1.js';
import { handleJarvisHttpV1 } from '../src/jarvis/http-v1.js';
import { renderJarvisPrivateChatV1 } from '../src/jarvis/ui-v1.js';

/* Proves the served JARVIS Command Center is the ACCEPTED orange/amber
   jarvis-command-center.jsx — not the legacy blue src/jarvis/ui-v1.js — and
   that only its System Status section is wired to GET <base>/api/runtime-truth. */

const mounted = renderJarvisCommandCenterV1({ base_path: '/jarvis' });
const standalone = renderJarvisCommandCenterV1({ base_path: '' });

/* ── Accepted amber design system — markers copied from the accepted source ── */
const ACCEPTED = [
  '--amber:#ffab40', '--bg:#040405', '--hi:#ffd08a', '--deep:#ff7a1a',
  '--line:rgba(255,168,72,.17)',
  '.jcc{', '.bg-glow{', '.side-orb{', '.orb-center{', '.mini-orb{',
  "'Michroma'", "'IBM Plex Mono'", "'Manrope'",
  'fonts.googleapis.com',
  'Denken. Bauen.', 'Systemstatus', 'Command Center', 'Immer einen Schritt voraus',
  'VISUAL_BASELINE=ACCEPTED',
];
for (const marker of ACCEPTED) {
  assert.ok(mounted.includes(marker), `accepted orange UI marker missing: ${JSON.stringify(marker)}`);
  assert.ok(standalone.includes(marker), `accepted orange UI marker missing (standalone): ${JSON.stringify(marker)}`);
}

/* ── The legacy BLUE UI must not be able to satisfy this test ──
   These markers are unique to the accepted amber design system. */
const DISCRIMINATING = [
  '--amber:#ffab40', '--bg:#040405', '--hi:#ffd08a', '--deep:#ff7a1a',
  '--line:rgba(255,168,72,.17)', '.jcc{', '.bg-glow{', '.side-orb{', '.mini-orb{',
  "'Michroma'", "'Manrope'", 'fonts.googleapis.com', 'Denken. Bauen.', 'Immer einen Schritt voraus',
];
const BLUE = renderJarvisPrivateChatV1({ base_path: '/jarvis' });
for (const marker of DISCRIMINATING) {
  assert.ok(mounted.includes(marker), `accepted discriminating marker missing: ${JSON.stringify(marker)}`);
  assert.ok(!BLUE.includes(marker), `legacy blue UI unexpectedly contains accepted marker: ${JSON.stringify(marker)}`);
}
for (const forbidden of ['A BRIGHTER YOU', 'PERSONAL AI OS', '--blue:#8bd2ff', 'CORE ONLINE', 'renderJarvisPrivateChatV1']) {
  assert.ok(!mounted.includes(forbidden), `served Command Center must not contain legacy-blue marker: ${JSON.stringify(forbidden)}`);
}

/* ── System Status wired to canonical Runtime Truth ── */
for (const marker of ['/runtime-truth', 'Nicht verbunden', 'classification', 'HERMES', 'ASTRA', 'BRIDGE', 'CLAUDE', 'GIT']) {
  assert.ok(mounted.includes(marker), `runtime-truth wiring marker missing: ${JSON.stringify(marker)}`);
}
// No fake per-service latency / uptime / usage / slot metrics ship in System Status.
for (const fake of ['38 ms', '64 ms', '210 ms', '99,98 %', '99,91 %', '99,80 %', '1 von 2 Slots', '99,98']) {
  assert.ok(!mounted.includes(fake), `fake System Status metric still shipped: ${JSON.stringify(fake)}`);
}

/* ── Client boot: correct api base per host, no /jarvis/api/ leak for the neutral host ── */
assert.ok(mounted.includes('id="jarvis-command-center-root"'));
assert.ok(mounted.includes('"apiBase":"/jarvis/api"'));
assert.ok(standalone.includes('"apiBase":"/api"'));
assert.ok(!standalone.includes('/jarvis/api/'), 'neutral standalone host render must not contain /jarvis/api/');

/* ── Manifest ── */
const man = jarvisCommandCenterManifestV1();
assert.equal(man.visual_baseline, 'ACCEPTED');
assert.equal(man.source, 'src/jarvis/command-center-ui/jarvis-command-center.jsx');
assert.equal(man.legacy_blue_ui_used, false);
assert.equal(man.system_status_canonical_only, true);
assert.equal(man.system_status_fail_closed, 'Nicht verbunden');
assert.equal(man.production_deploy, false);
assert.equal(man.hamyren_data_flow, false);
assert.ok(man.bundle_bytes > 50000 && typeof man.bundle_sha256 === 'string' && man.bundle_sha256.length === 64);

/* ── End to end through the private worker ── */
const authorize = async () => ({ ok: true, operator_id: 'operator:cc@example.invalid', email: 'cc@example.invalid' });

const page = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis'), {}, {}, { authorize });
assert.equal(page.status, 200);
const pageHtml = await page.text();
assert.match(pageHtml, /--amber:#ffab40/);
assert.match(pageHtml, /JARVIS · Command Center/);
assert.doesNotMatch(pageHtml, /A BRIGHTER YOU/);
const csp = page.headers.get('content-security-policy') || '';
assert.match(csp, /frame-ancestors 'none'/);
assert.match(csp, /connect-src 'self'/);
assert.match(csp, /style-src 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
assert.match(csp, /font-src https:\/\/fonts\.gstatic\.com/);
assert.doesNotMatch(csp, /script-src[^;]*https:/, 'no external script origin — bundle is inline');

const legacy = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis/legacy'), {}, {}, { authorize });
assert.equal(legacy.status, 200);
assert.match(await legacy.text(), /A BRIGHTER YOU/, 'legacy blue UI still reachable at /jarvis/legacy');

const rt = await handleJarvisHttpV1(new Request('https://example.invalid/jarvis/api/runtime-truth'), {}, {}, { authorize });
const rtBody = await rt.json();
assert.equal(rt.status, 200);
const canonical = rtBody.systems.source.classification === 'REAL' || rtBody.systems.source.classification === 'DERIVED';
assert.equal(canonical, false, 'no probe wired -> System Status must fall back to Nicht verbunden');
for (const sysName of ['JARVIS', 'HERMES', 'ASTRA', 'CLAUDE', 'CODEX', 'BRIDGE', 'GIT']) {
  assert.equal(rtBody.systems.data[sysName], 'UNKNOWN');
}

console.log('JARVIS Command Center accepted orange UI V1 smoke: PASS');
