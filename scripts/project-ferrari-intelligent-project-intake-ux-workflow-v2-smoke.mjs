import assert from 'node:assert/strict';

import {
  createProjectSourceIntakeState,
  registerProjectSource,
  upsertProjectFact,
  reviewProjectFact,
  updateProjectImagePurpose,
  createContentPack,
  PROJECT_IMAGE_PURPOSES
} from '../src/project-source-intake-v1.js';
import {
  intakeImageSource,
  intakeFileSource,
  intakeManualSource
} from '../src/project-source-workspace-intake-v1.js';
import {
  buildDeterministicProjectKnowledgeStructure,
  buildProjectKnowledgeReviewView,
  prepareProjectKnowledgeReview,
  approveProjectKnowledgeReview,
  knowledgeUseGate
} from '../src/project-source-knowledge-review-v1.js';
import { buildProjectSourceIntakeWorkspaceSections } from '../src/operator-project-source-intake-workspace-v1.js';
import {
  handleProjectIntakeUxV2Api,
  applyProjectIntakeUxV2,
  projectIntakeUxV2Manifest
} from '../src/operator-project-intake-ux-v2.js';

const scope = 'gelato-donatello:gelato-donatello-website-v1';
const identity = {
  operator_id: 'operator:ferrari-v2@example.test',
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: scope
};

const created = createProjectSourceIntakeState({ ...identity, at: '2026-09-05T20:10:00.000Z' });
assert.equal(created.ok, true);
let state = created.state;

// Scenario 1: an empty project cannot look approved.
let view = buildProjectKnowledgeReviewView(state);
assert.equal(view.status, 'NOT_STARTED');
assert.equal(view.stages.every((stage) => stage.complete === false), true);
assert.equal(view.source_count, 0);
assert.equal(view.gate.status, 'LEGACY_NOT_GATED');
assert.equal(view.gate.legacy_compatible, true);

// Scenarios 2-5: three image sources preserve three explicit purposes.
const imageRows = [
  ['src-menu-photo', 'asset-menu-photo', 'menu-screenshot.jpg', 'INFORMATION_EXTRACTION'],
  ['src-product-photo', 'asset-product-photo', 'gelato-product.jpg', 'VISUAL_USAGE'],
  ['src-flyer-photo', 'asset-flyer-photo', 'flyer.jpg', 'BOTH']
];
for (const [source_id, asset_id, filename, image_purpose] of imageRows) {
  const image = intakeImageSource(state, {
    source_id,
    asset_id,
    storage_ref: `private://gelato/${filename}`,
    filename,
    display_name: filename,
    mime_type: 'image/jpeg',
    ownership_status: 'CUSTOMER_ASSERTED',
    rights_status: 'CUSTOMER_ASSERTED',
    usage_role: 'PROJECT_VISUAL',
    image_purpose,
    publishable: true
  }, { at: '2026-09-05T20:11:00.000Z' });
  assert.equal(image.ok, true);
  assert.equal(image.source.image_purpose, image_purpose);
  assert.equal(image.asset.image_purpose, image_purpose);
  state = image.state;
}
assert.deepEqual([...PROJECT_IMAGE_PURPOSES], ['INFORMATION_EXTRACTION', 'VISUAL_USAGE', 'BOTH']);

// Scenario 6: a manual note is an ordinary source and remains unverified.
const note = intakeManualSource(state, {
  source_id: 'src-manual-note',
  display_name: 'Manuelle Information',
  ownership_status: 'CUSTOMER_ASSERTED',
  facts: [{
    fact_id: 'fact-manual-note',
    field_path: 'content.summary',
    value: 'Eisbecher Fantasimo jetzt neu auf der Karte',
    origin: 'MANUAL',
    verification_status: 'UNVERIFIED'
  }]
}, { at: '2026-09-05T20:12:00.000Z' });
assert.equal(note.ok, true);
assert.equal(note.source.source_type, 'MANUAL_INPUT');
assert.equal(note.source.source_metadata.manual_text, 'Eisbecher Fantasimo jetzt neu auf der Karte');
assert.equal(note.facts[0].verification_status, 'UNVERIFIED');
state = note.state;

// Scenario 7: text is available to the organizer without binary runtime data.
const text = intakeFileSource(state, {
  source_id: 'src-prices-text',
  storage_ref: 'private://gelato/prices.txt',
  filename: 'prices.txt',
  display_name: 'Preisliste Text',
  mime_type: 'text/plain',
  ownership_status: 'CUSTOMER_ASSERTED',
  extracted_text: 'Kugel Eis 1,60 EUR'
}, { at: '2026-09-05T20:13:00.000Z' });
assert.equal(text.ok, true);
assert.equal(text.source.source_metadata.text_content, 'Kugel Eis 1,60 EUR');
assert.equal(JSON.stringify(text.state).includes('base64'), false);
state = text.state;

// Scenario 14: conflicting values are preserved for human review.
let fact = upsertProjectFact(state, {
  fact_id: 'fact-price-a',
  field_path: 'business.pricing',
  value: 'Kugel Eis 1,60 €',
  origin: 'EXTRACTED',
  verification_status: 'UNVERIFIED',
  source_refs: ['src-prices-text']
}, { at: '2026-09-05T20:14:00.000Z' });
assert.equal(fact.ok, true);
state = fact.state;

let secondSource = registerProjectSource(state, {
  source_id: 'src-price-note-b',
  source_type: 'MANUAL_INPUT',
  locator: 'manual://price-b',
  display_name: 'Neue Preisnotiz',
  ownership_status: 'CUSTOMER_ASSERTED'
}, { at: '2026-09-05T20:14:01.000Z' });
assert.equal(secondSource.ok, true);
state = secondSource.state;

fact = upsertProjectFact(state, {
  fact_id: 'fact-price-b',
  field_path: 'business.pricing',
  value: 'Kugel Eis 1,80 €',
  origin: 'MANUAL',
  verification_status: 'UNVERIFIED',
  source_refs: ['src-price-note-b']
}, { at: '2026-09-05T20:14:02.000Z' });
assert.equal(fact.ok, true);
assert.equal(fact.conflict, true);
state = fact.state;
assert.equal(state.facts.filter((item) => item.field_path === 'business.pricing').every((item) => item.verification_status === 'SOURCE_CONFLICT'), true);

// Scenarios 8-10: prepare locks factories and review remains editable.
const structured = buildDeterministicProjectKnowledgeStructure(state);
assert.equal(structured.ok, true);
const prepared = prepareProjectKnowledgeReview(state, {
  ...structured,
  ai_used: true,
  provider: 'openai-api',
  model: 'test-model',
  notes: ['Preis-Konflikt muss human geklärt werden.']
}, { actor_id: identity.operator_id, at: '2026-09-05T20:15:00.000Z' });
assert.equal(prepared.ok, true);
state = prepared.state;
view = buildProjectKnowledgeReviewView(state);
assert.equal(view.status, 'IN_REVIEW');
assert.equal(view.gate.allowed, false);
assert.equal(view.conflict_count, 2);
assert.equal(createContentPack(state).error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');

// Scenarios 11 and 14: explicit confirmation and conflict resolution are mandatory.
let approval = approveProjectKnowledgeReview(state, {
  review_seen: true,
  approval_confirmed: false
}, { actor_id: identity.operator_id });
assert.equal(approval.ok, false);
assert.equal(approval.error, 'PROJECT_KNOWLEDGE_EXPLICIT_APPROVAL_REQUIRED');

approval = approveProjectKnowledgeReview(state, {
  review_seen: true,
  approval_confirmed: true
}, { actor_id: identity.operator_id });
assert.equal(approval.ok, false);
assert.equal(approval.error, 'PROJECT_KNOWLEDGE_CONFLICTS_MUST_BE_RESOLVED');

const resolved = reviewProjectFact(state, 'fact-price-a', {
  verification_status: 'OPERATOR_CONFIRMED',
  verified_by: identity.operator_id
}, { at: '2026-09-05T20:16:00.000Z' });
assert.equal(resolved.ok, true);
state = resolved.state;
assert.equal(state.facts.find((item) => item.fact_id === 'fact-price-a').verification_status, 'OPERATOR_CONFIRMED');
assert.equal(state.facts.find((item) => item.fact_id === 'fact-price-b').verification_status, 'REJECTED');
assert.equal(buildProjectKnowledgeReviewView(state).conflict_count, 0);

// Scenario 12: final human approval unlocks the existing gate.
approval = approveProjectKnowledgeReview(state, {
  review_seen: true,
  approval_confirmed: true
}, { actor_id: identity.operator_id, at: '2026-09-05T20:17:00.000Z' });
assert.equal(approval.ok, true);
state = approval.state;
assert.equal(state.knowledge_review.status, 'APPROVED');
assert.equal(knowledgeUseGate(state).allowed, true);
assert.equal(createContentPack(state, { at: '2026-09-05T20:17:01.000Z' }).ok, true);

// Scenario 13: a knowledge-relevant image purpose edit invalidates approval immediately.
const purposeChanged = updateProjectImagePurpose(state, 'src-product-photo', 'BOTH', { at: '2026-09-05T20:18:00.000Z' });
assert.equal(purposeChanged.ok, true);
assert.equal(purposeChanged.changed, true);
state = purposeChanged.state;
assert.equal(state.knowledge_review.status, 'CHANGES_PENDING');
assert.equal(state.knowledge_review.gate_active, true);
assert.equal(knowledgeUseGate(state).allowed, false);
assert.equal(createContentPack(state).error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');

// Legacy compatibility: legacy is readable until it enters the new review flow.
const legacyCreated = createProjectSourceIntakeState({
  operator_id: 'operator:legacy@example.test',
  customer_id: 'legacy-customer',
  project_id: 'legacy-project',
  scope_key: 'legacy-customer:legacy-project'
});
assert.equal(knowledgeUseGate(legacyCreated.state).status, 'LEGACY_NOT_GATED');

// V2 API uses the same durable state and invalidation contract.
let runtimeRevision = 40;
const service = {
  async getProjectSourceIntake({ scope_key }) {
    assert.equal(scope_key, scope);
    return { ok: true, status: 200, body: { state, identity, runtime_revision: runtimeRevision, persisted: true } };
  },
  async saveProjectSourceIntake(input) {
    assert.equal(input.expected_revision, runtimeRevision);
    state = structuredClone(input.state);
    runtimeRevision += 1;
    return { ok: true, status: 200, body: { runtime_revision: runtimeRevision } };
  }
};
const options = {
  runtime_service: service,
  authorize: async () => ({ ok: true, status: 200, operator_id: identity.operator_id, email: 'ferrari-v2@example.test' })
};

let response = await handleProjectIntakeUxV2Api(new Request('https://operator.example/operator/api/project-source-intake/image-purpose', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: scope,
    context_scope_key: scope,
    source_id: 'src-menu-photo',
    image_purpose: 'BOTH'
  })
}), {}, {}, options);
assert.equal(response.status, 200);
let body = await response.json();
assert.equal(body.ok, true);
assert.equal(body.source.image_purpose, 'BOTH');
assert.equal(body.factories_locked, true);

response = await handleProjectIntakeUxV2Api(new Request('https://operator.example/operator/api/project-source-intake/manual-note', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: scope,
    context_scope_key: scope,
    source_id: 'src-manual-note',
    fact_id: 'fact-manual-note',
    value: 'Eisbecher Fantasimo ab sofort auf der Karte'
  })
}), {}, {}, options);
assert.equal(response.status, 200);
body = await response.json();
assert.equal(body.ok, true);
assert.equal(state.facts.find((item) => item.fact_id === 'fact-manual-note').value, 'Eisbecher Fantasimo ab sofort auf der Karte');
assert.equal(state.sources.find((item) => item.source_id === 'src-manual-note').source_metadata.manual_text, 'Eisbecher Fantasimo ab sofort auf der Karte');

// Workspace keeps raw sources and structured knowledge visually distinct.
const workspace = buildProjectSourceIntakeWorkspaceSections(state);
assert.equal(workspace.sections.project_sources.length >= 6, true);
assert.equal(workspace.sections.project_knowledge.length >= 2, true);
assert.equal(workspace.knowledge_review.status, 'CHANGES_PENDING');

// Scenarios 2, 3, 4, 15, 16, 17: UI contract contains previews, progress, partial failure, thumbnails and responsive layout.
const baseHtml = '<!doctype html><html><body><div class="card source-intake-v1" data-project-source-intake="true" data-scope="' + scope + '><div class="source-upload-grid"></div><div data-source-status></div><div class="source-cards" data-source-cards></div></div><script id="aurentara-project-source-storage-v1-ui"></script></body></html>';
const enhanced = await applyProjectIntakeUxV2(new Response(baseHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
const html = await enhanced.text();
assert.equal(enhanced.headers.get('x-aurentara-project-intake-ux'), 'v2');
assert.match(html, /WÄSCHEKORB/);
assert.match(html, /Zusätzliche Information \/ Notiz/);
assert.match(html, /source-selection-thumb/);
assert.match(html, /data-v2-progress/);
assert.match(html, /Wird hochgeladen/);
assert.match(html, /Erfolgreiche Dateien bleiben gespeichert/);
assert.match(html, /source-card-v2-media/);
assert.match(html, /data-v2-purpose/);
assert.match(html, /@media\(max-width:760px\)/);
assert.match(html, /aria-live="polite"/);
assert.match(html, /Mit KI aufbereiten/);
assert.match(html, /Für Ferrari freigeben/);

const manifest = projectIntakeUxV2Manifest();
assert.equal(manifest.existing_source_registry_reused, true);
assert.equal(manifest.existing_asset_registry_reused, true);
assert.equal(manifest.existing_knowledge_review_reused, true);
assert.equal(manifest.existing_approval_engine_reused, true);
assert.equal(manifest.sequential_upload_requests, true);
assert.equal(manifest.per_file_progress, true);
assert.equal(manifest.partial_failure_preserves_success, true);
assert.equal(manifest.direct_image_thumbnails, true);
assert.equal(manifest.no_automatic_paid_ai_call, true);
assert.equal(manifest.dashboard_redesign, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-ferrari-intelligent-project-intake-ux-workflow-v2',
  source_basket_ux: 'PASS',
  multi_file_upload_feedback: 'PASS',
  upload_progress: 'PASS',
  image_preview_cards: 'PASS',
  image_purpose_classification: 'PASS',
  direct_manual_note_input: 'PASS',
  ai_structuring_gate: 'PASS',
  editable_human_review: 'PASS',
  conflict_handling: 'PASS',
  explicit_final_approval: 'PASS',
  approval_invalidation: 'PASS',
  factory_usage_lock: 'PASS',
  mobile_desktop_contract: 'PASS',
  legacy_compatibility: 'PASS',
  production_deploy: false,
  external_writes: false
}, null, 2));
