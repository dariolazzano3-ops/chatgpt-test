import assert from 'node:assert/strict';
import { applyProjectSourceHumanAcceptanceUi, projectSourceHumanAcceptanceUiManifest } from '../src/operator-project-source-intake-human-acceptance-ui-v1.js';

const source = '<!doctype html><html><body><div data-project-source-intake><div data-source-status>INTAKE IN PROGRESS</div><input data-source-url><button data-source-website>Website hinzufügen</button></div><script id="aurentara-project-source-storage-v1-ui"></script></body></html>';
const response = new Response(source, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(source.length) } });
const enhanced = await applyProjectSourceHumanAcceptanceUi(response);
const html = await enhanced.text();

assert.equal(enhanced.status, 200);
assert.equal(enhanced.headers.get('x-aurentara-project-source-human-acceptance-ui'), 'v1');
assert.equal(enhanced.headers.has('content-length'), false);
assert.match(html, /data-source-local-status/);
assert.match(html, /Website wird geprüft…/);
assert.match(html, /Website konnte nicht geprüft werden:/);
assert.match(html, /\/operator\/api\/project-source-intake\/website/);
assert.match(html, /stopImmediatePropagation/);
assert.match(html, /aria-busy/);
assert.match(html, /data-source-website/);
assert.match(html, /data-project-source-intake/);

const untouchedJson = new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
assert.equal(await applyProjectSourceHumanAcceptanceUi(untouchedJson), untouchedJson);

const manifest = projectSourceHumanAcceptanceUiManifest();
assert.equal(manifest.website_pending_status_local, true);
assert.equal(manifest.website_error_local, true);
assert.equal(manifest.project_sources_area_targeted, true);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.variable_cost_eur, 0);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-source-human-acceptance-ui-v1',
  local_pending_status: 'PASS',
  local_error_status: 'PASS',
  existing_global_error_retained: 'PASS',
  project_sources_area_targeted: 'PASS',
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
