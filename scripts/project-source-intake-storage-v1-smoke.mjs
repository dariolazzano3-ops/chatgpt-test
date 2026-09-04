import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import {
  createProjectSourceStorageClient,
  assertProjectSourceStorageRefBound,
  validateProjectSourceUploadDescriptor,
  projectSourceStorageManifest,
  PROJECT_SOURCE_BUCKET
} from '../src/project-source-storage-supabase-v1.js';
import { handleOperatorDashboard } from '../src/operator-project-source-intake-storage-dashboard-v1.js';
import { intakeManualSource, buildWorkspacePacksAndReadiness } from '../src/project-source-workspace-intake-v1.js';
import { registerProjectSource } from '../src/project-source-intake-v1.js';

const operatorId = 'operator:test@example.com';
const gelato = {
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1',
  name: 'Gelato Donatello',
  state: 'ACTIVE',
  blocked: false,
  production_deploy: false,
  controlled_paid_staging: { project_budget_ceiling_eur: 25, current_spend_eur: 0, reserved_eur: 0 }
};
const other = {
  customer_id: 'other-customer',
  project_id: 'other-project-v1',
  scope_key: 'other-customer:other-project-v1',
  name: 'Other Project',
  state: 'READY',
  blocked: false,
  production_deploy: false
};

const created = createOperatorRuntime({ operator_id: operatorId, portfolio: { operator_id: operatorId, projects: [gelato, other], production_deploy: false } });
assert.equal(created.ok, true);
const store = createMemoryOperatorRuntimeStore([created.runtime]);
const core = createOperatorRuntimeApiService({ operator_id: operatorId, store });
const service = withProjectSourceIntakeRuntimeService({ service: core, store, operator_id: operatorId });

const objects = new Map();
const storageCalls = [];
function storageObjectPath(url) {
  const marker = `/storage/v1/object/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}
const fakeFetcher = async (input, init = {}) => {
  const url = String(input);
  const method = String(init.method || 'GET').toUpperCase();
  storageCalls.push({ url, method, authorization: new Headers(init.headers || {}).has('authorization') });
  if (method === 'POST') {
    const path = storageObjectPath(url);
    if (!path) return new Response(JSON.stringify({ error: 'bad path' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const body = init.body instanceof Uint8Array ? init.body : new Uint8Array(await new Response(init.body).arrayBuffer());
    objects.set(path, { body, type: new Headers(init.headers || {}).get('content-type') || 'application/octet-stream' });
    return new Response(JSON.stringify({ Key: `${PROJECT_SOURCE_BUCKET}/${path}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'DELETE') {
    const parsed = JSON.parse(String(init.body || '{}'));
    for (const path of parsed.prefixes || []) objects.delete(path);
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'GET' && url.includes(`/storage/v1/object/authenticated/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}/`)) {
    const marker = `/storage/v1/object/authenticated/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}/`;
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length));
    const item = objects.get(path);
    if (!item) return new Response('not found', { status: 404 });
    return new Response(item.body, { status: 200, headers: { 'content-type': item.type, 'content-length': String(item.body.byteLength) } });
  }
  return new Response('not found', { status: 404 });
};

const env = {
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL: 'https://example.supabase.co',
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-secret'
};
const storage = createProjectSourceStorageClient(env, { fetcher: fakeFetcher });
const identity = { operator_id: operatorId, customer_id: gelato.customer_id, project_id: gelato.project_id, scope_key: gelato.scope_key };
const otherIdentity = { operator_id: operatorId, customer_id: other.customer_id, project_id: other.project_id, scope_key: other.scope_key };

const makeFile = (name, type, text) => {
  const blob = new Blob([text], { type });
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
};

// Bucket/storage contract.
const manifest = projectSourceStorageManifest();
assert.equal(manifest.bucket, 'project-source-intake-private');
assert.equal(manifest.bucket_public, false);
assert.equal(manifest.browser_service_role_exposed, false);
assert.equal(manifest.runtime_binary_storage, false);
assert.equal(manifest.variable_cost_eur, 0);
assert.equal(manifest.production_deploy, false);

// MIME, size and unsafe filename controls.
assert.equal(validateProjectSourceUploadDescriptor({ filename: 'payload.svg', mime_type: 'image/svg+xml', size: 50 }).error, 'PROJECT_SOURCE_UPLOAD_MIME_UNSUPPORTED');
assert.equal(validateProjectSourceUploadDescriptor({ filename: 'huge.png', mime_type: 'image/png', size: 15 * 1024 * 1024 + 1 }).error, 'PROJECT_SOURCE_UPLOAD_TOO_LARGE');
const traversal = await storage.upload(makeFile('../../Logo final?.png', 'image/png', 'synthetic-logo'), identity);
assert.equal(traversal.ok, true);
assert.equal(traversal.filename.includes('/'), false);
assert.equal(traversal.filename.includes('..'), false);
assert.equal(traversal.filename_was_sanitized, true);
assert.equal(traversal.public_url, null);
assert.equal((await assertProjectSourceStorageRefBound(traversal.storage_ref, identity)).ok, true);
assert.equal((await assertProjectSourceStorageRefBound(traversal.storage_ref, otherIdentity)).error, 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED');
assert.equal((await storage.download(traversal.storage_ref, otherIdentity)).error, 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED');
assert.equal((await storage.remove(traversal.storage_ref, otherIdentity)).error, 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED');
await storage.remove(traversal.storage_ref, identity);

const authorize = async () => ({ ok: true, status: 200, operator_id: operatorId, email: 'test@example.com' });
const handlerOptions = { runtime_service: service, project_source_storage_client: storage, authorize };

// Invalid scope is rejected before any storage write.
const beforeInvalid = storageCalls.length;
const invalidForm = new FormData();
invalidForm.append('scope_key', 'not-a-real-project');
invalidForm.append('files', makeFile('x.png', 'image/png', 'x'), 'x.png');
let response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/upload', { method: 'POST', body: invalidForm }), env, {}, handlerOptions);
assert.equal(response.status, 404);
assert.equal(storageCalls.length, beforeInvalid);

// Multi-image + multi-file upload, one bulk rights decision, and mobile-compatible multipart.
const upload = new FormData();
upload.append('scope_key', gelato.scope_key);
upload.append('rights_status', 'OWNED_CONFIRMED');
upload.append('usage_role', 'GALLERY');
upload.append('files', makeFile('gelato-logo.png', 'image/png', 'logo-fixture'), 'gelato-logo.png');
upload.append('files', makeFile('gelato-hero.webp', 'image/webp', 'hero-fixture'), 'gelato-hero.webp');
upload.append('files', makeFile('gelato-sortiment.pdf', 'application/pdf', 'pdf-fixture'), 'gelato-sortiment.pdf');
response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/upload', {
  method: 'POST',
  headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
  body: upload
}), env, {}, handlerOptions);
assert.equal(response.status, 201);
const uploaded = await response.json();
assert.equal(uploaded.ok, true);
assert.equal(uploaded.items.length, 3);
assert.equal(uploaded.multi_upload, true);
assert.equal(uploaded.bulk_rights_status, 'OWNED_CONFIRMED');
assert.equal(uploaded.mobile_compatible_multipart, true);
assert.equal(uploaded.binary_data_in_runtime_json, false);
assert.equal(uploaded.variable_cost_eur, 0);
assert.equal(uploaded.paid_provider_calls, 0);

// Source cards / runtime metadata contain refs only, never the fixture bytes or service role.
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake?scope_key=${encodeURIComponent(gelato.scope_key)}`), env, {}, handlerOptions);
assert.equal(response.status, 200);
const sourceView = await response.json();
assert.equal(sourceView.workspace.sections.project_sources.length, 3);
assert.equal(sourceView.storage.private, true);
assert.equal(sourceView.storage.public_access, false);
const durable = await store.load(operatorId);
const runtimeJson = JSON.stringify(durable);
assert.equal(runtimeJson.includes('logo-fixture'), false);
assert.equal(runtimeJson.includes('hero-fixture'), false);
assert.equal(runtimeJson.includes('pdf-fixture'), false);
assert.equal(runtimeJson.includes('synthetic-service-role-secret'), false);
assert.equal(runtimeJson.includes('supabase://project-source-intake-private/'), true);

// Cross-project read is denied even when a valid ref from another project is supplied.
const gelatoRef = sourceView.workspace.sections.project_sources[0].storage_ref;
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/object?scope_key=${encodeURIComponent(other.scope_key)}&storage_ref=${encodeURIComponent(gelatoRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 404);

// Explicit same-project private read works through the Access-gated Worker route.
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/object?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(gelatoRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(response.headers.get('x-aurentara-public-active'), 'false');
assert.match(response.headers.get('content-disposition') || '', /^attachment;/);

// Private preview is a separate authenticated, project-scoped route with a strict inline MIME allowlist.
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/preview?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(gelatoRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.equal(response.headers.get('x-aurentara-public-active'), 'false');
assert.equal(response.headers.get('x-aurentara-project-source-preview'), 'private-inline-v1');
assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
assert.match(response.headers.get('content-security-policy') || '', /sandbox/);
assert.match(response.headers.get('content-disposition') || '', /^inline;/);
assert.equal(response.headers.get('content-type'), 'image/png');

// Cross-project preview fails closed before object bytes are returned.
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/preview?scope_key=${encodeURIComponent(other.scope_key)}&storage_ref=${encodeURIComponent(gelatoRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 404);

// Unauthenticated preview fails closed through the existing operator auth gate.
response = await handleOperatorDashboard(
  new Request(`https://operator.example/operator/api/project-source-intake/preview?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(gelatoRef)}`),
  env,
  {},
  { ...handlerOptions, authorize: async () => ({ ok: false, status: 401, error: 'CLOUDFLARE_ACCESS_REQUIRED' }) }
);
assert.equal(response.status, 401);
assert.equal((await response.json()).private_operator_access_required, true);

// PDF is explicitly previewable under the same security headers.
const pdfRef = sourceView.workspace.sections.project_sources.find((source) => source.mime_type === 'application/pdf').storage_ref;
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/preview?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(pdfRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 200);
assert.equal(response.headers.get('content-type'), 'application/pdf');
assert.match(response.headers.get('content-disposition') || '', /^inline;/);

// Unsafe/active MIME stays download-only.
const htmlUpload = new FormData();
htmlUpload.append('scope_key', gelato.scope_key);
htmlUpload.append('rights_status', 'OWNED_CONFIRMED');
htmlUpload.append('files', makeFile('gelato-notes.html', 'text/html', '<p>private fixture</p>'), 'gelato-notes.html');
response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/upload', { method: 'POST', body: htmlUpload }), env, {}, handlerOptions);
assert.equal(response.status, 201);
const htmlUploaded = await response.json();
const htmlRef = htmlUploaded.items[0].storage_ref;
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/preview?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(htmlRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 415);
let previewError = await response.json();
assert.equal(previewError.error, 'PROJECT_SOURCE_PREVIEW_MIME_NOT_ALLOWED');
assert.equal(previewError.inline_preview, false);
assert.equal(previewError.download_available, true);
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/object?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(htmlRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 200);
assert.match(response.headers.get('content-disposition') || '', /^attachment;/);

// Response MIME must match registered source MIME or preview fails closed.
const parsedGelatoRef = gelatoRef.replace('supabase://project-source-intake-private/', '');
const storedGelatoObject = objects.get(parsedGelatoRef);
assert.ok(storedGelatoObject);
const originalGelatoType = storedGelatoObject.type;
storedGelatoObject.type = 'text/html';
response = await handleOperatorDashboard(new Request(`https://operator.example/operator/api/project-source-intake/preview?scope_key=${encodeURIComponent(gelato.scope_key)}&storage_ref=${encodeURIComponent(gelatoRef)}`), env, {}, handlerOptions);
assert.equal(response.status, 415);
previewError = await response.json();
assert.equal(previewError.error, 'PROJECT_SOURCE_PREVIEW_MIME_MISMATCH');
storedGelatoObject.type = originalGelatoType;

// Human manual categories map to existing canonical field paths; technical field_path input cannot override an explicit category.
const categoryFacts = [
  ['offering','business.offerings','Eis'],
  ['product','business.products','Eistorte'],
  ['price','business.pricing','1,60 EUR'],
  ['opening_hours','business.opening_hours','10:00–22:00'],
  ['phone','business.phone','0681 123456'],
  ['email','business.email','info@example.invalid'],
  ['address','business.address','Saarbrücken'],
  ['description','business.description','Gelateria'],
  ['other','content.summary','Sonstige Information']
].map(([manual_category, expected_path, value], index) => ({ fact_id: `manual-category-${index}`, manual_category, field_path: 'should.not.override.category', expected_path, value }));
const otherBeforeManual = await service.getProjectSourceIntake({ scope_key: other.scope_key });
response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/manual', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: other.scope_key,
    display_name: 'Human category mapping',
    facts: categoryFacts.map(({ expected_path, ...fact }) => fact)
  })
}), env, {}, handlerOptions);
assert.equal(response.status, 201);
const manualCategoryResponse = await response.json();
assert.equal(manualCategoryResponse.auto_verified, false);
assert.equal(manualCategoryResponse.production_deploy, false);
assert.equal(manualCategoryResponse.facts.length, categoryFacts.length);
for (let index = 0; index < categoryFacts.length; index += 1) {
  assert.equal(manualCategoryResponse.facts[index].field_path, categoryFacts[index].expected_path);
  assert.equal(manualCategoryResponse.facts[index].verification_status, 'UNVERIFIED');
  assert.equal(manualCategoryResponse.facts[index].origin, 'MANUAL');
}
const otherAfterManual = await service.getProjectSourceIntake({ scope_key: other.scope_key });
assert.equal(otherAfterManual.body.state.knowledge_revision > otherBeforeManual.body.state.knowledge_revision, true);
assert.equal(otherAfterManual.body.state.record_revision > otherBeforeManual.body.state.record_revision, true);
const runtimeAfterManual = await store.load(operatorId);
assert.equal(runtimeAfterManual.audit.some((event) => event.event === 'PROJECT_SOURCE_MANUAL_INPUT_RECORDED' && event.scope_key === other.scope_key), true);

// // Website purpose updates are project-scoped, audited, metadata-only and keep source identity stable.
let websiteRead = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
let websiteState = websiteRead.body.state;
const websiteRegistered = registerProjectSource(websiteState, {
  source_id: 'gelato-owned-website-purpose',
  source_type: 'OWNED_WEBSITE',
  locator: 'https://gelato.example/',
  ownership_status: 'OWNED_CONFIRMED',
  content_hash: 'website-purpose-v1',
  website_usage: { content: true, structure_reference: false, design_reference: false }
});
assert.equal(websiteRegistered.ok, true);
let websiteSaved = await service.saveProjectSourceIntake({
  state: websiteRegistered.state,
  expected_revision: websiteRead.body.runtime_revision,
  event: 'GELATO_WEBSITE_PURPOSE_FIXTURE_RECORDED'
});
assert.equal(websiteSaved.ok, true);

websiteRead = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
const websiteBefore = websiteRead.body.state.sources.find((source) => source.source_id === 'gelato-owned-website-purpose');
const websiteRevisions = {
  knowledge: websiteRead.body.state.knowledge_revision,
  record: websiteRead.body.state.record_revision
};
response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/website-usage', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: gelato.scope_key,
    source_id: websiteBefore.source_id,
    website_usage: { content: true, structure_reference: true, design_reference: false }
  })
}), env, {}, handlerOptions);
assert.equal(response.status, 200);
const usageResponse = await response.json();
assert.equal(usageResponse.ok, true);
assert.equal(usageResponse.source.source_id, websiteBefore.source_id);
assert.equal(usageResponse.source.locator, websiteBefore.locator);
assert.equal(usageResponse.source.storage_ref, websiteBefore.storage_ref);
assert.equal(usageResponse.source.content_hash, websiteBefore.content_hash);
assert.equal(usageResponse.source.version, websiteBefore.version);
assert.deepEqual(usageResponse.source.effective_usage, { content: true, structure_reference: true, design_reference: false });
assert.equal(usageResponse.variable_cost_eur, 0);
assert.equal(usageResponse.paid_provider_calls, 0);
assert.equal(usageResponse.production_deploy, false);

websiteRead = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
assert.equal(websiteRead.body.state.knowledge_revision, websiteRevisions.knowledge + 1);
assert.equal(websiteRead.body.state.record_revision, websiteRevisions.record + 1);
assert.equal(websiteRead.body.state.audit.at(-2)?.event === 'PROJECT_SOURCE_WEBSITE_USAGE_UPDATED' || websiteRead.body.state.audit.at(-1)?.event === 'PROJECT_SOURCE_WEBSITE_USAGE_UPDATED', true);

response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/website-usage', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: other.scope_key,
    source_id: websiteBefore.source_id,
    website_usage: { content: false, structure_reference: false, design_reference: true }
  })
}), env, {}, handlerOptions);
assert.equal(response.status, 404);

// // Controlled Gelato project facts are added explicitly and then packs/readiness are built. No website mission runs.
let read = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
let state = read.body.state;
const manual = intakeManualSource(state, {
  source_id: 'gelato-controlled-acceptance-facts',
  display_name: 'Gelato controlled acceptance facts',
  facts: [
    { fact_id: 'gelato-name', field_path: 'business.name', value: 'Gelato Donatello', verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'gelato-offerings', field_path: 'business.offerings', value: ['Eis', 'Eistorten'], verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'gelato-goal', field_path: 'website.primary_goal', value: 'Sortiment präsentieren und Anfragen ermöglichen', verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'gelato-summary', field_path: 'content.summary', value: 'Kontrollierter Gelato Source-Intake Acceptance-Fall.', verification_status: 'OPERATOR_CONFIRMED', critical: false }
  ]
});
assert.equal(manual.ok, true);
let saved = await service.saveProjectSourceIntake({ state: manual.state, expected_revision: read.body.runtime_revision, event: 'GELATO_CONTROLLED_SOURCE_FACTS_RECORDED' });
assert.equal(saved.ok, true);
read = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
const firstAsset = read.body.state.assets.find((asset) => asset.publishable === true);
assert.ok(firstAsset);
const packs = buildWorkspacePacksAndReadiness(read.body.state, { requires_assets: true, intended_asset_ids: [firstAsset.asset_id] }, { content_pack_id: 'gelato-storage-content-v1', visual_pack_id: 'gelato-storage-visual-v1', readiness_id: 'gelato-storage-readiness-v1' });
assert.equal(packs.ok, true);
assert.notEqual(packs.readiness.status, 'BLOCKED');
saved = await service.saveProjectSourceIntake({ state: packs.state, expected_revision: read.body.runtime_revision, event: 'GELATO_STORAGE_PACKS_READY' });
assert.equal(saved.ok, true);
const afterGelato = await store.load(operatorId);
const gelatoAfter = afterGelato.command_center_state.portfolio.projects.find((project) => project.scope_key === gelato.scope_key);
assert.equal(gelatoAfter.controlled_paid_staging.project_budget_ceiling_eur, 25);
assert.equal(gelatoAfter.controlled_paid_staging.current_spend_eur, 0);
assert.equal(gelatoAfter.controlled_paid_staging.reserved_eur, 0);
assert.equal((afterGelato.universal_runs || []).length, 0);

// Delete stays project scoped and removes binary while keeping a soft-delete audit trail in intake state.
read = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
const deleteTarget = read.body.state.sources.find((source) => source.storage_ref);
response = await handleOperatorDashboard(new Request('https://operator.example/operator/api/project-source-intake/object', {
  method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope_key: gelato.scope_key, source_id: deleteTarget.source_id })
}), env, {}, handlerOptions);
assert.equal(response.status, 200);
const deleted = await response.json();
assert.equal(deleted.project_scoped, true);
assert.equal(deleted.storage_deleted, true);
read = await service.getProjectSourceIntake({ scope_key: gelato.scope_key });
assert.ok(read.body.state.sources.find((source) => source.source_id === deleteTarget.source_id)?.deleted_at);

// Runtime rejects binary content even when called directly.
const poisoned = structuredClone(read.body.state);
poisoned.binary_data = new Uint8Array([1, 2, 3]);
const rejectedBinary = await service.saveProjectSourceIntake({ state: poisoned, expected_revision: read.body.runtime_revision });
assert.equal(rejectedBinary.ok, false);
assert.equal(rejectedBinary.body.error, 'PROJECT_SOURCE_RUNTIME_BINARY_DATA_REJECTED');

// Existing dashboard is extended, not replaced, and contains mobile/multi-file Source UI.
response = await handleOperatorDashboard(new Request('https://operator.example/operator'), env, {}, handlerOptions);
assert.equal(response.status, 200);
const html = await response.text();
assert.equal(html.includes('aurentara-project-source-storage-v1-ui'), true);
assert.equal(html.includes('type="file" multiple'), true);
assert.equal(html.includes('@media(max-width:760px)'), true);
assert.equal(html.includes('Bulk Rights'), true);
assert.equal(html.includes('Project Sources'), true);
assert.equal(html.includes('Website-Art'), true);
assert.equal(html.includes('data-source-use-content'), true);
assert.equal(html.includes('data-source-use-structure'), true);
assert.equal(html.includes('data-source-use-design'), true);
assert.equal(html.includes('data-website-usage-save'), true);
assert.equal(html.includes('Verwendung speichern'), true);
assert.equal(html.includes('data-source-download'), true);
assert.equal(html.includes('/project-source-intake/preview?scope_key='), true);
assert.equal(html.includes('Herunterladen'), true);
assert.equal(html.includes('data-source-manual-category'), true);
for (const label of ['Leistung / Angebot','Produkt','Preis','Öffnungszeiten','Telefon','E-Mail','Adresse','Beschreibung','Sonstige Information']) assert.equal(html.includes(label), true);
assert.equal(html.includes('Technischer Pfad:'), true);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-source-intake-storage-v1',
  private_bucket: true,
  public_access_denied: true,
  cross_project_read_denied: true,
  authenticated_private_preview: 'PASS',
  unauthenticated_preview_fail_closed: 'PASS',
  cross_project_preview_denied: 'PASS',
  image_preview_inline: 'PASS',
  pdf_preview_inline: 'PASS',
  unsafe_mime_download_only: 'PASS',
  response_mime_mismatch_fail_closed: 'PASS',
  explicit_download: 'PASS',
  manual_category_mapping: 'PASS',
  manual_verification_unchanged: 'PASS',
  cross_project_write_denied: true,
  invalid_scope_rejected: true,
  unsupported_mime_rejected: true,
  oversized_upload_rejected: true,
  unsafe_filename_sanitized: true,
  runtime_storage_ref_only: true,
  delete_project_scoped: true,
  mobile_upload_path: 'PASS',
  multi_image_upload: 'PASS',
  bulk_rights: 'PASS',
  website_purpose_update: 'PASS',
  website_purpose_identity_stability: 'PASS',
  website_purpose_cross_project_rejection: 'PASS',
  gelato_content_pack: packs.content_pack.version,
  gelato_visual_pack: packs.visual_pack.version,
  gelato_readiness: packs.readiness.status,
  gelato_budget_eur: 25,
  gelato_budget_consumed_eur: 0,
  website_mission_executed: false,
  paid_provider_calls: 0,
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
