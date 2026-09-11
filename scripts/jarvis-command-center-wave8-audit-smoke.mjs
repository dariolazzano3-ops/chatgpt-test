import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import {
  auditJarvisCommandCenterFieldsV1,
  JARVIS_COMMAND_CENTER_FIELD_AUDIT_V1
} from '../src/jarvis/command-center-field-audit-v1.js';
import { renderJarvisCommandCenterV1 } from '../src/jarvis/command-center-v1.js';
import { jarvisCommandCenterWorkerChainV1 } from '../src/jarvis/command-center-worker-binding-v1.js';
import { JARVIS_SYSTEM_STATUS } from '../src/jarvis/command-center-runtime-truth-v1.js';

// ── 1. Field audit: every operational field classified, no MOCK masquerades ──
const audit = auditJarvisCommandCenterFieldsV1();
assert.equal(audit.ok, true, 'field audit violations: ' + JSON.stringify(audit.violations));
assert.equal(audit.operational_mock_masquerading_as_real, 0);
assert.ok(audit.field_count >= 20);
for (const f of JARVIS_COMMAND_CENTER_FIELD_AUDIT_V1) {
  assert.ok(['REAL', 'DERIVED', 'UNKNOWN', 'MOCK', 'STATIC'].includes(f.classification), `bad class for ${f.field}`);
  if (f.classification === 'MOCK') assert.ok(f.decorative || f.labelled === true, `unlabelled operational MOCK: ${f.field}`);
}
// every domain that the runtime-truth adapter can serve is REAL or DERIVED here
for (const surface of ['Runs', 'Activity', 'Approvals', 'Evidence']) {
  const rows = JARVIS_COMMAND_CENTER_FIELD_AUDIT_V1.filter((f) => f.surface === surface);
  assert.ok(rows.length && rows.every((f) => ['REAL', 'DERIVED', 'UNKNOWN'].includes(f.classification)), `${surface} not real/fail-closed`);
}

// ── 2. System semantics match the canonical adapter enums ──
for (const [sys, states] of Object.entries(audit.system_semantics)) {
  assert.deepEqual(states, [...JARVIS_SYSTEM_STATUS[sys]], `system semantics drift for ${sys}`);
}

// ── 3. Worker chain: nothing fake ──
const chain = jarvisCommandCenterWorkerChainV1();
assert.equal(chain.claude_execution_bridge_bound, false);
assert.equal(chain.fallback_active, false);
assert.equal(chain.codex_binding_present, false);
assert.equal(chain.worker_output_self_accepts, false);
assert.equal(chain.implementation_commands_fail_closed, true);

// ── 4. Static scan of the SERVED bundle for forbidden fabricated values ──
const html = renderJarvisCommandCenterV1({ base_path: '/jarvis' });
const FORBIDDEN = [
  // fake service metrics
  '38 ms', '64 ms', '210 ms', '99,98 %', '99,91 %', '99,80 %', '1 von 2 Slots',
  // fake run/activity/approval seed
  'Command Center V1: Home-Ansicht', 'Nightly: Dependency-Audit aller Repos',
  'AURENTARA: Landing-Copy veröffentlichen', 'Wartet auf Freigabe A-031',
  'Evidence-Paket E-3812 signiert', '12 von 12 Prüfungen bestanden',
  '94 %', '+11 diese Woche', 'main@a3f9e21',
  // fake health / brain replies
  'System stabil', 'Alle fünf Kernsysteme sind erreichbar', 'Das Ergebnis kommt mit Evidence',
  // legacy blue
  'A BRIGHTER YOU', 'PERSONAL AI OS', '--blue:#8bd2ff', 'CORE ONLINE',
];
for (const bad of FORBIDDEN) {
  assert.ok(!html.includes(bad), `forbidden fabricated value in served bundle: ${JSON.stringify(bad)}`);
}
// hardcoded LiveTag "Online" health claim must be gone from sidebar/footer
assert.ok(!/label="Online"/.test(html), 'static Online LiveTag still present');
// honest fail-closed vocabulary is present
for (const marker of ['Nicht verbunden', 'Unbekannt', 'Noch keine Runs', 'Keine Evidence verknüpft', 'fail-closed']) {
  assert.ok(html.includes(marker), `fail-closed marker missing: ${JSON.stringify(marker)}`);
}

// ── 5. repo grep: no committed secrets, no forbidden external action wiring ──
const grep = (re, paths) => {
  try { return execSync(`git grep -nI -E ${JSON.stringify(re)} -- ${paths}`, { encoding: 'utf8' }); }
  catch { return ''; }
};
const CC_SRC = 'src/jarvis/command-center-ui src/jarvis/command-center-v1.js src/jarvis/command-center-worker-binding-v1.js src/jarvis/command-center-read-bindings-v1.js src/jarvis/command-center-field-audit-v1.js';
assert.equal(grep('sk-[A-Za-z0-9]{16}|gh[pous]_[A-Za-z0-9]{20}|BEGIN [A-Z ]*PRIVATE KEY|SERVICE_ROLE_KEY *= *["\\x27][A-Za-z0-9]', CC_SRC), '', 'possible secret material in Command Center sources');
assert.equal(grep('wrangler +deploy|DROP +TABLE|TRUNCATE +|rm +-rf|dns_records|zones/[a-z0-9]+/dns|/billing/|git +push|git +merge', CC_SRC), '', 'forbidden external-action wiring in Command Center frontend sources');

// ── 6. accepted visual baseline still intact ──
for (const marker of ['--amber:#ffab40', '--bg:#040405', '--hi:#ffd08a', '--deep:#ff7a1a', '.jcc{', 'bg-glow', "'Michroma'"]) {
  assert.ok(html.includes(marker), `accepted design token missing: ${JSON.stringify(marker)}`);
}
// mobile nav cascade fix: the media block follows the .mnav base rule
const jsx = fs.readFileSync('src/jarvis/command-center-ui/jarvis-command-center.jsx', 'utf8');
const mnavBase = jsx.indexOf('.mnav{display:none;position:fixed');
const media980 = jsx.indexOf('@media (max-width:980px){\n  .shell{grid-template-columns:1fr}');
assert.ok(mnavBase > 0 && media980 > mnavBase, 'mobile-nav @media block must follow the .mnav base rule');

console.log('JARVIS Command Center Wave 8 final runtime-truth + safety audit: PASS');
