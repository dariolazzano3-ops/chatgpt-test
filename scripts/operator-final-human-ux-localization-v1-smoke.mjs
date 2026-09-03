import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  applyOperatorFinalHumanUxLocalization,
  formatOperatorBerlinTimestamp,
  isTransientOperatorNetworkError,
  operatorFinalHumanUxLocalizationManifest,
  runBoundedOperatorRead
} from '../src/operator-final-human-ux-localization-v1.js';
import { applyOperatorDeploymentLocalization, operatorDeploymentLocalizationManifest } from '../src/operator-deployment-localization-v1.js';

assert.equal(formatOperatorBerlinTimestamp('2026-09-03T18:06:00Z'), '03.09.2026 · 20:06 MESZ');
assert.equal(formatOperatorBerlinTimestamp('2026-12-03T18:06:00Z'), '03.12.2026 · 19:06 MEZ');
assert.equal(formatOperatorBerlinTimestamp('not-a-date'), '–');
assert.equal(isTransientOperatorNetworkError(new Error('Load failed')), true);
assert.equal(isTransientOperatorNetworkError(new Error('Failed to fetch')), true);
assert.equal(isTransientOperatorNetworkError(new Error('HTTP 503')), false);

let calls = 0;
const recovered = await runBoundedOperatorRead(async () => {
  calls += 1;
  if (calls === 1) throw new Error('Load failed');
  return 'ok';
}, '/operator/api/projects', { method: 'GET' });
assert.equal(recovered, 'ok');
assert.equal(calls, 2, 'GET may retry exactly once after a transient network exception');

calls = 0;
await assert.rejects(() => runBoundedOperatorRead(async () => {
  calls += 1;
  throw new Error('Load failed');
}, '/operator/api/projects', { method: 'GET' }), /Load failed/);
assert.equal(calls, 2, 'failing GET stops after one bounded retry');

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  calls = 0;
  await assert.rejects(() => runBoundedOperatorRead(async () => {
    calls += 1;
    throw new Error('Load failed');
  }, '/operator/api/write', { method }), /Load failed/);
  assert.equal(calls, 1, `${method} must never be automatically retried`);
}

const html = `<!doctype html><html lang="de"><head></head><body>
<div class="deployment-identity-v1" data-deployment-identity-v1="true"><b>STAGING · 8c1f3fdb · deployed 2026-09-03 18:06 UTC</b><span class="locked">Production: LOCKED</span><span class="locked">External Writes: LOCKED</span></div>
<div id="project-detail"><div data-project-source-intake><label>Bulk Rights</label><select data-source-rights><option> CUSTOMER_ASSERTED </option><option> OWNED_CONFIRMED </option></select><label>Usage</label><select data-source-usage><option value="PROJECT_VISUAL">Project Visual</option><option value="GALLERY">Gallery</option></select><button data-source-upload>Upload</button></div></div>
<div><strong>PROJECT_SOURCE_UPLOAD_RECORDED</strong></div>
<button>Open Activity</button><input placeholder="Quick Jump...">
<div class="row"><strong>Control Plane</strong><span>LIVE_STAGING_CONTROL_READY</span><div>This component may limit or block operator work.</div></div>
<div><b>Mode</b><b>Budget</b><b>Spent</b><b>Reserved</b><b>Remaining</b><b>Paid Provider Calls</b><b>Production</b><b>External Writes</b></div>
</body></html>`;
const baseResponse = new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
const localized = await applyOperatorFinalHumanUxLocalization(baseResponse);
const deployed = await applyOperatorDeploymentLocalization(localized);
const output = await deployed.text();

assert.match(output, /aurentara-operator-final-localization-v1-script/);
assert.match(output, /Europe\/Berlin/);
assert.match(output, /STAGING · 8c1f3fdb · bereitgestellt<span class="operator-deployment-time">03\.09\.2026 · 20:06 MESZ<\/span>/);
assert.match(output, /Produktion: GESPERRT/);
assert.match(output, /Externe Schreibzugriffe: GESPERRT/);
assert.match(output, /CUSTOMER_ASSERTED:'Vom Kunden bestätigt'/);
assert.match(output, /OWNED_CONFIRMED:'Eigentum bestätigt'/);
assert.match(output, /CUSTOMER_LICENSED:'Vom Kunden lizenziert'/);
assert.match(output, /PUBLIC_REFERENCE_ONLY:'Nur als Referenz'/);
assert.match(output, /UNKNOWN:'Rechte ungeklärt'/);
assert.match(output, /RESTRICTED:'Nutzung eingeschränkt'/);
assert.match(output, /DO_NOT_PUBLISH:'Nicht veröffentlichen'/);
assert.match(output, /PROJECT_VISUAL:'Projektbild'/);
assert.match(output, /GALLERY:'Galerie'/);
assert.match(output, /PROJECT_SOURCE_UPLOAD_RECORDED:'Projektquelle hochgeladen'/);
assert.match(output, /PROJECT_SOURCE_WEBSITE_IMPORTED:'Website-Quelle importiert'/);
assert.match(output, /CONTROLLED_PAID_STAGING_ACTIVATED:'Kontrolliertes Paid-Staging aktiviert'/);
assert.match(output, /PROJECT_CREATED:'Projekt erstellt'/);
assert.match(output, /'Open Activity':'Aktivität öffnen'/);
assert.match(output, /'Quick Jump\.\.\.':'Schnellzugriff\.\.\.'/);
assert.match(output, /'Mode':'Modus'/);
assert.match(output, /'Spent':'Ausgegeben'/);
assert.match(output, /'Reserved':'Reserviert'/);
assert.match(output, /'Remaining':'Verfügbar'/);
assert.match(output, /'Paid Provider Calls':'Kostenpflichtige Provider-Aufrufe'/);
assert.match(output, /'This component may limit or block operator work\.':'Diese Komponente kann Operator-Arbeit einschränken oder blockieren\.'/);
assert.match(output, /Staging-Kontrolle bereit/);
assert.match(output, /LIVE_STAGING_CONTROL_READY/);
assert.match(output, /setAttribute\('value',raw\)/, 'rights enum is pinned before visible option text is localized');
assert.match(output, /const raw=String\(option\.value\|\|''\)\.trim\(\)/, 'usage localization is driven by unchanged API value');
assert.match(output, /if\(method!==\'GET\'\)return nativeFetch\(input,init\)/, 'browser retry bypasses all writes');
assert.match(output, /return nativeFetch\(input,init\);\n    \}/, 'browser GET path has one final retry and no loop');
assert.match(output, /sessionStorage\.setItem\(CONTEXT_KEY/);
assert.match(output, /detail:contextDetail\(\)/);
assert.match(output, /state\.selectedScope=before\.scope/);
assert.match(output, /state\.section=before\.section/);
assert.match(output, /renderProjectDetail\(before\.detail\)/);
assert.match(output, /⚠️ Verbindung fehlgeschlagen\. Bitte erneut versuchen\./);
assert.match(output, /Technisches Detail:/);

const sourceUi = await fs.readFile(new URL('../src/operator-project-source-intake-storage-dashboard-v1.js', import.meta.url), 'utf8');
assert.match(sourceUi, /fd\.append\('rights_status',root\.querySelector\('\[data-source-rights\]'\)\.value\.trim\(\)\)/);
assert.match(sourceUi, /fd\.append\('usage_role',root\.querySelector\('\[data-source-usage\]'\)\.value\)/);
assert.match(sourceUi, /method:'POST'/);
assert.match(sourceUi, /method:'DELETE'/);
const acceptedCards = await fs.readFile(new URL('../src/operator-project-source-intake-human-acceptance-ui-v1.js', import.meta.url), 'utf8');
for (const accepted of ['Eigene Website','Rechte: ','✅ Erfolgreich hinzugefügt','🔒 Privat gespeichert','Ansehen','Name bearbeiten','Löschen']) assert.ok(acceptedCards.includes(accepted), `accepted source card remains: ${accepted}`);

const manifest = operatorFinalHumanUxLocalizationManifest();
assert.equal(manifest.locale, 'de-DE');
assert.equal(manifest.time_zone, 'Europe/Berlin');
assert.equal(manifest.context_storage_scope, 'sessionStorage');
assert.equal(manifest.context_detail_snapshot, true);
assert.ok(manifest.context_detail_limit_bytes <= 500_000);
assert.equal(manifest.read_retry_maximum, 1);
assert.equal(manifest.write_retry_maximum, 0);
assert.equal(manifest.write_methods_retried, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);
assert.equal(manifest.paid_provider_calls, 0);
assert.equal(manifest.additional_variable_cost_eur, 0);
const deploymentManifest = operatorDeploymentLocalizationManifest();
assert.equal(deploymentManifest.stored_utc_unchanged, true);
assert.equal(deploymentManifest.production_deploy, false);
assert.equal(deploymentManifest.variable_cost_eur, 0);

console.log(JSON.stringify({
  status: 'PASS',
  summer: formatOperatorBerlinTimestamp('2026-09-03T18:06:00Z'),
  winter: formatOperatorBerlinTimestamp('2026-12-03T18:06:00Z'),
  read_retry_maximum: manifest.read_retry_maximum,
  write_retry_maximum: manifest.write_retry_maximum,
  context_retention: 'sessionStorage + selectedScope + section + bounded detail snapshot',
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
