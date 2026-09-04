import assert from 'node:assert/strict';
import {
  applyProjectSourceHumanAcceptanceUi,
  handleProjectSourceHumanAcceptanceApi,
  projectSourceHumanAcceptanceUiManifest
} from '../src/operator-project-source-intake-human-acceptance-ui-v1.js';
import { createProjectSourceIntakeState, registerProjectSource } from '../src/project-source-intake-v1.js';

const operatorId = 'operator:human-ux@example.com';
const gelatoIdentity = {
  operator_id: operatorId,
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1'
};
const otherIdentity = {
  operator_id: operatorId,
  customer_id: 'other-customer',
  project_id: 'other-project-v1',
  scope_key: 'other-customer:other-project-v1'
};

function seededState(identity) {
  const created = createProjectSourceIntakeState({ ...identity, at: '2026-09-03T18:00:00.000Z' });
  assert.equal(created.ok, true);
  return created.state;
}

let gelatoState = seededState(gelatoIdentity);
let registered = registerProjectSource(gelatoState, {
  ...gelatoIdentity,
  source_id: 'gelato-image-source',
  source_type: 'IMAGE_VISUAL',
  storage_ref: 'supabase://project-source-intake-private/operator-gelato/project-gelato/scope-gelato/source/PNG.png',
  display_name: 'PNG.png',
  mime_type: 'image/png',
  ownership_status: 'OWNED_CONFIRMED',
  content_hash: 'sha256-gelato-image'
}, { at: '2026-09-03T18:01:00.000Z' });
assert.equal(registered.ok, true);
gelatoState = registered.state;
registered = registerProjectSource(gelatoState, {
  ...gelatoIdentity,
  source_id: 'gelato-website-source',
  source_type: 'OWNED_WEBSITE',
  locator: 'https://gelato.example',
  display_name: 'Website source',
  ownership_status: 'CUSTOMER_ASSERTED'
}, { at: '2026-09-03T18:02:00.000Z' });
assert.equal(registered.ok, true);
gelatoState = registered.state;

const records = new Map([
  [gelatoIdentity.scope_key, { identity: gelatoIdentity, state: gelatoState, revision: 11 }],
  [otherIdentity.scope_key, { identity: otherIdentity, state: seededState(otherIdentity), revision: 4 }]
]);
const runtimeEvents = [];
const service = {
  async getProjectSourceIntake({ scope_key }) {
    const record = records.get(scope_key);
    if (!record) return { ok: false, status: 404, body: { error: 'PROJECT_NOT_FOUND' } };
    return {
      ok: true,
      status: 200,
      body: {
        state: structuredClone(record.state),
        identity: structuredClone(record.identity),
        runtime_revision: record.revision,
        persisted: true
      }
    };
  },
  async saveProjectSourceIntake({ state, expected_revision, event }) {
    const record = records.get(state.scope_key);
    if (!record) return { ok: false, status: 404, body: { error: 'PROJECT_NOT_FOUND' } };
    if (expected_revision !== record.revision) return { ok: false, status: 409, body: { error: 'OPERATOR_RUNTIME_REVISION_CONFLICT' } };
    record.state = structuredClone(state);
    record.revision += 1;
    runtimeEvents.push({ scope_key: state.scope_key, event });
    return { ok: true, status: 200, body: { runtime_revision: record.revision } };
  }
};
const authorize = async () => ({ ok: true, status: 200, operator_id: operatorId, email: 'human-ux@example.com' });
const options = { runtime_service: service, authorize };

// Display-name editing is metadata-only and preserves storage/provenance identity.
const before = structuredClone(records.get(gelatoIdentity.scope_key).state.sources.find((source) => source.source_id === 'gelato-image-source'));
const beforeKnowledgeRevision = records.get(gelatoIdentity.scope_key).state.knowledge_revision;
let response = await handleProjectSourceHumanAcceptanceApi(new Request('https://operator.example/operator/api/project-source-intake/rename', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: gelatoIdentity.scope_key, source_id: 'gelato-image-source', display_name: 'Spaghetti Eis' })
}), {}, {}, options);
assert.equal(response.status, 200);
let body = await response.json();
assert.equal(body.ok, true);
assert.equal(body.changed, true);
assert.equal(body.metadata_only, true);
assert.equal(body.storage_ref_unchanged, true);
assert.equal(body.content_hash_unchanged, true);
assert.equal(body.source_id_unchanged, true);
assert.equal(body.source_version_unchanged, true);
assert.equal(body.knowledge_revision_unchanged, true);
assert.equal(body.variable_cost_eur, 0);
assert.equal(body.paid_provider_calls, 0);
assert.equal(body.production_deploy, false);

const afterRecord = records.get(gelatoIdentity.scope_key);
const after = afterRecord.state.sources.find((source) => source.source_id === 'gelato-image-source');
assert.equal(after.display_name, 'Spaghetti Eis');
assert.equal(after.storage_ref, before.storage_ref);
assert.equal(after.content_hash, before.content_hash);
assert.equal(after.source_id, before.source_id);
assert.equal(after.version, before.version);
assert.equal(afterRecord.state.knowledge_revision, beforeKnowledgeRevision);
assert.equal(afterRecord.state.audit.at(-1).event, 'PROJECT_SOURCE_DISPLAY_NAME_UPDATED');
assert.equal(afterRecord.state.audit.at(-1).previous_display_name, 'PNG.png');
assert.equal(runtimeEvents.at(-1).event, 'PROJECT_SOURCE_DISPLAY_NAME_UPDATED');

// Reload/persistence: a fresh read keeps the edited display name.
const reloaded = await service.getProjectSourceIntake({ scope_key: gelatoIdentity.scope_key });
assert.equal(reloaded.body.state.sources.find((source) => source.source_id === 'gelato-image-source').display_name, 'Spaghetti Eis');

// Cross-project edits fail closed even with a valid source id from Gelato.
response = await handleProjectSourceHumanAcceptanceApi(new Request('https://operator.example/operator/api/project-source-intake/rename', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: otherIdentity.scope_key, source_id: 'gelato-image-source', display_name: 'Cross Project Rename' })
}), {}, {}, options);
assert.equal(response.status, 404);
body = await response.json();
assert.equal(body.error, 'PROJECT_SOURCE_NOT_FOUND');
assert.equal(records.get(gelatoIdentity.scope_key).state.sources.find((source) => source.source_id === 'gelato-image-source').display_name, 'Spaghetti Eis');

// Blank names are rejected without runtime mutation.
const revisionBeforeBlank = records.get(gelatoIdentity.scope_key).revision;
response = await handleProjectSourceHumanAcceptanceApi(new Request('https://operator.example/operator/api/project-source-intake/rename', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: gelatoIdentity.scope_key, source_id: 'gelato-image-source', display_name: '   ' })
}), {}, {}, options);
assert.equal(response.status, 400);
assert.equal(records.get(gelatoIdentity.scope_key).revision, revisionBeforeBlank);

// Normal dashboard HTML gets the local Polish layer without replacing the existing Source UI.
const source = '<!doctype html><html><body><div data-project-source-intake data-scope="gelato-donatello:gelato-donatello-website-v1"><div data-source-status>INTAKE IN PROGRESS</div><input type="file" multiple data-source-files><select data-source-rights><option>CUSTOMER_ASSERTED</option></select><select data-source-usage><option>PROJECT_VISUAL</option></select><button data-source-upload>Upload</button><div data-source-cards></div><input data-source-url><button data-source-website>Website hinzufügen</button></div><script id="aurentara-project-source-storage-v1-ui"></script></body></html>';
response = new Response(source, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(source.length) } });
const enhanced = await applyProjectSourceHumanAcceptanceUi(response);
const html = await enhanced.text();

assert.equal(enhanced.status, 200);
assert.equal(enhanced.headers.get('x-aurentara-project-source-human-acceptance-ui'), 'v1');
assert.equal(enhanced.headers.has('content-length'), false);
assert.match(html, /data-source-local-status/);
assert.match(html, /Website wird geprüft…/);
assert.match(html, /✅ Website erfolgreich hinzugefügt/);
assert.match(html, /Dateien werden hochgeladen…/);
assert.match(html, /Dateien erfolgreich hochgeladen/);
assert.match(html, /Project Sources werden aktualisiert…/);
assert.match(html, /Mehrere Dateien können gleichzeitig ausgewählt werden/);
assert.match(html, /Strg\/Shift/);
assert.match(html, /Dateien ausgewählt/);
assert.match(html, /Dieses Dateiformat wird aktuell nicht unterstützt/);
assert.match(html, /PROJECT_SOURCE_UPLOAD_MIME_UNSUPPORTED/);
assert.match(html, /Name bearbeiten/);
assert.match(html, /Ansehen/);
assert.match(html, /Herunterladen/);
assert.match(html, /data-polish-preview/);
assert.match(html, /data-polish-download/);
assert.match(html, /\/operator\/api\/project-source-intake\/preview/);
assert.match(html, /Für diesen Dateityp ist keine sichere Vorschau verfügbar/);
assert.match(html, /Name wird gespeichert…/);
assert.match(html, /✅ Name gespeichert/);
assert.match(html, /\/operator\/api\/project-source-intake'\+path/);
assert.match(html, /sourceFetch\('\/rename'/);
assert.match(html, /Eigene Website/);
assert.match(html, /Referenz-Website/);
assert.match(html, /Manuelle Information/);
assert.match(html, /Eigentum bestätigt/);
assert.match(html, /Vom Kunden bestätigt/);
assert.match(html, /Vom Kunden lizenziert/);
assert.match(html, /Nur als Referenz/);
assert.match(html, /Rechte ungeklärt/);
assert.match(html, /Nutzung eingeschränkt/);
assert.match(html, /Nicht veröffentlichen/);
assert.match(html, /Bereit mit Hinweisen/);
assert.match(html, /Intake läuft/);
assert.match(html, /🔒 Privat gespeichert/);
assert.match(html, /✅ Source gelöscht/);
assert.match(html, /stopImmediatePropagation/);
assert.match(html, /aria-busy/);
assert.doesNotMatch(html, /window\.location\.reload/);
assert.doesNotMatch(html, /Private storage:/);
assert.doesNotMatch(html, /Rights:/);
assert.equal(html.includes('image/heic'), false);
assert.equal(html.includes('image/heif'), false);
assert.equal(html.includes('image/svg+xml'), false);

const untouchedJson = new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
assert.equal(await applyProjectSourceHumanAcceptanceUi(untouchedJson), untouchedJson);

const manifest = projectSourceHumanAcceptanceUiManifest();
assert.equal(manifest.website_pending_status_local, true);
assert.equal(manifest.website_error_local, true);
assert.equal(manifest.upload_pending_status_local, true);
assert.equal(manifest.upload_error_local, true);
assert.equal(manifest.multi_file_selection_feedback, true);
assert.equal(manifest.client_mime_precheck_matches_server_allowlist, true);
assert.equal(manifest.server_mime_validation_authoritative, true);
assert.equal(manifest.source_display_name_editing, true);
assert.equal(manifest.private_preview_action, true);
assert.equal(manifest.explicit_download_action, true);
assert.equal(manifest.unsafe_preview_human_message, true);
assert.equal(manifest.storage_object_rename, false);
assert.equal(manifest.german_source_presentation, true);
assert.equal(manifest.project_context_retained_without_reload, true);
assert.equal(manifest.project_sources_area_targeted, true);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.variable_cost_eur, 0);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-source-human-acceptance-ui-v1',
  upload_busy_feedback: 'PASS',
  local_upload_error: 'PASS',
  multi_file_selection_feedback: 'PASS',
  display_name_rename: 'PASS',
  private_preview_action: 'PASS',
  explicit_download_action: 'PASS',
  unsafe_preview_message: 'PASS',
  rename_persisted_after_reload: 'PASS',
  rename_storage_ref_unchanged: 'PASS',
  rename_hash_unchanged: 'PASS',
  rename_source_id_unchanged: 'PASS',
  cross_project_rename_denied: 'PASS',
  german_presentation: 'PASS',
  website_busy_feedback: 'PASS',
  project_context_retention: 'PASS',
  local_success_states: 'PASS',
  client_mime_precheck: 'PASS',
  server_validation_authoritative: true,
  storage_object_rename: false,
  paid_provider_calls: 0,
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));